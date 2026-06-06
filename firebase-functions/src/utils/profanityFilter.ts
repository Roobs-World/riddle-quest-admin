import {containsProfanity as sharedContainsProfanity} from "@qwordly/core";

/**
 * Checks if the given username contains profanity or inappropriate content.
 * @param username - The username to check
 * @returns true if the username contains profanity, false otherwise
 */
export function containsProfanity(username: string): boolean {
  return sharedContainsProfanity(username);
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
