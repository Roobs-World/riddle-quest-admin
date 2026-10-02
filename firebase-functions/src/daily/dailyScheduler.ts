import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";
import {getDailyDate, isDailyGenerationDue} from "@qwordly/core/validation/dailyCalendar";
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
  // Preserve delayed midnight retries without advancing regional clocks on manual runs.
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

/**
 * Starts generation at each regional midnight, with half-hour repairs for the
 * first three local hours. India’s half-hour offset and DST use the shared IANA clocks.
 */
export const dailyChallengeScheduler = onScheduleWithSentry(
  "dailyChallengeScheduler",
  {
    schedule: "0,30 * * * *",
    timeZone: "UTC",
    timeoutSeconds: 900,
    memory: "512MiB",
    secrets: ["OPENAI_API_KEY"],
  },
  scheduledTaskHandler, // Use the exported handler here
);
