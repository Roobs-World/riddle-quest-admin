import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../../../gameplay/rules/limits";
import {type Feedback, type ScoredGuess} from "../../../gameplay/contracts/scoring";
import {type GameEngineSnapshot} from "../../../gameplay/controllers/GameEngine";
import type {PlayerData, SavedGame} from "../../../platform/contracts/capabilities";
import {parseDraftCheckpointRevision} from "../../../gameplay/session/checkpoints/draftCheckpointRevision";

/** Defines the max saved guesses value. */
const MAX_SAVED_GUESSES = 6;
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** Indicates whether is bounded string. */
const isBoundedString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength;
/** Indicates whether is feedback. */
const isFeedback = (value: unknown): value is Feedback => value === "green" || value === "yellow" || value === "red";

/** Parses scored guesses. */
const parseScoredGuesses = (value: unknown, answerLength: number): ScoredGuess[] | null => {
  if (!Array.isArray(value) || value.length > MAX_SAVED_GUESSES) return null;
  /** Provides guesses behavior. */
  const guesses: ScoredGuess[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !Array.isArray(candidate.guess) || !Array.isArray(candidate.feedback)) return null;
    if (candidate.guess.length !== answerLength || candidate.feedback.length !== answerLength) return null;
    if (!candidate.guess.every((letter) => typeof letter === "string" && letter.length <= 16)) return null;
    if (!candidate.feedback.every(isFeedback)) return null;
    guesses.push({guess: [...candidate.guess], feedback: [...candidate.feedback]});
  }
  return guesses;
};

/** Parses engine snapshot. */
const parseEngineSnapshot = (
  value: unknown,
  answerLength: number,
  restoredGuesses: ScoredGuess[],
): GameEngineSnapshot | null => {
  if (!isRecord(value)) return null;
  /** Provides guesses behavior. */
  const guesses = parseScoredGuesses(value.guesses, answerLength);
  if (
    !guesses ||
    JSON.stringify(guesses) !== JSON.stringify(restoredGuesses) ||
    !Number.isInteger(value.attemptsUsed) ||
    (value.attemptsUsed as number) < 0 ||
    (value.attemptsUsed as number) > MAX_SAVED_GUESSES ||
    (value.attemptsUsed as number) < guesses.length ||
    typeof value.hasUsedContinue !== "boolean" ||
    typeof value.gameOver !== "boolean"
  )
    return null;
  return {
    guesses,
    attemptsUsed: value.attemptsUsed as number,
    hasUsedContinue: value.hasUsedContinue,
    gameOver: value.gameOver,
  };
};

/** Parses letter states. */
const parseLetterStates = (value: unknown): Record<string, Feedback> | null => {
  if (!isRecord(value)) return null;
  /** Provides entries behavior. */
  const entries = Object.entries(value);
  if (entries.length > 64) return null;
  if (!entries.every(([letter, feedback]) => isBoundedString(letter, 16) && isFeedback(feedback))) return null;
  return Object.fromEntries(entries) as Record<string, Feedback>;
};

/** Parses low-integrity platform storage into one bounded, internally consistent game snapshot. */
export const parseSavedGame = (value: unknown): SavedGame | null => {
  if (!isRecord(value)) return null;
  if (
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.savedAt) ||
    (value.savedAt as number) < 0 ||
    !isBoundedString(value.riddleId, 128) ||
    !isBoundedString(value.sessionToken, 128) ||
    value.sessionToken.length < 20 ||
    (value.gameMode !== "classic" && value.gameMode !== "challenge") ||
    !Array.isArray(value.currentLetters) ||
    value.currentLetters.length < 1 ||
    value.currentLetters.length > MAX_RIDDLE_ANSWER_CHARACTERS ||
    !value.currentLetters.every((letter) => typeof letter === "string" && letter.length <= 16) ||
    !Number.isInteger(value.activeSlotIndex) ||
    (value.activeSlotIndex as number) < 0 ||
    (value.activeSlotIndex as number) >= value.currentLetters.length ||
    !Array.isArray(value.hintRevealedIndices) ||
    value.hintRevealedIndices.length > value.currentLetters.length ||
    !value.hintRevealedIndices.every(
      (index) => Number.isInteger(index) && index >= 0 && index < (value.currentLetters as unknown[]).length,
    ) ||
    new Set(value.hintRevealedIndices).size !== value.hintRevealedIndices.length
  )
    return null;
  /** Provides guesses behavior. */
  const guesses = parseScoredGuesses(value.guesses, value.currentLetters.length);
  /** Provides engine snapshot behavior. */
  const engineSnapshot = guesses
    ? parseEngineSnapshot(value.engineSnapshot, value.currentLetters.length, guesses)
    : null;
  /** Provides letter states behavior. */
  const letterStates = parseLetterStates(value.letterStates);
  if (!guesses || !engineSnapshot || !letterStates) return null;
  /** Provides inferred awaiting continue behavior. */
  const inferredAwaitingContinue =
    !engineSnapshot.gameOver && !engineSnapshot.hasUsedContinue && engineSnapshot.attemptsUsed === 5;
  if (
    value.awaitingContinue !== undefined &&
    (typeof value.awaitingContinue !== "boolean" || value.awaitingContinue !== inferredAwaitingContinue)
  )
    return null;
  /** Provides pending outcome behavior. */
  let pendingOutcome: SavedGame["pendingOutcome"];
  if (value.pendingOutcome !== undefined) {
    /** Provides outcome behavior. */
    const outcome = value.pendingOutcome;
    if (
      !isRecord(outcome) ||
      !isBoundedString(outcome.id, 256) ||
      (outcome.kind !== "win" && outcome.kind !== "loss") ||
      outcome.riddleId !== value.riddleId ||
      outcome.gameMode !== value.gameMode ||
      outcome.sessionToken !== value.sessionToken ||
      !Number.isInteger(outcome.attempts) ||
      (outcome.attempts as number) < 1 ||
      (outcome.attempts as number) > MAX_SAVED_GUESSES ||
      typeof outcome.isCorrect !== "boolean" ||
      (outcome.kind === "win") !== outcome.isCorrect
    )
      return null;
    pendingOutcome = {
      id: outcome.id,
      kind: outcome.kind,
      riddleId: outcome.riddleId,
      gameMode: outcome.gameMode as "classic" | "challenge",
      sessionToken: outcome.sessionToken,
      attempts: outcome.attempts as number,
      isCorrect: outcome.isCorrect,
    };
  }
  /** Malformed optional ordering does not discard valid saved progress. */
  const draftRevision = parseDraftCheckpointRevision(value.draftRevision);
  return {
    schemaVersion: 1,
    savedAt: value.savedAt as number,
    ...(draftRevision ? {draftRevision} : {}),
    riddleId: value.riddleId,
    sessionToken: value.sessionToken,
    gameMode: value.gameMode,
    currentLetters: [...value.currentLetters],
    activeSlotIndex: value.activeSlotIndex as number,
    hintRevealedIndices: [...value.hintRevealedIndices] as number[],
    guesses,
    engineSnapshot,
    awaitingContinue: inferredAwaitingContinue,
    letterStates,
    ...(pendingOutcome ? {pendingOutcome} : {}),
  };
};

/**
 * Parses low-integrity provider storage into the single shared player-data contract.
 *
 * Profile and active-game fields are independently discarded when malformed so
 * one stale optional field cannot prevent the bounded envelope from restoring.
 *
 * @param value Untrusted value read from provider-owned browser storage.
 * @returns A bounded player-data snapshot, or null when the envelope is invalid.
 */
export async function parsePlayerData(value: unknown): Promise<PlayerData | null> {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.updatedAt) ||
    (value.updatedAt as number) < 0
  )
    return null;
  /** Provides {bridge profile schema} behavior. */
  const {BridgeProfileSchema} = await import("../../../platform/bridge/messages");
  /** Provides profile behavior. */
  const profile = BridgeProfileSchema.safeParse(value.profile);
  /** Provides active game behavior. */
  const activeGame = value.activeGame === null ? null : parseSavedGame(value.activeGame);
  return {
    schemaVersion: 1,
    updatedAt: value.updatedAt as number,
    ...(profile.success ? {profile: profile.data} : {}),
    ...(value.activeGame === null || activeGame ? {activeGame} : {}),
  };
}
