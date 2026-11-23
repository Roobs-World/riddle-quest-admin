import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {isFacebookFirebaseUid} from "./facebookSecurity";
import {settleFacebookReferralAfterAuthoritativeWin} from "./facebookReferrals";
import type {Firestore} from "../../../../firebase-functions/src/race/raceSetupService";

/** Only canonical Facebook wins participate; other providers retain their existing delivery path. */
export const needsFacebookRaceReferral = (userId: string, won: boolean): boolean =>
  won && isFacebookFirebaseUid(userId) && isFacebookFeatureEnabled("referrals");

/**
 * Acknowledges an existing race outbox only after the idempotent referral grant.
 * Projection work commits first, leaving delivered=false for existing trigger/queue retries.
 * A crash between the grant and this acknowledgement safely replays the settlement receipt.
 */
export async function finishFacebookRaceReferralDelivery(db: Firestore, eventRef: FirebaseFirestore.DocumentReference,
  userId: string, nowMs: number): Promise<void> {
  await settleFacebookReferralAfterAuthoritativeWin(userId, nowMs, db);
  await db.runTransaction(async transaction => {
    /** Concurrent successful, suppressed or quarantined delivery wins. */
    const current = await transaction.get(eventRef);
    if (!current.exists || current.data()?.delivered === true) return;
    transaction.update(eventRef, {delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs});
  });
}
