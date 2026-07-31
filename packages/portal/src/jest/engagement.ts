import type {JestPlatformPort, PlatformResult} from "./types";

export const DAILY_REMINDER_ID = "riddle-quest-d1-v2";
export const STREAK_REMINDER_ID = "riddle-quest-d3-v2";
export const WEEKLY_REMINDER_ID = "riddle-quest-d7-v2";

export async function scheduleEngagementReminders(
  platform: JestPlatformPort,
  copy: {
    dailyBody: string;
    streakBody: string;
    weeklyBody: string;
    dailyCta: string;
    streakCta: string;
    weeklyCta: string;
    assetReference?: string;
  },
): Promise<PlatformResult<void>[]> {
  const common = {
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
      body: copy.dailyBody,
      ctaText: copy.dailyCta,
      entryPayload: {
        ...common.entryPayload,
        reference: "notification_d1_v3",
        notification_template: "daily_reward_progress_v3",
        notification_offset: "D1",
        callback: "daily_coin_reward",
      },
    }),
    platform.scheduleNotification({
      ...common,
      identifier: STREAK_REMINDER_ID,
      scheduledInDays: 3,
      priority: "high",
      body: copy.streakBody,
      ctaText: copy.streakCta,
      entryPayload: {
        ...common.entryPayload,
        reference: "notification_d3_v3",
        notification_template: "streak_progress_v3",
        notification_offset: "D3",
        callback: "daily_streak",
      },
    }),
    platform.scheduleNotification({
      ...common,
      identifier: WEEKLY_REMINDER_ID,
      scheduledInDays: 7,
      priority: "high",
      body: copy.weeklyBody,
      ctaText: copy.weeklyCta,
      entryPayload: {
        ...common.entryPayload,
        reference: "notification_d7_v3",
        notification_template: "level_progress_v3",
        notification_offset: "D7",
        callback: "daily_coin_reward",
      },
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
