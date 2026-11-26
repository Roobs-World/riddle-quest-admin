import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest} from "../validation/callableValidation";
import {assertJestAccountActive, getJestAccountDeletionRef, runWithJestAccountOperationLease} from "../shared/accountDeletion";
import {raceProviderScope} from "../race/access/raceProviderScope";
import {isFacebookFeatureEnabled} from "../../../platforms/web/facebook/server/facebookFeatureFlags";

const Preference = z.union([z.object({enabled: z.boolean()}).strict(), z.object({initialize: z.literal(true)}).strict()]);

/** Saves the authenticated player's master preference without granting provider permission. */
export const setNotificationPreference = onCallWithSentry("setNotificationPreference", {
  ...browserCallableSecurityOptions, region: "europe-west1",
}, async request => {
  const input = validateCallableRequest(Preference, request.data, "setNotificationPreference");
  const uid = request.auth?.uid;
  const scope = uid ? raceProviderScope(uid) : undefined;
  if (!uid || !((scope === "jest" && request.auth?.token.jestRegistered === true) ||
      (scope === "facebook" && request.auth?.token.provider === "facebook"))) {
    throw new HttpsError("permission-denied", "Registered game account required.");
  }
  if (scope === "facebook" && ("initialize" in input || input.enabled) && !isFacebookFeatureEnabled("notifications")) {
    throw new HttpsError("failed-precondition", "Notifications are unavailable.");
  }
  const enabled = await runWithJestAccountOperationLease(uid, 30, async () => {
    const db = admin.firestore();
    return db.runTransaction(async tx => {
      const userRef = db.doc(`users/${uid}`);
      const [user, deleted] = await Promise.all([tx.get(userRef), tx.get(getJestAccountDeletionRef(db, uid))]);
      assertJestAccountActive(deleted);
      if (!user.exists) throw new HttpsError("not-found", "Account unavailable.");
      const saved = user.get("notificationsEnabled");
      if ("initialize" in input && saved !== undefined) return saved === true;
      const desired = "enabled" in input ? input.enabled : true;
      if (saved !== desired) tx.update(userRef, {notificationsEnabled: desired});
      return desired;
    });
  });
  return {enabled};
});
