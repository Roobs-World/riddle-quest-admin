import {randomBytes} from "node:crypto";
import {Timestamp} from "firebase-admin/firestore";
import type {DecodedIdToken} from "firebase-admin/auth";
import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {AccountPushDevice, managerRegistrationAcknowledged, renewPairedBrowserDevice} from "./notificationDevices";
import {FirebasePushTarget} from "../../../src/notifications/contracts/firebasePush";
import {admin} from "../shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef, runWithJestAccountOperationLease} from "../shared/accountDeletion";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {raceProviderScope} from "../race/access/raceProviderScope";
import {validateCallableRequest} from "../validation/callableValidation";
import {managerOrigin, notificationBridgeSecret, pushDigest} from "./notificationBridge";

const Enrollment = z.object({locale: z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/u).max(16)}).strict();

function enrollmentTarget(uid: string, claims: DecodedIdToken, profile: unknown): string {
  const scope = raceProviderScope(uid);
  const account = z.object({provider: z.string().optional(), androidProvider: z.string().optional()}).parse(profile);
  if (scope === "jest" && claims.jestRegistered === true) return "jest";
  if ((scope === "facebook" || scope === "reddit") && claims.provider === scope) return scope;
  if (scope === "android" && ["anonymous", "google.com"].includes(claims.firebase.sign_in_provider) &&
      ["anonymous", "google.com"].includes(account.androidProvider ?? "")) return "android";
  const provider = FirebasePushTarget.safeParse(claims.provider);
  if (provider.success && account.provider === provider.data) return provider.data;
  if (["password", "google.com", "apple.com", "microsoft.com"].includes(claims.firebase.sign_in_provider)) return "web";
  throw new HttpsError("permission-denied", "Registered game account required.");
}

export const createNotificationEnrollment = onCallWithSentry("createNotificationEnrollment", {
  ...browserCallableSecurityOptions, region: "europe-west1",
}, async request => {
  const {locale} = validateCallableRequest(Enrollment, request.data, "createNotificationEnrollment");
  const auth = request.auth;
  if (!auth) throw new HttpsError("permission-denied", "Registered game account required.");
  const uid = auth.uid, origin = managerOrigin();
  return runWithJestAccountOperationLease(uid, 60, async () => {
    const db = admin.firestore(), now = Date.now(), expiresAtMs = now + 10 * 60_000;
    const pairingCode = randomBytes(32).toString("hex");
    await db.runTransaction(async tx => {
      const limitRef = db.doc(`notificationPairingLimits/${uid}`);
      const [user, deleted, limit] = await Promise.all([tx.get(db.doc(`users/${uid}`)), tx.get(getJestAccountDeletionRef(db, uid)), tx.get(limitRef)]);
      assertJestAccountActive(deleted);
      if (!user.exists || user.data()?.notificationsEnabled === false) throw new HttpsError("failed-precondition", "Enable notifications in Settings first.");
      const target = FirebasePushTarget.parse(enrollmentTarget(uid, auth.token, user.data()));
      const previous = limit.data(), sameWindow = typeof previous?.windowStartMs === "number" && previous.windowStartMs > now - 3_600_000;
      const count = sameWindow && typeof previous?.count === "number" ? previous.count : 0;
      if (count >= 10) throw new HttpsError("resource-exhausted", "Too many notification setup requests. Try again later.");
      tx.set(limitRef, {uid, windowStartMs: sameWindow ? previous?.windowStartMs : now, count: count + 1, expiresAt: Timestamp.fromMillis(now + 86_400_000)});
      tx.create(db.doc(`notificationPairings/${pushDigest(pairingCode)}`), {uid, target, locale, createdAtMs: now, expiresAtMs,
        expiresAt: Timestamp.fromMillis(expiresAtMs)});
    });
    return {url: `${origin}/push/#pair=${pairingCode}`, expiresAtMs};
  });
});

const EnrollmentStatus = z.object({pairingCode: z.string().regex(/^[a-f0-9]{64}$/u).optional()}).strict();

export const getNotificationEnrollmentStatus = onCallWithSentry("getNotificationEnrollmentStatus", {
  ...browserCallableSecurityOptions, region: "europe-west1", secrets: [notificationBridgeSecret],
}, async request => {
  const input = validateCallableRequest(EnrollmentStatus, request.data, "getNotificationEnrollmentStatus");
  const auth = request.auth;
  if (!auth) throw new HttpsError("permission-denied", "Registered game account required.");
  const uid = auth.uid;
  return runWithJestAccountOperationLease(uid, 60, async () => {
    const db = admin.firestore();
    const [user, deleted] = await Promise.all([db.doc(`users/${uid}`).get(), getJestAccountDeletionRef(db, uid).get()]);
    assertJestAccountActive(deleted);
    if (!user.exists || user.data()?.notificationsEnabled === false) return {registeredDevices: 0, enrollmentComplete: false};
    enrollmentTarget(uid, auth.token, user.data());
    if (input.pairingCode) await renewPairedBrowserDevice(uid, input.pairingCode);
    let registeredDevices = 0;
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    for (;;) {
      let query = db.collection("accountPushDevices").where("uid", "==", uid).orderBy(admin.firestore.FieldPath.documentId()).limit(200);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      for (const row of page.docs) {
        const device = AccountPushDevice.safeParse(row.data());
        if (device.success && device.data.uid === uid && device.data.enabled && managerRegistrationAcknowledged(device.data) && device.data.expiresAtMs > Date.now()) registeredDevices += 1;
      }
      if (page.docs.length < 200) break;
      cursor = page.docs.at(-1);
    }
    let enrollmentComplete = false;
    if (input.pairingCode) {
      const pairing = (await db.doc(`notificationPairings/${pushDigest(input.pairingCode)}`).get()).data();
      if (pairing?.uid === uid && typeof pairing.deviceHash === "string" && /^[a-f0-9]{64}$/u.test(pairing.deviceHash)) {
        const device = AccountPushDevice.safeParse((await db.doc(`accountPushDevices/${pairing.deviceHash}`).get()).data());
        enrollmentComplete = device.success && device.data.uid === uid && device.data.enabled && managerRegistrationAcknowledged(device.data) && device.data.expiresAtMs > Date.now();
      }
    }
    return {registeredDevices, enrollmentComplete};
  });
});
