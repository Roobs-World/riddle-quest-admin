import {logger} from "firebase-functions/v2";
import {admin} from "../shared/firebaseAdmin";
import {generateUniqueRiddle} from "../riddles/openaiService";
import type {DailyRiddle} from "../validation/firestoreSchemas";
import {RiddleCollections} from "../validation/firestoreSchemas";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";
import {
  getExistingRiddlesFromFirestore,
  getLocalizedCanonicalKey,
  getLocalizedDailyDocRef,
  getLocalizedExistingRiddlesFromFirestoreForLocale,
  getNextDailyIndex,
  riddleExists,
} from "../riddles/riddleGenerationRepository";

/** Provides generate todays daily challenge behavior. */
export async function generateTodaysDailyChallenge(forceGenerate: boolean = false): Promise<void> {
  const dailyChallengeQuestionCount = 1;
  logger.info(`Generating today's ${dailyChallengeQuestionCount}-question daily challenge...`);

  const today = new Date();
  const todayDateString = today.toISOString().split("T")[0]; // YYYY-MM-DD format

  const currentDailyRiddleRef = admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).doc("current");
  const existingChallenge = await currentDailyRiddleRef.get();

  const getUtcDateFromStoredTimestamp = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === "object" && value !== null && "toDate" in (value as object)) {
      const ts = value as {toDate: () => Date};
      const parsed = ts.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
    }
    const parsed = new Date(value as string | number | Date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
  };

  if (existingChallenge.exists && !forceGenerate) {
    const existingData = existingChallenge.data();
    const existingChallengeDate = getUtcDateFromStoredTimestamp(existingData?.timestamp);
    if (existingChallengeDate === todayDateString && existingData?.text && existingData?.answer) {
      logger.info(`Today's daily challenge already exists with ${dailyChallengeQuestionCount} question.`);
      return;
    }
  }

  logger.info(`Generating ${dailyChallengeQuestionCount} new riddle for daily challenge on ${todayDateString}...`);

  // Check for required environment variables
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  // Get existing riddles for duplicate checking
  const existing = await getExistingRiddlesFromFirestore();
  const startingDailyIndex = await getNextDailyIndex();

  let selectedDailyChallengeRiddle: {text: string; answer: string} | null = null;

  const generatedAttempts: {question: string; answer: string}[] = [];

  // Circuit breaker: Maximum attempts to prevent infinite loops
  const maxAttempts = dailyChallengeQuestionCount * 10;
  let attemptCount = 0;

  while (!selectedDailyChallengeRiddle && attemptCount < maxAttempts) {
    attemptCount++;

    // Generate a riddle using the OpenAI service
    const riddle = await generateUniqueRiddle("en", [
      ...existing.answers,
      ...generatedAttempts.map((item) => item.answer),
    ]);

    if (riddle) {
      const newRiddle = {
        question: riddle[0],
        answer: riddle[1],
      };

      // Check for duplicates against existing and newly generated riddles
      if (
        !riddleExists(newRiddle, existing.questions, existing.answers) &&
        !riddleExists(
          newRiddle,
          generatedAttempts.map((r) => r.question),
          generatedAttempts.map((r) => r.answer),
        )
      ) {
        const riddleData: DailyRiddle = {
          riddleId: "current",
          text: newRiddle.question,
          answer: newRiddle.answer,
          dailyIndex: startingDailyIndex,
          category: "daily",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };

        await currentDailyRiddleRef.set(riddleData);
        selectedDailyChallengeRiddle = {
          text: newRiddle.question,
          answer: newRiddle.answer,
        };

        // Add to existing for subsequent duplicate checks within this run
        existing.questions.push(newRiddle.question.toLowerCase());
        existing.answers.push(newRiddle.answer.toLowerCase());

        logger.info(`Generated daily challenge question 1/${dailyChallengeQuestionCount} (attempt ${attemptCount})`);
      } else {
        logger.warn(`Generated riddle is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
      }
      generatedAttempts.push(newRiddle);
    } else {
      logger.warn(`Failed to generate unique riddle, retrying... (attempt ${attemptCount}/${maxAttempts})`);
    }
  }

  // Check if we hit the circuit breaker
  if (!selectedDailyChallengeRiddle && attemptCount >= maxAttempts) {
    logger.warn(
      `Circuit breaker activated: Only generated 0/${dailyChallengeQuestionCount} daily challenge questions after ${maxAttempts} attempts`,
    );
    throw new Error(`Failed to generate any unique daily challenge questions after ${maxAttempts} attempts`);
  }

  if (selectedDailyChallengeRiddle) {
    logger.info(`Successfully generated and stored the current daily challenge for ${todayDateString}.`);
  } else {
    throw new Error("Failed to generate any daily challenge questions.");
  }
}

/** Provides generate localized todays daily challenge behavior. */
export async function generateLocalizedTodaysDailyChallenge(forceGenerate: boolean = false): Promise<void> {
  const todayDateString = new Date().toISOString().split("T")[0];

  const generateForLocale = async (locale: SupportedLocale): Promise<void> => {
    const currentDailyRiddleRef = getLocalizedDailyDocRef(locale);
    const existingChallenge = await currentDailyRiddleRef.get();

    const getUtcDateFromStoredTimestamp = (value: unknown): string | null => {
      if (!value) return null;
      if (typeof value === "object" && value !== null && "toDate" in (value as object)) {
        const ts = value as {toDate: () => Date};
        const parsed = ts.toDate();
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
      }
      const parsed = new Date(value as string | number | Date);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
    };

    if (existingChallenge.exists && !forceGenerate) {
      const existingData = existingChallenge.data();
      const existingChallengeDate = getUtcDateFromStoredTimestamp(existingData?.timestamp);
      if (existingChallengeDate === todayDateString && existingData?.text && existingData?.answer) {
        logger.info(`Today's daily challenge already exists for locale ${locale}.`);
        return;
      }
    }

    logger.info(`Generating today's daily challenge for locale ${locale} on ${todayDateString}...`);

    const openAIKey = process.env.OPENAI_API_KEY;
    if (!openAIKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    const existing = await getLocalizedExistingRiddlesFromFirestoreForLocale(locale);
    const startingDailyIndex = await getNextDailyIndex();
    const maxAttempts = 50;
    let attemptCount = 0;
    let selectedDailyChallengeRiddle: {text: string; answer: string} | null = null;
    const generatedAttempts: {question: string; answer: string}[] = [];

    while (!selectedDailyChallengeRiddle && attemptCount < maxAttempts) {
      attemptCount++;
      const riddle = await generateUniqueRiddle(locale, [
        ...existing.answers,
        ...generatedAttempts.map((item) => item.answer),
      ]);
      if (!riddle) {
        continue;
      }

      const newRiddle = {question: riddle[0], answer: riddle[1]};
      if (
        !riddleExists(newRiddle, existing.questions, existing.answers) &&
        !riddleExists(
          newRiddle,
          generatedAttempts.map((item) => item.question),
          generatedAttempts.map((item) => item.answer),
        )
      ) {
        const riddleData: DailyRiddle = {
          riddleId: "current",
          canonicalKey: getLocalizedCanonicalKey("daily", startingDailyIndex, locale),
          challengeKey: todayDateString,
          locale,
          text: newRiddle.question,
          answer: newRiddle.answer,
          dailyIndex: startingDailyIndex,
          category: "daily",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };

        await currentDailyRiddleRef.set(riddleData);
        selectedDailyChallengeRiddle = {
          text: newRiddle.question,
          answer: newRiddle.answer,
        };
        existing.questions.push(newRiddle.question.toLowerCase());
        existing.answers.push(newRiddle.answer.toLowerCase());
        logger.info(`Generated daily challenge question for locale ${locale} (attempt ${attemptCount})`);
      }

      generatedAttempts.push(newRiddle);
    }

    if (!selectedDailyChallengeRiddle) {
      throw new Error(`Failed to generate any daily challenge questions for locale ${locale}.`);
    }
  };

  const localeConcurrency = 3;
  for (let index = 0; index < SUPPORTED_LOCALES.length; index += localeConcurrency) {
    await Promise.all(SUPPORTED_LOCALES.slice(index, index + localeConcurrency).map(generateForLocale));
  }
}
