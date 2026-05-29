/** Per-letter evaluation produced after a submitted guess. */
export type Feedback = "green" | "yellow" | "red";

/** A guess that was submitted and scored by the game engine. */
export interface ScoredGuess {
  guess: string[];
  feedback: Feedback[];
}
