"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverRacePerformance = deliverRacePerformance;
const raceDeliveryFailures_1 = require("./raceDeliveryFailures");
const https_1 = require("firebase-functions/v2/https");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const raceMatchPerformance_1 = require("./raceMatchPerformance");
const raceSetupService_1 = require("./raceSetupService");
const raceDeliveryRecords_1 = require("./raceDeliveryRecords");
const facebookRaceReferralDelivery_1 = require("../facebook/facebookRaceReferralDelivery");
const facebookSecurity_1 = require("../facebook/facebookSecurity");
const facebookLiveRaceReferralDelivery_1 = require("../facebook/facebookLiveRaceReferralDelivery");
const redditLiveRaceReferralDelivery_1 = require("../reddit/redditLiveRaceReferralDelivery");
const redditSecurity_1 = require("../reddit/redditSecurity");
const facebookFeatureFlags_1 = require("../facebook/facebookFeatureFlags");
const facebookLiveRaceDelivery_1 = require("../facebook/facebookLiveRaceDelivery");
const redditFeatureFlags_1 = require("../reddit/redditFeatureFlags");
const redditLiveRaceDelivery_1 = require("../reddit/redditLiveRaceDelivery");
/** Idempotently folds a settled owner's performance into their language/category estimate. */
async function deliverRacePerformance(runId, db = firebaseAdmin_1.admin.firestore(), nowMs = Date.now()) {
    /** Provides event ref behavior. */
    const eventRef = db.doc(`racePerformanceOutbox/${runId}`);
    return (0, raceDeliveryFailures_1.withRaceDeliveryReceipt)(db, eventRef, nowMs, async (observe) => {
        /** Provider grants require a durable second stage after the owner projection commits. */
        let referralUserId;
        /** Facebook live winner work records official scores independently of referral enablement. */
        let facebookLiveUserId;
        /** Only new bound Facebook seats need an additional context projection. */
        let facebookLiveContext = false;
        /** Reddit live scores and referral grants retain independent provider switches. */
        let redditLiveUserId;
        /** Records whether the primary projection was newly applied. */
        const changed = await db.runTransaction(async (transaction) => {
            referralUserId = undefined;
            facebookLiveUserId = undefined;
            facebookLiveContext = false;
            redditLiveUserId = undefined;
            /** Provides event behavior. */
            const event = await transaction.get(eventRef);
            observe(event.data());
            if (!event.exists || event.data()?.delivered === true)
                return false;
            /** Provides user id behavior. */
            const receipt = (0, raceDeliveryRecords_1.parseRacePerformanceEvent)(event.data(), runId);
            if (receipt.expiresAt.toMillis() <= nowMs) {
                transaction.update(eventRef, { delivered: true, deliveryState: "suppressed", suppressed: true, deliveredAtMs: nowMs });
                return false;
            }
            if (receipt.nextAttemptAtMs !== undefined && receipt.nextAttemptAtMs > nowMs)
                return false;
            /** Owner linkage comes from the validated server receipt and is rechecked against the source. */
            const userId = receipt.userId;
            if (receipt.source !== undefined) {
                // Live results have their own private source and do not contribute recorded-race speed samples.
                /** Provides reddit behavior. */
                const reddit = receipt.source === "reddit_live";
                /** Provides active behavior. */
                const active = reddit ? await (0, redditLiveRaceReferralDelivery_1.validateRedditLiveRaceReferralSource)(transaction, db, receipt, nowMs) :
                    await (0, facebookLiveRaceReferralDelivery_1.validateFacebookLiveRaceReferralSource)(transaction, db, receipt, nowMs);
                if (!active || !(reddit ? (0, redditLiveRaceReferralDelivery_1.needsRedditLiveRaceReferral)(userId) || (0, redditFeatureFlags_1.isRedditFeatureEnabled)("tournaments") :
                    (0, facebookRaceReferralDelivery_1.needsFacebookRaceReferral)(userId, true) || (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("tournaments") ||
                        receipt.facebookContext !== undefined && (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("matchmaking"))) {
                    transaction.update(eventRef, { delivered: true, deliveryState: "suppressed", suppressed: true, deliveredAtMs: nowMs });
                    return false;
                }
                if (reddit)
                    redditLiveUserId = userId;
                else {
                    facebookLiveUserId = userId;
                    facebookLiveContext = receipt.facebookContext !== undefined;
                }
                return true;
            }
            /** Provides [source, owner, deletion] behavior. */
            const [source, owner, deletion] = await Promise.all([transaction.get(db.doc(`raceRuns/${runId}`)),
                transaction.get(db.doc(`users/${userId}`)), transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId))]);
            /** Absent legacy retention remains supported; an explicit expired source cannot authorize effects. */
            const sourceExpiry = source.data()?.expiresAt;
            if (!source.exists || sourceExpiry instanceof firebaseAdmin_1.admin.firestore.Timestamp && sourceExpiry.toMillis() <= nowMs || !owner.exists || deletion.exists) {
                transaction.update(eventRef, { delivered: true, deliveryState: "suppressed", suppressed: true, deliveredAtMs: nowMs });
                return false;
            }
            /** Provides run behavior. */
            const run = (0, raceSetupService_1.parseRunRecord)(source.data(), source.id);
            if (run.runId !== runId || run.userId !== userId || !run.settledOutcome || run.settledAtMs === undefined || receipt.createdAtMs !== run.settledAtMs ||
                run.finishedAtMs !== undefined && run.finishedAtMs > run.settledAtMs)
                throw new https_1.HttpsError("data-loss", "Performance source is not settled.");
            if ((0, facebookRaceReferralDelivery_1.needsFacebookRaceReferral)(userId, run.settledOutcome.result === "player_win"))
                referralUserId = userId;
            /** A retried Facebook reward must not fold the same performance sample twice. */
            if (receipt.facebookPerformanceRecorded === true) {
                if (!(0, facebookSecurity_1.isFacebookFirebaseUid)(userId) || run.settledOutcome.result !== "player_win")
                    throw new https_1.HttpsError("data-loss", "Facebook performance receipt is invalid.");
                if (!referralUserId)
                    transaction.update(eventRef, { delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs });
                return false;
            }
            /** Provides ref behavior. */
            const ref = db.doc(`users/${userId}/raceMatchProfiles/${run.locale}`);
            /** Provides existing behavior. */
            const existing = await transaction.get(ref);
            /** Provides profile behavior. */
            const profile = existing.exists ? raceMatchPerformance_1.RaceMatchProfileSchema.parse(existing.data()) : (0, raceMatchPerformance_1.emptyRaceMatchProfile)();
            /** Provides sample behavior. */
            const sample = (0, raceMatchPerformance_1.racePerformanceSample)(run);
            /** Completion remains measurable even when idle losses supply no speed observation. */
            const observedAtMs = run.finishedAtMs ?? run.settledAtMs;
            /** Deadline recovery and delayed outbox delivery cannot make an old finish current. */
            const completion = (0, raceMatchPerformance_1.recordRaceCompletion)(profile, run.role, run.categoryId, run.correctCount >= 10, observedAtMs);
            transaction.set(ref, sample ? (0, raceMatchPerformance_1.recordRacePerformance)(completion, run.categoryId, sample, observedAtMs) : completion);
            transaction.update(eventRef, referralUserId ? { facebookPerformanceRecorded: true } :
                { delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs });
            return true;
        });
        if (facebookLiveUserId) {
            if (facebookLiveContext)
                await (0, facebookLiveRaceDelivery_1.finishFacebookLiveRaceDelivery)(db, eventRef, facebookLiveUserId, nowMs, true);
            else
                await (0, facebookLiveRaceDelivery_1.finishFacebookLiveRaceDelivery)(db, eventRef, facebookLiveUserId, nowMs);
        }
        if (redditLiveUserId)
            await (0, redditLiveRaceDelivery_1.finishRedditLiveRaceDelivery)(db, eventRef, redditLiveUserId, nowMs);
        if (referralUserId) {
            if ((0, redditSecurity_1.isRedditFirebaseUid)(referralUserId))
                await (0, redditLiveRaceReferralDelivery_1.finishRedditLiveRaceReferralDelivery)(db, eventRef, referralUserId, nowMs);
            else
                await (0, facebookRaceReferralDelivery_1.finishFacebookRaceReferralDelivery)(db, eventRef, referralUserId, nowMs);
        }
        return changed;
    });
}
//# sourceMappingURL=racePerformanceDelivery.js.map