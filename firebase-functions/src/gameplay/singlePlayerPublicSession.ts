import {HttpsError} from "firebase-functions/v2/https";
import {baseAttemptLimit} from "./singlePlayerGuessTransition";
import type {SinglePlayerSessionState} from "./singlePlayerSessionTypes";

/** Answer-free recovery state returned with a playable riddle. */
export type PublicSinglePlayerSessionStatus = {
  /** Number of guesses already accepted by the backend. */ attemptsUsed: number;
  /** Indicates whether the paid extra attempt was already granted. */ hasUsedContinue: boolean;
  /** Indicates whether the player must choose Continue or decline before guessing. */ awaitingContinue: boolean;
};

/** Projects bounded recovery state while rejecting an internally inconsistent session. */
export function projectPublicSinglePlayerSession(state: SinglePlayerSessionState): PublicSinglePlayerSessionStatus {
  /** Provides base limit behavior. */
  const baseLimit = baseAttemptLimit(state.gameMode);
  /** Provides max attempts behavior. */
  const maxAttempts = baseLimit + (state.hasUsedContinue ? 1 : 0);
  /** Provides awaiting continue behavior. */
  const awaitingContinue = state.attempts === baseLimit && !state.hasUsedContinue && !state.terminal;
  if (
    !Number.isInteger(state.attempts) ||
    state.attempts < 0 ||
    state.attempts > maxAttempts ||
    typeof state.hasUsedContinue !== "boolean" ||
    typeof state.awaitingContinue !== "boolean" ||
    state.awaitingContinue !== awaitingContinue
  ) {
    throw new HttpsError("internal", "The authoritative game recovery state is invalid.");
  }
  return {
    attemptsUsed: state.attempts,
    hasUsedContinue: state.hasUsedContinue,
    awaitingContinue,
  };
}
