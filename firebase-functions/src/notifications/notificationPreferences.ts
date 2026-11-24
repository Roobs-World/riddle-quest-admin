import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest} from "../validation/callableValidation";
import {assertJestAccountActive, getJestAccountDeletionRef, runWithJestAccountOperationLease} from "../shared/accountDeletion";
import {raceProviderScope} from "../race/access/raceProviderScope";

const Preference = z.object({enabled: z.boolean()}).strict();

/** Saves the authenticated player's master preference without granting provider permission. */
export const setNotificationPreference = onCallWithSentry("setNotificationPreference", {
  ...browserCallableSecurityOptions, region: "europe-west1",
}, async request => {
  const {enabled} = validateCallableRequest(Preference, request.data, "setNotificationPreference");
  const uid = request.auth?.uid;
  const scope = uid ? raceProviderScope(uid) : undefined;
  if (!uid || !((scope === "jest" && request.auth?.token.jestRegistered === true) ||
      (scope === "facebook" && request.auth?.token.provider === "facebook"))) {
    throw new HttpsError("permission-denied", "Registered game account required.");
  }
  await runWithJestAccountOperationLease(uid, 30, async () => {
    const db = admin.firestore();
    await db.runTransaction(async tx => {
      const userRef = db.doc(`users/${uid}`);
      const [user, deleted] = await Promise.all([tx.get(userRef), tx.get(getJestAccountDeletionRef(db, uid))]);
      assertJestAccountActive(deleted);
      if (!user.exists) throw new HttpsError("not-found", "Account unavailable.");
      tx.update(userRef, {notificationsEnabled: enabled});
    });
  });
  return {enabled};
});
