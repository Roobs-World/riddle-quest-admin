/**
 * Represents a guess that was submitted and scored by the game engine.
 */
export interface SubmittedGuess {
  /** Guess letters in their submitted order. */
  guess: string[];
  /** Per-letter feedback aligned by index with `guess`. */
  feedback: Feedback[];
}

/**
 * Per-letter evaluation produced after a submitted guess.
 */
export type Feedback = "green" | "yellow" | "red";

/**
 * High-level game result for the current riddle.
 */
export type GameOutcome = "win" | "loss" | null;
