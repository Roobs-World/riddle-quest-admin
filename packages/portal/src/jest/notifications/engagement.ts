import type {JestPlatformPort, PlatformResult} from "../types";

/** Defines the legacy reminder ids value. */
export const LEGACY_REMINDER_IDS = ["riddle-quest-d1-v2", "riddle-quest-d3-v2", "riddle-quest-d7-v2"] as const;
/** Defines the engagement reminder ids value. */
export const ENGAGEMENT_REMINDER_IDS = Array.from({length: 7}, (_, index) => `riddle-quest-d${index + 1}-v3`);
/** Stable identifier for the current Race-to-10 results reminder. */
export const RACE_RESULTS_REMINDER_ID = "race_to_10_results_v1";
/** Legacy Race-to-10 reminder identifier retained for migration cleanup. */
export const LEGACY_RACE_REMINDER_ID = "race_to_10_return_v1";
/** Race reminder identifiers retained for cleanup across identifier migrations. */
export const RACE_REMINDER_IDS = [LEGACY_RACE_REMINDER_ID, RACE_RESULTS_REMINDER_ID] as const;
/** Every app-owned notification identifier that account deletion must unschedule. */
export const PLAYER_NOTIFICATION_IDS = [
  ...LEGACY_REMINDER_IDS,
  ...ENGAGEMENT_REMINDER_IDS,
  ...RACE_REMINDER_IDS,
] as const;

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
    /** Stores daily body. */
    dailyBody: string;
    /** Stores streak body. */
    streakBody: string;
    /** Stores weekly body. */
    weeklyBody: string;
    /** Stores daily cta. */
    dailyCta: string;
    /** Stores streak cta. */
    streakCta: string;
    /** Stores weekly cta. */
    weeklyCta: string;
    /** Stores asset reference. */
    assetReference?: string;
  },
  rotationSeed = 0,
): Promise<PlatformResult<void>[]> {
  /** Provides common behavior. */
  const common = {
    ...(copy.assetReference ? {assetReference: copy.assetReference} : {}),
    entryPayload: {
      gameMode: "challenge",
      campaign: "daily_cosmic_callback_v2",
      challengeDestination: "daily",
    },
  } as const;
  /** Provides variants behavior. */
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

  return Promise.all(
    ENGAGEMENT_REMINDER_IDS.map((identifier, index) => {
      /** Provides scheduled in days behavior. */
      const scheduledInDays = index + 1;
      /** Provides variant behavior. */
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
    }),
  );
}

/** Removes engagement reminders. */
export async function removeEngagementReminders(platform: JestPlatformPort) {
  return Promise.all(
    [...LEGACY_REMINDER_IDS, ...ENGAGEMENT_REMINDER_IDS].map((identifier) => platform.removeNotification(identifier)),
  );
}

/** Provides replace engagement reminders behavior. */
export async function replaceEngagementReminders(
  platform: JestPlatformPort,
  copy: Parameters<typeof scheduleEngagementReminders>[1],
  rotationSeed: number,
) {
  /** Removes d. */
  const removed = await removeEngagementReminders(platform);
  /** Provides scheduled behavior. */
  const scheduled = await scheduleEngagementReminders(platform, copy, rotationSeed);
  return {removed, scheduled};
}

/** Provides notification rotation seed behavior. */
export function notificationRotationSeed(playerId: string, now = Date.now()) {
  /** Provides player hash behavior. */
  const playerHash = [...playerId].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) | 0, 0);
  /** Provides utc day behavior. */
  const utcDay = Math.floor(now / 86_400_000);
  return Math.abs(playerHash + utcDay) % 3;
}
