import {sendAndroidLiveChallengePush} from "../../../../platforms/native/android/server/androidNotifications";
import {defineSecret} from "firebase-functions/params";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {admin} from "../../shared/firebaseAdmin";
import {runWithJestAccountOperationLease} from "../../shared/accountDeletion";
import {raceProviderScope} from "../access/raceProviderScope";
import {deliverLiveRacePush} from "./raceLivePushDelivery";
import {sendFacebookLiveChallengePush} from "../../../../platforms/web/facebook/server/notifications/facebookLiveChallengePush";

/** Dedicated server-only Meta notification credential. */
const facebookNotificationToken = defineSecret("FACEBOOK_NOTIFICATION_APP_ACCESS_TOKEN");
/** Resolves only the current signed Facebook identity generation. */
const facebookUidSecret = defineSecret("FACEBOOK_UID_SECRET");

/** Delivers durable challenge work after the inviter's browser has closed. Provider requests are never replayed after a claim. */
export const deliverLiveRaceChallengePush = onDocumentCreated({document: "liveRacePushOutbox/{eventId}",
  region: "europe-west1", retry: true, timeoutSeconds: 60, secrets: [facebookNotificationToken, facebookUidSecret]}, async event => {
  /** Isolated or configured server database. */
  const db = admin.firestore();
  await deliverLiveRacePush(db, event.params.eventId, async delivery =>
    runWithJestAccountOperationLease(delivery.event.recipientId, 60, async () => {
      if (raceProviderScope(delivery.event.recipientId) === "facebook") return sendFacebookLiveChallengePush(db, delivery, {
        appId: process.env.FACEBOOK_APP_ID ?? "", uidSecret: facebookUidSecret.value(), appAccessToken: facebookNotificationToken.value(),
        enabled: process.env.FACEBOOK_CHALLENGE_PUSH_ENABLED === "1",
      });
      if (raceProviderScope(delivery.event.recipientId) === "android") return sendAndroidLiveChallengePush(db, {
        uid: delivery.event.recipientId, challengeId: delivery.event.challengeId, title: delivery.title, body: delivery.body, expiresAtMs: delivery.event.expiresAtMs,
      });
      return "skipped";
    }));
});
