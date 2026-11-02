import {AcceptedGuessesSchema} from "@riddle-quest/core/validation/acceptedGuesses";
import {splitGraphemes} from "@riddle-quest/core/game";
import {HttpsError} from "firebase-functions/v2/https";
import {baseAttemptLimit} from "./singlePlayerGuessTransition";
import type {SinglePlayerSessionState} from "./singlePlayerSessionTypes";

/** Answer-free recovery state returned with a playable riddle. */
export type PublicSinglePlayerSessionStatus = {
  /** Purchased letters restored independently of provider checkpoints. */ revealedHints: {
    /** Zero-based answer slot must stay within the issued grapheme shape. */
    index: number;
    /** One answer grapheme occupies its original positional slot. */
    letter: string}[];
  /** Accepted feedback only; absent for legacy sessions without complete receipts. */ acceptedGuesses?: {
    /** Accepted attempt number orders recovered feedback rows. */
    attempt: number;
    /** Positional scoring colors accompany the accepted submitted graphemes. */
    feedback: {
    /** One answer grapheme occupies its original positional slot. */
    letter: string;
    /** Accepted positional color is green, yellow or red. */
    status: "green" | "yellow" | "red"}[]}[];
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
  /** Segment the issued answer; reveal only indices already durably paid for. */
  const indices = state.hintRevealedIndices ?? [];
  /** Grapheme cells preserve the issued answer shape and purchased hint locks. */
  const letters = indices.length ? splitGraphemes(state.answer, state.locale) : [];
  if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= letters.length) ||
    new Set(indices).size !== indices.length) {
    throw new HttpsError("internal", "The authoritative hint recovery state is invalid.");
  }
  /** Receipts are the durable source of accepted feedback, independent of provider saves. */
  const receipts = Object.values(state.guessReceipts ?? {});
  /** Accepted receipt feedback is ordered by consumed attempt. */
  const history = receipts.map(({result}) => ({attempt: result.attempts, feedback: result.feedback}))
    .sort((left, right) => left.attempt - right.attempt);
  /** Schema validation rejects malformed authoritative recovery history. */
  const parsed = AcceptedGuessesSchema.safeParse(history);
  if (!parsed.success || history.some(({attempt}) => attempt > state.attempts)) {
    throw new HttpsError("internal", "The authoritative guess recovery state is invalid.");
  }
  // Old sessions may have no receipts. Do not claim an incomplete history is authoritative.
  /** Complete accepted feedback history is optional for legacy sessions. */
  const acceptedGuesses = history.length === state.attempts ? parsed.data : undefined;
  return {
    ...(acceptedGuesses ? {acceptedGuesses} : {}),
    revealedHints: indices.map((index) => ({index, letter: letters[index].toLocaleUpperCase(state.locale)})),
    attemptsUsed: state.attempts,
    hasUsedContinue: state.hasUsedContinue,
    awaitingContinue,
  };
}
