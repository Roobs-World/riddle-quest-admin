import {SUPPORTED_LOCALES, type SupportedLocale} from "@riddle-quest/core/validation";
import {getDailyDate, isDailyGenerationDue} from "@riddle-quest/core/validation/dailyCalendar";
import {type ScheduledEvent} from "firebase-functions/v2/scheduler";
import {DailyGenerationIncompleteError, generateLocalizedDailyChallengeForDate} from "./dailyRiddleGeneration";
import * as functions from "firebase-functions";
import {captureException} from "../shared/sentry";
import {onScheduleWithSentry} from "../shared/sentryHandlers";
import {getSafeErrorMetadata} from "../shared/errorMetadata";

// Export the handler function for testing first
/** Provides scheduled task handler behavior. */
export const scheduledTaskHandler = async (context: ScheduledEvent) => {
  /** One captured generation instant shared across locale grouping. */
  const dispatchedAt = new Date();
  /** Provides scheduled at behavior. */
  const scheduledAt = context.scheduleTime ? new Date(context.scheduleTime) : dispatchedAt;
  // Preserve delayed regional retries without advancing regional clocks on manual runs.
  /** Provides now behavior. */
  const now = scheduledAt > dispatchedAt ? dispatchedAt : scheduledAt;
  /** Supported locales grouped by the regional Daily date they currently require. */
  const groups = new Map<string, SupportedLocale[]>();
  for (const locale of SUPPORTED_LOCALES) {
    if (!isDailyGenerationDue(locale, now)) continue;
    /** Regional Daily date selected for this locale’s generation group. */
    const day = getDailyDate(locale, now);
    groups.set(day, [...(groups.get(day) ?? []), locale]);
  }
  for (const [targetDateString, locales] of groups) {

    try {
      functions.logger.info(`Starting immutable localized daily riddle generation for ${targetDateString}.`);

      // Generate or validate the selected day's localized riddle set. Repeated
      // schedules safely retry only missing or invalid immutable documents.
      await generateLocalizedDailyChallengeForDate(targetDateString, false, locales);

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
        ...(error instanceof DailyGenerationIncompleteError
          ? {failedLocales: error.failedLocales, attemptCount: error.attemptCount}
          : {}),
      });
      throw error; // Re-throw to ensure proper error reporting
    }
  }
};

/** Dispatches regional 09:00 slots, including Indian half-hours and European DST. */
export const dailyChallengeScheduler = onScheduleWithSentry(
  "dailyChallengeScheduler",
  {
    schedule: "0,30 0,2,3,6-9 * * *",
    minInstances: 0,
    retryCount: 2,
    minBackoffSeconds: 60,
    timeZone: "UTC",
    timeoutSeconds: 900,
    memory: "512MiB",
    secrets: ["OPENAI_API_KEY"],
  },
  scheduledTaskHandler, // Use the exported handler here
);
