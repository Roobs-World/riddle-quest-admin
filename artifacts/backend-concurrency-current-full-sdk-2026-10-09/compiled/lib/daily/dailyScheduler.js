"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyChallengeScheduler = exports.scheduledTaskHandler = void 0;
const validation_1 = require("@qwordly/core/validation");
const dailyCalendar_1 = require("@qwordly/core/validation/dailyCalendar");
const dailyRiddleGeneration_1 = require("./dailyRiddleGeneration");
const functions = __importStar(require("firebase-functions"));
const sentry_1 = require("../shared/sentry");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const errorMetadata_1 = require("../shared/errorMetadata");
// Export the handler function for testing first
/** Provides scheduled task handler behavior. */
const scheduledTaskHandler = async (context) => {
    /** One captured generation instant shared across locale grouping. */
    const dispatchedAt = new Date();
    /** Provides scheduled at behavior. */
    const scheduledAt = context.scheduleTime ? new Date(context.scheduleTime) : dispatchedAt;
    // Preserve delayed midnight retries without advancing regional clocks on manual runs.
    /** Provides now behavior. */
    const now = scheduledAt > dispatchedAt ? dispatchedAt : scheduledAt;
    /** Supported locales grouped by the regional Daily date they currently require. */
    const groups = new Map();
    for (const locale of validation_1.SUPPORTED_LOCALES) {
        if (!(0, dailyCalendar_1.isDailyGenerationDue)(locale, now))
            continue;
        /** Regional Daily date selected for this locale’s generation group. */
        const day = (0, dailyCalendar_1.getDailyDate)(locale, now);
        groups.set(day, [...(groups.get(day) ?? []), locale]);
    }
    for (const [targetDateString, locales] of groups) {
        try {
            functions.logger.info(`Starting immutable localized daily riddle generation for ${targetDateString}.`);
            // Generate or validate the selected day's localized riddle set. Repeated
            // schedules safely retry only missing or invalid immutable documents.
            await (0, dailyRiddleGeneration_1.generateLocalizedDailyChallengeForDate)(targetDateString, false, locales);
            functions.logger.info("Daily scheduler finished successfully (localized daily set ready).", {
                challengeDate: targetDateString,
            });
        }
        catch (error) {
            functions.logger.error("Daily scheduler failed while preparing immutable daily riddles.", {
                challengeDate: targetDateString,
                ...(0, errorMetadata_1.getSafeErrorMetadata)(error),
            });
            (0, sentry_1.captureException)(error, {
                functionName: "dailyChallengeScheduler",
                phase: "scheduled_generation",
                challengeDate: targetDateString,
                ...(error instanceof dailyRiddleGeneration_1.DailyGenerationIncompleteError
                    ? { failedLocales: error.failedLocales, attemptCount: error.attemptCount }
                    : {}),
            });
            throw error; // Re-throw to ensure proper error reporting
        }
    }
};
exports.scheduledTaskHandler = scheduledTaskHandler;
/**
 * Starts generation at each regional midnight, with half-hour repairs for the
 * first three local hours. India’s half-hour offset and DST use the shared IANA clocks.
 */
exports.dailyChallengeScheduler = (0, sentryHandlers_1.onScheduleWithSentry)("dailyChallengeScheduler", {
    schedule: "0,30 * * * *",
    timeZone: "UTC",
    timeoutSeconds: 900,
    memory: "512MiB",
    secrets: ["OPENAI_API_KEY"],
}, exports.scheduledTaskHandler);
//# sourceMappingURL=dailyScheduler.js.map