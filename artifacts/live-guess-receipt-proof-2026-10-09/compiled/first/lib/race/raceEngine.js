"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceRules = exports.RACE_START_LEAD_MS = exports.RACE_PREPARATION_WINDOW_MS = void 0;
exports.raceOperationAtMs = raceOperationAtMs;
exports.raceHasLegacyTerminalGrant = raceHasLegacyTerminalGrant;
exports.raceClock = raceClock;
exports.raceDeadlineAtMs = raceDeadlineAtMs;
exports.refreshRaceRun = refreshRaceRun;
exports.applyRaceGuess = applyRaceGuess;
exports.applyRaceHint = applyRaceHint;
exports.applyRaceSkip = applyRaceSkip;
exports.abandonRaceRun = abandonRaceRun;
exports.toRaceRunView = toRaceRunView;
exports.raceOutcome = raceOutcome;
const game_1 = require("@qwordly/core/game");
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
/** Bounds unscored deck preparation so repeatedly postponing readiness cannot extend one attempt. */
exports.RACE_PREPARATION_WINDOW_MS = 30_000;
/** Server-scheduled countdown duration after readiness is accepted. */
exports.RACE_START_LEAD_MS = 3_000;
/** Resolves immutable per-run rules; legacy runs retain their original supported version. */
const raceRules = (run) => run.rulesSnapshot ?? race_1.RACE_RULES;
exports.raceRules = raceRules;
/** Prevents reordered commands and reads from preceding already accepted server progress. */
function raceOperationAtMs(run, sampledAtMs) {
    /** Historical scoring events provide a floor for records predating the command marker. */
    const eventWallMs = run.events.reduce((latest, event) => Math.max(latest, event.wallElapsedMs), 0);
    /** Historical scheduled runs use the same fixed lead-in even before this marker existed. */
    const readinessAtMs = run.readinessAcceptedAtMs ?? (run.status === "scheduled" ? Math.max(0, run.startedAtMs - exports.RACE_START_LEAD_MS) : 0);
    return Math.max(sampledAtMs, run.lastActionAtMs ?? 0, run.events.length ? run.startedAtMs + eventWallMs : 0, readinessAtMs, run.status === "active" ? run.startedAtMs : 0, run.status === "abandoned" ? run.finishedAtMs ?? 0 : 0, run.settledAtMs ?? 0, run.achievementProgressRecordedAtMs ?? 0, run.achievementOutcomePresentedAtMs ?? 0);
}
/** Recognizes old outcome grants which left active storage after an immutable deadline had already elapsed. */
function raceHasLegacyTerminalGrant(run) {
    if (run.recordVersion !== undefined || run.achievementProgressRecordedAtMs === undefined ||
        !["active", "completed", "timed_out"].includes(run.status) || run.achievementProgressRecordedAtMs < run.startedAtMs)
        return false;
    /** Prior outcome code applied the maximum to both roles and used strict ghost expiry. */
    const adjustedAtGrant = run.achievementProgressRecordedAtMs - run.startedAtMs + run.hintPenaltyMs + run.skipPenaltyMs;
    return Number.isSafeInteger(adjustedAtGrant) && (adjustedAtGrant >= (run.rulesSnapshot ?? race_1.RACE_RULES).maxAdjustedTimeMs ||
        run.opponent !== undefined && adjustedAtGrant > run.opponent.adjustedFinishMs);
}
/** Provides copy run behavior. */
const copyRun = (run) => ({
    ...run,
    ...(run.guessHistory ? { guessHistory: [...run.guessHistory] } : {}),
    riddles: run.riddles.map((riddle) => ({ ...riddle })),
    revealedLetters: run.revealedLetters.map((letter) => ({ ...letter })),
    events: run.events.map((event) => ({ ...event })),
    opponent: run.opponent ? { ...run.opponent, events: run.opponent.events.map((event) => ({ ...event })) } : undefined,
});
/** Calculates authoritative elapsed and penalty time for a race run. */
function raceClock(run, nowMs) {
    /** Provides total penalty ms behavior. */
    const totalPenaltyMs = run.hintPenaltyMs + run.skipPenaltyMs;
    /** Provides wall elapsed ms behavior. */
    const wallElapsedMs = run.wallFinishMs ?? (run.status === "prepared" ? 0 : Math.max(0, raceOperationAtMs(run, nowMs) - run.startedAtMs));
    return { wallElapsedMs, totalPenaltyMs, adjustedElapsedMs: wallElapsedMs + totalPenaltyMs };
}
/** Computes the next authoritative ghost/maximum-time deadline after penalties. */
function raceDeadlineAtMs(run) {
    if (run.status === "prepared")
        return run.preparationExpiresAtMs;
    if (!["active", "scheduled"].includes(run.status))
        return undefined;
    if (run.role === "creator")
        return undefined;
    /** Provides maximum behavior. */
    const maximum = (0, exports.raceRules)(run).maxAdjustedTimeMs;
    /** Provides target behavior. */
    const target = Math.min(maximum, run.opponent ? run.opponent.adjustedFinishMs + 1 : maximum);
    return run.startedAtMs + Math.max(0, target - run.hintPenaltyMs - run.skipPenaltyMs);
}
/** Provides finish run behavior. */
const finishRun = (run, result, adjustedFinishMs) => {
    /** Provides total penalty ms behavior. */
    const totalPenaltyMs = run.hintPenaltyMs + run.skipPenaltyMs;
    /** Provides wall finish ms behavior. */
    const wallFinishMs = Math.max(0, adjustedFinishMs - totalPenaltyMs);
    return {
        ...run,
        status: result === "timed_out" ? "timed_out" : "completed",
        result,
        wallFinishMs,
        finishedAtMs: run.startedAtMs + wallFinishMs,
    };
};
/** Completes a run once the tenth riddle has been cleared, whether answered or skipped. */
const finishCompletedRun = (run, nowMs) => {
    /** Adjusted finish time after any penalty attached to the clearing action. */
    const adjustedFinishMs = raceClock(run, nowMs).adjustedElapsedMs;
    /** Competitive result determined against the immutable opponent finish time. */
    const result = run.opponent
        ? adjustedFinishMs < run.opponent.adjustedFinishMs
            ? "player_win"
            : adjustedFinishMs === run.opponent.adjustedFinishMs ? "tie" : "ghost_win"
        : "recorded";
    return finishRun(run, result, adjustedFinishMs);
};
/** Refreshes time-dependent run state, including timeout and ghost completion. */
function refreshRaceRun(input, nowMs) {
    /** Scheduling and deadlines share the same accepted-progress floor as scoring. */
    const operationAtMs = raceOperationAtMs(input, nowMs);
    /** Provides run behavior. */
    const run = copyRun(input);
    if (run.status === "prepared") {
        if (run.preparationExpiresAtMs !== undefined && operationAtMs >= run.preparationExpiresAtMs) {
            return { ...run, status: "abandoned", result: null, wallFinishMs: 0, finishedAtMs: operationAtMs };
        }
        return run;
    }
    if (run.status === "scheduled" && operationAtMs >= run.startedAtMs)
        run.status = "active";
    if (run.status !== "active")
        return run;
    /** Provides clock behavior. */
    const clock = raceClock(run, raceHasLegacyTerminalGrant(run) ? run.achievementProgressRecordedAtMs : nowMs);
    if ((run.role === "challenger" || raceHasLegacyTerminalGrant(run)) && clock.adjustedElapsedMs >= (0, exports.raceRules)(run).maxAdjustedTimeMs) {
        return finishRun(run, "timed_out", (0, exports.raceRules)(run).maxAdjustedTimeMs);
    }
    if (run.opponent && clock.adjustedElapsedMs > run.opponent.adjustedFinishMs) {
        return finishRun(run, "ghost_win", run.opponent.adjustedFinishMs);
    }
    return run;
}
/** Provides require active riddle behavior. */
const requireActiveRiddle = (run, riddleId) => {
    if (run.status !== "active") {
        throw new https_1.HttpsError("failed-precondition", "This Race to 10 run is no longer active.");
    }
    /** Provides riddle behavior. */
    const riddle = run.riddles[run.currentPosition];
    if (!riddle || riddle.riddleId !== riddleId) {
        throw new https_1.HttpsError("failed-precondition", "The submitted riddle is not the active race riddle.");
    }
    return riddle;
};
/** Provides append event behavior. */
const appendEvent = (run, type, nowMs, penaltyAddedMs) => {
    /** Provides clock behavior. */
    const clock = raceClock(run, nowMs);
    run.events.push({
        sequence: run.events.length,
        type,
        riddlePosition: run.currentPosition,
        wallElapsedMs: clock.wallElapsedMs,
        penaltyAddedMs,
        totalPenaltyMs: clock.totalPenaltyMs,
        adjustedElapsedMs: clock.adjustedElapsedMs,
        correctCount: run.correctCount,
    });
};
/** Provides advance riddle behavior. */
const advanceRiddle = (run, nowMs) => {
    run.currentPosition += 1;
    run.guessesUsed = 0;
    run.guessHistory = [];
    run.hintUsed = false;
    run.revealedLetters = [];
    if (run.currentPosition >= run.riddles.length && run.correctCount < (0, exports.raceRules)(run).targetCorrect) {
        /** Provides clock behavior. */
        const clock = raceClock(run, nowMs);
        Object.assign(run, finishRun(run, "timed_out", Math.min(clock.adjustedElapsedMs, (0, exports.raceRules)(run).maxAdjustedTimeMs)));
    }
};
/** Provides finalize after penalty behavior. */
const finalizeAfterPenalty = (run, nowMs) => refreshRaceRun(run, nowMs);
/** Normalizes answer. */
const normalizeAnswer = (value, locale) => (0, game_1.lowerCaseGraphemes)(value.trim(), locale).join("");
/** Applies and validates one guess against the current authoritative riddle. */
function applyRaceGuess(input, inputData, nowMs) {
    /** Provides run behavior. */
    const run = refreshRaceRun(input, nowMs);
    /** Provides riddle behavior. */
    const riddle = requireActiveRiddle(run, inputData.riddleId);
    /** Provides guess letters behavior. */
    const guessLetters = (0, game_1.splitGraphemes)(inputData.guess.trim(), run.locale);
    /** Provides answer letters behavior. */
    const answerLetters = (0, game_1.splitGraphemes)(riddle.answer, run.locale);
    if (guessLetters.length !== answerLetters.length) {
        throw new https_1.HttpsError("invalid-argument", `Guess must contain exactly ${answerLetters.length} characters.`);
    }
    /** Provides statuses behavior. */
    const statuses = (0, game_1.computeFeedback)(inputData.guess.trim(), riddle.answer, run.locale);
    /** Provides feedback behavior. */
    const feedback = guessLetters.map((letter, index) => ({ letter, status: statuses[index] }));
    /** Indicates whether is correct. */
    const isCorrect = normalizeAnswer(inputData.guess, run.locale) === normalizeAnswer(riddle.answer, run.locale);
    run.guessesUsed += 1;
    run.guessHistory = [...(run.guessHistory ?? []), inputData.guess.trim()];
    if (isCorrect) {
        run.correctCount += 1;
        appendEvent(run, "correct", nowMs, 0);
        if (run.correctCount >= (0, exports.raceRules)(run).targetCorrect) {
            return { run: finishCompletedRun(run, nowMs), feedback, isCorrect, autoSkipped: false };
        }
        advanceRiddle(run, nowMs);
        return { run, feedback, isCorrect, autoSkipped: false };
    }
    if (run.guessesUsed >= (0, exports.raceRules)(run).maxGuessesPerRiddle) {
        run.skipPenaltyMs += (0, exports.raceRules)(run).skipPenaltyMs;
        run.correctCount += 1;
        appendEvent(run, "skip", nowMs, (0, exports.raceRules)(run).skipPenaltyMs);
        if (run.correctCount >= (0, exports.raceRules)(run).targetCorrect) {
            return { run: finishCompletedRun(run, nowMs), feedback, isCorrect, autoSkipped: true };
        }
        advanceRiddle(run, nowMs);
        return { run: finalizeAfterPenalty(run, nowMs), feedback, isCorrect, autoSkipped: true };
    }
    return { run, feedback, isCorrect, autoSkipped: false };
}
/** Reveals one server-selected letter and applies the configured hint penalty. */
function applyRaceHint(input, inputData, nowMs) {
    /** Provides run behavior. */
    const run = refreshRaceRun(input, nowMs);
    /** Provides riddle behavior. */
    const riddle = requireActiveRiddle(run, inputData.riddleId);
    /** Provides answer behavior. */
    const answer = (0, game_1.splitGraphemes)(riddle.answer, run.locale);
    /** Provides revealed behavior. */
    const revealed = new Set(run.revealedLetters.map((letter) => letter.index));
    /** Provides index behavior. */
    const index = answer.findIndex((_, candidateIndex) => !revealed.has(candidateIndex));
    if (run.revealedLetters.length >= (0, exports.raceRules)(run).maxHintsPerRiddle || index < 0)
        throw new https_1.HttpsError("failed-precondition", "No unrevealed race hint is available.");
    run.hintUsed = true;
    run.hintPenaltyMs += (0, exports.raceRules)(run).hintPenaltyMs;
    /** Provides revealed letter behavior. */
    const revealedLetter = answer[index];
    run.revealedLetters.push({ index, letter: revealedLetter });
    appendEvent(run, "hint", nowMs, (0, exports.raceRules)(run).hintPenaltyMs);
    return { run: finalizeAfterPenalty(run, nowMs), revealedLetter, index };
}
/** Skips the current riddle after a guess and applies the configured penalty. */
function applyRaceSkip(input, inputData, nowMs) {
    /** Provides run behavior. */
    const run = refreshRaceRun(input, nowMs);
    requireActiveRiddle(run, inputData.riddleId);
    run.skipPenaltyMs += (0, exports.raceRules)(run).skipPenaltyMs;
    run.correctCount += 1;
    appendEvent(run, "skip", nowMs, (0, exports.raceRules)(run).skipPenaltyMs);
    if (run.correctCount >= (0, exports.raceRules)(run).targetCorrect)
        return finishCompletedRun(run, nowMs);
    advanceRiddle(run, nowMs);
    return finalizeAfterPenalty(run, nowMs);
}
/** Marks an active run abandoned without producing a competitive result. */
function abandonRaceRun(input, nowMs) {
    /** Provides run behavior. */
    const run = refreshRaceRun(input, nowMs);
    if (run.status === "abandoned")
        return run;
    if (!["prepared", "scheduled", "active"].includes(run.status)) {
        throw new https_1.HttpsError("failed-precondition", "This Race to 10 run already has a final result.");
    }
    /** Provides clock behavior. */
    const clock = raceClock(run, nowMs);
    return {
        ...run,
        status: "abandoned",
        result: null,
        wallFinishMs: clock.wallElapsedMs,
        finishedAtMs: raceOperationAtMs(run, nowMs),
    };
}
/** Projects server-only run state, optionally including the complete immutable evaluation deck. */
function toRaceRunView(input, nowMs, includeEvaluation = false, includeGuessHistory = false) {
    /** Provides run behavior. */
    const run = refreshRaceRun(input, nowMs);
    includeEvaluation = includeEvaluation && run.evaluationPolicy !== "server-only";
    /** Provides clock behavior. */
    const clock = raceClock(run, nowMs);
    /** Provides current behavior. */
    const current = ["prepared", "scheduled", "active"].includes(run.status) ? run.riddles[run.currentPosition] : undefined;
    /** Provides linked opponent identity behavior. */
    const linkedOpponentIdentity = typeof run.opponent?.subjectUserId === "string" && run.opponent.subjectUserId.length > 0;
    return {
        runId: run.runId,
        challengeId: run.challengeId,
        rivalryChallengeId: run.rivalryChallengeId,
        role: run.role,
        status: run.status,
        serverNowMs: raceOperationAtMs(run, nowMs),
        ...(run.status !== "prepared" ? { startsAtMs: run.startedAtMs } : {}),
        ...(run.preparationExpiresAtMs !== undefined ? { preparationExpiresAtMs: run.preparationExpiresAtMs } : {}),
        categoryId: run.categoryId,
        locale: run.locale,
        rules: (0, exports.raceRules)(run),
        correctCount: run.correctCount,
        wallElapsedMs: clock.wallElapsedMs,
        totalPenaltyMs: clock.totalPenaltyMs,
        adjustedElapsedMs: clock.adjustedElapsedMs,
        currentRiddle: current
            ? {
                riddleId: current.riddleId,
                text: current.text,
                answerLength: (0, game_1.splitGraphemes)(current.answer, run.locale).length,
                position: current.position,
                guessesUsed: run.guessesUsed,
                ...(includeGuessHistory ? { confirmedGuesses: (run.guessHistory ?? []).map(guess => ({
                        guess: (0, game_1.splitGraphemes)(guess, run.locale), feedback: (0, game_1.computeFeedback)(guess, current.answer),
                    })) } : {}),
                guessesRemaining: (0, exports.raceRules)(run).maxGuessesPerRiddle - run.guessesUsed,
                hintAvailable: run.revealedLetters.length < Math.min((0, exports.raceRules)(run).maxHintsPerRiddle, (0, game_1.splitGraphemes)(current.answer, run.locale).length),
                revealedLetters: run.revealedLetters.map((letter) => ({ ...letter })),
                ...(includeEvaluation ? { evaluation: { answer: current.answer, locale: run.locale } } : {}),
            }
            : null,
        ...(includeEvaluation
            ? {
                preloadedRiddles: run.riddles.map((riddle) => ({
                    /** Graphemes are computed once so the exact server hint is available before play. */
                    hint: { index: 0, letter: (0, game_1.splitGraphemes)(riddle.answer, run.locale)[0] },
                    riddleId: riddle.riddleId,
                    text: riddle.text,
                    answerLength: (0, game_1.splitGraphemes)(riddle.answer, run.locale).length,
                    position: riddle.position,
                    evaluation: { answer: riddle.answer, locale: run.locale },
                })),
            }
            : {}),
        events: run.events.map((event) => ({ ...event })),
        opponent: run.opponent
            ? {
                displayName: linkedOpponentIdentity || run.opponent.kind === "bot" ? run.opponent.displayName : "Riddle Quest player",
                ...(linkedOpponentIdentity ? { avatarUrl: run.opponent.avatarUrl } : {}),
                adjustedFinishMs: run.opponent.adjustedFinishMs,
                events: run.opponent.events.map((event) => ({ ...event })),
            }
            : undefined,
    };
}
/** Produces the final public outcome for a completed authoritative run. */
function raceOutcome(run, nowMs) {
    /** Provides refreshed behavior. */
    const refreshed = refreshRaceRun(run, nowMs);
    /** Provides clock behavior. */
    const clock = raceClock(refreshed, nowMs);
    /** Provides total penalty ms behavior. */
    const totalPenaltyMs = refreshed.hintPenaltyMs + refreshed.skipPenaltyMs;
    if (!refreshed.result || refreshed.status === "active") {
        throw new https_1.HttpsError("failed-precondition", "The Race to 10 run does not have a final outcome yet.");
    }
    return {
        runId: refreshed.runId,
        challengeId: refreshed.challengeId,
        result: refreshed.result,
        correctCount: refreshed.correctCount,
        wallFinishMs: clock.wallElapsedMs,
        hintPenaltyMs: refreshed.hintPenaltyMs,
        skipPenaltyMs: refreshed.skipPenaltyMs,
        totalPenaltyMs,
        adjustedFinishMs: clock.adjustedElapsedMs,
        opponentAdjustedFinishMs: refreshed.opponent?.adjustedFinishMs,
        publishable: refreshed.role === "creator" && refreshed.result === "recorded" && refreshed.correctCount === (0, exports.raceRules)(refreshed).targetCorrect,
        rematchEligible: refreshed.role === "challenger" && refreshed.status === "completed",
        newlyUnlockedAchievementIds: [],
        achievementCoinsAwarded: 0,
    };
}
//# sourceMappingURL=raceEngine.js.map