/**
 * Per-grapheme evaluation produced after a submitted guess.
 *
 * `green` is an exact-position match, `yellow` exists elsewhere in the answer,
 * and `red` has no remaining unmatched occurrence in the answer.
 */
export type Feedback = "green" | "yellow" | "red";

/** A submitted guess paired with its positionally aligned evaluation. */
export interface ScoredGuess {
  /** Ordered grapheme strings submitted by the player. */
  guess: string[];
  /** Feedback at the matching index in {@link ScoredGuess.guess}. */
  feedback: Feedback[];
}
