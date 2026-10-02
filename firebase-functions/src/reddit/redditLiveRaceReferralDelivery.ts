import {liveRaceReferralEventId, validateLiveRaceReferralSource} from "../race/raceLiveReferralDelivery";
import type {Firestore} from "../race/raceSetupService";
import type {parseRacePerformanceEvent} from "../race/raceDeliveryRecords";
import {isRedditFirebaseUid} from "./redditSecurity";
import {isRedditFeatureEnabled} from "./redditFeatureFlags";
import {settleRedditReferralAfterAuthoritativeWin} from "./redditReferrals";

/** Reddit cannot collide with either legacy request IDs or Facebook's live hash domain. */
export const redditLiveRaceReferralEventId = (userId: string, ticketId: string): string =>
  liveRaceReferralEventId("reddit", userId, ticketId);

/** Provider identity and emergency-off state are rechecked during delivery. */
export const needsRedditLiveRaceReferral = (userId: string): boolean =>
  isRedditFirebaseUid(userId) && isRedditFeatureEnabled("referrals");

/** Reddit accepts only its own source discriminator and immutable private winner binding. */
export function validateRedditLiveRaceReferralSource(transaction: FirebaseFirestore.Transaction, db: Firestore,
  receipt: ReturnType<typeof parseRacePerformanceEvent>, nowMs: number): Promise<boolean> {
  return validateLiveRaceReferralSource(transaction, db, receipt, nowMs, "reddit");
}

/** Grant-before-ack uses the existing idempotent ledger and durable trigger/queue retries. */
export async function finishRedditLiveRaceReferralDelivery(db: Firestore, eventRef: FirebaseFirestore.DocumentReference,
  userId: string, nowMs: number): Promise<void> {
  await settleRedditReferralAfterAuthoritativeWin(userId, nowMs, db);
  await db.runTransaction(async transaction => {
    /** Provides current behavior. */
    const current = await transaction.get(eventRef);
    if (!current.exists || current.data()?.delivered === true) return;
    transaction.update(eventRef, {delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs});
  });
}
