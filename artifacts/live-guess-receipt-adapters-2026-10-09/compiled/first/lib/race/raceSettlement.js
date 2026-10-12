"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creatorRaceResult = creatorRaceResult;
exports.settleRaceRun = settleRaceRun;
exports.readSettledRaceOutcome = readSettledRaceOutcome;
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const raceAchievements_1 = require("./raceAchievements");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceEngine_1 = require("./raceEngine");
const raceOpponentPrivacy_1 = require("./raceOpponentPrivacy");
const raceSetupService_1 = require("./raceSetupService");
const raceMatchOffer_1 = require("./raceMatchOffer");
const raceStoredRecords_1 = require("./raceStoredRecords");
/** Maps a canonical challenger outcome into the recording creator's result. */
function creatorRaceResult(result) {
    if (result === "player_win")
        return "loss";
    if (result === "tie")
        return "tie";
    if (result === "ghost_win" || result === "timed_out")
        return "win";
    throw new https_1.HttpsError("failed-precondition", "A solo recording has no opposing result.");
}
/**
 * Settles a terminal run and its owner rewards once inside the caller's transaction.
 * Reads precede writes. The run is the settlement receipt; copied provider identities
 * never enter the creator-delivery outbox. Active and abandoned runs earn no rewards.
 */
async function settleRaceRun(transaction, db, input, sampledAtMs) {
    // Enforce canonical scoring even for internal callers passing a typed record directly.
    (0, raceStoredRecords_1.assertRaceStoredRecord)(input, "run");
    /** Receipt, achievement and outbox clocks cannot precede accepted command progress. */
    const nowMs = (0, raceEngine_1.raceOperationAtMs)(input, sampledAtMs);
    /** Provides privacy behavior. */
    const privacy = await (0, raceOpponentPrivacy_1.resolveRaceOpponentPrivacy)(transaction, db, input);
    /** Provides offer behavior. */
    const offer = await (0, raceMatchOffer_1.readRaceMatchOffer)(transaction, db, input);
    if (["prepared", "scheduled", "active"].includes(input.status) && privacy.run.opponent?.subjectUserId) {
        /** Provides opponent behavior. */
        const opponent = privacy.run.opponent.subjectUserId;
        /** Provides blocks behavior. */
        const blocks = await Promise.all([
            transaction.get(db.doc(`users/${input.userId}/blockedRivals/${opponent}`)),
            transaction.get(db.doc(`users/${opponent}/blockedRivals/${input.userId}`)),
        ]);
        if (blocks.some((block) => block.exists)) {
            /** Provides abandoned behavior. */
            const abandoned = { ...privacy.run, status: "abandoned", result: null,
                wallFinishMs: (0, raceEngine_1.raceClock)(input, nowMs).wallElapsedMs, finishedAtMs: nowMs };
            transaction.set(db.doc(`raceRuns/${input.runId}`), (0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(abandoned, privacy.scrubbed), { merge: true });
            (0, raceMatchOffer_1.recordRaceMatchTerminal)(transaction, offer, abandoned, nowMs);
            return abandoned;
        }
    }
    /** Provides run behavior. */
    const run = (0, raceEngine_1.refreshRaceRun)(privacy.run, nowMs);
    if (["prepared", "scheduled", "active", "abandoned"].includes(run.status) || run.settledAtMs !== undefined) {
        if (run.status !== input.status)
            transaction.set(db.doc(`raceRuns/${run.runId}`), (0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(run, privacy.scrubbed), { merge: true });
        (0, raceMatchOffer_1.recordRaceMatchTerminal)(transaction, offer, run, nowMs);
        return run;
    }
    /** Provides outcome behavior. */
    const outcome = (0, raceEngine_1.raceOutcome)(run, nowMs);
    // Check the complete receipt before granting rewards, including a finish after the settlement clock.
    (0, raceStoredRecords_1.assertRaceStoredRecord)({ ...run, settledAtMs: nowMs, settledOutcome: outcome }, "run");
    /** Provides owner ref behavior. */
    const ownerRef = db.doc(`users/${run.userId}`);
    /** Provides [owner, deletion] behavior. */
    const [owner, deletion] = await Promise.all([
        transaction.get(ownerRef),
        transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, run.userId)),
    ]);
    // Deleted accounts must never be recreated by a delayed deadline or retry.
    if (deletion.exists || !owner.exists) {
        /** Provides settled behavior. */
        const settled = { ...run, settledAtMs: nowMs, settledOutcome: outcome };
        transaction.set(db.doc(`raceRuns/${run.runId}`), (0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(settled, privacy.scrubbed), { merge: true });
        (0, raceMatchOffer_1.recordRaceMatchTerminal)(transaction, offer, settled, nowMs);
        return settled;
    }
    /** Provides award behavior. */
    const award = run.achievementProgressRecordedAtMs === undefined
        ? (0, raceSetupService_1.persistRaceAchievementEvent)(transaction, ownerRef, owner.data() ?? {}, {
            kind: "completed",
            won: outcome.result === "player_win",
            cleanRun: outcome.correctCount === race_1.RACE_TARGET_CORRECT && outcome.totalPenaltyMs === 0,
        }, nowMs)
        : undefined;
    /** Provides settled behavior. */
    const settled = {
        ...run,
        settledAtMs: nowMs,
        settledOutcome: outcome,
        achievementProgressRecordedAtMs: run.achievementProgressRecordedAtMs ?? nowMs,
        ...(award ? { settlementAwards: {
                newlyUnlockedAchievementIds: award.newlyUnlockedAchievementIds,
                achievementCoinsAwarded: award.achievementCoinsAwarded,
            } } : {}),
    };
    transaction.set(db.doc(`raceRuns/${run.runId}`), (0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(settled, privacy.scrubbed), { merge: true });
    (0, raceMatchOffer_1.recordRaceMatchTerminal)(transaction, offer, settled, nowMs);
    transaction.create(db.doc(`racePerformanceOutbox/${run.runId}`), {
        runId: run.runId, userId: run.userId, createdAtMs: nowMs, ...(0, raceDeliveryFailures_1.pendingRaceDelivery)(nowMs),
        expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nowMs + race_1.RACE_CHALLENGE_TTL_MS),
    });
    if (run.challengeId && run.opponent?.subjectUserId) {
        transaction.create(db.doc(`raceSettlementOutbox/${run.runId}`), (0, raceSetupService_1.stripUndefined)({
            runId: run.runId,
            userId: run.userId,
            creatorId: run.opponent.subjectUserId,
            challengeId: run.challengeId,
            categoryId: run.categoryId,
            result: creatorRaceResult(outcome.result),
            adjustedDeltaMs: outcome.adjustedFinishMs - run.opponent.adjustedFinishMs,
            createdAtMs: nowMs,
            ...(0, raceDeliveryFailures_1.pendingRaceDelivery)(nowMs),
            expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nowMs + race_1.RACE_CHALLENGE_TTL_MS),
        }));
    }
    return settled;
}
/** Returns a settled outcome and presents already-granted rewards at most once. */
async function readSettledRaceOutcome(transaction, db, run, sampledAtMs) {
    /** Reward presentation follows the same canonical clock floor as settlement. */
    const nowMs = (0, raceEngine_1.raceOperationAtMs)(run, sampledAtMs);
    // Fetch before settlement can write; the transaction retries if the balance changes.
    /** Provides owner behavior. */
    const owner = await transaction.get(db.doc(`users/${run.userId}`));
    if (!owner.exists)
        throw new https_1.HttpsError("internal", "Player progress is unavailable for this race.");
    /** Provides settled behavior. */
    const settled = await settleRaceRun(transaction, db, run, nowMs);
    /** Provides outcome behavior. */
    const outcome = settled.settledOutcome ?? (0, raceEngine_1.raceOutcome)(settled, nowMs);
    if (!settled.settlementAwards || settled.achievementOutcomePresentedAtMs !== undefined)
        return acceptedRaceOutcome(outcome);
    /** Provides coins behavior. */
    const coins = (0, raceSetupService_1.readRaceCoinBalance)(owner.data() ?? {});
    /** The exact public reward response must succeed before consuming its presentation receipt. */
    const response = acceptedRaceOutcome({
        ...outcome,
        ...settled.settlementAwards,
        newCoins: coins + (run.achievementProgressRecordedAtMs === undefined ? settled.settlementAwards.achievementCoinsAwarded : 0),
    });
    transaction.set(db.doc(`raceRuns/${run.runId}`), { achievementOutcomePresentedAtMs: nowMs }, { merge: true });
    return response;
}
/** Rejects an undeliverable public outcome inside the caller's transaction without exposing stored diagnostics. */
function acceptedRaceOutcome(outcome) {
    /** Public reward identifiers and safe currency values are stricter than optional storage metadata. */
    const accepted = race_1.RaceOutcomeSchema.safeParse(outcome);
    if (!accepted.success || !(0, raceAchievements_1.raceRewardAwardsAgree)(accepted.data.newlyUnlockedAchievementIds, accepted.data.achievementCoinsAwarded))
        throw new https_1.HttpsError("data-loss", "Stored race outcome is invalid.");
    return accepted.data;
}
const raceDeliveryFailures_1 = require("./raceDeliveryFailures");
//# sourceMappingURL=raceSettlement.js.map