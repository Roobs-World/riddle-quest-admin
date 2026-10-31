"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertRaceMatchOfferForStart = assertRaceMatchOfferForStart;
exports.readRaceMatchOffer = readRaceMatchOffer;
exports.recordRaceMatchTerminal = recordRaceMatchTerminal;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const raceMatchOfferRecord_1 = require("./raceMatchOfferRecord");
const raceMatchPerformance_1 = require("./raceMatchPerformance");
/** Attribution is accepted only from the server-issued owner/challenge/language receipt. */
function assertRaceMatchOfferForStart(offer, userId, input, prepared) {
    if (!input.offerId)
        return;
    if (!offer?.exists)
        throw new https_1.HttpsError("permission-denied", "The matchmaking offer does not belong to this challenge and player.");
    /** Acceptance consumes only a validated server receipt. */
    const data = (0, raceMatchOfferRecord_1.parseRaceMatchOffer)(offer.data(), offer.id);
    if (data.userId !== userId || data.challengeId !== input.challengeId || data.locale !== input.locale) {
        throw new https_1.HttpsError("permission-denied", "The matchmaking offer does not belong to this challenge and player.");
    }
    if (data.recordingFingerprint !== undefined && data.recordingFingerprint !== prepared?.recordingFingerprint)
        throw new https_1.HttpsError("failed-precondition", "The offered recording changed during preparation.");
    if (data.acceptedRunId !== undefined)
        throw new https_1.HttpsError("already-exists", "The matchmaking offer has already been accepted.");
}
/** Reads attribution before any transaction writes; missing/deleted receipts are never recreated. */
async function readRaceMatchOffer(transaction, db, run) {
    if (!run.matchOfferId)
        return null;
    if (!/^[a-f0-9]{64}$/.test(run.matchOfferId))
        throw new https_1.HttpsError("data-loss", "Stored matchmaking attribution is invalid.");
    /** Provides offer behavior. */
    const offer = await transaction.get(db.doc(`raceMatchOffers/${run.matchOfferId}`));
    if (!offer.exists)
        return null;
    try {
        /** Derived attribution is checked independently of canonical scoring. */
        const data = (0, raceMatchOfferRecord_1.parseRaceMatchOffer)(offer.data(), offer.id);
        if (data.userId === run.userId && data.challengeId === run.challengeId && data.acceptedRunId === run.runId && data.locale === run.locale &&
            (data.recordingFingerprint === undefined || data.recordingFingerprint === run.recordingFingerprint))
            return offer;
    }
    catch (error) {
        if (!(error instanceof https_1.HttpsError) || error.code !== "data-loss")
            throw error;
    }
    // Attribution is a downstream projection; corruption must never block scoring or rewards.
    firebase_functions_1.logger.write({ severity: "ERROR", message: "Race matchmaking attribution requires repair", offerId: run.matchOfferId, runId: run.runId });
    return null;
}
/** Terminal funnel facts are deterministic projections, independent of reward delivery and retries. */
function recordRaceMatchTerminal(transaction, offer, run, nowMs) {
    if (!offer || ["prepared", "scheduled", "active"].includes(run.status))
        return;
    /** Complete observed finishes alone support prediction-error and opponent-gap calibration. */
    const sample = (0, raceMatchPerformance_1.racePerformanceSample)(run);
    /** A terminal ghost loss with fewer than ten answers remains censored, rather than a completed finish. */
    const finishedTen = run.status !== "abandoned" && run.correctCount >= 10;
    /** The original expected duration is pinned on the server-issued offer. */
    const expected = offer.data()?.expectedPerformanceMs;
    /** Actual normalized finish is absent for partial, idle and abandoned races. */
    const actual = sample?.observation === "finish" ? sample.timeMs : null;
    transaction.update(offer.ref, { finishedTen, actualPerformanceMs: actual,
        predictionLogError: actual !== null && typeof expected === "number" && Number.isFinite(expected) && expected > 0 ? Math.log(actual / expected) : null,
        opponentAdjustedFinishMs: run.opponent?.adjustedFinishMs ?? null,
        finishTimeDeltaMs: finishedTen && run.opponent ? (run.settledOutcome?.adjustedFinishMs ?? (run.wallFinishMs ?? 0) + run.hintPenaltyMs + run.skipPenaltyMs) - run.opponent.adjustedFinishMs : null,
        settlementDelayMs: run.settledAtMs !== undefined && run.finishedAtMs !== undefined ? Math.max(0, run.settledAtMs - run.finishedAtMs) : null,
        terminalStatus: run.status, terminalAtMs: run.settledAtMs ?? run.finishedAtMs ?? nowMs,
        result: run.settledOutcome?.result ?? run.result ?? null, correctCount: run.correctCount,
        hintPenaltyMs: run.hintPenaltyMs, skipPenaltyMs: run.skipPenaltyMs,
        adjustedFinishMs: run.settledOutcome?.adjustedFinishMs ?? (run.wallFinishMs ?? 0) + run.hintPenaltyMs + run.skipPenaltyMs });
}
//# sourceMappingURL=raceMatchOffer.js.map