"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectPublicSinglePlayerSession = projectPublicSinglePlayerSession;
const acceptedGuesses_1 = require("@qwordly/core/validation/acceptedGuesses");
const game_1 = require("@qwordly/core/game");
const https_1 = require("firebase-functions/v2/https");
const singlePlayerGuessTransition_1 = require("./singlePlayerGuessTransition");
/** Projects bounded recovery state while rejecting an internally inconsistent session. */
function projectPublicSinglePlayerSession(state) {
    /** Provides base limit behavior. */
    const baseLimit = (0, singlePlayerGuessTransition_1.baseAttemptLimit)(state.gameMode);
    /** Provides max attempts behavior. */
    const maxAttempts = baseLimit + (state.hasUsedContinue ? 1 : 0);
    /** Provides awaiting continue behavior. */
    const awaitingContinue = state.attempts === baseLimit && !state.hasUsedContinue && !state.terminal;
    if (!Number.isInteger(state.attempts) ||
        state.attempts < 0 ||
        state.attempts > maxAttempts ||
        typeof state.hasUsedContinue !== "boolean" ||
        typeof state.awaitingContinue !== "boolean" ||
        state.awaitingContinue !== awaitingContinue) {
        throw new https_1.HttpsError("internal", "The authoritative game recovery state is invalid.");
    }
    /** Segment the issued answer; reveal only indices already durably paid for. */
    const indices = state.hintRevealedIndices ?? [];
    /** Grapheme cells preserve the issued answer shape and purchased hint locks. */
    const letters = indices.length ? (0, game_1.splitGraphemes)(state.answer, state.locale) : [];
    if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= letters.length) ||
        new Set(indices).size !== indices.length) {
        throw new https_1.HttpsError("internal", "The authoritative hint recovery state is invalid.");
    }
    /** Receipts are the durable source of accepted feedback, independent of provider saves. */
    const receipts = Object.values(state.guessReceipts ?? {});
    /** Accepted receipt feedback is ordered by consumed attempt. */
    const history = receipts.map(({ result }) => ({ attempt: result.attempts, feedback: result.feedback }))
        .sort((left, right) => left.attempt - right.attempt);
    /** Schema validation rejects malformed authoritative recovery history. */
    const parsed = acceptedGuesses_1.AcceptedGuessesSchema.safeParse(history);
    if (!parsed.success || history.some(({ attempt }) => attempt > state.attempts)) {
        throw new https_1.HttpsError("internal", "The authoritative guess recovery state is invalid.");
    }
    // Old sessions may have no receipts. Do not claim an incomplete history is authoritative.
    /** Complete accepted feedback history is optional for legacy sessions. */
    const acceptedGuesses = history.length === state.attempts ? parsed.data : undefined;
    return {
        ...(acceptedGuesses ? { acceptedGuesses } : {}),
        revealedHints: indices.map((index) => ({ index, letter: letters[index].toLocaleUpperCase(state.locale) })),
        attemptsUsed: state.attempts,
        hasUsedContinue: state.hasUsedContinue,
        awaitingContinue,
    };
}
//# sourceMappingURL=singlePlayerPublicSession.js.map