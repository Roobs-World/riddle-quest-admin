import type {Feedback as CoreFeedback, ScoredGuess} from "@qwordly/core";

export type Feedback = CoreFeedback;

/** Represents a guess that was submitted and scored by the game engine. */
export type SubmittedGuess = ScoredGuess;

/**
 * High-level game result for the current riddle.
 */
export type GameOutcome = "win" | "loss" | null;
