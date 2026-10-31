"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAnswerText = exports.baseAttemptLimit = void 0;
exports.transitionSinglePlayerGuess = transitionSinglePlayerGuess;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const game_1 = require("@qwordly/core/game");
const constants_1 = require("../shared/constants");
/** Resolves the base attempt cap for a mode. */
const baseAttemptLimit = (gameMode) => gameMode === "challenge" ? constants_1.MAX_ATTEMPTS_CHALLENGE : constants_1.MAX_ATTEMPTS_CLASSIC;
exports.baseAttemptLimit = baseAttemptLimit;
/** Normalizes answer-bearing input exactly once on the trusted backend. */
const normalizeAnswerText = (value, locale) => (0, game_1.lowerCaseGraphemes)(value.trim(), locale).join("");
exports.normalizeAnswerText = normalizeAnswerText;
/** Produces a fixed replay-receipt map key. */
const receiptHash = (value) => (0, node_crypto_1.createHash)("sha256").update(value).digest("hex");
/** Applies one guess to canonical server-owned state. */
function transitionSinglePlayerGuess({ state, request, answer, locale }) {
    /** Normalizes d answer. */
    const normalizedAnswer = (0, exports.normalizeAnswerText)(answer, locale);
    /** Normalizes d guess. */
    const normalizedGuess = (0, exports.normalizeAnswerText)(request.guess, locale);
    /** Requests hash. */
    const requestHash = receiptHash(request.requestId);
    /** Provides guess hash behavior. */
    const guessHash = receiptHash(normalizedGuess);
    /** Provides prior receipt behavior. */
    const priorReceipt = state?.guessReceipts?.[requestHash];
    if (priorReceipt) {
        if (priorReceipt.guessHash !== guessHash) {
            throw new https_1.HttpsError("already-exists", "The guess request id was already used for different input.");
        }
        return { state: state, result: priorReceipt.result, replayed: true };
    }
    /** Provides continue was granted after last guess behavior. */
    const continueWasGrantedAfterLastGuess = state?.hasUsedContinue && state.attempts === (0, exports.baseAttemptLimit)(request.gameMode);
    if (state?.lastGuess === normalizedGuess && state.lastGuessResult && !continueWasGrantedAfterLastGuess) {
        return { state, result: state.lastGuessResult, replayed: true };
    }
    if (state?.terminal)
        throw new https_1.HttpsError("failed-precondition", "This riddle is already complete.");
    if (state?.awaitingContinue && !state.hasUsedContinue) {
        throw new https_1.HttpsError("failed-precondition", "Choose whether to continue before submitting another guess.");
    }
    /** Provides answer length behavior. */
    const answerLength = (0, game_1.splitGraphemes)(normalizedAnswer, locale).length;
    /** Provides guess letters behavior. */
    const guessLetters = (0, game_1.splitGraphemes)(normalizedGuess, locale);
    if (guessLetters.length !== answerLength) {
        throw new https_1.HttpsError("invalid-argument", `The guess must contain exactly ${answerLength} characters.`);
    }
    /** Provides attempts behavior. */
    const attempts = (state?.attempts ?? 0) + 1;
    /** Provides max attempts behavior. */
    const maxAttempts = (0, exports.baseAttemptLimit)(request.gameMode) + (state?.hasUsedContinue ? 1 : 0);
    if (attempts > maxAttempts)
        throw new https_1.HttpsError("failed-precondition", "No attempts remain for this riddle.");
    /** Indicates whether is correct. */
    const isCorrect = normalizedGuess === normalizedAnswer;
    /** Indicates whether can continue. */
    const canContinue = !isCorrect && attempts === (0, exports.baseAttemptLimit)(request.gameMode) && !state?.hasUsedContinue;
    /** Provides game over behavior. */
    const gameOver = isCorrect || (!canContinue && attempts >= maxAttempts);
    /** Provides feedback states behavior. */
    const feedbackStates = (0, game_1.computeFeedback)(normalizedGuess, normalizedAnswer);
    /** Provides result behavior. */
    const result = {
        feedback: guessLetters.map((letter, index) => ({ letter, status: feedbackStates[index] ?? "red" })),
        attempts,
        isCorrect,
        gameOver,
        ...(canContinue ? { canContinue: true } : {}),
    };
    /** Provides next state behavior. */
    const nextState = {
        ...(state ?? {}),
        gameMode: request.gameMode,
        riddleId: request.riddleId,
        contentKey: state?.contentKey ?? "",
        completionKey: state?.completionKey ?? "",
        locale: state?.locale ?? locale,
        answer: state?.answer ?? answer,
        attempts,
        lastGuess: normalizedGuess,
        lastGuessResult: result,
        hasUsedContinue: state?.hasUsedContinue ?? false,
        awaitingContinue: canContinue,
        terminal: gameOver,
        isCorrect,
        guessReceipts: { ...(state?.guessReceipts ?? {}), [requestHash]: { guessHash, result } },
    };
    return { state: nextState, result, replayed: false };
}
//# sourceMappingURL=singlePlayerGuessTransition.js.map