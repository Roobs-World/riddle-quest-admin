"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFacebookLiveTournamentDeliveryInput = readFacebookLiveTournamentDeliveryInput;
exports.finishFacebookLiveRaceDelivery = finishFacebookLiveRaceDelivery;
const race_1 = require("@qwordly/core/race");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const facebookFeatureFlags_1 = require("./facebookFeatureFlags");
const facebookRaceReferralDelivery_1 = require("./facebookRaceReferralDelivery");
const facebookLiveRaceReferralDelivery_1 = require("./facebookLiveRaceReferralDelivery");
const raceDeliveryRecords_1 = require("../race/raceDeliveryRecords");
const https_1 = require("firebase-functions/v2/https");
const facebookLiveTournament_1 = require("../race/facebookLiveTournament");
const facebookTournament_1 = require("../race/facebookTournament");
const facebookContextBoard_1 = require("../race/facebookContextBoard");
const facebookContextService_1 = require("../race/facebookContextService");
/** Eligible solve delivery and administrator dry-run share the official source validator. */
async function readFacebookLiveTournamentDeliveryInput(transaction, db, receipt, nowMs) {
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
    const { run, deck } = await (0, facebookLiveTournament_1.readFacebookLiveTournamentRun)(transaction, db, receipt.userId, receipt.liveTicketId);
    (0, facebookTournament_1.assertFacebookTournamentDeck)(run, deck);
    if (run.finishedAtMs === undefined || run.finishedAtMs > nowMs)
        throw new https_1.HttpsError("data-loss", "Stored live score finish is invalid.");
    (0, facebookTournament_1.deriveFacebookTournamentEntry)(receipt.userId, run.locale, run, run.finishedAtMs);
    return { runId: receipt.liveTicketId, locale: run.locale };
}
/** The existing live winner receipt recovers official standings independently of a mounted browser. */
async function finishFacebookLiveRaceDelivery(db, eventRef, userId, nowMs, hasContext = false) {
    if (hasContext && (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("matchmaking")) {
        await (0, jestAccountDeletion_1.runWithJestAccountOperationLease)(userId, 120, async () => {
            /** Deletion, receipt/source bindings and the original active board are re-read before delivery. */
            const input = await db.runTransaction(async (transaction) => {
                /** A retired receipt cannot reconstruct a deleted score. */
                const current = await transaction.get(eventRef);
                if (!current.exists || current.data()?.delivered === true)
                    return undefined;
                /** Only a retained Facebook winner receipt can carry a context destination. */
                const receipt = (0, raceDeliveryRecords_1.parseRacePerformanceEvent)(current.data(), eventRef.id);
                if (receipt.userId !== userId || !receipt.facebookContext || receipt.expiresAt.toMillis() <= nowMs ||
                    !await (0, facebookLiveRaceReferralDelivery_1.validateFacebookLiveRaceReferralSource)(transaction, db, receipt, nowMs))
                    return undefined;
                /** Forfeit wins still grant the existing win receipt but never synthesize a context solve. */
                const score = await readFacebookLiveTournamentDeliveryInput(transaction, db, receipt, nowMs);
                if (!score)
                    return undefined;
                /** Expired, replaced or departed memberships suppress only the old context projection. */
                const snapshot = await transaction.get(db.doc(`facebookContextCompetitions/${receipt.facebookContext.contextKey}`));
                if (!snapshot.exists)
                    return undefined;
                /** Corrupt authoritative boards remain failures, rather than being silently acknowledged. */
                const board = (0, facebookContextService_1.parseFacebookContextCompetition)(snapshot.data());
                /** Only the originally captured membership may receive a delayed score. */
                const member = board.members.find(row => row.userId === userId && row.active);
                if (board.contextKey !== receipt.facebookContext.contextKey || board.locale !== score.locale || nowMs < board.createdAtMs ||
                    nowMs >= board.expiresAtMs || board.createdAtMs !== receipt.facebookContext.createdAtMs ||
                    member?.joinedAtMs !== receipt.facebookContext.joinedAtMs)
                    return undefined;
                return { ...score, binding: receipt.facebookContext };
            });
            if (input && (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("matchmaking"))
                await (0, facebookContextBoard_1.recordFacebookContextBoardBindingRun)(userId, input, { db, nowMs });
        });
    }
    if ((0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("tournaments")) {
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
                    !await (0, facebookLiveRaceReferralDelivery_1.validateFacebookLiveRaceReferralSource)(transaction, db, receipt, nowMs))
                    return undefined;
                return readFacebookLiveTournamentDeliveryInput(transaction, db, receipt, nowMs);
            });
            if (input && (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("tournaments"))
                await (0, facebookTournament_1.recordFacebookTournamentRun)(userId, input, { db, nowMs });
        });
    }
    if ((0, facebookRaceReferralDelivery_1.needsFacebookRaceReferral)(userId, true)) {
        await (0, facebookRaceReferralDelivery_1.finishFacebookRaceReferralDelivery)(db, eventRef, userId, nowMs);
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
//# sourceMappingURL=facebookLiveRaceDelivery.js.map