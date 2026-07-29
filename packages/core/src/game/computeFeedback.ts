import type {Feedback} from "./types";
import {lowerCaseGraphemes} from "./graphemes";

/**
 * Computes green/yellow/red feedback for a guess against the correct answer.
 *
 * 1. First pass marks exact-position matches as green and decrements their char count.
 * 2. Second pass marks in-word-but-wrong-position letters as yellow (only while the
 *    char count > 0 to handle duplicate letters correctly).
 * 3. Everything else stays red.
 */
export function computeFeedback(guess: string, answer: string): Feedback[] {
  const guessChars = lowerCaseGraphemes(guess);
  const answerChars = lowerCaseGraphemes(answer);

  const charCounts: Record<string, number> = {};
  for (const ch of answerChars) {
    charCounts[ch] = (charCounts[ch] || 0) + 1;
  }

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
