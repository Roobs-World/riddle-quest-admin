"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayRaceDelivery = replayRaceDelivery;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const raceSetupService_1 = require("./raceSetupService");
const raceDeliveryRecords_1 = require("./raceDeliveryRecords");
const raceDeliveryQueue_1 = require("./raceDeliveryQueue");
const raceSettlement_1 = require("./raceSettlement");
const raceSettlementDelivery_1 = require("./raceSettlementDelivery");
const racePerformanceDelivery_1 = require("./racePerformanceDelivery");
const raceMatchPerformance_1 = require("./raceMatchPerformance");
const facebookLiveRaceReferralDelivery_1 = require("../facebook/facebookLiveRaceReferralDelivery");
const facebookFeatureFlags_1 = require("../facebook/facebookFeatureFlags");
const facebookLiveRaceDelivery_1 = require("../facebook/facebookLiveRaceDelivery");
const redditFeatureFlags_1 = require("../reddit/redditFeatureFlags");
const redditLiveRaceDelivery_1 = require("../reddit/redditLiveRaceDelivery");
const redditLiveRaceReferralDelivery_1 = require("../reddit/redditLiveRaceReferralDelivery");
/**
 * Administrator-only recovery of an existing, repaired delivery receipt.
 * No callable exposes this interface. Original source, enqueue time and retention
 * must remain valid; normal delivery rechecks account deletion and blocking.
 * Repeating a replay cannot reset an acknowledged delivery or duplicate effects.
 */
async function replayRaceDelivery(db, collection, eventId, nowMs, options = {}) {
    if (!raceDeliveryQueue_1.RACE_DELIVERY_QUEUES.includes(collection) || !/^[^/]{1,160}$/.test(eventId) || !Number.isSafeInteger(nowMs) || nowMs < 0)
        throw new https_1.HttpsError("invalid-argument", "Invalid race delivery replay target.");
    /** Receipt reset and source validation share one transaction. */
    const eventRef = db.doc(`${collection}/${eventId}`);
    /** Each actual replay release gets a clock-independent identity, stable across transaction retries. */
    const replayId = (0, node_crypto_1.randomUUID)();
    await db.runTransaction(async (transaction) => {
        /** Missing or expired authority cannot be reconstructed from diagnostics. */
        const [event, source] = await Promise.all([transaction.get(eventRef), transaction.get(db.doc(`raceRuns/${eventId}`))]);
        if (!event.exists)
            throw new https_1.HttpsError("failed-precondition", "Replay requires an existing receipt and canonical source.");
        /** The supported storage contract applies to repaired and legacy receipts. */
        const receipt = collection === "raceSettlementOutbox" ? (0, raceDeliveryRecords_1.parseRaceSettlementEvent)(event.data(), eventId) : (0, raceDeliveryRecords_1.parseRacePerformanceEvent)(event.data(), eventId);
        /** Retention clocks are preserved rather than extended by recovery. */
        if (receipt.expiresAt.toMillis() <= nowMs)
            throw new https_1.HttpsError("failed-precondition", "Expired race data cannot be replayed.");
        if (collection === "racePerformanceOutbox" && (receipt.source === "facebook_live" || receipt.source === "reddit_live")) {
            /** Provides live receipt behavior. */
            const liveReceipt = (0, raceDeliveryRecords_1.parseRacePerformanceEvent)(event.data(), eventId);
            /** Provides active behavior. */
            const active = receipt.source === "reddit_live" ? await (0, redditLiveRaceReferralDelivery_1.validateRedditLiveRaceReferralSource)(transaction, db, liveReceipt, nowMs) :
                await (0, facebookLiveRaceReferralDelivery_1.validateFacebookLiveRaceReferralSource)(transaction, db, liveReceipt, nowMs);
            if (!active)
                throw new https_1.HttpsError("failed-precondition", "Replay requires an active canonical live winner.");
            if (receipt.source === "facebook_live" && ((0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("tournaments") ||
                liveReceipt.facebookContext !== undefined && (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("matchmaking")))
                await (0, facebookLiveRaceDelivery_1.readFacebookLiveTournamentDeliveryInput)(transaction, db, liveReceipt, nowMs);
            if (receipt.source === "reddit_live" && (0, redditFeatureFlags_1.isRedditFeatureEnabled)("tournaments"))
                await (0, redditLiveRaceDelivery_1.readRedditLiveTournamentDeliveryInput)(transaction, db, liveReceipt, nowMs);
        }
        else {
            /** Provides source expiry behavior. */
            const sourceExpiry = source.data()?.expiresAt;
            if (!source.exists || !(sourceExpiry instanceof firebaseAdmin_1.admin.firestore.Timestamp) || sourceExpiry.toMillis() <= nowMs)
                throw new https_1.HttpsError("failed-precondition", "Replay requires an existing unexpired canonical source.");
            /** Canonical settlement is the only authority for downstream effects. */
            const run = (0, raceSetupService_1.parseRunRecord)(source.data(), source.id);
            if (run.runId !== eventId || run.userId !== receipt.userId || !run.settledOutcome || run.settledAtMs !== receipt.createdAtMs)
                throw new https_1.HttpsError("data-loss", "Repaired race delivery does not match its canonical source.");
            if (collection === "raceSettlementOutbox") {
                /** Creator metadata is checked before releasing the quarantined receipt. */
                const settlement = (0, raceDeliveryRecords_1.parseRaceSettlementEvent)(event.data(), eventId);
                if (!run.challengeId || !run.opponent?.subjectUserId || settlement.creatorId !== run.opponent.subjectUserId ||
                    settlement.challengeId !== run.challengeId || settlement.categoryId !== run.categoryId ||
                    settlement.result !== (0, raceSettlement_1.creatorRaceResult)(run.settledOutcome.result) ||
                    settlement.adjustedDeltaMs !== run.settledOutcome.adjustedFinishMs - run.opponent.adjustedFinishMs)
                    throw new https_1.HttpsError("data-loss", "Repaired creator delivery does not match its canonical source.");
            }
            else {
                if (run.finishedAtMs !== undefined && run.finishedAtMs > receipt.createdAtMs)
                    throw new https_1.HttpsError("data-loss", "Stored race performance occurrence time is invalid.");
                /** Dry-run must validate a repaired derived profile before approving receipt release. */
                const profile = await transaction.get(db.doc(`users/${run.userId}/raceMatchProfiles/${run.locale}`));
                if (profile.exists && !raceMatchPerformance_1.RaceMatchProfileSchema.safeParse(profile.data()).success)
                    throw new https_1.HttpsError("data-loss", "Stored race performance profile is invalid.");
            }
        }
        /** Another successful replay may already have released or delivered this receipt. */
        if (event.data()?.deliveryState !== "quarantined" && event.data()?.quarantined !== true) {
            if (receipt.replayedAtMs !== undefined)
                return;
            throw new https_1.HttpsError("failed-precondition", "No quarantined race delivery is available to replay.");
        }
        if (options.dryRun)
            return;
        transaction.update(eventRef, { delivered: false, deliveryState: "pending", deliveryAttempts: 0,
            nextAttemptAtMs: nowMs, replayedAtMs: nowMs, replayId, quarantined: firebaseAdmin_1.admin.firestore.FieldValue.delete(),
            quarantinedAtMs: firebaseAdmin_1.admin.firestore.FieldValue.delete(), failureCode: firebaseAdmin_1.admin.firestore.FieldValue.delete(),
            lastFailureCode: firebaseAdmin_1.admin.firestore.FieldValue.delete(), lastFailureAtMs: firebaseAdmin_1.admin.firestore.FieldValue.delete() });
    });
    if (options.dryRun)
        return false;
    return collection === "raceSettlementOutbox" ? (0, raceSettlementDelivery_1.deliverRaceSettlement)(eventId, db, nowMs) : (0, racePerformanceDelivery_1.deliverRacePerformance)(eventId, db, nowMs);
}
//# sourceMappingURL=raceDeliveryRecovery.js.map