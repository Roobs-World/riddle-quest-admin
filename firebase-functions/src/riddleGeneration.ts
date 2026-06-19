import * as functions from "firebase-functions";
import {onCall, CallableOptions, CallableRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {generateUniqueRiddle} from "./openaiService";
import {captureException} from "./sentry";
import type {ClassicRiddle, DailyRiddle} from "./validation/firestoreSchemas";
import {RiddleCollections} from "./validation/firestoreSchemas";
import {clueContainsLiteralAnswer} from "./riddleQuality";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";
import {
  GenerateRiddlesResponseSchema,
  GenerateTodaysDailyChallengeRequestSchema,
  GenerateTodaysDailyChallengeResponseSchema,
  InitializeRiddleDatabaseResponseSchema,
} from "./validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "./validation/callableValidation";
import {z} from "zod";

const SeedLocalizedRiddlesRequestSchema = z
  .object({
    classicCount: z.number().int().positive().max(100).optional(),
    forceGenerateDaily: z.boolean().optional(),
  })
  .optional()
  .transform((value) => ({
    classicCount: value?.classicCount ?? 20,
    forceGenerateDaily: value?.forceGenerateDaily ?? true,
  }));

const SeedLocalizedRiddlesResponseSchema = z.object({
  success: z.literal(true),
  classicCount: z.number().int().positive(),
  dailyGenerated: z.boolean(),
  localeCount: z.number().int().positive(),
  message: z.string().min(1),
});

/**
 * Checks if a riddle already exists in the provided lists of questions and
 * answers.
 *
 * @param riddle - The riddle object to check.
 * @param existingQuestions - An array of existing questions.
 * @param existingAnswers - An array of existing answers.
 * @return True if the riddle exists, false otherwise.
 */
function riddleExists(
  riddle: {question: string; answer: string},
  existingQuestions: string[],
  existingAnswers: string[],
): boolean {
  const normalizedQuestion = riddle.question.toLowerCase();
  const normalizedAnswer = riddle.answer.toLowerCase();

  return existingQuestions.includes(normalizedQuestion) || existingAnswers.includes(normalizedAnswer);
}

function riddleHasPlayableClue(riddle: {question: string; answer: string}): boolean {
  return !clueContainsLiteralAnswer(riddle.question, riddle.answer);
}

const LOCALIZED_RIDDLES_COLLECTION = "localizedRiddles";
const LOCALIZED_RIDDLE_SUBCOLLECTION = "riddles";

const getLocalizedRiddleCollection = (locale: SupportedLocale): string =>
  `${LOCALIZED_RIDDLES_COLLECTION}/${locale}/${LOCALIZED_RIDDLE_SUBCOLLECTION}`;

const getLocalizedDailyDocRef = (locale: SupportedLocale): admin.firestore.DocumentReference =>
  admin.firestore().collection(getLocalizedRiddleCollection(locale)).doc("current");

const getLocalizedClassicDocRef = (locale: SupportedLocale, riddleId: string): admin.firestore.DocumentReference =>
  admin.firestore().collection(getLocalizedRiddleCollection(locale)).doc(riddleId);

const getLocalizedCanonicalKey = (category: "classic" | "daily", index: number, locale: SupportedLocale): string =>
  `${category}:${index}:${locale}`;

async function areLocalizedClassicRiddlesSeeded(): Promise<boolean> {
  for (const locale of SUPPORTED_LOCALES) {
    if (!(await areLocalizedClassicRiddlesSeededForLocale(locale))) {
      return false;
    }
  }

  return true;
}

async function areLocalizedClassicRiddlesSeededForLocale(locale: SupportedLocale): Promise<boolean> {
  const snapshot = await admin
    .firestore()
    .collection(getLocalizedRiddleCollection(locale))
    .where("classicIndex", ">=", 0)
    .limit(1)
    .get();

  return !snapshot.empty;
}

/**
 * Fetches existing riddles from all riddle collections for duplicate checking.
 * Checks classic riddles, daily riddles
 * @returns A promise that resolves with an object containing arrays of questions and answers.
 */
async function getExistingRiddlesFromFirestore(): Promise<{questions: string[]; answers: string[]}> {
  try {
    const questions: string[] = [];
    const answers: string[] = [];

    // Get classic riddles from 'riddles' collection
    const riddlesSnapshot = await admin.firestore().collection(RiddleCollections.RIDDLES).get();
    riddlesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.text) {
        questions.push(data.text.toLowerCase());
      }
      if (data.answer) {
        answers.push(data.answer.toLowerCase());
      }
    });

    // Get daily riddles from 'dailyRiddles' collection
    const dailyRiddlesSnapshot = await admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).get();
    dailyRiddlesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.text) {
        questions.push(data.text.toLowerCase());
      }
      if (data.answer) {
        answers.push(data.answer.toLowerCase());
      }
    });

    logger.info(
      `Loaded ${questions.length} existing questions and ${answers.length} existing answers for duplicate checking`,
    );
    return {questions, answers};
  } catch (error) {
    logger.error("Error fetching existing riddles from Firestore:", error);
    captureException(error);
    throw new Error("Failed to fetch existing riddles from Firestore.");
  }
}

async function getLocalizedExistingRiddlesFromFirestoreForLocale(
  locale: SupportedLocale,
): Promise<{questions: string[]; answers: string[]}> {
  const questions: string[] = [];
  const answers: string[] = [];

  const snapshot = await admin.firestore().collection(getLocalizedRiddleCollection(locale)).get();
  snapshot.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data();
    if (data.text) {
      questions.push(data.text.toLowerCase());
    }
    if (data.answer) {
      answers.push(data.answer.toLowerCase());
    }
  });

  logger.info(
    `Loaded ${questions.length} localized questions and ${answers.length} localized answers for duplicate checking in locale ${locale}`,
  );
  return {questions, answers};
}

async function requireAdmin(request: CallableRequest<unknown>): Promise<void> {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  if (request.auth.token?.admin === true) {
    return;
  }

  const adminDoc = await admin.firestore().collection("admins").doc(request.auth.uid).get();
  if (adminDoc.exists) {
    return;
  }

  throw new functions.https.HttpsError("permission-denied", "This operation requires admin privileges.");
}

/**
 * Gets the next available classic index for new riddles.
 * @returns The next available classic index.
 */
async function getNextClassicIndex(): Promise<number> {
  try {
    const riddlesSnapshot = await admin
      .firestore()
      .collection(RiddleCollections.RIDDLES)
      .where("classicIndex", ">=", 0)
      .orderBy("classicIndex", "desc")
      .limit(1)
      .get();

    if (riddlesSnapshot.empty) {
      return 1; // Start from 1 to match the classic_1 doc naming convention
    }

    const highestIndexDoc = riddlesSnapshot.docs[0];
    const highestIndex = highestIndexDoc.data().classicIndex || 0;
    return highestIndex + 1;
  } catch (error) {
    logger.error("Error getting next classic index:", error);
    captureException(error);
    throw new Error("Failed to get next classic index.");
  }
}

/**
 * Stores generated classic riddles in the riddles collection.
 * @param riddles - An array of riddle objects to store.
 * @param startingIndex - The starting classic index for the riddles.
 */
async function storeClassicRiddlesInFirestore(
  riddles: {question: string; answer: string}[],
  startingIndex: number,
): Promise<void> {
  const batch = admin.firestore().batch();

  riddles.forEach((riddle, index) => {
    const docId = `classic_${startingIndex + index}`;
    const riddleRef = admin.firestore().collection(RiddleCollections.RIDDLES).doc(docId);
    const riddleData: ClassicRiddle = {
      riddleId: docId,
      text: riddle.question,
      answer: riddle.answer,
      classicIndex: startingIndex + index,
      category: "classic",
    };

    batch.set(riddleRef, riddleData);
  });

  try {
    await batch.commit();
    logger.info(`Successfully stored ${riddles.length} new classic riddles in Firestore.`);
  } catch (error) {
    logger.error("Error storing classic riddles in Firestore:", error);
    captureException(error);
    throw new Error("Failed to store classic riddles in Firestore.");
  }
}

async function storeLocalizedClassicRiddlesInFirestore(
  locale: SupportedLocale,
  riddles: {question: string; answer: string}[],
  startingIndex: number,
): Promise<void> {
  const batch = admin.firestore().batch();

  riddles.forEach((riddle, index) => {
    const docId = `classic_${startingIndex + index}`;
    const riddleRef = getLocalizedClassicDocRef(locale, docId);
    const riddleData: ClassicRiddle = {
      riddleId: docId,
      canonicalKey: getLocalizedCanonicalKey("classic", startingIndex + index, locale),
      locale,
      text: riddle.question,
      answer: riddle.answer,
      classicIndex: startingIndex + index,
      category: "classic",
    };

    batch.set(riddleRef, riddleData);
  });

  try {
    await batch.commit();
    logger.info(`Successfully stored ${riddles.length} new classic riddles in Firestore for locale ${locale}.`);
  } catch (error) {
    logger.error(`Error storing classic riddles in Firestore for locale ${locale}:`, error);
    captureException(error);
    throw new Error(`Failed to store classic riddles in Firestore for locale ${locale}.`);
  }
}

/**
 * Gets the next available daily index for new daily riddles.
 * @returns The next available daily index.
 */
async function getNextDailyIndex(): Promise<number> {
  try {
    const currentDoc = await admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).doc("current").get();

    if (!currentDoc.exists) {
      return 0;
    }

    const highestIndex = currentDoc.data()?.dailyIndex || 0;
    return highestIndex + 1;
  } catch (error) {
    logger.error("Error getting next daily index:", error);
    captureException(error);
    throw new Error("Failed to get next daily index.");
  }
}

/**
 * Stores generated daily riddles in the dailyRiddles collection.
 * @param riddles - An array of riddle objects to store.
 * @param startingIndex - The starting daily index for the riddles.
 */
async function storeDailyRiddlesInFirestore(
  riddles: {question: string; answer: string}[],
  startingIndex: number,
): Promise<void> {
  if (riddles.length === 0) {
    logger.warn("No daily riddles provided to store.");
    return;
  }

  if (riddles.length > 1) {
    logger.warn(
      `Received ${riddles.length} daily riddles, but schema supports only one. Keeping the first and overwriting dailyRiddles/current.`,
    );
  }

  const selectedRiddle = riddles[0];
  const riddleRef = admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).doc("current");
  const riddleData: DailyRiddle = {
    riddleId: "current",
    text: selectedRiddle.question,
    answer: selectedRiddle.answer,
    dailyIndex: startingIndex,
    category: "daily",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await riddleRef.set(riddleData);
    logger.info("Successfully stored daily riddle in dailyRiddles/current.");
  } catch (error) {
    logger.error("Error storing daily riddles in Firestore:", error);
    captureException(error);
    throw new Error("Failed to store daily riddles in Firestore.");
  }
}

async function storeLocalizedDailyRiddlesInFirestore(
  locale: SupportedLocale,
  riddles: {question: string; answer: string}[],
  startingIndex: number,
): Promise<void> {
  if (riddles.length === 0) {
    logger.warn(`No daily riddles provided to store for locale ${locale}.`);
    return;
  }

  if (riddles.length > 1) {
    logger.warn(
      `Received ${riddles.length} daily riddles for locale ${locale}, but schema supports only one. Keeping the first and overwriting localizedRiddles/${locale}/riddles/current.`,
    );
  }

  const selectedRiddle = riddles[0];
  const riddleRef = getLocalizedDailyDocRef(locale);
  const riddleData: DailyRiddle = {
    riddleId: "current",
    canonicalKey: getLocalizedCanonicalKey("daily", startingIndex, locale),
    challengeKey: new Date().toISOString().split("T")[0],
    locale,
    text: selectedRiddle.question,
    answer: selectedRiddle.answer,
    dailyIndex: startingIndex,
    category: "daily",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await riddleRef.set(riddleData);
    logger.info(`Successfully stored daily riddle in localizedRiddles/${locale}/riddles/current.`);
  } catch (error) {
    logger.error(`Error storing daily riddles in Firestore for locale ${locale}:`, error);
    captureException(error);
    throw new Error(`Failed to store daily riddles in Firestore for locale ${locale}.`);
  }
}

async function generateLocalizedClassicRiddlesForLocale(
  locale: SupportedLocale,
  numberOfRiddles: number,
): Promise<void> {
  logger.info(`Generating ${numberOfRiddles} new classic riddles for locale ${locale}...`);

  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const existing = await getLocalizedExistingRiddlesFromFirestoreForLocale(locale);
  const startingIndex = await getNextClassicIndex();
  const newRiddles: {question: string; answer: string}[] = [];
  const generatedAttempts: {question: string; answer: string}[] = [];
  const maxAttempts = numberOfRiddles * 10;
  let attemptCount = 0;

  while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
    attemptCount++;
    const riddle = await generateUniqueRiddle(locale);
    if (!riddle) {
      logger.warn(`Failed to generate unique classic riddle for locale ${locale}, retrying... (attempt ${attemptCount}/${maxAttempts})`);
      continue;
    }

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
      logger.info(`Generated classic riddle ${newRiddles.length}/${numberOfRiddles} for locale ${locale} (attempt ${attemptCount})`);
    } else {
      logger.warn(`Generated classic riddle for locale ${locale} is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
    }

    generatedAttempts.push(newRiddle);
  }

  if (newRiddles.length < numberOfRiddles && attemptCount >= maxAttempts) {
    logger.warn(
      `Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} classic riddles for locale ${locale} after ${maxAttempts} attempts`,
    );
    if (newRiddles.length === 0) {
      throw new Error(`Failed to generate any unique classic riddles for locale ${locale} after ${maxAttempts} attempts`);
    }
  }

  if (newRiddles.length > 0) {
    await storeLocalizedClassicRiddlesInFirestore(locale, newRiddles, startingIndex);
    logger.info(`Successfully generated and stored ${newRiddles.length} classic riddles for locale ${locale}.`);
  }
}

async function generateLocalizedDailyRiddlesForLocale(
  locale: SupportedLocale,
  numberOfRiddles: number,
): Promise<void> {
  logger.info(`Generating ${numberOfRiddles} new daily riddles for locale ${locale}...`);

  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const existing = await getLocalizedExistingRiddlesFromFirestoreForLocale(locale);
  const startingIndex = await getNextDailyIndex();
  const newRiddles: {question: string; answer: string}[] = [];
  const generatedAttempts: {question: string; answer: string}[] = [];
  const maxAttempts = numberOfRiddles * 10;
  let attemptCount = 0;

  while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
    attemptCount++;
    const riddle = await generateUniqueRiddle(locale);
    if (!riddle) {
      logger.warn(`Failed to generate unique daily riddle for locale ${locale}, retrying... (attempt ${attemptCount}/${maxAttempts})`);
      continue;
    }

    const newRiddle = {question: riddle[0], answer: riddle[1]};
    if (!riddleHasPlayableClue(newRiddle)) {
      logger.warn(
        `Generated daily riddle for locale ${locale} reveals its answer, trying again... (attempt ${attemptCount}/${maxAttempts})`,
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
      logger.info(`Generated daily riddle ${newRiddles.length}/${numberOfRiddles} for locale ${locale} (attempt ${attemptCount})`);
    } else {
      logger.warn(`Generated daily riddle for locale ${locale} is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
    }

    generatedAttempts.push(newRiddle);
  }

  if (newRiddles.length < numberOfRiddles && attemptCount >= maxAttempts) {
    logger.warn(
      `Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} daily riddles for locale ${locale} after ${maxAttempts} attempts`,
    );
    if (newRiddles.length === 0) {
      throw new Error(`Failed to generate any unique daily riddles for locale ${locale} after ${maxAttempts} attempts`);
    }
  }

  if (newRiddles.length > 0) {
    await storeLocalizedDailyRiddlesInFirestore(locale, newRiddles, startingIndex);
    logger.info(`Successfully generated and stored ${newRiddles.length} daily riddles for locale ${locale}.`);
  }
}

export async function generateLocalizedClassicRiddles(numberOfRiddles: number): Promise<void> {
  for (const locale of SUPPORTED_LOCALES) {
    if (await areLocalizedClassicRiddlesSeededForLocale(locale)) {
      logger.info(`Skipping locale ${locale} because localized classic riddles already exist.`);
      continue;
    }

    await generateLocalizedClassicRiddlesForLocale(locale, numberOfRiddles);
  }
}

export async function generateLocalizedDailyRiddles(numberOfRiddles: number): Promise<void> {
  for (const locale of SUPPORTED_LOCALES) {
    await generateLocalizedDailyRiddlesForLocale(locale, numberOfRiddles);
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
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  // Get existing riddles for duplicate checking
  const existing = await getExistingRiddlesFromFirestore();

  // Get the next available classic index
  const startingIndex = await getNextClassicIndex();

  const newRiddles: {question: string; answer: string}[] = [];
  const generatedAttempts: {question: string; answer: string}[] = [];

  // Circuit breaker: Maximum attempts to prevent infinite loops
  const maxAttempts = numberOfRiddles * 10; // Allow 10x attempts for retries
  let attemptCount = 0;

  while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
    attemptCount++;

    // Generate a riddle using the OpenAI service
    const riddle = await generateUniqueRiddle();

    if (riddle) {
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
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  // Get existing riddles for duplicate checking (includes both classic and daily)
  const existing = await getExistingRiddlesFromFirestore();

  // Get the next available daily index
  const startingIndex = await getNextDailyIndex();

  const newRiddles: {question: string; answer: string}[] = [];
  const generatedAttempts: {question: string; answer: string}[] = [];

  // Circuit breaker: Maximum attempts to prevent infinite loops
  const maxAttempts = numberOfRiddles * 10; // Allow 10x attempts for retries
  let attemptCount = 0;

  while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
    attemptCount++;

    // Generate a riddle using the OpenAI service
    const riddle = await generateUniqueRiddle();

    if (riddle) {
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
 * Callable function to initialize the riddle database with a larger batch of riddles.
 * This is now deprecated in favor of automatic initialization in submit answer function.
 * Kept for backward compatibility.
 * @return A promise resolving to an object indicating success or failure.
 */
export const initializeRiddleDatabase = onCall(
  {
    enforceAppCheck: true,
    cors: true,
    region: "us-central1",
    timeoutSeconds: 300, // 5 minutes for initial database setup
    secrets: ["OPENAI_API_KEY"],
  } as CallableOptions,
  async (request: CallableRequest<unknown>): Promise<{success: boolean; message: string; riddlesGenerated: number}> => {
    logger.info("initializeRiddleDatabase function called - entry point reached");

    try {
      await requireAdmin(request);
      // Check if any classic riddles already exist
      const existingRiddlesSnapshot = await admin
        .firestore()
        .collection(RiddleCollections.RIDDLES)
        .where("classicIndex", ">=", 0)
        .limit(1)
        .get();

      if (!existingRiddlesSnapshot.empty) {
        logger.info("Riddle database already initialized - classic riddles exist.");
        return validateCallableResponse(InitializeRiddleDatabaseResponseSchema, {
          success: true,
          message: "Riddle database already initialized.",
          riddlesGenerated: 0,
        }, "initializeRiddleDatabase");
      }

      // Generate initial batch of riddles for new database
      const initialRiddleCount = 20;
      logger.info(`Generating ${initialRiddleCount} initial riddles for database initialization...`);
      await generateAndAppendRiddles(initialRiddleCount);
      logger.info(`Riddle database initialized with ${initialRiddleCount} classic riddles.`);

      return validateCallableResponse(InitializeRiddleDatabaseResponseSchema, {
        success: true,
        message: `Riddle database initialized with ${initialRiddleCount} classic riddles.`,
        riddlesGenerated: initialRiddleCount,
      }, "initializeRiddleDatabase");
    } catch (error) {
      logger.error("Error initializing riddle database:", error);
      captureException(error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      if (error instanceof Error) {
        logger.error("Error message:", error.message);
      }
      throw new functions.https.HttpsError("internal", "Failed to initialize riddle database.", error);
    }
  },
);

/**
 * Callable function to trigger the generation and appending of new Daily Mode riddles.
 * Can be called by the client when more daily riddles are needed.
 * @return A promise resolving to an object indicating success or failure.
 */
export const generateDailyRiddles = onCall(
  {
    enforceAppCheck: true,
    cors: true,
    region: "us-central1",
    timeoutSeconds: 540, // 9 minutes for riddle generation
    secrets: ["OPENAI_API_KEY"],
  } as CallableOptions,
  async (request: CallableRequest<unknown>): Promise<{success: boolean; message: string}> => {
    logger.info("generateDailyRiddles function called - entry point reached");

    try {
      await requireAdmin(request);
      logger.info("Starting daily riddle generation process with 10 riddles...");
      await generateAndAppendDailyRiddles(10);
      logger.info("Daily Mode riddles generated and stored in Firestore successfully.");
      return validateCallableResponse(GenerateRiddlesResponseSchema, {
        success: true,
        message: "New Daily Mode riddles generated and added to Firestore.",
      }, "generateDailyRiddles");
    } catch (error) {
      logger.error("Error generating Daily Mode riddles:", error);
      captureException(error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      if (error instanceof Error) {
        logger.error("Error message:", error.message);
      }
      throw new functions.https.HttpsError("internal", "Failed to generate new daily riddles.", error);
    }
  },
);

/**
 * Generates 1 riddle for today's daily challenge and stores it in the challenge structure.
 * @param forceGenerate - If true, generates new riddles even if today's challenge already exists.
 * @return A promise that resolves when the daily challenge is created.
 */
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
    const riddle = await generateUniqueRiddle();

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
    // Reset all users' daily challenge progress for the new day
    await resetAllUsersDailyChallengeProgress();

    logger.info(`Successfully generated and stored the current daily challenge for ${todayDateString}.`);
  } else {
    throw new Error("Failed to generate any daily challenge questions.");
  }
}

export async function generateLocalizedTodaysDailyChallenge(forceGenerate: boolean = false): Promise<void> {
  const todayDateString = new Date().toISOString().split("T")[0];

  for (const locale of SUPPORTED_LOCALES) {
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
        continue;
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
      const riddle = await generateUniqueRiddle(locale);
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
  }

  await resetAllUsersDailyChallengeProgress();
}

/**
 * Resets all users' daily challenge progress to 0 for the new day.
 * This is called when a new daily challenge is generated.
 */
async function resetAllUsersDailyChallengeProgress(): Promise<void> {
  logger.info("Resetting all users' daily challenge progress for new day...");

  try {
    // Get all user documents
    const usersSnapshot = await admin.firestore().collection("users").get();

    if (usersSnapshot.empty) {
      logger.info("No users found to reset progress.");
      return;
    }

    // Create batch to update all users
    const batch = admin.firestore().batch();
    let userCount = 0;

    usersSnapshot.forEach((userDoc) => {
      const userRef = userDoc.ref;
      batch.update(userRef, {
        "progress.dailyChallengeCurrentQuestion": 0,
      });
      userCount++;
    });

    // Commit the batch update
    await batch.commit();

    logger.info(`Reset daily challenge progress for ${userCount} users.`);
  } catch (error) {
    logger.error("Error resetting users' daily challenge progress:", error);
    captureException(error);
    throw new Error("Failed to reset users' daily challenge progress.");
  }
}

/**
 * Callable function to generate today's single-question daily challenge.
 * Can be called manually or by a scheduler.
 * @return A promise resolving to an object indicating success or failure.
 */
export const generateTodaysDailyChallengeFunction = onCall(
  {
    enforceAppCheck: true,
    cors: true,
    region: "us-central1",
    timeoutSeconds: 540, // 9 minutes for riddle generation
    secrets: ["OPENAI_API_KEY"],
  } as CallableOptions,
  async (
    request: CallableRequest<{forceGenerate?: boolean}>,
  ): Promise<{success: boolean; message: string; questionsGenerated: number}> => {
    logger.info("generateTodaysDailyChallengeFunction called - entry point reached");

    try {
      await requireAdmin(request);
      const {forceGenerate = false} = validateCallableRequest(
        GenerateTodaysDailyChallengeRequestSchema,
        request.data,
        "generateTodaysDailyChallengeFunction",
      );

      const today = new Date();
      const todayDateString = today.toISOString().split("T")[0];

      logger.info(`Starting daily challenge generation for ${todayDateString}...`);
      await generateTodaysDailyChallenge(forceGenerate);

      const challengeDoc = await admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).doc("current").get();
      const questionsGenerated = challengeDoc.exists ? 1 : 0;

      logger.info(`Daily challenge generated successfully with ${questionsGenerated} questions.`);
      return validateCallableResponse(GenerateTodaysDailyChallengeResponseSchema, {
        success: true,
        message: `Today's daily challenge generated successfully with ${questionsGenerated} questions.`,
        questionsGenerated,
      }, "generateTodaysDailyChallengeFunction");
    } catch (error) {
      logger.error("Error generating today's daily challenge:", error);
      captureException(error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (error instanceof Error) {
        logger.error("Error message:", error.message);
      }
      throw new functions.https.HttpsError("internal", `Failed to generate today's daily challenge: ${errorMessage}`);
    }
  },
);

export const seedLocalizedRiddles = onCall(
  {
    cors: true,
    region: "us-central1",
    timeoutSeconds: 540,
    secrets: ["OPENAI_API_KEY"],
  } as CallableOptions,
  async (request: CallableRequest<unknown>) => {
    logger.info("seedLocalizedRiddles function called - entry point reached");

    try {
      await requireAdmin(request);
      const {classicCount, forceGenerateDaily} = SeedLocalizedRiddlesRequestSchema.parse(request.data);

      await initializeLocalizedRiddleDatabaseIfEmpty(classicCount);
      await generateLocalizedTodaysDailyChallenge(forceGenerateDaily);

      return validateCallableResponse(
        SeedLocalizedRiddlesResponseSchema,
        {
          success: true,
          classicCount,
          dailyGenerated: forceGenerateDaily,
          localeCount: SUPPORTED_LOCALES.length,
          message: `Seeded localized riddles for ${SUPPORTED_LOCALES.length} locales with ${classicCount} classic riddles each and today's daily challenge.`,
        },
        "seedLocalizedRiddles",
      );
    } catch (error) {
      logger.error("Error seeding localized riddles:", error);
      captureException(error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "Failed to seed localized riddles.", error);
    }
  },
);
