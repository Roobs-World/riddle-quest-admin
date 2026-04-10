/**
 * @fileoverview Keyboard letter-state derivation utility.
 *
 * Computes the best known state for each letter across all submitted guesses
 * so the on-screen keyboard can colour-hint previously used keys.
 *
 * Priority: green > yellow > red
 * - A letter locked to "green" (correct position) is never downgraded.
 * - A letter known to be "yellow" (present, wrong position) beats "red".
 * - This mirrors the convention used by Wordle and similar games.
 */

import type { SubmittedGuess, Feedback } from "../hooks/types";

const PRIORITY: Record<Feedback, number> = { green: 3, yellow: 2, red: 1 };

/**
 * Derives the highest-priority feedback state for every letter that appears
 * in the submitted guesses.
 *
 * @param guesses  All guesses submitted so far.
 * @returns  A map from lowercase letter → its best Feedback state.
 *           Letters that have never been guessed are not present in the map.
 */
export function computeLetterStates(
  guesses: SubmittedGuess[]
): Record<string, Feedback> {
  const states: Record<string, Feedback> = {};

  for (const { guess, feedback } of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i].toLowerCase();
      const incoming = feedback[i];
      const existing = states[letter];

      if (!existing || PRIORITY[incoming] > PRIORITY[existing]) {
        states[letter] = incoming;
      }
    }
  }

  return states;
}

