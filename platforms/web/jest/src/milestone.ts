import type {JestPlatformPort, JestPreferences, JestSession, PlatformResult} from "./types";

/** Describes authoritative completion. */
export type AuthoritativeCompletion = {
  /** Stores is correct. */
  isCorrect: boolean;
  /** Stores game mode. */
  gameMode: "classic" | "challenge";
  /** Stores new win streak. */
  newWinStreak?: number;
};

/** Decides whether a confirmed guest win should offer registration. */
export function shouldPromptGuestRegistration(
  session: JestSession,
  completedRiddles?: number,
): boolean {
  if (session.player.registered) return false;
  /** Provides count behavior. */
  const count = completedRiddles ?? (session.preferences.jestGuestCompletedRiddles ?? 0) + 1;
  return count > 0 && count % 3 === 0;
}

/** Records authoritative completion. */
export async function recordAuthoritativeCompletion(
  platform: JestPlatformPort,
  session: JestSession,
  completion: AuthoritativeCompletion,
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
  /** Both Daily and Classic wins advance the guest registration cadence. */
  const isGuestWin = !session.player.registered;
  /** Provides guest completed riddles behavior. */
  const guestCompletedRiddles = (preferences.jestGuestCompletedRiddles ?? 0) + (isGuestWin ? 1 : 0);
  if (!preferences.firstMilestoneMarked || isGuestWin) {
    preferences = {
      ...preferences,
      firstMilestoneMarked: true,
      ...(isGuestWin && {jestGuestCompletedRiddles: guestCompletedRiddles}),
    };
    await platform.writePreferences(preferences);
    milestoneMarked = !session.preferences.firstMilestoneMarked;
  }

  return {
    status: "success",
    value: {
      preferences,
      milestoneMarked,
      shouldPromptRegistration: shouldPromptGuestRegistration(session, guestCompletedRiddles),
    },
  };
}
