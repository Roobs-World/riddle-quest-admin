"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverRaceSettlement = deliverRaceSettlement;
const raceDeliveryFailures_1 = require("./raceDeliveryFailures");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceSettlement_1 = require("./raceSettlement");
const raceSetupService_1 = require("./raceSetupService");
const raceDeliveryRecords_1 = require("./raceDeliveryRecords");
const facebookRaceReferralDelivery_1 = require("../facebook/facebookRaceReferralDelivery");
/**
 * Delivers one canonical settlement outbox event transactionally and idempotently.
 * Revalidates the source result, account lifecycle, and both blocking directions.
 * A missing/deleted source is acknowledged without reintroducing player identity.
 */
async function deliverRaceSettlement(runId, db = firebaseAdmin_1.admin.firestore(), nowMs = Date.now()) {
    /** Provides event ref behavior. */
    const eventRef = db.doc(`raceSettlementOutbox/${runId}`);
    return (0, raceDeliveryFailures_1.withRaceDeliveryReceipt)(db, eventRef, nowMs, async (observe) => {
        /** A creator's authoritative win is recorded before their referral settlement runs. */
        let referralUserId;
        /** Records whether the primary projection was newly applied. */
        const changed = await db.runTransaction(async (transaction) => {
            referralUserId = undefined;
            /** Provides event snapshot behavior. */
            const eventSnapshot = await transaction.get(eventRef);
            observe(eventSnapshot.data());
            if (!eventSnapshot.exists || eventSnapshot.data()?.delivered === true)
                return false;
            /** Provides event behavior. */
            const event = (0, raceDeliveryRecords_1.parseRaceSettlementEvent)(eventSnapshot.data(), runId);
            if (event.expiresAt.toMillis() <= nowMs) {
                transaction.update(eventRef, { delivered: true, deliveryState: "suppressed", deliveredAtMs: nowMs, suppressed: true });
                return false;
            }
            if (event.nextAttemptAtMs !== undefined && event.nextAttemptAtMs > nowMs)
                return false;
            /** Provides [run snapshot, challenger, creator, challenger deletion, creator deletion, outgoing block, incoming block] behavior. */
            const [runSnapshot, challenger, creator, challengerDeletion, creatorDeletion, outgoingBlock, incomingBlock] = await Promise.all([
                transaction.get(db.doc(`raceRuns/${runId}`)),
                transaction.get(db.doc(`users/${event.userId}`)),
                transaction.get(db.doc(`users/${event.creatorId}`)),
                transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, event.userId)),
                transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, event.creatorId)),
                transaction.get(db.doc(`users/${event.userId}/blockedRivals/${event.creatorId}`)),
                transaction.get(db.doc(`users/${event.creatorId}/blockedRivals/${event.userId}`)),
            ]);
            /** Firestore TTL deletion may lag behind an explicit canonical retention deadline. */
            const sourceExpiry = runSnapshot.data()?.expiresAt;
            if (!runSnapshot.exists || sourceExpiry instanceof firebaseAdmin_1.admin.firestore.Timestamp && sourceExpiry.toMillis() <= nowMs ||
                !creator.exists || !challenger.exists || challengerDeletion.exists ||
                creatorDeletion.exists || outgoingBlock.exists || incomingBlock.exists) {
                transaction.update(eventRef, { delivered: true, deliveryState: "suppressed", deliveredAtMs: nowMs, suppressed: true });
                return false;
            }
            /** Provides run behavior. */
            const run = (0, raceSetupService_1.parseRunRecord)(runSnapshot.data(), runSnapshot.id);
            /** Provides outcome behavior. */
            const outcome = run.settledOutcome;
            if (run.runId !== runId || !outcome || !run.challengeId || run.settledAtMs === undefined || run.userId !== event.userId ||
                run.opponent?.subjectUserId !== event.creatorId || run.challengeId !== event.challengeId ||
                (0, raceSettlement_1.creatorRaceResult)(outcome.result) !== event.result || event.categoryId !== run.categoryId ||
                event.adjustedDeltaMs !== outcome.adjustedFinishMs - (run.opponent?.adjustedFinishMs ?? 0) || event.createdAtMs !== run.settledAtMs)
                throw new Error("race-settlement-source-mismatch");
            /** Provides item id behavior. */
            const itemId = (0, raceSetupService_1.requestDocumentId)(run.challengeId, run.userId);
            // Legacy completion may already have delivered this challenge before migration.
            /** Provides inbox ref behavior. */
            const inboxRef = db.doc(`users/${event.creatorId}/raceInbox/${itemId}`);
            /** Provides existing inbox behavior. */
            const existingInbox = await transaction.get(inboxRef);
            if (!existingInbox.exists) {
                /** Provides profile behavior. */
                const profile = challenger.data() ?? {};
                transaction.create(inboxRef, {
                    itemId,
                    challengeId: run.challengeId,
                    opponentUserId: run.userId,
                    opponentLevel: typeof profile.level === "number" && Number.isInteger(profile.level) && profile.level > 0 ? profile.level : 1,
                    opponentDisplayName: String(profile.displayName || profile.username || "Riddle Quest player").trim().slice(0, 80),
                    ...(typeof profile.avatarUrl === "string" ? { opponentAvatarUrl: profile.avatarUrl } : {}),
                    categoryId: run.categoryId,
                    result: (0, raceSettlement_1.creatorRaceResult)(outcome.result),
                    adjustedDeltaMs: event.adjustedDeltaMs,
                    read: false,
                    createdAtMs: event.createdAtMs,
                    expiresAt: event.expiresAt,
                });
                for (const [viewer, target] of [[run.userId, event.creatorId], [event.creatorId, run.userId]]) {
                    transaction.set(db.doc(`users/${viewer}/knownRivals/${target}`), {
                        targetUserId: target,
                        source: "completed_race",
                        challengeId: run.challengeId,
                        establishedAtMs: event.createdAtMs,
                    }, { merge: true });
                }
                (0, raceSetupService_1.persistRaceAchievementEvent)(transaction, db.doc(`users/${event.creatorId}`), creator.data() ?? {}, { kind: "opponent_resolved", won: event.result === "win" }, event.createdAtMs);
            }
            if ((0, facebookRaceReferralDelivery_1.needsFacebookRaceReferral)(event.creatorId, event.result === "win"))
                referralUserId = event.creatorId;
            if (!referralUserId)
                transaction.update(eventRef, { delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs });
            return !existingInbox.exists;
        });
        if (referralUserId)
            await (0, facebookRaceReferralDelivery_1.finishFacebookRaceReferralDelivery)(db, eventRef, referralUserId, nowMs);
        return changed;
    });
}
//# sourceMappingURL=raceSettlementDelivery.js.map