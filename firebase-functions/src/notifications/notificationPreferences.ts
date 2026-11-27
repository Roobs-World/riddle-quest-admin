import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest} from "../validation/callableValidation";
import {assertAccountActive, getAccountDeletionRef} from "../shared/accountDeletion";
import {raceProviderScope} from "../race/access/raceProviderScope";
import {isFacebookFeatureEnabled} from "../../../platforms/web/facebook/server/facebookFeatureFlags";
import {writeFacebookConsent} from "../../../platforms/web/facebook/server/notifications/managerRegistration";

const Preference = z.union([z.object({enabled: z.boolean()}).strict(), z.object({initialize: z.literal(true)}).strict(),
  z.object({enabled: z.literal(true), facebookConsent: z.literal("a2u-v1")}).strict()]);

/** Saves the authenticated player's master preference without granting provider permission. */
export const setNotificationPreference = onCallWithSentry("setNotificationPreference", {
  ...browserCallableSecurityOptions, region: "europe-west1",
}, async request => {
  const input = validateCallableRequest(Preference, request.data, "setNotificationPreference");
  const uid = request.auth?.uid;
  const scope = uid ? raceProviderScope(uid) : undefined;
  if (!uid || scope !== "facebook" || request.auth?.token.provider !== "facebook") {
    throw new HttpsError("permission-denied", "Registered game account required.");
  }
  if (("initialize" in input || input.enabled) && !isFacebookFeatureEnabled("notifications")) {
    throw new HttpsError("failed-precondition", "Notifications are unavailable.");
  }
  const db = admin.firestore();
  return db.runTransaction(async tx => {
    const userRef = db.doc(`users/${uid}`);
    const [user, deleted] = await Promise.all([tx.get(userRef), tx.get(getAccountDeletionRef(db, uid))]);
    assertAccountActive(deleted);
    if (!user.exists) throw new HttpsError("not-found", "Account unavailable.");
    const saved = user.get("notificationsEnabled");
    const enabled = "enabled" in input ? input.enabled : saved === undefined || saved === true;
    const facebookConsent = await writeFacebookConsent(db, tx, uid, request.auth?.token.accountGeneration,
      user.data()!, enabled, "facebookConsent" in input);
    if (saved !== enabled) tx.update(userRef, {notificationsEnabled: enabled});
    return {enabled, ...(facebookConsent !== undefined ? {facebookConsent} : {})};
  });
});
