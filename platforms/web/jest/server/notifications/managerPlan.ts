import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import type {DocumentSnapshot} from "firebase-admin/firestore";
import {admin} from "../../../../../firebase-functions/src/shared/firebaseAdmin";
import {browserCallableSecurityOptions} from "../../../../../firebase-functions/src/shared/callableSecurity";
import {onCallWithSentry} from "../../../../../firebase-functions/src/shared/sentryHandlers";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../../../../../firebase-functions/src/shared/accountDeletion";
import {validateCallableRequest} from "../../../../../firebase-functions/src/validation/callableValidation";
import {managerOrigin, notificationBridgeSecret, pushDigest} from "../../../../../firebase-functions/src/notifications/notificationBridge";
import {isJestFirebaseUid} from "../jestSecurity";
import {JestNotificationPlan, JestRegistration} from "../../src/notifications/managerProtocol";

const DAY_MS = 86_400_000;

function accountRevision(snapshot: DocumentSnapshot): number {
  if (!snapshot.updateTime) throw new HttpsError("not-found", "Account unavailable.");
  return snapshot.updateTime.seconds * 1_000_000 + Math.floor(snapshot.updateTime.nanoseconds / 1_000);
}

async function readPlan(response: Response): Promise<JestNotificationPlan> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpsError(response.status === 409 ? "aborted" : "unavailable", "Notification plan unavailable.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new HttpsError("unavailable", "Notification plan unavailable.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        throw new HttpsError("unavailable", "Notification plan unavailable.");
      }
      chunks.push(next.value);
    }
  } finally {reader.releaseLock();}
  const bytes = Buffer.concat(chunks);
  return JestNotificationPlan.parse(JSON.parse(bytes.toString("utf8")));
}

/** Only verified registered accounts receive a manager-authored SDK schedule. */
export const getJestNotificationPlan = onCallWithSentry("getJestNotificationPlan", {
  ...browserCallableSecurityOptions, region: "europe-west1", secrets: [notificationBridgeSecret],
}, async request => {
  validateCallableRequest(z.object({}).strict(), request.data, "getJestNotificationPlan");
  const uid = request.auth?.uid;
  if (!uid || !isJestFirebaseUid(uid) || request.auth?.token.jestRegistered !== true) {
    throw new HttpsError("permission-denied", "Registered Jest account required.");
  }
  const db = admin.firestore();
  const userRef = db.doc(`users/${uid}`);
  const deletionRef = getJestAccountDeletionRef(db, uid);
  const [user, deleted] = await db.getAll(userRef, deletionRef);
  assertJestAccountActive(deleted);
  if (!user.exists) throw new HttpsError("not-found", "Account unavailable.");
  const registration = JestRegistration.parse({
    version: 1, recipientHash: pushDigest(`jest:${uid}`), revision: accountRevision(user),
    enabled: user.get("notificationsEnabled") === true, locale: "en", expiresAtMs: Date.now() + 30 * DAY_MS,
  });
  const response = await fetch(`${managerOrigin()}/api/devices/jest/registration`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: {"Content-Type": "application/json", Authorization: `Bearer ${notificationBridgeSecret.value()}`},
    body: JSON.stringify(registration),
  });
  const plan = await readPlan(response);
  if (plan.revision !== registration.revision || plan.enabled !== registration.enabled ||
      plan.installationId !== pushDigest(`jest:${registration.recipientHash}`) ||
      (plan.enabled && plan.expiresAtMs <= Date.now())) {
    throw new HttpsError("aborted", "Notification preference changed. Try again.");
  }
  const [current, currentDeletion] = await db.getAll(userRef, deletionRef);
  assertJestAccountActive(currentDeletion);
  // Unrelated gameplay writes may advance the account revision while consent remains unchanged.
  if (!current.exists || (current.get("notificationsEnabled") === true) !== registration.enabled) {
    throw new HttpsError("aborted", "Notification preference changed. Try again.");
  }
  return plan;
});
