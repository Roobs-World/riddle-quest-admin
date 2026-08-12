import {logger} from "firebase-functions/v2";
import {admin} from "../shared/firebaseAdmin";
import {generateUniqueRiddle} from "../riddles/openaiService";
import type {DailyRiddle} from "../validation/firestoreSchemas";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";
import {
  getLocalizedCanonicalKey,
  getLocalizedDailyDocRef,
  getLocalizedExistingRiddlesFromFirestoreForLocale,
  riddleExists,
  riddleHasPlayableClue,
} from "../riddles/riddleGenerationRepository";
import {isPlayableSinglePlayerAnswer} from "../gameplay/singlePlayerAnswerPolicy";

/** Maximum model calls spent on one locale in one scheduled run. */
const MAX_DAILY_ATTEMPTS_PER_LOCALE = 3;
/** Maximum model calls spent across all locales in one scheduled run. */
const MAX_DAILY_ATTEMPTS_PER_RUN = 51;
/** Locale generation concurrency keeps OpenAI and Firestore pressure bounded. */
const DAILY_LOCALE_CONCURRENCY = 3;

/** Validates and normalizes an immutable UTC daily-content key. */
function assertUtcDateKey(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("A YYYY-MM-DD UTC challenge date is required.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("A valid UTC challenge date is required.");
  }
  return value;
}

/**
 * Generates immutable localized daily documents for one UTC date.
 *
 * The scheduler runs this before rollover. A failure never overwrites playable
 * content for another date, and later scheduled retries only fill missing or
 * invalid locale documents.
 */
export async function generateLocalizedDailyChallengeForDate(
  targetDate: string,
  forceGenerate: boolean = false,
): Promise<void> {
  const challengeDate = assertUtcDateKey(targetDate);
  const dailyIndex = Math.floor(new Date(`${challengeDate}T00:00:00.000Z`).getTime() / 86_400_000);
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY environment variable is required");

  let totalAttemptCount = 0;
  const failures: {locale: SupportedLocale; reason: string}[] = [];

  const generateForLocale = async (locale: SupportedLocale): Promise<void> => {
    const dailyRiddleRef = getLocalizedDailyDocRef(locale, challengeDate);
    const existingChallenge = await dailyRiddleRef.get();
    const existingData = existingChallenge.data();
    if (
      existingChallenge.exists &&
      !forceGenerate &&
      existingData?.challengeKey === challengeDate &&
      typeof existingData.text === "string" &&
      existingData.text.length > 0 &&
      isPlayableSinglePlayerAnswer(existingData.answer) &&
      riddleHasPlayableClue({question: existingData.text, answer: existingData.answer})
    ) {
      logger.info("Immutable daily challenge already exists.", {locale, challengeDate});
      return;
    }

    const existing = await getLocalizedExistingRiddlesFromFirestoreForLocale(locale);
    const generatedAttempts: {question: string; answer: string}[] = [];

    for (let localeAttempt = 1; localeAttempt <= MAX_DAILY_ATTEMPTS_PER_LOCALE; localeAttempt++) {
      if (totalAttemptCount >= MAX_DAILY_ATTEMPTS_PER_RUN) break;
      totalAttemptCount += 1;
      const riddle = await generateUniqueRiddle(locale, [
        ...existing.answers,
        ...generatedAttempts.map((item) => item.answer),
      ]);
      if (!riddle) continue;

      const candidate = {question: riddle[0], answer: riddle[1]};
      generatedAttempts.push(candidate);
      if (
        !isPlayableSinglePlayerAnswer(candidate.answer) ||
        !riddleHasPlayableClue(candidate) ||
        riddleExists(candidate, existing.questions, existing.answers) ||
        riddleExists(
          candidate,
          generatedAttempts.slice(0, -1).map((item) => item.question),
          generatedAttempts.slice(0, -1).map((item) => item.answer),
        )
      ) {
        continue;
      }

      const riddleId = `daily-${challengeDate}`;
      const riddleData: DailyRiddle = {
        riddleId,
        canonicalKey: getLocalizedCanonicalKey("daily", dailyIndex, locale),
        challengeKey: challengeDate,
        locale,
        text: candidate.question,
        answer: candidate.answer,
        dailyIndex,
        category: "daily",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      };
      await dailyRiddleRef.set(riddleData);
      logger.info("Generated immutable daily challenge.", {locale, challengeDate, localeAttempt});
      return;
    }

    throw new Error("Locale generation attempt budget exhausted.");
  };

  for (let index = 0; index < SUPPORTED_LOCALES.length; index += DAILY_LOCALE_CONCURRENCY) {
    const localeBatch = SUPPORTED_LOCALES.slice(index, index + DAILY_LOCALE_CONCURRENCY);
    const settled = await Promise.allSettled(localeBatch.map(generateForLocale));
    settled.forEach((result, resultIndex) => {
      if (result.status === "rejected") {
        const reason = result.reason instanceof Error ? result.reason.name : typeof result.reason;
        failures.push({locale: localeBatch[resultIndex], reason});
      }
    });
  }

  if (failures.length > 0) {
    logger.error("Immutable daily generation finished with missing locales.", {
      challengeDate,
      generatedLocaleCount: SUPPORTED_LOCALES.length - failures.length,
      failedLocaleCount: failures.length,
      failedLocales: failures.map((entry) => entry.locale),
      attemptCount: totalAttemptCount,
    });
    throw new Error(`Daily generation incomplete for ${failures.length} locale(s).`);
  }
  logger.info("Immutable localized daily generation completed.", {
    challengeDate,
    localeCount: SUPPORTED_LOCALES.length,
    attemptCount: totalAttemptCount,
  });
}

/** Backwards-compatible wrapper used by manual tooling and older tests. */
export async function generateLocalizedTodaysDailyChallenge(forceGenerate: boolean = false): Promise<void> {
  return generateLocalizedDailyChallengeForDate(new Date().toISOString().slice(0, 10), forceGenerate);
}
