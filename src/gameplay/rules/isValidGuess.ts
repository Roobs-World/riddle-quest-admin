import {graphemeLength} from "../input/graphemes";

/**
 * Checks whether a guess fits the local keyboard's Unicode character policy.
 *
 * @param guess - Candidate guess. Leading or trailing whitespace is not accepted.
 * @param expectedLength - Required number of NFC-normalized grapheme clusters.
 * Defaults to `5`.
 * @returns `true` when the trimmed value is non-empty, has exactly the requested
 * grapheme length, and the original value consists only of Unicode letters and
 * combining marks.
 *
 * @remarks
 * This is a shape check only; it does not check a dictionary or normalize the
 * returned input. Punctuation, digits, separators, and internal whitespace are
 * rejected.
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
