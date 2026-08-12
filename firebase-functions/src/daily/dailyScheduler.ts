import {type ScheduledEvent} from "firebase-functions/v2/scheduler";
import {generateLocalizedDailyChallengeForDate} from "./dailyRiddleGeneration";
import * as functions from "firebase-functions";
import {captureException} from "../shared/sentry";
import {onScheduleWithSentry} from "../shared/sentryHandlers";
import {getSafeErrorMetadata} from "../shared/errorMetadata";

// Export the handler function for testing first
/** Provides scheduled task handler behavior. */
export const scheduledTaskHandler = async (context: ScheduledEvent) => {
  void context;
  functions.logger.info("Daily scheduler started (target: immutable localized documents).");
  const currentDate = new Date();
  const targetDate = new Date(currentDate);
  if (currentDate.getUTCHours() >= 21) targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  const targetDateString = targetDate.toISOString().slice(0, 10);

  try {
    functions.logger.info(
      `Starting immutable localized daily riddle generation for ${targetDateString}.`,
    );

    // Generate or validate the selected day's localized riddle set. Repeated
    // schedules safely retry only missing or invalid immutable documents.
    await generateLocalizedDailyChallengeForDate(targetDateString, false);

    functions.logger.info("Daily scheduler finished successfully (localized daily set ready).", {
      challengeDate: targetDateString,
    });
  } catch (error) {
    functions.logger.error("Daily scheduler failed while preparing immutable daily riddles.", {
      challengeDate: targetDateString,
      ...getSafeErrorMetadata(error),
    });
    captureException(error, {
      functionName: "dailyChallengeScheduler",
      phase: "scheduled_generation",
      challengeDate: targetDateString,
    });
    throw error; // Re-throw to ensure proper error reporting
  }
};

/**
 * Scheduled function to prepare immutable daily riddles. It pre-generates the
 * next day before rollover, then retries today's missing locale slots during
 * the first UTC hours. Existing playable dated documents are never overwritten.
 */
export const dailyChallengeScheduler = onScheduleWithSentry(
  "dailyChallengeScheduler",
  {
    schedule: "0 0-2,21-23 * * *",
    timeZone: "UTC",
    timeoutSeconds: 900,
    memory: "512MiB",
    secrets: ["OPENAI_API_KEY"],
  },
  scheduledTaskHandler, // Use the exported handler here
);
