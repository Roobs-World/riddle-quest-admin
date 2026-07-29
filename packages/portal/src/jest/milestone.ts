import type {JestPlatformPort, JestPreferences, JestSession, PlatformResult} from "./types";

export const REGISTRATION_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthoritativeCompletion = {
  isCorrect: boolean;
  gameMode: "classic" | "challenge";
  newWinStreak?: number;
};

export async function recordAuthoritativeCompletion(
  platform: JestPlatformPort,
  session: JestSession,
  completion: AuthoritativeCompletion,
  now = Date.now(),
): Promise<PlatformResult<{
  preferences: JestPreferences;
  milestoneMarked: boolean;
  shouldPromptRegistration: boolean;
}>> {
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

  let preferences = session.preferences;
  let milestoneMarked = false;
  if (!preferences.firstMilestoneMarked) {
    const result = await platform.markFirstMilestone();
    if (result.status !== "success") return result;
    preferences = {...preferences, firstMilestoneMarked: true};
    await platform.writePreferences(preferences);
    milestoneMarked = true;
  }

  const dismissedAt = preferences.registrationPromptDismissedAt ?? 0;
  return {
    status: "success",
    value: {
      preferences,
      milestoneMarked,
      shouldPromptRegistration:
        !session.player.registered && now - dismissedAt >= REGISTRATION_PROMPT_COOLDOWN_MS,
    },
  };
}
