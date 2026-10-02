import {randomUUID} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {parseRunRecord, type Firestore} from "./raceSetupService";
import {parseRacePerformanceEvent, parseRaceSettlementEvent} from "./raceDeliveryRecords";
import {RACE_DELIVERY_QUEUES, type RaceDeliveryQueueName} from "./raceDeliveryQueue";
import {creatorRaceResult} from "./raceSettlement";
import {deliverRaceSettlement} from "./raceSettlementDelivery";
import {deliverRacePerformance} from "./racePerformanceDelivery";
import {RaceMatchProfileSchema} from "./raceMatchPerformance";
import {validateFacebookLiveRaceReferralSource} from "../facebook/facebookLiveRaceReferralDelivery";
import {isFacebookFeatureEnabled} from "../facebook/facebookFeatureFlags";
import {readFacebookLiveTournamentDeliveryInput} from "../facebook/facebookLiveRaceDelivery";
import {isRedditFeatureEnabled} from "../reddit/redditFeatureFlags";
import {readRedditLiveTournamentDeliveryInput} from "../reddit/redditLiveRaceDelivery";
import {validateRedditLiveRaceReferralSource} from "../reddit/redditLiveRaceReferralDelivery";

/**
 * Administrator-only recovery of an existing, repaired delivery receipt.
 * No callable exposes this interface. Original source, enqueue time and retention
 * must remain valid; normal delivery rechecks account deletion and blocking.
 * Repeating a replay cannot reset an acknowledged delivery or duplicate effects.
 */
export async function replayRaceDelivery(db: Firestore, collection: RaceDeliveryQueueName,
  eventId: string, nowMs: number, options: {
    /** Validate repair without releasing or delivering the receipt. */
    dryRun?: boolean;
  } = {}): Promise<boolean> {
  if (!RACE_DELIVERY_QUEUES.includes(collection) || !/^[^/]{1,160}$/.test(eventId) || !Number.isSafeInteger(nowMs) || nowMs < 0)
    throw new HttpsError("invalid-argument", "Invalid race delivery replay target.");
  /** Receipt reset and source validation share one transaction. */
  const eventRef = db.doc(`${collection}/${eventId}`);
  /** Each actual replay release gets a clock-independent identity, stable across transaction retries. */
  const replayId = randomUUID();
  await db.runTransaction(async transaction => {
    /** Missing or expired authority cannot be reconstructed from diagnostics. */
    const [event, source] = await Promise.all([transaction.get(eventRef), transaction.get(db.doc(`raceRuns/${eventId}`))]);
    if (!event.exists) throw new HttpsError("failed-precondition", "Replay requires an existing receipt and canonical source.");
    /** The supported storage contract applies to repaired and legacy receipts. */
    const receipt = collection === "raceSettlementOutbox" ? parseRaceSettlementEvent(event.data(), eventId) : parseRacePerformanceEvent(event.data(), eventId);
    /** Retention clocks are preserved rather than extended by recovery. */
    if (receipt.expiresAt.toMillis() <= nowMs)
      throw new HttpsError("failed-precondition", "Expired race data cannot be replayed.");
    if (collection === "racePerformanceOutbox" && (receipt.source === "facebook_live" || receipt.source === "reddit_live")) {
      /** Provides live receipt behavior. */
      const liveReceipt = parseRacePerformanceEvent(event.data(), eventId);
      /** Provides active behavior. */
      const active = receipt.source === "reddit_live" ? await validateRedditLiveRaceReferralSource(transaction, db, liveReceipt, nowMs) :
        await validateFacebookLiveRaceReferralSource(transaction, db, liveReceipt, nowMs);
      if (!active)
        throw new HttpsError("failed-precondition", "Replay requires an active canonical live winner.");
      if (receipt.source === "facebook_live" && isFacebookFeatureEnabled("tournaments"))
        await readFacebookLiveTournamentDeliveryInput(transaction, db, liveReceipt, nowMs);
      if (receipt.source === "reddit_live" && isRedditFeatureEnabled("tournaments"))
        await readRedditLiveTournamentDeliveryInput(transaction, db, liveReceipt, nowMs);
    } else {
      /** Provides source expiry behavior. */
      const sourceExpiry = source.data()?.expiresAt;
      if (!source.exists || !(sourceExpiry instanceof admin.firestore.Timestamp) || sourceExpiry.toMillis() <= nowMs)
        throw new HttpsError("failed-precondition", "Replay requires an existing unexpired canonical source.");
      /** Canonical settlement is the only authority for downstream effects. */
      const run = parseRunRecord(source.data(), source.id);
      if (run.runId !== eventId || run.userId !== receipt.userId || !run.settledOutcome || run.settledAtMs !== receipt.createdAtMs)
        throw new HttpsError("data-loss", "Repaired race delivery does not match its canonical source.");
      if (collection === "raceSettlementOutbox") {
        /** Creator metadata is checked before releasing the quarantined receipt. */
        const settlement = parseRaceSettlementEvent(event.data(), eventId);
        if (!run.challengeId || !run.opponent?.subjectUserId || settlement.creatorId !== run.opponent.subjectUserId ||
          settlement.challengeId !== run.challengeId || settlement.categoryId !== run.categoryId ||
          settlement.result !== creatorRaceResult(run.settledOutcome.result) ||
          settlement.adjustedDeltaMs !== run.settledOutcome.adjustedFinishMs - run.opponent.adjustedFinishMs)
          throw new HttpsError("data-loss", "Repaired creator delivery does not match its canonical source.");
      } else {
        if (run.finishedAtMs !== undefined && run.finishedAtMs > receipt.createdAtMs)
          throw new HttpsError("data-loss", "Stored race performance occurrence time is invalid.");
        /** Dry-run must validate a repaired derived profile before approving receipt release. */
        const profile = await transaction.get(db.doc(`users/${run.userId}/raceMatchProfiles/${run.locale}`));
        if (profile.exists && !RaceMatchProfileSchema.safeParse(profile.data()).success)
          throw new HttpsError("data-loss", "Stored race performance profile is invalid.");
      }
    }
    /** Another successful replay may already have released or delivered this receipt. */
    if (event.data()?.deliveryState !== "quarantined" && event.data()?.quarantined !== true) {
      if (receipt.replayedAtMs !== undefined) return;
      throw new HttpsError("failed-precondition", "No quarantined race delivery is available to replay.");
    }
    if (options.dryRun) return;
    transaction.update(eventRef, {delivered: false, deliveryState: "pending", deliveryAttempts: 0,
      nextAttemptAtMs: nowMs, replayedAtMs: nowMs, replayId, quarantined: admin.firestore.FieldValue.delete(),
      quarantinedAtMs: admin.firestore.FieldValue.delete(), failureCode: admin.firestore.FieldValue.delete(),
      lastFailureCode: admin.firestore.FieldValue.delete(), lastFailureAtMs: admin.firestore.FieldValue.delete()});
  });
  if (options.dryRun) return false;
  return collection === "raceSettlementOutbox" ? deliverRaceSettlement(eventId, db, nowMs) : deliverRacePerformance(eventId, db, nowMs);
}
