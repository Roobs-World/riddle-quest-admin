import type {JestPlatformPort, PlatformResult} from "../types";

/** Defines the legacy reminder ids value. */
export const LEGACY_REMINDER_IDS = [
  "riddle-quest-d1-v2",
  "riddle-quest-d3-v2",
  "riddle-quest-d7-v2",
] as const;
/** Defines the engagement reminder ids value. */
export const ENGAGEMENT_REMINDER_IDS = Array.from(
  {length: 7},
  (_, index) => `riddle-quest-d${index + 1}-v3`,
);

/** Describes reminder variant. */
type ReminderVariant = {
  /** Stores body. */
  body: string;
  /** Stores cta. */
  cta: string;
  /** Stores template. */
  template: string;
  /** Stores callback. */
  callback: string;
};

/** Provides schedule engagement reminders behavior. */
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
  rotationSeed = 0,
): Promise<PlatformResult<void>[]> {
  const common = {
    ...(copy.assetReference ? {assetReference: copy.assetReference} : {}),
    entryPayload: {
      gameMode: "challenge",
      campaign: "daily_cosmic_callback_v2",
      challengeDestination: "daily",
    },
  } as const;
  const variants: ReminderVariant[] = [
    {
      body: copy.dailyBody,
      cta: copy.dailyCta,
      template: "daily_reward_progress_v4",
      callback: "daily_coin_reward",
    },
    {
      body: copy.streakBody,
      cta: copy.streakCta,
      template: "streak_progress_v4",
      callback: "daily_streak",
    },
    {
      body: copy.weeklyBody,
      cta: copy.weeklyCta,
      template: "level_progress_v4",
      callback: "daily_coin_reward",
    },
  ];

  return Promise.all(ENGAGEMENT_REMINDER_IDS.map((identifier, index) => {
    const scheduledInDays = index + 1;
    const variant = variants[(rotationSeed + index) % variants.length];
    return platform.scheduleNotification({
      ...common,
      identifier,
      scheduledInDays,
      priority: scheduledInDays >= 3 ? "high" : "medium",
      body: variant.body,
      ctaText: variant.cta,
      entryPayload: {
        ...common.entryPayload,
        reference: `notification_d${scheduledInDays}_v4`,
        notification_template: variant.template,
        notification_offset: `D${scheduledInDays}`,
        callback: variant.callback,
      },
    });
  }));
}

/** Removes engagement reminders. */
export async function removeEngagementReminders(platform: JestPlatformPort) {
  return Promise.all(
    [...LEGACY_REMINDER_IDS, ...ENGAGEMENT_REMINDER_IDS]
      .map((identifier) => platform.removeNotification(identifier)),
  );
}

/** Provides replace engagement reminders behavior. */
export async function replaceEngagementReminders(
  platform: JestPlatformPort,
  copy: Parameters<typeof scheduleEngagementReminders>[1],
  rotationSeed: number,
) {
  const removed = await removeEngagementReminders(platform);
  const scheduled = await scheduleEngagementReminders(platform, copy, rotationSeed);
  return {removed, scheduled};
}

/** Provides notification rotation seed behavior. */
export function notificationRotationSeed(playerId: string, now = Date.now()) {
  const playerHash = [...playerId].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) | 0, 0);
  const utcDay = Math.floor(now / 86_400_000);
  return Math.abs(playerHash + utcDay) % 3;
}
