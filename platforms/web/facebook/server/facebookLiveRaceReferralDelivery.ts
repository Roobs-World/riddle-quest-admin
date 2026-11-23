import {liveRaceReferralEventId, validateLiveRaceReferralSource} from "../../../../firebase-functions/src/race/raceLiveReferralDelivery";
import type {Firestore} from "../../../../firebase-functions/src/race/raceSetupService";
import type {parseRacePerformanceEvent} from "../../../../firebase-functions/src/race/raceDeliveryRecords";

/** Facebook keeps its existing separate hash domain and durable receipts. */
export const facebookLiveRaceReferralEventId = (userId: string, ticketId: string): string =>
  liveRaceReferralEventId("facebook", userId, ticketId);

/** Facebook authority never accepts another provider's source or private binding. */
export function validateFacebookLiveRaceReferralSource(transaction: FirebaseFirestore.Transaction, db: Firestore,
  receipt: ReturnType<typeof parseRacePerformanceEvent>, nowMs: number): Promise<boolean> {
  return validateLiveRaceReferralSource(transaction, db, receipt, nowMs, "facebook");
}
