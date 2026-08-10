/** Minimum number of non-whitespace characters accepted by the username form. */
export const USERNAME_MIN_LENGTH = 3;

/** Maximum number of characters accepted by the username input. */
export const USERNAME_MAX_LENGTH = 24;

/** Trims surrounding whitespace before a username is submitted. */
export function normalizeUsernameInput(username: string): string {
  return username.trim();
}

/** Reports whether normalized username input is long enough to submit. */
export function canSubmitUsername(username: string): boolean {
  return normalizeUsernameInput(username).length >= USERNAME_MIN_LENGTH;
}
