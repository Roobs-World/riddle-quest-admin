import {onSchedule} from "firebase-functions/v2/scheduler";
import {ScheduledEvent} from "firebase-functions/v2/scheduler";
import {generateLocalizedTodaysDailyChallenge as generateTodaysDailyRiddle} from "./riddleGeneration";
import * as functions from "firebase-functions";
import {captureException} from "./sentry";

// Export the handler function for testing first
export const scheduledTaskHandler = async (_context: ScheduledEvent) => {
  functions.logger.info("Daily scheduler started (target: dailyRiddles/current).");
  const currentDate = new Date();
  const todayDateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format

  try {
    functions.logger.info(`Starting daily riddle generation for ${todayDateString} into dailyRiddles/current...`);

    // Generate (or validate) today's single daily riddle in dailyRiddles/current.
    await generateTodaysDailyRiddle(false); // forceGenerate = false

    functions.logger.info("Daily scheduler finished successfully (dailyRiddles/current updated).");
  } catch (error) {
    functions.logger.error("Daily scheduler failed while updating dailyRiddles/current:", error);
    captureException(error, {
      functionName: "dailyChallengeScheduler",
      phase: "scheduled_generation",
      challengeDate: todayDateString,
    });
    throw error; // Re-throw to ensure proper error reporting
  }
};

/**
 * Scheduled function to update the current daily riddle.
 * Runs once per day at 00:00 UTC.
 * Creates exactly 1 daily riddle per day based on the current date.
 * Uses OpenAI to generate fresh riddles for each day.
 * Source of truth target: dailyRiddles/current.
 */
export const dailyChallengeScheduler = onSchedule(
  {
    schedule: "0 0 * * *", // Runs once daily at 00:00 UTC
    timeZone: "UTC",
    secrets: ["OPENAI_API_KEY"],
  },
  scheduledTaskHandler, // Use the exported handler here
);
