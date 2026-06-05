import {graphemeLength} from "./graphemes";

/**
 * Validates that a guess is the correct length and contains only letters.
 */
export function isValidGuess(guess: string, expectedLength: number = 5): boolean {
  if (typeof guess !== "string" || guess.trim().length === 0) {
    return false;
  }

  if (graphemeLength(guess.trim()) !== expectedLength) {
    return false;
  }

  return /^[\p{L}\p{M}]+$/u.test(guess);
}
