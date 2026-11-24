import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {admin} from "../../shared/firebaseAdmin";
import {retireLegacyLiveRacePush} from "./raceLivePushDelivery";

/** Retains the deployed trigger to retire legacy work without generating notification content. */
export const deliverLiveRaceChallengePush = onDocumentCreated({document: "liveRacePushOutbox/{eventId}",
  region: "europe-west1", retry: true, timeoutSeconds: 60}, async event => {
  await retireLegacyLiveRacePush(admin.firestore(), event.params.eventId);
});
