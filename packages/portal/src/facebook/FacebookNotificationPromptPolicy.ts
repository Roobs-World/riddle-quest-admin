/** Defines the reprompt interval ms value. */
const REPROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000;

/** Describes facebook notification prompt state. */
export type FacebookNotificationPromptState = Readonly<{
  permission: "unknown" | "declined" | "accepted";
  lastPromptAtMs?: number;
}>;

/** Prompts only after the first authoritative win and never more than weekly. */
export function shouldPromptForFacebookNotifications({
  authoritativeWins,
  capabilityAvailable,
  state,
  nowMs,
}: {
  authoritativeWins: number;
  capabilityAvailable: boolean;
  state: FacebookNotificationPromptState;
  nowMs: number;
}): boolean {
  if (
    !capabilityAvailable ||
    !Number.isSafeInteger(authoritativeWins) ||
    authoritativeWins < 1 ||
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0 ||
    state.permission === "accepted"
  ) return false;
  if (state.lastPromptAtMs === undefined) return true;
  if (!Number.isSafeInteger(state.lastPromptAtMs) || state.lastPromptAtMs < 0) return false;
  return nowMs - state.lastPromptAtMs >= REPROMPT_INTERVAL_MS;
}

/** Records an attempted prompt regardless of accept/decline outcome. */
export function recordFacebookNotificationPrompt(
  state: FacebookNotificationPromptState,
  permission: FacebookNotificationPromptState["permission"],
  nowMs: number,
): FacebookNotificationPromptState {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error("facebook-notification-prompt-time-invalid");
  }
  return {permission, lastPromptAtMs: nowMs};
}
