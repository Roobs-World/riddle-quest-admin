"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyGenerationIncompleteError = void 0;
exports.generateLocalizedDailyChallengeForDate = generateLocalizedDailyChallengeForDate;
exports.generateLocalizedTodaysDailyChallenge = generateLocalizedTodaysDailyChallenge;
const dailyCalendar_1 = require("@qwordly/core/validation/dailyCalendar");
const v2_1 = require("firebase-functions/v2");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const openaiService_1 = require("../riddles/openaiService");
const validation_1 = require("@qwordly/core/validation");
const riddleGenerationRepository_1 = require("../riddles/riddleGenerationRepository");
const singlePlayerAnswerPolicy_1 = require("../gameplay/singlePlayerAnswerPolicy");
/** Maximum model calls spent on one locale in one scheduled run. */
const MAX_DAILY_ATTEMPTS_PER_LOCALE = 3;
/** Maximum model calls spent across all locales in one scheduled run. */
const MAX_DAILY_ATTEMPTS_PER_RUN = 51;
/** Locale generation concurrency keeps OpenAI and Firestore pressure bounded. */
const DAILY_LOCALE_CONCURRENCY = 3;
/** Carries content-free diagnostics across the scheduler's error boundary. */
class DailyGenerationIncompleteError extends Error {
    failedLocales;
    attemptCount;
    /** Retains only locale identifiers and the bounded candidate count. */
    constructor(
    /** Locale identifiers whose dated content could not be prepared. */
    failedLocales, 
    /** Candidate attempts spent in this invocation, including rejected candidates. */
    attemptCount) {
        super(`Daily generation incomplete for ${failedLocales.length} locale(s).`);
        this.failedLocales = failedLocales;
        this.attemptCount = attemptCount;
    }
}
exports.DailyGenerationIncompleteError = DailyGenerationIncompleteError;
/** Validates and normalizes an immutable calendar daily-content key. */
function assertDailyDateKey(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new Error("A YYYY-MM-DD challenge date is required.");
    /** Parses d. */
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new Error("A valid challenge date is required.");
    }
    return value;
}
/**
 * Generates immutable localized daily documents for one regional calendar date.
 *
 * The scheduler runs this at regional 09:00. A failure never overwrites playable
 * content for another date, and later scheduled retries only fill missing or
 * invalid locale documents.
 */
async function generateLocalizedDailyChallengeForDate(targetDate, forceGenerate = false, locales = validation_1.SUPPORTED_LOCALES) {
    /** Provides challenge date behavior. */
    const challengeDate = assertDailyDateKey(targetDate);
    /** Provides daily index behavior. */
    const dailyIndex = Math.floor(new Date(`${challengeDate}T00:00:00.000Z`).getTime() / 86_400_000);
    if (locales.length === 0)
        return;
    if (!process.env.OPENAI_API_KEY)
        throw new Error("OPENAI_API_KEY environment variable is required");
    /** Provides total attempt count behavior. */
    let totalAttemptCount = 0;
    /** Provides failures behavior. */
    const failures = [];
    /** Provides generate for locale behavior. */
    const generateForLocale = async (locale) => {
        /** Provides daily riddle ref behavior. */
        const dailyRiddleRef = (0, riddleGenerationRepository_1.getLocalizedDailyDocRef)(locale, challengeDate);
        /** Provides existing challenge behavior. */
        const existingChallenge = await dailyRiddleRef.get();
        /** Provides existing data behavior. */
        const existingData = existingChallenge.data();
        if (existingChallenge.exists &&
            !forceGenerate &&
            existingData?.challengeKey === challengeDate &&
            typeof existingData.text === "string" &&
            existingData.text.length > 0 &&
            (0, singlePlayerAnswerPolicy_1.isPlayableSinglePlayerAnswer)(existingData.answer) &&
            (0, riddleGenerationRepository_1.riddleHasPlayableClue)({ question: existingData.text, answer: existingData.answer })) {
            v2_1.logger.info("Immutable daily challenge already exists.", { locale, challengeDate });
            return;
        }
        /** Provides existing behavior. */
        const existing = await (0, riddleGenerationRepository_1.getLocalizedExistingRiddlesFromFirestoreForLocale)(locale);
        /** Provides generated attempts behavior. */
        const generatedAttempts = [];
        for (let localeAttempt = 1; localeAttempt <= MAX_DAILY_ATTEMPTS_PER_LOCALE; localeAttempt++) {
            if (totalAttemptCount >= MAX_DAILY_ATTEMPTS_PER_RUN)
                break;
            totalAttemptCount += 1;
            /** Provides riddle behavior. */
            const riddle = await (0, openaiService_1.generateUniqueRiddle)(locale, [...existing.answers, ...generatedAttempts.map((item) => item.answer)], { mode: "daily", difficulty: "medium", background: true, excludedQuestions: [...existing.questions, ...generatedAttempts.map((item) => item.question)] });
            if (!riddle)
                continue;
            /** Provides candidate behavior. */
            const candidate = { question: riddle[0], answer: riddle[1] };
            generatedAttempts.push(candidate);
            if (!(0, singlePlayerAnswerPolicy_1.isPlayableSinglePlayerAnswer)(candidate.answer) ||
                !(0, riddleGenerationRepository_1.riddleHasPlayableClue)(candidate) ||
                (0, riddleGenerationRepository_1.riddleExists)(candidate, existing.questions, existing.answers) ||
                (0, riddleGenerationRepository_1.riddleExists)(candidate, generatedAttempts.slice(0, -1).map((item) => item.question), generatedAttempts.slice(0, -1).map((item) => item.answer))) {
                continue;
            }
            /** Provides riddle id behavior. */
            const riddleId = `daily-${challengeDate}`;
            /** Provides riddle data behavior. */
            const riddleData = {
                riddleId,
                canonicalKey: (0, riddleGenerationRepository_1.getLocalizedCanonicalKey)("daily", dailyIndex, locale),
                challengeKey: challengeDate,
                locale,
                text: candidate.question,
                answer: candidate.answer,
                ...(riddle[2] ? { difficultyBand: riddle[2] } : {}),
                dailyIndex,
                category: "daily",
                timestamp: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            };
            await dailyRiddleRef.set(riddleData);
            v2_1.logger.info("Generated immutable daily challenge.", { locale, challengeDate, localeAttempt });
            return;
        }
        throw new Error("Locale generation attempt budget exhausted.");
    };
    for (let index = 0; index < locales.length; index += DAILY_LOCALE_CONCURRENCY) {
        /** Provides locale batch behavior. */
        const localeBatch = locales.slice(index, index + DAILY_LOCALE_CONCURRENCY);
        /** Sets tled. */
        const settled = await Promise.allSettled(localeBatch.map(generateForLocale));
        settled.forEach((result, resultIndex) => {
            if (result.status === "rejected") {
                /** Provides reason behavior. */
                const reason = result.reason instanceof Error ? result.reason.name : typeof result.reason;
                failures.push({ locale: localeBatch[resultIndex], reason });
            }
        });
    }
    if (failures.length > 0) {
        v2_1.logger.error("Immutable daily generation finished with missing locales.", {
            challengeDate,
            generatedLocaleCount: locales.length - failures.length,
            failedLocaleCount: failures.length,
            failedLocales: failures.map((entry) => entry.locale),
            attemptCount: totalAttemptCount,
        });
        throw new DailyGenerationIncompleteError(failures.map((entry) => entry.locale), totalAttemptCount);
    }
    v2_1.logger.info("Immutable localized daily generation completed.", {
        challengeDate,
        localeCount: locales.length,
        attemptCount: totalAttemptCount,
    });
}
/** Backwards-compatible wrapper used by manual tooling and older tests. */
async function generateLocalizedTodaysDailyChallenge(forceGenerate = false) {
    /** One captured generation instant shared across locale grouping. */
    const now = new Date();
    /** Supported locales grouped by the regional Daily date they currently require. */
    const groups = new Map();
    for (const locale of validation_1.SUPPORTED_LOCALES) {
        /** Regional Daily date selected for this locale’s generation group. */
        const day = (0, dailyCalendar_1.getDailyDate)(locale, now);
        groups.set(day, [...(groups.get(day) ?? []), locale]);
    }
    for (const [day, locales] of groups)
        await generateLocalizedDailyChallengeForDate(day, forceGenerate, locales);
}
//# sourceMappingURL=dailyRiddleGeneration.js.map