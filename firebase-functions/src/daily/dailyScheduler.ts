import {onSchedule, type ScheduledEvent} from "firebase-functions/v2/scheduler";
import {
  initializeLocalizedRiddleDatabaseIfEmpty,
} from "../riddles/riddleGeneration";
import {generateLocalizedTodaysDailyChallenge as generateTodaysDailyRiddle} from "./dailyRiddleGeneration";
import * as functions from "firebase-functions";
import {captureException} from "../shared/sentry";

// Export the handler function for testing first
export const scheduledTaskHandler = async (context: ScheduledEvent) => {
  void context;
  functions.logger.info("Daily scheduler started (target: localizedRiddles/{locale}/riddles/current).");
  const currentDate = new Date();
  const todayDateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format

  try {
    functions.logger.info(
      `Starting localized daily riddle generation for ${todayDateString} into localizedRiddles/{locale}/riddles/current...`,
    );

    // Keep the localized classic catalog recoverable after an intentional
    // reset or an empty-database deployment.
    await initializeLocalizedRiddleDatabaseIfEmpty(20);

    // Generate (or validate) today's single localized daily riddle for each supported locale.
    await generateTodaysDailyRiddle(false); // forceGenerate = false

    functions.logger.info("Daily scheduler finished successfully (localized daily riddles updated).");
  } catch (error) {
    functions.logger.error("Daily scheduler failed while updating localized daily riddles:", error);
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
 * Source of truth target: localizedRiddles/{locale}/riddles/current.
 */
export const dailyChallengeScheduler = onSchedule(
  {
    schedule: "0 0 * * *", // Runs once daily at 00:00 UTC
    timeZone: "UTC",
    timeoutSeconds: 1800,
    memory: "512MiB",
    secrets: ["OPENAI_API_KEY"],
  },
  scheduledTaskHandler, // Use the exported handler here
);
