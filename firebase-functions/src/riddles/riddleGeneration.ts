import {logger} from "firebase-functions/v2";
import {admin} from "../shared/firebaseAdmin";
import {generateUniqueRiddle} from "./openaiService";
import {captureException} from "../shared/sentry";
import {RiddleCollections} from "../validation/firestoreSchemas";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";
import {
  areLocalizedClassicRiddlesSeeded,
  areLocalizedClassicRiddlesSeededForLocale,
  getExistingRiddlesFromFirestore,
  getLocalizedExistingRiddlesFromFirestoreForLocale,
  getNextClassicIndex,
  getNextDailyIndex,
  riddleExists,
  riddleHasPlayableClue,
  storeClassicRiddlesInFirestore,
  storeDailyRiddlesInFirestore,
  storeLocalizedClassicRiddlesInFirestore,
} from "./riddleGenerationRepository";

export {generateLocalizedTodaysDailyChallenge} from "../daily/dailyRiddleGeneration";

/** Provides generate localized classic riddles for locale behavior. */
export async function generateLocalizedClassicRiddlesForLocale(
  locale: SupportedLocale,
  numberOfRiddles: number,
): Promise<void> {
  logger.info(`Generating ${numberOfRiddles} new classic riddles for locale ${locale}...`);

  /** Provides open ai key behavior. */
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  /** Provides existing behavior. */
  const existing = await getLocalizedExistingRiddlesFromFirestoreForLocale(locale);
  /** Starts ing index. */
  const startingIndex = await getNextClassicIndex();
  /** Provides new riddles behavior. */
  const newRiddles: {
    /** Stores question. */
    question: string; /** Stores answer. */
    /** Stores answer. */
    answer: string;
  }[] = [];
  /** Provides generated attempts behavior. */
  const generatedAttempts: {
    /** Stores question. */
    question: string; /** Stores answer. */
    /** Stores answer. */
    answer: string;
  }[] = [];
  /** Provides max attempts behavior. */
  const maxAttempts = numberOfRiddles * 10;
  /** Provides attempt count behavior. */
  let attemptCount = 0;

  while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
    attemptCount++;
    /** Provides riddle behavior. */
    const riddle = await generateUniqueRiddle(locale, [
      ...existing.answers,
      ...generatedAttempts.map((item) => item.answer),
    ]);
    if (!riddle) {
      logger.warn(
        `Failed to generate unique classic riddle for locale ${locale}, retrying... (attempt ${attemptCount}/${maxAttempts})`,
      );
      continue;
    }

    /** Provides new riddle behavior. */
    const newRiddle = {question: riddle[0], answer: riddle[1]};
    if (!riddleHasPlayableClue(newRiddle)) {
      logger.warn(
        `Generated classic riddle for locale ${locale} reveals its answer, trying again... (attempt ${attemptCount}/${maxAttempts})`,
      );
      continue;
    }

    if (
      !riddleExists(newRiddle, existing.questions, existing.answers) &&
      !riddleExists(
        newRiddle,
        generatedAttempts.map((item) => item.question),
        generatedAttempts.map((item) => item.answer),
      )
    ) {
      newRiddles.push(newRiddle);
      existing.questions.push(newRiddle.question.toLowerCase());
      existing.answers.push(newRiddle.answer.toLowerCase());
      logger.info(
        `Generated classic riddle ${newRiddles.length}/${numberOfRiddles} for locale ${locale} (attempt ${attemptCount})`,
      );
    } else {
      logger.warn(
        `Generated classic riddle for locale ${locale} is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`,
      );
    }

    generatedAttempts.push(newRiddle);
  }

  if (newRiddles.length < numberOfRiddles && attemptCount >= maxAttempts) {
    logger.warn(
      `Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} classic riddles for locale ${locale} after ${maxAttempts} attempts`,
    );
    if (newRiddles.length === 0) {
      throw new Error(
        `Failed to generate any unique classic riddles for locale ${locale} after ${maxAttempts} attempts`,
      );
    }
  }

  if (newRiddles.length > 0) {
    await storeLocalizedClassicRiddlesInFirestore(locale, newRiddles, startingIndex);
    logger.info(`Successfully generated and stored ${newRiddles.length} classic riddles for locale ${locale}.`);
  }
}

/** Provides generate localized classic riddles behavior. */
export async function generateLocalizedClassicRiddles(numberOfRiddles: number): Promise<void> {
  /** Provides locale concurrency behavior. */
  const localeConcurrency = 3;
  for (let index = 0; index < SUPPORTED_LOCALES.length; index += localeConcurrency) {
    /** Provides locale batch behavior. */
    const localeBatch = SUPPORTED_LOCALES.slice(index, index + localeConcurrency);
    await Promise.all(
      localeBatch.map(async (locale) => {
        if (await areLocalizedClassicRiddlesSeededForLocale(locale)) {
          logger.info(`Skipping locale ${locale} because localized classic riddles already exist.`);
          return;
        }

        await generateLocalizedClassicRiddlesForLocale(locale, numberOfRiddles);
      }),
    );
  }
}

/**
 * Generates a specified number of unique riddles and stores them directly in Firestore.
 * This function is called automatically by the submit answer function when needed.
 *
 * @param numberOfRiddles - The number of new riddles to generate.
 */
export async function generateAndAppendRiddles(numberOfRiddles: number): Promise<void> {
  logger.info(`Generating ${numberOfRiddles} new riddles...`);

  // Check for required environment variables
  /** Provides open ai key behavior. */
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  // Get existing riddles for duplicate checking
  /** Provides existing behavior. */
  const existing = await getExistingRiddlesFromFirestore();

  // Get the next available classic index
  /** Starts ing index. */
  const startingIndex = await getNextClassicIndex();

  /** Provides new riddles behavior. */
  const newRiddles: {
    /** Stores question. */
    question: string; /** Stores answer. */
    /** Stores answer. */
    answer: string;
  }[] = [];
  /** Provides generated attempts behavior. */
  const generatedAttempts: {
    /** Stores question. */
    question: string; /** Stores answer. */
    /** Stores answer. */
    answer: string;
  }[] = [];

  // Circuit breaker: Maximum attempts to prevent infinite loops
  /** Provides max attempts behavior. */
  const maxAttempts = numberOfRiddles * 10; // Allow 10x attempts for retries
  /** Provides attempt count behavior. */
  let attemptCount = 0;

  while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
    attemptCount++;

    // Generate a riddle using the OpenAI service
    /** Provides riddle behavior. */
    const riddle = await generateUniqueRiddle("en", [
      ...existing.answers,
      ...generatedAttempts.map((item) => item.answer),
    ]);

    if (riddle) {
      /** Provides new riddle behavior. */
      const newRiddle = {
        question: riddle[0],
        answer: riddle[1],
      };

      if (!riddleHasPlayableClue(newRiddle)) {
        logger.warn(`Generated riddle reveals its answer, trying again... (attempt ${attemptCount}/${maxAttempts})`);
        continue;
      }

      // Check for duplicates against existing and newly generated riddles
      if (
        !riddleExists(newRiddle, existing.questions, existing.answers) &&
        !riddleExists(
          newRiddle,
          generatedAttempts.map((r) => r.question),
          generatedAttempts.map((r) => r.answer),
        )
      ) {
        newRiddles.push(newRiddle);
        // Add to existing for subsequent duplicate checks within this run
        existing.questions.push(newRiddle.question.toLowerCase());
        existing.answers.push(newRiddle.answer.toLowerCase());
        logger.info(`Generated riddle ${newRiddles.length}/${numberOfRiddles} (attempt ${attemptCount})`);
      } else {
        logger.warn(`Generated riddle is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
      }
      generatedAttempts.push(newRiddle);
    } else {
      logger.warn(`Failed to generate unique riddle, retrying... (attempt ${attemptCount}/${maxAttempts})`);
    }
  }

  // Check if we hit the circuit breaker
  if (newRiddles.length < numberOfRiddles && attemptCount >= maxAttempts) {
    logger.warn(
      `Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} riddles after ${maxAttempts} attempts`,
    );
    if (newRiddles.length === 0) {
      throw new Error(`Failed to generate any unique riddles after ${maxAttempts} attempts`);
    }
  }

  if (newRiddles.length > 0) {
    // Store riddles directly in Firestore
    await storeClassicRiddlesInFirestore(newRiddles, startingIndex);
    logger.info(`Successfully generated and stored ${newRiddles.length} new riddles in Firestore.`);
  } else {
    logger.warn("No new unique riddles were generated.");
  }
}

/**
 * Generates a specified number of unique daily riddles and stores them directly in Firestore.
 * This function is called automatically by the submit answer function when needed.
 *
 * @param numberOfRiddles - The number of new daily riddles to generate.
 */
export async function generateAndAppendDailyRiddles(numberOfRiddles: number): Promise<void> {
  logger.info(`Generating ${numberOfRiddles} new daily riddles...`);

  // Check for required environment variables
  /** Provides open ai key behavior. */
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  // Get existing riddles for duplicate checking (includes both classic and daily)
  /** Provides existing behavior. */
  const existing = await getExistingRiddlesFromFirestore();

  // Get the next available daily index
  /** Starts ing index. */
  const startingIndex = await getNextDailyIndex();

  /** Provides new riddles behavior. */
  const newRiddles: {
    /** Stores question. */
    question: string; /** Stores answer. */
    /** Stores answer. */
    answer: string;
  }[] = [];
  /** Provides generated attempts behavior. */
  const generatedAttempts: {
    /** Stores question. */
    question: string; /** Stores answer. */
    /** Stores answer. */
    answer: string;
  }[] = [];

  // Circuit breaker: Maximum attempts to prevent infinite loops
  /** Provides max attempts behavior. */
  const maxAttempts = numberOfRiddles * 10; // Allow 10x attempts for retries
  /** Provides attempt count behavior. */
  let attemptCount = 0;

  while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
    attemptCount++;

    // Generate a riddle using the OpenAI service
    /** Provides riddle behavior. */
    const riddle = await generateUniqueRiddle("en", [
      ...existing.answers,
      ...generatedAttempts.map((item) => item.answer),
    ]);

    if (riddle) {
      /** Provides new riddle behavior. */
      const newRiddle = {
        question: riddle[0],
        answer: riddle[1],
      };

      if (!riddleHasPlayableClue(newRiddle)) {
        logger.warn(
          `Generated daily riddle reveals its answer, trying again... (attempt ${attemptCount}/${maxAttempts})`,
        );
        continue;
      }

      // Check for duplicates against existing and newly generated riddles
      if (
        !riddleExists(newRiddle, existing.questions, existing.answers) &&
        !riddleExists(
          newRiddle,
          generatedAttempts.map((r) => r.question),
          generatedAttempts.map((r) => r.answer),
        )
      ) {
        newRiddles.push(newRiddle);
        // Add to existing for subsequent duplicate checks within this run
        existing.questions.push(newRiddle.question.toLowerCase());
        existing.answers.push(newRiddle.answer.toLowerCase());
        logger.info(`Generated daily riddle ${newRiddles.length}/${numberOfRiddles} (attempt ${attemptCount})`);
      } else {
        logger.warn(`Generated daily riddle is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
      }
      generatedAttempts.push(newRiddle);
    } else {
      logger.warn(`Failed to generate unique daily riddle, retrying... (attempt ${attemptCount}/${maxAttempts})`);
    }
  }

  // Check if we hit the circuit breaker
  if (newRiddles.length < numberOfRiddles && attemptCount >= maxAttempts) {
    logger.warn(
      `Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} daily riddles after ${maxAttempts} attempts`,
    );
    if (newRiddles.length === 0) {
      throw new Error(`Failed to generate any unique daily riddles after ${maxAttempts} attempts`);
    }
  }

  if (newRiddles.length > 0) {
    await storeDailyRiddlesInFirestore(newRiddles, startingIndex);
    logger.info("Successfully generated and stored a new current daily riddle in Firestore.");
  } else {
    logger.warn("No new unique daily riddles were generated.");
  }
}

/**
 * Initializes the riddle database if it's empty.
 * This function is called automatically by the submit answer function if no riddles exist.
 *
 * @param initialRiddleCount - The number of initial riddles to generate.
 */
export async function initializeRiddleDatabaseIfEmpty(initialRiddleCount: number = 20): Promise<void> {
  logger.info("Checking if riddle database needs initialization...");

  try {
    // Check if any classic riddles already exist
    /** Provides existing riddles snapshot behavior. */
    const existingRiddlesSnapshot = await admin
      .firestore()
      .collection(RiddleCollections.RIDDLES)
      .where("classicIndex", ">=", 0)
      .limit(1)
      .get();

    if (!existingRiddlesSnapshot.empty) {
      logger.info("Riddle database already initialized - classic riddles exist.");
      return;
    }

    // Generate initial batch of riddles for new database
    logger.info(`Generating ${initialRiddleCount} initial riddles for database initialization...`);
    await generateAndAppendRiddles(initialRiddleCount);
    logger.info(`Riddle database initialized with ${initialRiddleCount} classic riddles.`);
  } catch (error) {
    logger.error("Error initializing riddle database:", error);
    captureException(error);
    throw new Error("Failed to initialize riddle database.");
  }
}

/** Provides initialize localized riddle database if empty behavior. */
export async function initializeLocalizedRiddleDatabaseIfEmpty(initialRiddleCount: number = 20): Promise<void> {
  logger.info("Checking if localized riddle database needs initialization...");

  try {
    if (await areLocalizedClassicRiddlesSeeded()) {
      logger.info("Localized riddle database already initialized - classic riddles exist for every locale.");
      return;
    }

    logger.info(`Generating ${initialRiddleCount} initial riddles for each supported locale...`);
    await generateLocalizedClassicRiddles(initialRiddleCount);
    logger.info(`Localized riddle database initialized with ${initialRiddleCount} classic riddles per locale.`);
  } catch (error) {
    logger.error("Error initializing localized riddle database:", error);
    captureException(error);
    throw new Error("Failed to initialize localized riddle database.");
  }
}

/**
 * Generates 1 riddle for today's daily challenge and stores it in the challenge structure.
 * @param forceGenerate - If true, generates new riddles even if today's challenge already exists.
 * @return A promise that resolves when the daily challenge is created.
 */
