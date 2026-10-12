"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRedditLiveTournamentDeliveryInput = readRedditLiveTournamentDeliveryInput;
exports.finishRedditLiveRaceDelivery = finishRedditLiveRaceDelivery;
const race_1 = require("@qwordly/core/race");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const redditFeatureFlags_1 = require("./redditFeatureFlags");
const redditLiveRaceReferralDelivery_1 = require("./redditLiveRaceReferralDelivery");
const redditLiveRaceReferralDelivery_2 = require("./redditLiveRaceReferralDelivery");
const raceDeliveryRecords_1 = require("../race/raceDeliveryRecords");
const https_1 = require("firebase-functions/v2/https");
const redditLiveTournament_1 = require("../race/redditLiveTournament");
const redditTournament_1 = require("../race/redditTournament");
/** Eligible solve delivery and administrator dry-run share the official source validator. */
async function readRedditLiveTournamentDeliveryInput(transaction, db, receipt, nowMs) {
    /** The private record is read within the current authoritative transaction. */
    const snapshot = await transaction.get(db.doc(`liveRaceMatches/${receipt.liveMatchId}`));
    /** Private match linkage identifies the settled human winner. */
    const match = snapshot.data();
    if (!match || match.winner !== 0 && match.winner !== 1)
        throw new https_1.HttpsError("data-loss", "Stored live score winner is invalid.");
    /** Only a completed ten-riddle solve qualifies for an official tournament score. */
    const candidate = match.runs[match.winner];
    if (candidate.status !== "completed" || candidate.correctCount !== race_1.RACE_TARGET_CORRECT)
        return undefined;
    /** The official validator resolves private completion and its independent frozen deck. */
    const { run, deck } = await (0, redditLiveTournament_1.readRedditLiveTournamentRun)(transaction, db, receipt.userId, receipt.liveTicketId);
    (0, redditTournament_1.assertRedditTournamentDeck)(run, deck);
    if (run.finishedAtMs === undefined || run.finishedAtMs > nowMs)
        throw new https_1.HttpsError("data-loss", "Stored live score finish is invalid.");
    (0, redditTournament_1.deriveRedditTournamentEntry)(receipt.userId, run.locale, run, run.finishedAtMs);
    return { runId: receipt.liveTicketId, locale: run.locale };
}
/** The existing live winner receipt recovers official standings independently of a mounted browser. */
async function finishRedditLiveRaceDelivery(db, eventRef, userId, nowMs) {
    if ((0, redditFeatureFlags_1.isRedditFeatureEnabled)("tournaments")) {
        // Deletion waits for this lease before sweeping board entries. A late worker
        // cannot recreate deleted identity or tournament rows after that sweep.
        await (0, jestAccountDeletion_1.runWithJestAccountOperationLease)(userId, 120, async () => {
            /** Source validation selects only an opaque owned ticket and its exact content locale. */
            const input = await db.runTransaction(async (transaction) => {
                /** A re-read receipt prevents a deleted or acknowledged delivery from being reconstructed. */
                const current = await transaction.get(eventRef);
                if (!current.exists || current.data()?.delivered === true)
                    return undefined;
                /** Existing winner delivery receipt retains its original owner, source and retention. */
                const receipt = (0, raceDeliveryRecords_1.parseRacePerformanceEvent)(current.data(), eventRef.id);
                if (receipt.userId !== userId || receipt.expiresAt.toMillis() <= nowMs ||
                    !await (0, redditLiveRaceReferralDelivery_2.validateRedditLiveRaceReferralSource)(transaction, db, receipt, nowMs))
                    return undefined;
                return readRedditLiveTournamentDeliveryInput(transaction, db, receipt, nowMs);
            });
            if (input && (0, redditFeatureFlags_1.isRedditFeatureEnabled)("tournaments"))
                await (0, redditTournament_1.recordRedditTournamentRun)(userId, input, { db, nowMs });
        });
    }
    if ((0, redditLiveRaceReferralDelivery_1.needsRedditLiveRaceReferral)(userId)) {
        await (0, redditLiveRaceReferralDelivery_1.finishRedditLiveRaceReferralDelivery)(db, eventRef, userId, nowMs);
    }
    else {
        // Official recording and referral rewards have independent emergency switches.
        await db.runTransaction(async (transaction) => {
            /** A re-read receipt prevents a deleted or acknowledged delivery from being reconstructed. */
            const current = await transaction.get(eventRef);
            if (!current.exists || current.data()?.delivered === true)
                return;
            transaction.update(eventRef, { delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs });
        });
    }
}
//# sourceMappingURL=redditLiveRaceDelivery.js.map