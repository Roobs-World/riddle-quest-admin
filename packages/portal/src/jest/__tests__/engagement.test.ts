import {DAILY_REMINDER_ID, removeEngagementReminders, scheduleEngagementReminders, STREAK_REMINDER_ID, WEEKLY_REMINDER_ID} from "../engagement";
import {MockJestPlatform} from "../MockJestPlatform";

it("uses stable replacement and removal identifiers", async () => {
  const platform = new MockJestPlatform();
  platform.player.registered = true;
  platform.scheduleNotification = jest.fn(platform.scheduleNotification);
  platform.removeNotification = jest.fn(platform.removeNotification);
  await scheduleEngagementReminders(platform, {
    dailyBody: "A daily riddle is ready.",
    streakBody: "Keep your streak going.",
    weeklyBody: "Your next challenge is ready.",
    dailyCta: "Solve it",
    streakCta: "Start streak",
    weeklyCta: "Claim coins",
  });
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(1, expect.objectContaining({
    identifier: DAILY_REMINDER_ID,
    scheduledInDays: 1,
    body: "A daily riddle is ready.",
    ctaText: "Solve it",
    entryPayload: expect.objectContaining({
      reference: "notification_d1_v3",
      notification_template: "daily_reward_progress_v3",
      notification_offset: "D1",
      callback: "daily_coin_reward",
    }),
  }));
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(2, expect.objectContaining({
    identifier: STREAK_REMINDER_ID,
    scheduledInDays: 3,
    body: "Keep your streak going.",
    ctaText: "Start streak",
    entryPayload: expect.objectContaining({
      reference: "notification_d3_v3",
      notification_template: "streak_progress_v3",
      notification_offset: "D3",
      callback: "daily_streak",
    }),
  }));
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(3, expect.objectContaining({
    identifier: WEEKLY_REMINDER_ID,
    scheduledInDays: 7,
    body: "Your next challenge is ready.",
    ctaText: "Claim coins",
    entryPayload: expect.objectContaining({
      gameMode: "challenge",
      reference: "notification_d7_v3",
      notification_template: "level_progress_v3",
      notification_offset: "D7",
      callback: "daily_coin_reward",
    }),
  }));
  await removeEngagementReminders(platform);
  expect(platform.removeNotification).toHaveBeenCalledWith(DAILY_REMINDER_ID);
  expect(platform.removeNotification).toHaveBeenCalledWith(STREAK_REMINDER_ID);
  expect(platform.removeNotification).toHaveBeenCalledWith(WEEKLY_REMINDER_ID);
});
