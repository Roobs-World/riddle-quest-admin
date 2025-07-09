import {onSchedule} from "firebase-functions/v2/scheduler";
import {ScheduledEvent} from "firebase-functions/v2/scheduler";
import {generateTodaysDailyChallenge} from "./riddleGeneration";
import * as functions from "firebase-functions";

// Export the handler function for testing first
export const scheduledTaskHandler = async (_context: ScheduledEvent) => {
  console.log("Daily challenge scheduler started.");

  try {
    const currentDate = new Date();
    const todayDateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format

    console.log(`🗓️ Starting daily challenge generation for ${todayDateString}...`);

    // Use the new 5-question daily challenge generation function
    await generateTodaysDailyChallenge(false); // forceGenerate = false

    console.log("✅ Daily challenge scheduler finished successfully.");
  } catch (error) {
    functions.logger.error("❌ Daily challenge scheduler failed:", error);
    console.error("❌ Daily challenge scheduler failed:", error);
    throw error; // Re-throw to ensure proper error reporting
  }
};

/**
 * Scheduled function to set the daily challenge.
 * Runs once every day at 00:00 UTC.
 * Creates exactly 5 daily challenge questions per day based on the current date.
 * Uses OpenAI to generate fresh riddles for each day.
 */
export const dailyChallengeScheduler = onSchedule(
  {
    schedule: "0 0 * * *", // Runs daily at 00:00 UTC
    timeZone: "UTC",
    secrets: ["OPENAI_API_KEY"],
  },
  scheduledTaskHandler, // Use the exported handler here
);
