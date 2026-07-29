import {DAILY_REMINDER_ID, removeEngagementReminders, scheduleEngagementReminders, STREAK_REMINDER_ID, WEEKLY_REMINDER_ID} from "../engagement";
import {MockJestPlatform} from "../MockJestPlatform";

it("uses stable replacement and removal identifiers", async () => {
  const platform = new MockJestPlatform();
  platform.player.registered = true;
  platform.scheduleNotification = jest.fn(platform.scheduleNotification);
  platform.removeNotification = jest.fn(platform.removeNotification);
  await scheduleEngagementReminders(platform, {
    title: "Riddle Quest",
    dailyLabel: "Daily",
    levelLabel: "Level",
    streakLabel: "Streak",
    ctaText: "Open",
    level: 8,
    winStreak: 3,
  });
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(1, expect.objectContaining({identifier: DAILY_REMINDER_ID}));
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(2, expect.objectContaining({
    identifier: STREAK_REMINDER_ID,
    scheduledInDays: 3,
    body: "Daily · Streak 3",
  }));
  expect(platform.scheduleNotification).toHaveBeenNthCalledWith(3, expect.objectContaining({
    identifier: WEEKLY_REMINDER_ID,
    scheduledInDays: 7,
    entryPayload: expect.objectContaining({gameMode: "challenge", reference: "notification_d7_v2"}),
  }));
  await removeEngagementReminders(platform);
  expect(platform.removeNotification).toHaveBeenCalledWith(DAILY_REMINDER_ID);
  expect(platform.removeNotification).toHaveBeenCalledWith(STREAK_REMINDER_ID);
  expect(platform.removeNotification).toHaveBeenCalledWith(WEEKLY_REMINDER_ID);
});
