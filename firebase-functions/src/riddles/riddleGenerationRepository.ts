import {logger} from "firebase-functions/v2";
import {admin} from "../shared/firebaseAdmin";
import type {DocumentReference} from "firebase-admin/firestore";
import {captureException} from "../shared/sentry";
import type {ClassicRiddle, DailyRiddle} from "../validation/firestoreSchemas";
import {RiddleCollections} from "../validation/firestoreSchemas";
import {clueContainsLiteralAnswer} from "./riddleQuality";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";

/** Provides riddle exists behavior. */
export function riddleExists(
  riddle: {question: string; answer: string},
  existingQuestions: string[],
  existingAnswers: string[],
): boolean {
  const normalizedQuestion = riddle.question.toLowerCase();
  const normalizedAnswer = riddle.answer.toLowerCase();

  return existingQuestions.includes(normalizedQuestion) || existingAnswers.includes(normalizedAnswer);
}

/** Provides riddle has playable clue behavior. */
export function riddleHasPlayableClue(riddle: {question: string; answer: string}): boolean {
  return !clueContainsLiteralAnswer(riddle.question, riddle.answer);
}

/** Defines the localized riddles collection value. */
const LOCALIZED_RIDDLES_COLLECTION = "localizedRiddles";
/** Defines the localized riddle subcollection value. */
const LOCALIZED_RIDDLE_SUBCOLLECTION = "riddles";

/** Gets localized riddle collection. */
const getLocalizedRiddleCollection = (locale: SupportedLocale): string =>
  `${LOCALIZED_RIDDLES_COLLECTION}/${locale}/${LOCALIZED_RIDDLE_SUBCOLLECTION}`;

/** Gets localized daily doc ref. */
export const getLocalizedDailyDocRef = (locale: SupportedLocale): DocumentReference =>
  admin.firestore().collection(getLocalizedRiddleCollection(locale)).doc("current");

/** Gets localized classic doc ref. */
export const getLocalizedClassicDocRef = (locale: SupportedLocale, riddleId: string): DocumentReference =>
  admin.firestore().collection(getLocalizedRiddleCollection(locale)).doc(riddleId);

/** Gets localized canonical key. */
export const getLocalizedCanonicalKey = (category: "classic" | "daily", index: number, locale: SupportedLocale): string =>
  `${category}:${index}:${locale}`;

/** Provides are localized classic riddles seeded behavior. */
export async function areLocalizedClassicRiddlesSeeded(): Promise<boolean> {
  for (const locale of SUPPORTED_LOCALES) {
    if (!(await areLocalizedClassicRiddlesSeededForLocale(locale))) {
      return false;
    }
  }

  return true;
}
/** Provides are localized classic riddles seeded for locale behavior. */
export async function areLocalizedClassicRiddlesSeededForLocale(locale: SupportedLocale): Promise<boolean> {
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
export async function getExistingRiddlesFromFirestore(): Promise<{questions: string[]; answers: string[]}> {
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

/** Gets localized existing riddles from firestore for locale. */
export async function getLocalizedExistingRiddlesFromFirestoreForLocale(
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

/**
 * Gets the next available classic index for new riddles.
 * @returns The next available classic index.
 */
export async function getNextClassicIndex(): Promise<number> {
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
export async function storeClassicRiddlesInFirestore(
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

/** Stores localized classic riddles in firestore. */
export async function storeLocalizedClassicRiddlesInFirestore(
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
export async function getNextDailyIndex(): Promise<number> {
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
export async function storeDailyRiddlesInFirestore(
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
