/**
 * Validates that a guess is the correct length and contains only letters.
 */
export function isValidGuess(guess: string, expectedLength: number = 5): boolean {
  if (typeof guess !== "string" || guess.trim().length === 0) {
    return false;
  }

  if (guess.length !== expectedLength) {
    return false;
  }

  return /^[a-zA-Z]+$/.test(guess);
}
