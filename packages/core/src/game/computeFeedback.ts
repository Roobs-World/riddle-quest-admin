import type {Feedback} from "./types";
import {lowerCaseGraphemes} from "./graphemes";

/**
 * Scores a guess against an answer using Wordle-style positional feedback.
 *
 * 1. First pass marks exact-position matches as green and decrements their char count.
 * 2. Second pass marks in-word-but-wrong-position letters as yellow (only while the
 *    char count > 0 to handle duplicate letters correctly).
 * 3. Everything else stays red.
 *
 * @param guess - Submitted guess. It is NFC-normalized and lowercased with the
 * default `en` locale before comparison.
 * @param answer - Correct answer, normalized in the same way as `guess`.
 * @returns One feedback value for each grapheme in `guess`, in input order.
 *
 * @remarks
 * Callers are expected to enforce equal grapheme lengths before scoring. If the
 * lengths differ, the function still returns one value per guess grapheme and
 * applies the same finite duplicate-letter counts from the supplied answer.
 */
export function computeFeedback(guess: string, answer: string): Feedback[] {
  /** Provides guess chars behavior. */
  const guessChars = lowerCaseGraphemes(guess);
  /** Provides answer chars behavior. */
  const answerChars = lowerCaseGraphemes(answer);

  /** Provides char counts behavior. */
  const charCounts: Record<string, number> = {};
  for (const ch of answerChars) {
    charCounts[ch] = (charCounts[ch] || 0) + 1;
  }

  /** Provides feedback behavior. */
  const feedback: Feedback[] = guessChars.map(() => "red");

  for (let i = 0; i < guessChars.length; i++) {
    if (guessChars[i] === answerChars[i]) {
      feedback[i] = "green";
      charCounts[guessChars[i]]--;
    }
  }

  for (let i = 0; i < guessChars.length; i++) {
    if (feedback[i] === "green") continue;
    if (charCounts[guessChars[i]] > 0) {
      feedback[i] = "yellow";
      charCounts[guessChars[i]]--;
    }
  }

  return feedback;
}
