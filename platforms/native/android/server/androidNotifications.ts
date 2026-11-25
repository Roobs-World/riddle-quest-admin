import {createHash} from "node:crypto";
import {Timestamp, type Firestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {gameplayInteractiveCallableOptions} from "../../../../firebase-functions/src/shared/gameplayCallableOptions";
import {onCallWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {validateCallableRequest} from "../../../../firebase-functions/src/validation/callableValidation";
import {assertJestAccountActive, getJestAccountDeletionRef, runWithJestAccountOperationLease} from "../../../../firebase-functions/src/shared/accountDeletion";
import {isAndroidAccountProvider} from "./androidUser";
import {sendFcmNotification} from "../../../../firebase-functions/src/notifications/fcmEdgeDelivery";

import {notificationManagerBridgeSecret, synchronizeAndroidRegistration} from "./notifications/androidNotificationBridge";
import type {AndroidRegistration} from "./notificationManagerProtocol";

const Token = z.string().min(20).max(4096).regex(/^[A-Za-z0-9_:.-]+$/);
const Locale = z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/u).max(16);
const Owner = z.string().min(1).max(128);
const DeviceEpoch = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const Subscription = z.union([
  z.object({enabled: z.literal(true), token: Token, locale: Locale, expectedOwnerId: Owner, deviceEpoch: DeviceEpoch, deviceId: z.uuid(), preferenceFromSettings: z.boolean()}).strict(),
  z.object({enabled: z.literal(false), token: Token, expectedOwnerId: Owner, deviceEpoch: DeviceEpoch, deviceId: z.uuid(), preferenceFromSettings: z.boolean()}).strict(),
  z.object({enabled: z.boolean(), expectedOwnerId: Owner, deviceEpoch: DeviceEpoch, deviceId: z.uuid(), preferenceFromSettings: z.boolean()}).strict(),
  z.object({token: Token, invitations: z.boolean(), daily: z.boolean(), locale: Locale}).strict()
    .transform(input => ({...input, enabled: input.invitations || input.daily, expectedOwnerId: undefined})),
]);

/** Only this opaque hash, never a raw token or account id, is shared with the manager. */
export const androidPushTokenHash = (token: string): string => createHash("sha256").update(token).digest("hex");
const revisionAfter = (previous: unknown, nowMs: number): number =>
  Math.max(nowMs, typeof previous === "number" && Number.isSafeInteger(previous) ? previous + 1 : 0);

/** Authenticated game identity remains authoritative for preference and token ownership. */
export const setAndroidPushSubscription = onCallWithSentry("setAndroidPushSubscription", {
  ...gameplayInteractiveCallableOptions, secrets: [notificationManagerBridgeSecret],
}, async request => {
  const input = validateCallableRequest(Subscription, request.data, "setAndroidPushSubscription");
  const uid = request.auth?.uid;
  if (!uid || !isAndroidAccountProvider(request.auth?.token.firebase?.sign_in_provider) ||
      input.expectedOwnerId && input.expectedOwnerId !== uid) throw new HttpsError("permission-denied", "Android account required.");
  return runWithJestAccountOperationLease(uid, 30, async () => {
    const db = admin.firestore(), nowMs = Date.now();
    const ref = "token" in input && (input.enabled || input.expectedOwnerId !== undefined)
      ? db.doc(`androidPushTokens/${androidPushTokenHash(input.token)}`) : null;
    const deviceRef = "deviceId" in input ? db.doc(`androidNotificationDevices/${input.deviceId}`) : null;
    const commandDigest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const committed = await db.runTransaction(async tx => {
      const [user, deleted, current, owned, device] = await Promise.all([
        tx.get(db.doc(`users/${uid}`)), tx.get(getJestAccountDeletionRef(db, uid)),
        ref ? tx.get(ref) : Promise.resolve(null), tx.get(db.collection("androidPushTokens").where("uid", "==", uid).limit(6)),
        deviceRef ? tx.get(deviceRef) : Promise.resolve(null),
      ]);
      assertJestAccountActive(deleted);
      if (!user.exists || !isAndroidAccountProvider(user.data()?.androidProvider)) throw new HttpsError("not-found", "Android account unavailable.");
      const previousDevice = device?.data();
      const previousHash = typeof previousDevice?.tokenHash === "string" && /^[a-f0-9]{64}$/.test(previousDevice.tokenHash) ? previousDevice.tokenHash : null;
      const oldTokenRef = ref && previousHash && previousHash !== ref.id ? db.doc(`androidPushTokens/${previousHash}`) : null;
      const oldToken = oldTokenRef ? await tx.get(oldTokenRef) : null;
      const retired: AndroidRegistration[] = [];
      if (deviceRef && "deviceEpoch" in input) {
        if (typeof previousDevice?.deviceEpoch === "number" && (input.deviceEpoch < previousDevice.deviceEpoch ||
            input.deviceEpoch === previousDevice.deviceEpoch && (previousDevice.uid !== uid || previousDevice.commandDigest !== commandDigest)))
          throw new HttpsError("failed-precondition", "Notification device operation superseded.");
        tx.set(deviceRef, {uid, deviceEpoch: input.deviceEpoch, commandDigest, updatedAtMs: nowMs,
          ...(ref ? {tokenHash: ref.id} : previousHash ? {tokenHash: previousHash} : {}),
          expiresAt: Timestamp.fromMillis(nowMs + 30 * 86_400_000)});
      }
      const previous = current?.data();
      if (ref && "deviceEpoch" in input && typeof previous?.deviceEpoch === "number") {
        if (input.deviceEpoch < previous.deviceEpoch || input.deviceEpoch === previous.deviceEpoch && previous.uid !== uid)
          throw new HttpsError("failed-precondition", "Notification operation superseded.");
        if (input.deviceEpoch === previous.deviceEpoch && previous.uid === uid) {
          const enabled = previous.enabled === true && user.data()?.notificationsEnabled !== false;
          return {enabled, revision: previous.revision, registrations: [{version: 1, tokenHash: ref.id, revision: previous.revision,
            enabled: enabled && previous.managerCampaigns === true, locale: Locale.parse(previous.locale),
            expiresAtMs: previous.expiresAt.toMillis()} satisfies AndroidRegistration]};
        }
      } else if (input.enabled && previous?.managerCampaigns === true && !("deviceEpoch" in input)) {
        throw new HttpsError("failed-precondition", "Notification application update required.");
      }
      const explicitPreference = "preferenceFromSettings" in input && input.preferenceFromSettings;
      const legacyOff = input.expectedOwnerId === undefined && !input.enabled;
      const masterEnabled = explicitPreference ? input.enabled : legacyOff ? false : user.data()?.notificationsEnabled !== false;
      const enabled = input.enabled && masterEnabled;
      if (explicitPreference || legacyOff) tx.update(user.ref, {notificationsEnabled: masterEnabled});
      if (oldTokenRef && oldToken?.exists && oldToken.data()?.deviceId === ("deviceId" in input ? input.deviceId : undefined)) {
        const old = oldToken.data(), locale = Locale.safeParse(old?.locale);
        tx.delete(oldTokenRef);
        retired.push({version: 1, tokenHash: oldTokenRef.id, revision: revisionAfter(old?.revision, nowMs), enabled: false,
          locale: locale.success ? locale.data : "en", expiresAtMs: nowMs});
      }
      if (!enabled) {
        const revokeAccount = explicitPreference || legacyOff || !masterEnabled;
        const registrations = [...retired, ...owned.docs.filter(row => row.id !== ref?.id && row.id !== retired[0]?.tokenHash && revokeAccount).map(row => {
          const entry = row.data(), revision = revisionAfter(entry.revision, nowMs), locale = Locale.safeParse(entry.locale);
          tx.update(row.ref, {enabled: false, revision, updatedAtMs: nowMs});
          return {version: 1, tokenHash: row.id, revision, enabled: false, locale: locale.success ? locale.data : "en", expiresAtMs: nowMs} satisfies AndroidRegistration;
        })];
        if (ref && "deviceEpoch" in input && "token" in input) {
          const revision = revisionAfter(previous?.revision, nowMs), locale = Locale.safeParse(previous?.locale);
          tx.set(ref, {uid, token: input.token, enabled: false, managerCampaigns: true, deviceEpoch: input.deviceEpoch, deviceId: input.deviceId,
            revision, locale: locale.success ? locale.data : "en", updatedAtMs: nowMs, expiresAt: Timestamp.fromMillis(nowMs + 30 * 86_400_000)});
          registrations.push({version: 1, tokenHash: ref.id, revision, enabled: false, locale: locale.success ? locale.data : "en", expiresAtMs: nowMs});
        }
        return {enabled: false, revision: 0, registrations};
      }
      if (!ref || !("token" in input) || !("locale" in input)) return {enabled: true, revision: 0, registrations: retired};
      const retainedDevices = owned.docs.filter(row => row.id !== retired[0]?.tokenHash).length;
      if (retainedDevices > 5 || previous?.uid !== uid && retainedDevices >= 5) throw new HttpsError("resource-exhausted", "Too many notification devices.");
      const revision = revisionAfter(Math.max(typeof previous?.revision === "number" ? previous.revision : 0, ...retired.map(row => row.revision)), nowMs), expiresAtMs = nowMs + 30 * 86_400_000;
      const managerCampaigns = input.expectedOwnerId !== undefined;
      tx.set(ref, {uid, token: input.token, locale: input.locale, enabled: true, managerCampaigns, revision,
        ...("deviceEpoch" in input ? {deviceEpoch: input.deviceEpoch, deviceId: input.deviceId} : {}), updatedAtMs: nowMs, expiresAt: Timestamp.fromMillis(expiresAtMs)});
      return {enabled: true, revision, registrations: [...retired, {version: 1, tokenHash: ref.id, revision, enabled: managerCampaigns, locale: input.locale, expiresAtMs} satisfies AndroidRegistration]};
    });
    const synchronized = await Promise.allSettled(committed.registrations.map(synchronizeAndroidRegistration));
    if (!committed.enabled) return {enabled: false, delivery: "inactive", registrationRevision: 0};
    if (!committed.registrations.length) return {enabled: true, delivery: "permission-required", registrationRevision: 0};
    if (synchronized.some(result => result.status === "rejected")) throw new HttpsError("unavailable", "Notification service unavailable.");
    return {enabled: true, registrationRevision: committed.revision,
      delivery: synchronized.every(result => result.status === "fulfilled" && result.value) ? "ready" : "not-configured"};
  });
});

/** Sends only to a fresh token whose current owner and consent still match. */
export async function sendAndroidPush(
  db: Firestore,
  tokenId: string,
  uid: string,
  data: Record<string, string>,
  consent: "invitations" | "daily" | "campaign",
  ttlMs: number,
  expectedRevision?: number,
): Promise<boolean> {
  if (ttlMs <= 0) return false;
  /** Private Firestore reference used by this authority or replay scenario. */
  const ref = db.doc(`androidPushTokens/${tokenId}`);
  /** Current token ownership, live account and permanent deletion boundary. */
  const [registration, account, deleted] = await Promise.all([
    ref.get(),
    db.doc(`users/${uid}`).get(),
    getJestAccountDeletionRef(db, uid).get(),
  ]);
  /** Current server-owned provider registration or immutable referral ownership. */
  const binding = registration.data();
  if (
    !binding ||
    binding.uid !== uid ||
    (consent === "campaign" ? binding.enabled !== true || binding.managerCampaigns !== true : binding.enabled !== true && binding[consent] !== true) ||
    (expectedRevision !== undefined && binding.revision !== expectedRevision) ||
    binding.updatedAtMs < Date.now() - 30 * 86_400_000 ||
    typeof binding.token !== "string" ||
    !account.exists ||
    account.data()?.notificationsEnabled === false ||
    deleted.exists ||
    !isAndroidAccountProvider(account.data()?.androidProvider)
  )
    return false;
  try {
    if (consent === "campaign") {
      return await sendFcmNotification({version: 1, transport: "android", token: binding.token,
        expiresAtMs: Number(data.expiresAtMs), data: {...data, accountId: uid}});
    }
    await getMessaging().send({
      token: binding.token,
      data: {...data, accountId: uid},
      android: {
        priority: consent === "invitations" ? "high" : "normal",
        ttl: Math.max(0, ttlMs),
        collapseKey: data.kind,
      },
    });
    return true;
  } catch (error) {
    /** Bounded provider error identifier used to retire invalid tokens. */
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      await db.runTransaction(async (tx) => {
        /** Current row rechecked before conditional token removal. */
        const latest = await tx.get(ref);
        if (latest.data()?.uid === uid && latest.data()?.token === binding.token) tx.delete(ref);
      });
    }
    throw error;
  }
}

/** Delivers invitation work through at most five current native installations. */
export async function sendAndroidLiveChallengePush(
  db: Firestore,
  input: {
    /** Authenticated game account that owns this operation. */
    uid: string;
    /** Opaque canonical private-lobby handle. */
    challengeId: string;
    /** Manager-authored notification headline supplied by a trusted dispatcher. */
    title: string;
    /** Manager-authored notification text supplied by a trusted dispatcher. */
    body: string;
    /** Server-owned expiration of the opaque entry or notification. */
    expiresAtMs: number;
  },
): Promise<"submitted" | "skipped" | "unconfirmed"> {
  /** At most five current native installations owned by this account. */
  const registrations = await db.collection("androidPushTokens").where("uid", "==", input.uid).limit(5).get();
  if (registrations.empty) return "skipped";
  /** Provider outcomes kept separate from actual delivery to the player. */
  const outcomes = await Promise.allSettled(
    registrations.docs.map((row) =>
      sendAndroidPush(
        db,
        row.id,
        input.uid,
        {
          kind: "liveChallenge",
          challengeId: input.challengeId,
          title: input.title,
          body: input.body,
          expiresAtMs: String(input.expiresAtMs),
        },
        "invitations",
        input.expiresAtMs - Date.now(),
      ),
    ),
  );
  return outcomes.some((result) => result.status === "fulfilled" && result.value)
    ? "submitted"
    : outcomes.some((result) => result.status === "rejected")
      ? "unconfirmed"
      : "skipped";
}
