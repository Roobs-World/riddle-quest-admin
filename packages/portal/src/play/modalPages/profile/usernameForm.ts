import {
  normalizeUsernameDisplay,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  UsernameSchema,
} from "@qwordly/core/validation";

export {USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH};

/** Trims surrounding whitespace before a username is submitted. */
export function normalizeUsernameInput(username: string): string {
  return normalizeUsernameDisplay(username);
}

/** Reports whether username input passes the shared bridge/callable boundary. */
export function canSubmitUsername(username: string): boolean {
  return UsernameSchema.safeParse(username).success;
}
