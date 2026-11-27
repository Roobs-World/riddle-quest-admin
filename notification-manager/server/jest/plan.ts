import {JestNotificationPlan, type JestRegistrationReceipt} from "../../../platforms/web/jest/src/notifications/managerProtocol.js";

const DAILY_REMINDERS = [
  {body: "Your next riddle is waiting. Follow the clues and see what you can solve.", ctaText: "Solve a riddle"},
  {body: "A small clue can unlock a big answer. Put your puzzle skills to work today.", ctaText: "Find the answer"},
  {body: "Ready for a change of pace? Try a challenge and stretch your riddle-solving skills.", ctaText: "Try a challenge"},
  {body: "Take a quick brain break. A few clever clues could lead to your next win.", ctaText: "Take a brain break"},
  {body: "Some answers hide in plain sight. Look at the clues from a new angle.", ctaText: "Look for clues"},
  {body: "Keep your curiosity going. Pick a puzzle and work your way to the solution.", ctaText: "Pick a puzzle"},
  {body: "Make time for one more mystery. Return to the riddles and discover your next answer.", ctaText: "Solve a mystery"},
] as const;

export function createJestNotificationPlan(registration: JestRegistrationReceipt): JestNotificationPlan {
  return JestNotificationPlan.parse({
    ...registration, version: 1, planId: "jest-daily-v4",
    notifications: registration.enabled ? DAILY_REMINDERS.map((reminder, index) => ({
      ...reminder, identifier: `riddle-quest-d${index + 1}-v4`, scheduledInDays: index + 1,
      assetReference: "riddle-q-notification",
    })) : [],
  });
}
