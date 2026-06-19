import type {Feedback, ScoredGuess} from "./types";

const PRIORITY: Record<Feedback, number> = {green: 3, yellow: 2, red: 1};

/**
 * Derives the highest-priority feedback state for every letter in submitted guesses.
 */
export function computeLetterStates(guesses: ScoredGuess[]): Record<string, Feedback> {
  const states: Record<string, Feedback> = {};

  for (const {guess, feedback} of guesses) {
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
