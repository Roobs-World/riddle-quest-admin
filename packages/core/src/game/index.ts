/**
 * Deterministic game rules shared by browser targets and authoritative services.
 *
 * @remarks
 * This entry point contains only provider-independent state transitions, scoring,
 * Unicode grapheme helpers, and shared types. It does not perform identity,
 * persistence, economy, analytics, or platform SDK operations.
 *
 * @packageDocumentation
 */
export type {Feedback, ScoredGuess} from "./types";
export {computeFeedback} from "./computeFeedback";
export {isValidGuess} from "./isValidGuess";
export {computeLetterStates} from "./computeLetterStates";
export {
  GameEngine,
  type GameEngineConfig,
  type GameEngineSnapshot,
  type GuessOutcome,
  type GameEngineMode,
} from "./GameEngine";
export {computeGuestCompletionRewards, type LocalCompletionRewards} from "./completionStrategies";
export {splitGraphemes, lowerCaseGraphemes, graphemeLength} from "./graphemes";
export {MAX_RIDDLE_ANSWER_CHARACTERS} from "./limits";

export {countCoinRewardAchievements} from "./achievementRewards";
