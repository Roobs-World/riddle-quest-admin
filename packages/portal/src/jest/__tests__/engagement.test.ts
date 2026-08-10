import {
  ENGAGEMENT_REMINDER_IDS,
  LEGACY_REMINDER_IDS,
  notificationRotationSeed,
  removeEngagementReminders,
  replaceEngagementReminders,
  scheduleEngagementReminders,
} from "../notifications/engagement";
import {MockJestPlatform} from "../MockJestPlatform";

const copy = {
  dailyBody: "A daily riddle is ready.",
  streakBody: "Keep your streak going.",
  weeklyBody: "Your next challenge is ready.",
  dailyCta: "Solve it",
  streakCta: "Start streak",
  weeklyCta: "Claim coins",
};

it("schedules a rotating, attributed D1-D7 series with stable identifiers", async () => {
  const platform = new MockJestPlatform();
  platform.player.registered = true;
  platform.scheduleNotification = jest.fn(platform.scheduleNotification);
  platform.removeNotification = jest.fn(platform.removeNotification);
  await scheduleEngagementReminders(platform, copy, 0);
  expect(platform.scheduleNotification).toHaveBeenCalledTimes(7);
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(1, expect.objectContaining({
    identifier: ENGAGEMENT_REMINDER_IDS[0],
    scheduledInDays: 1,
    body: "A daily riddle is ready.",
    ctaText: "Solve it",
    entryPayload: expect.objectContaining({
      reference: "notification_d1_v4",
      notification_template: "daily_reward_progress_v4",
      notification_offset: "D1",
      callback: "daily_coin_reward",
    }),
  }));
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(2, expect.objectContaining({
    identifier: ENGAGEMENT_REMINDER_IDS[1],
    scheduledInDays: 2,
    body: "Keep your streak going.",
    ctaText: "Start streak",
    entryPayload: expect.objectContaining({
      reference: "notification_d2_v4",
      notification_template: "streak_progress_v4",
      notification_offset: "D2",
      callback: "daily_streak",
    }),
  }));
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(7, expect.objectContaining({
    identifier: ENGAGEMENT_REMINDER_IDS[6],
    scheduledInDays: 7,
    body: "A daily riddle is ready.",
    ctaText: "Solve it",
    entryPayload: expect.objectContaining({
      gameMode: "challenge",
      reference: "notification_d7_v4",
      notification_template: "daily_reward_progress_v4",
      notification_offset: "D7",
      callback: "daily_coin_reward",
    }),
  }));
});

it("unschedules stale reminders before replacing the rolling series", async () => {
  const platform = new MockJestPlatform();
  platform.player.registered = true;
  const operations: string[] = [];
  platform.removeNotification = jest.fn(async (identifier) => {
    operations.push(`remove:${identifier}`);
    return {status: "success", value: undefined};
  });
  platform.scheduleNotification = jest.fn(async ({identifier}) => {
    operations.push(`schedule:${identifier}`);
    return {status: "success", value: undefined};
  });

  await replaceEngagementReminders(platform, copy, 1);
  expect(operations.slice(0, LEGACY_REMINDER_IDS.length + ENGAGEMENT_REMINDER_IDS.length))
    .toEqual([...LEGACY_REMINDER_IDS, ...ENGAGEMENT_REMINDER_IDS].map((id) => `remove:${id}`));
  expect(operations.at(-7)).toBe(`schedule:${ENGAGEMENT_REMINDER_IDS[0]}`);

  await removeEngagementReminders(platform);
  [...LEGACY_REMINDER_IDS, ...ENGAGEMENT_REMINDER_IDS].forEach((identifier) => {
    expect(platform.removeNotification).toHaveBeenCalledWith(identifier);
  });
});

it("changes the rotation on the next UTC day for the same player", () => {
  const today = Date.UTC(2026, 7, 1, 12);
  expect(notificationRotationSeed("player-1", today + 86_400_000))
    .toBe((notificationRotationSeed("player-1", today) + 1) % 3);
});

it("attaches approved assets and supports the current-day rotation default", async () => {
  const platform = new MockJestPlatform();
  platform.player.registered = true;
  platform.scheduleNotification = jest.fn(platform.scheduleNotification);

  await scheduleEngagementReminders(platform, {...copy, assetReference: "notification-hero"});

  expect(platform.scheduleNotification).toHaveBeenCalledTimes(7);
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(1, expect.objectContaining({
    assetReference: "notification-hero",
    priority: "medium",
  }));
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(3, expect.objectContaining({
    priority: "high",
  }));
  expect(notificationRotationSeed("player-1")).toBeGreaterThanOrEqual(0);
  expect(notificationRotationSeed("player-1")).toBeLessThan(3);
});
