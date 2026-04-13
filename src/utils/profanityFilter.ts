// Simple profanity filter for usernames
// This is a basic implementation that can be enhanced with more sophisticated filtering

import { PROFANE_WORDS } from "./profanityWords";

/**
 * Checks if the given username contains profanity or inappropriate content.
 * @param username - The username to check
 * @returns true if the username contains profanity, false otherwise
 */
export function containsProfanity(username: string): boolean {
  if (!username || typeof username !== "string") {
    return false;
  }

  const cleanUsername = username.toLowerCase().trim();

  // Check for exact matches and partial matches
  return PROFANE_WORDS.some((word) => {
    // Check for exact word match (with word boundaries)
    const exactMatch = new RegExp(`\\b${word}\\b`, "i").test(cleanUsername);

    // Substring matching catches things like "fuck" in "fucker", but some terms
    // create too many false positives (e.g. "anus" in "cleanuser", "anal" in "analysis").
    const boundaryOnly = new Set(["anal", "anus", "tit", "tits"]);
    const substringMatch = boundaryOnly.has(word)
      ? false
      : cleanUsername.includes(word.toLowerCase());

    return exactMatch || substringMatch;
  });
}

/**
 * Validates that a username doesn't contain profanity.
 * @param username - The username to validate
 * @returns An error message if profanity is detected, empty string otherwise
 */
export function validateUsernameForProfanity(username: string): string {
  if (containsProfanity(username)) {
    return "Username contains inappropriate language. Please choose a different username.";
  }
  return "";
}

