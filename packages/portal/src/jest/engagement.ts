import type {JestPlatformPort, PlatformResult} from "./types";

export const DAILY_REMINDER_ID = "riddle-quest-d1-v2";
export const STREAK_REMINDER_ID = "riddle-quest-d3-v2";
export const WEEKLY_REMINDER_ID = "riddle-quest-d7-v2";

export async function scheduleEngagementReminders(
  platform: JestPlatformPort,
  copy: {
    title: string;
    dailyLabel: string;
    levelLabel: string;
    streakLabel: string;
    ctaText: string;
    level?: number;
    winStreak?: number;
    assetReference?: string;
  },
): Promise<PlatformResult<void>[]> {
  await removeEngagementReminders(platform);
  const level = Math.max(1, copy.level ?? 1);
  const winStreak = Math.max(0, copy.winStreak ?? 0);
  const common = {
    title: copy.title,
    ctaText: copy.ctaText,
    ...(copy.assetReference ? {assetReference: copy.assetReference} : {}),
    entryPayload: {
      gameMode: "challenge",
      campaign: "daily_cosmic_callback_v2",
      challengeDestination: "daily",
    },
  } as const;
  return Promise.all([
    platform.scheduleNotification({
      ...common,
      identifier: DAILY_REMINDER_ID,
      scheduledInDays: 1,
      priority: "medium",
      body: `${copy.dailyLabel} · ${copy.levelLabel} ${level}`,
      entryPayload: {...common.entryPayload, reference: "notification_d1_v2"},
    }),
    platform.scheduleNotification({
      ...common,
      identifier: STREAK_REMINDER_ID,
      scheduledInDays: 3,
      priority: "high",
      body: `${copy.dailyLabel} · ${copy.streakLabel} ${winStreak}`,
      entryPayload: {...common.entryPayload, reference: "notification_d3_v2"},
    }),
    platform.scheduleNotification({
      ...common,
      identifier: WEEKLY_REMINDER_ID,
      scheduledInDays: 7,
      priority: "high",
      body: `${copy.dailyLabel} · ${copy.levelLabel} ${level} · ${copy.streakLabel} ${winStreak}`,
      entryPayload: {...common.entryPayload, reference: "notification_d7_v2"},
    }),
  ]);
}

export async function removeEngagementReminders(platform: JestPlatformPort) {
  return Promise.all([
    platform.removeNotification(DAILY_REMINDER_ID),
    platform.removeNotification(STREAK_REMINDER_ID),
    platform.removeNotification(WEEKLY_REMINDER_ID),
  ]);
}
