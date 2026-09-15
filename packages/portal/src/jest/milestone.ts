import type {JestPlatformPort, JestPreferences, JestSession, PlatformResult} from "./types";

/** Defines the registration prompt cooldown ms value. */
export const REGISTRATION_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Describes authoritative completion. */
export type AuthoritativeCompletion = {
  /** Stores is correct. */
  isCorrect: boolean;
  /** Stores game mode. */
  gameMode: "classic" | "challenge";
  /** Stores new win streak. */
  newWinStreak?: number;
};

/** Records authoritative completion. */
export async function recordAuthoritativeCompletion(
  platform: JestPlatformPort,
  session: JestSession,
  completion: AuthoritativeCompletion,
  now = Date.now(),
): Promise<
  PlatformResult<{
    /** Stores preferences. */
    preferences: JestPreferences;
    /** Stores milestone marked. */
    milestoneMarked: boolean;
    /** Stores should prompt registration. */
    shouldPromptRegistration: boolean;
  }>
> {
  if (!completion.isCorrect) {
    return {
      status: "success",
      value: {
        preferences: session.preferences,
        milestoneMarked: false,
        shouldPromptRegistration: false,
      },
    };
  }

  // Jest deduplicates this event per session. A saved flag must not prevent
  // a new session (including the Simulator checklist) from observing it.
  /** Reports every authoritative win through the platform's milestone API. */
  const result = await platform.markFirstMilestone();
  if (result.status !== "success") return result;

  /** Provides preferences behavior. */
  let preferences = session.preferences;
  /** Provides milestone marked behavior. */
  let milestoneMarked = false;
  if (!preferences.firstMilestoneMarked) {
    preferences = {...preferences, firstMilestoneMarked: true};
    await platform.writePreferences(preferences);
    milestoneMarked = true;
  }

  /** Provides dismissed at behavior. */
  const dismissedAt = preferences.registrationPromptDismissedAt ?? 0;
  return {
    status: "success",
    value: {
      preferences,
      milestoneMarked,
      shouldPromptRegistration: !session.player.registered && now - dismissedAt >= REGISTRATION_PROMPT_COOLDOWN_MS,
    },
  };
}
