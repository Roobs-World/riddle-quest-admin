import type {Feedback, ScoredGuess} from "./types";

/** Keyboard-state precedence: a stronger observation never regresses. */
const PRIORITY: Record<Feedback, number> = {green: 3, yellow: 2, red: 1};

/**
 * Collapses scored guesses into the strongest known feedback for each keyboard key.
 *
 * @param guesses - Submitted guesses and their positionally aligned feedback.
 * @returns A new record keyed by JavaScript-lowercased guess symbols. When a symbol
 * appears more than once, `green` takes precedence over `yellow`, which takes
 * precedence over `red`.
 *
 * @remarks
 * The function does not mutate its inputs. Each `guess` element is expected to
 * have a corresponding `feedback` element; malformed, unaligned arrays are not
 * validated at runtime.
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
