import {FieldValue, type DocumentData, type DocumentSnapshot, type Firestore, type Transaction} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {pushDigest} from "../../../../../firebase-functions/src/notifications/notificationBridge";
import {isFacebookFirebaseUid} from "../facebookSecurity";
import {FacebookRegistration} from "./managerProtocol";

/** A Settings opt-in is tied to one signed Facebook account generation. */
const Consent = z.object({
  policy: z.literal("a2u-v1"), generation: z.number().int().positive(), locale: z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/u),
  expiresAtMs: z.number().int().positive().safe(),
}).strict();
const DAY_MS = 86_400_000;

/** Only the signed identity exchange establishes the private Meta recipient address. */
export function facebookRouteIdentity(snapshot: DocumentSnapshot) {
  const data = snapshot.data();
  if (!data || data.provider !== "facebook" || data.status !== "active" || data.appId !== process.env.FACEBOOK_APP_ID ||
      typeof data.appId !== "string" || !/^\d{5,30}$/u.test(data.appId) || typeof data.providerPlayerId !== "string" ||
      !/^[A-Za-z0-9_-]{1,256}$/u.test(data.providerPlayerId) || !isFacebookFirebaseUid(data.uid) ||
      !Number.isSafeInteger(data.accountGeneration) || data.accountGeneration < 1 ||
      pushDigest(`${data.appId}\0${data.providerPlayerId}`) !== snapshot.id) return null;
  return {appId: data.appId as string, playerId: data.providerPlayerId, uid: data.uid as string, generation: data.accountGeneration as number};
}

/** Firestore commit timestamps preserve ordering even for multiple writes in one millisecond. */
function registrationRevision(snapshot: DocumentSnapshot): number {
  if (!snapshot.updateTime) throw new Error("facebook-registration-time-unavailable");
  return snapshot.updateTime.seconds * 1_000_000 + Math.floor(snapshot.updateTime.nanoseconds / 1_000);
}

/** Builds an opaque registration. Deletion and generation changes invalidate prior consent. */
export function facebookRegistration(snapshot: DocumentSnapshot, previous?: DocumentSnapshot): FacebookRegistration | null {
  const stored = snapshot.get("managerNotificationConsent");
  if (!stored && !previous?.get("managerNotificationConsent")) return null;
  const consent = Consent.safeParse(stored);
  const identity = facebookRouteIdentity(snapshot);
  const enabled = consent.success && !!identity && consent.data.generation === identity.generation;
  const revision = snapshot.exists ? registrationRevision(snapshot) : registrationRevision(previous!) + 1;
  return {version: 1, recipientHash: snapshot.id, revision, enabled,
    locale: consent.success ? consent.data.locale : "en", expiresAtMs: enabled ? consent.data.expiresAtMs : 0};
}

/** Updates permission and renewal alongside the master preference in the same transaction. */
export async function writeFacebookConsent(db: Firestore, tx: Transaction, uid: string, generation: unknown,
  user: DocumentData, enabled: boolean, explicitConsent: boolean): Promise<boolean> {
  const matches = await tx.get(db.collection("providerIdentities").where("uid", "==", uid).limit(2));
  const snapshot = matches.size === 1 ? matches.docs[0] : undefined;
  const identity = snapshot && facebookRouteIdentity(snapshot);
  if (!snapshot || !identity || identity.uid !== uid || identity.generation !== generation) {
    if (!enabled) return false;
    throw new HttpsError("failed-precondition", "Facebook identity unavailable.");
  }
  const previous = Consent.safeParse(snapshot.get("managerNotificationConsent"));
  const retained = previous.success && previous.data.generation === identity.generation;
  if (!enabled || (!explicitConsent && !retained)) {
    if (snapshot.get("managerNotificationConsent")) tx.update(snapshot.ref, {managerNotificationConsent: FieldValue.delete()});
    return false;
  }
  const locale = Consent.shape.locale.safeParse(user.preferredLanguage);
  const desiredLocale = locale.success ? locale.data : "en";
  const now = Date.now();
  if (!retained || previous.data.locale !== desiredLocale || previous.data.expiresAtMs <= now + 7 * DAY_MS) {
    tx.update(snapshot.ref, {managerNotificationConsent: {policy: "a2u-v1", generation: identity.generation,
      locale: desiredLocale, expiresAtMs: now + 30 * DAY_MS}});
  }
  return true;
}
