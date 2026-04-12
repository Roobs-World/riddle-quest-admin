import {onSchedule} from "firebase-functions/v2/scheduler";
import {ScheduledEvent} from "firebase-functions/v2/scheduler";
import {generateTodaysDailyChallenge} from "./riddleGeneration";
import * as functions from "firebase-functions";
import {captureException} from "./sentry";

// Export the handler function for testing first
export const scheduledTaskHandler = async (_context: ScheduledEvent) => {
  functions.logger.info("Daily challenge scheduler started.");
  const currentDate = new Date();
  const todayDateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format

  try {
    functions.logger.info(`Starting daily challenge generation for ${todayDateString}...`);

    // Generate the single-riddle daily challenge for today
    await generateTodaysDailyChallenge(false); // forceGenerate = false

    functions.logger.info("Daily challenge scheduler finished successfully.");
  } catch (error) {
    functions.logger.error("Daily challenge scheduler failed:", error);
    captureException(error, {
      functionName: "dailyChallengeScheduler",
      phase: "scheduled_generation",
      challengeDate: todayDateString,
    });
    throw error; // Re-throw to ensure proper error reporting
  }
};

/**
 * Scheduled function to set the daily challenge.
 * Runs once per day at 00:00 UTC.
 * Creates exactly 1 daily challenge question per day based on the current date.
 * Uses OpenAI to generate fresh riddles for each day.
 */
export const dailyChallengeScheduler = onSchedule(
  {
    schedule: "0 0 * * *", // Runs once daily at 00:00 UTC
    timeZone: "UTC",
    secrets: ["OPENAI_API_KEY"],
  },
  scheduledTaskHandler, // Use the exported handler here
);
