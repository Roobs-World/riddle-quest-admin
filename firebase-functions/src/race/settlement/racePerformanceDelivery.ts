import {withRaceDeliveryReceipt} from "../delivery/raceDeliveryFailures";
import {HttpsError} from "firebase-functions/v2/https";
import {getJestAccountDeletionRef} from "../../shared/accountDeletion";
import {admin} from "../../shared/firebaseAdmin";
import {emptyRaceMatchProfile, RaceMatchProfileSchema, racePerformanceSample, recordRacePerformance, recordRaceCompletion} from "../matchmaking/raceMatchPerformance";
import {parseRunRecord, type Firestore} from "../raceSetupService";
import {parseRacePerformanceEvent} from "../delivery/raceDeliveryRecords";
import {finishFacebookRaceReferralDelivery, needsFacebookRaceReferral} from "../../../../platforms/web/facebook/server/facebookRaceReferralDelivery";
import {isFacebookFirebaseUid} from "../../../../platforms/web/facebook/server/facebookSecurity";
import {validateFacebookLiveRaceReferralSource} from "../../../../platforms/web/facebook/server/facebookLiveRaceReferralDelivery";
import {finishRedditLiveRaceReferralDelivery, needsRedditLiveRaceReferral, validateRedditLiveRaceReferralSource} from "../../../../platforms/web/reddit/server/redditLiveRaceReferralDelivery";
import {isRedditFirebaseUid} from "../../../../platforms/web/reddit/server/redditSecurity";
import {isFacebookFeatureEnabled} from "../../../../platforms/web/facebook/server/facebookFeatureFlags";
import {finishFacebookLiveRaceDelivery} from "../../../../platforms/web/facebook/server/facebookLiveRaceDelivery";
import {isRedditFeatureEnabled} from "../../../../platforms/web/reddit/server/redditFeatureFlags";
import {finishRedditLiveRaceDelivery} from "../../../../platforms/web/reddit/server/redditLiveRaceDelivery";

/** Idempotently folds a settled owner's performance into their language/category estimate. */
export async function deliverRacePerformance(runId: string, db: Firestore = admin.firestore(), nowMs = Date.now()): Promise<boolean> {
  /** Provides event ref behavior. */
  const eventRef = db.doc(`racePerformanceOutbox/${runId}`);
  return withRaceDeliveryReceipt(db, eventRef, nowMs, async observe => {
    /** Provider grants require a durable second stage after the owner projection commits. */
    let referralUserId: string | undefined;
    /** Facebook live winner work records official scores independently of referral enablement. */
    let facebookLiveUserId: string | undefined;
    /** Only new bound Facebook seats need an additional context projection. */
    let facebookLiveContext = false;
    /** Reddit live scores and referral grants retain independent provider switches. */
    let redditLiveUserId: string | undefined;
    /** Records whether the primary projection was newly applied. */
    const changed = await db.runTransaction(async (transaction) => {
      referralUserId = undefined;
      facebookLiveUserId = undefined;
      facebookLiveContext = false;
      redditLiveUserId = undefined;
      /** Provides event behavior. */
      const event = await transaction.get(eventRef);
      observe(event.data());
      if (!event.exists || event.data()?.delivered === true) return false;
      /** Provides user id behavior. */
      const receipt = parseRacePerformanceEvent(event.data(), runId);
      if (receipt.expiresAt.toMillis() <= nowMs) {
        transaction.update(eventRef, {delivered: true, deliveryState: "suppressed", suppressed: true, deliveredAtMs: nowMs});
        return false;
      }
      if (receipt.nextAttemptAtMs !== undefined && receipt.nextAttemptAtMs > nowMs) return false;
      /** Owner linkage comes from the validated server receipt and is rechecked against the source. */
      const userId = receipt.userId;
      if (receipt.source !== undefined) {
        // Live results have their own private source and do not contribute recorded-race speed samples.
        /** Provides reddit behavior. */
        const reddit = receipt.source === "reddit_live";
        /** Provides active behavior. */
        const active = reddit ? await validateRedditLiveRaceReferralSource(transaction, db, receipt, nowMs) :
          await validateFacebookLiveRaceReferralSource(transaction, db, receipt, nowMs);
        if (!active || !(reddit ? needsRedditLiveRaceReferral(userId) || isRedditFeatureEnabled("tournaments") :
          needsFacebookRaceReferral(userId, true) || isFacebookFeatureEnabled("tournaments") ||
            receipt.facebookContext !== undefined && isFacebookFeatureEnabled("matchmaking"))) {
          transaction.update(eventRef, {delivered: true, deliveryState: "suppressed", suppressed: true, deliveredAtMs: nowMs});
          return false;
        }
        if (reddit) redditLiveUserId = userId;
        else {facebookLiveUserId = userId; facebookLiveContext = receipt.facebookContext !== undefined;}
        return true;
      }
      /** Provides [source, owner, deletion] behavior. */
      const [source, owner, deletion] = await Promise.all([transaction.get(db.doc(`raceRuns/${runId}`)),
        transaction.get(db.doc(`users/${userId}`)), transaction.get(getJestAccountDeletionRef(db, userId))]);
      /** Absent legacy retention remains supported; an explicit expired source cannot authorize effects. */
      const sourceExpiry = source.data()?.expiresAt;
      if (!source.exists || sourceExpiry instanceof admin.firestore.Timestamp && sourceExpiry.toMillis() <= nowMs || !owner.exists || deletion.exists) {
        transaction.update(eventRef, {delivered: true, deliveryState: "suppressed", suppressed: true, deliveredAtMs: nowMs});
        return false;
      }
      /** Provides run behavior. */
      const run = parseRunRecord(source.data(), source.id);
      if (run.runId !== runId || run.userId !== userId || !run.settledOutcome || run.settledAtMs === undefined || receipt.createdAtMs !== run.settledAtMs ||
        run.finishedAtMs !== undefined && run.finishedAtMs > run.settledAtMs)
        throw new HttpsError("data-loss", "Performance source is not settled.");
      if (needsFacebookRaceReferral(userId, run.settledOutcome.result === "player_win")) referralUserId = userId;
      /** A retried Facebook reward must not fold the same performance sample twice. */
      if (receipt.facebookPerformanceRecorded === true) {
        if (!isFacebookFirebaseUid(userId) || run.settledOutcome.result !== "player_win")
          throw new HttpsError("data-loss", "Facebook performance receipt is invalid.");
        if (!referralUserId) transaction.update(eventRef, {delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs});
        return false;
      }
      /** Provides ref behavior. */
      const ref = db.doc(`users/${userId}/raceMatchProfiles/${run.locale}`);
      /** Provides existing behavior. */
      const existing = await transaction.get(ref);
      /** Provides profile behavior. */
      const profile = existing.exists ? RaceMatchProfileSchema.parse(existing.data()) : emptyRaceMatchProfile();
      /** Provides sample behavior. */
      const sample = racePerformanceSample(run);
      /** Completion remains measurable even when idle losses supply no speed observation. */
      const observedAtMs = run.finishedAtMs ?? run.settledAtMs;
      /** Deadline recovery and delayed outbox delivery cannot make an old finish current. */
      const completion = recordRaceCompletion(profile, run.role, run.categoryId, run.correctCount >= 10, observedAtMs);
      transaction.set(ref, sample ? recordRacePerformance(completion, run.categoryId, sample, observedAtMs) : completion);
      transaction.update(eventRef, referralUserId ? {facebookPerformanceRecorded: true} :
        {delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs});
      return true;
    });
    if (facebookLiveUserId) {
      if (facebookLiveContext) await finishFacebookLiveRaceDelivery(db, eventRef, facebookLiveUserId, nowMs, true);
      else await finishFacebookLiveRaceDelivery(db, eventRef, facebookLiveUserId, nowMs);
    }
    if (redditLiveUserId) await finishRedditLiveRaceDelivery(db, eventRef, redditLiveUserId, nowMs);
    if (referralUserId) {
      if (isRedditFirebaseUid(referralUserId)) await finishRedditLiveRaceReferralDelivery(db, eventRef, referralUserId, nowMs);
      else await finishFacebookRaceReferralDelivery(db, eventRef, referralUserId, nowMs);
    }
    return changed;
  });
}
