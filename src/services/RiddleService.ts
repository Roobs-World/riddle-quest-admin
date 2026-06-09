import {getFirestore, collection, doc, getDoc, getDocs, query, where, limit} from "@react-native-firebase/firestore";
import {getAuth} from "@react-native-firebase/auth";
import {getApp} from "@react-native-firebase/app";
import {z, ZodError} from "zod";
import {SubmitGuessInputSchema, SubmitGuessOutputSchema} from "../validation/cloudFunctionsSchemas";
import {FirestoreRiddleSchema, PlayerSchema} from "../validation/firestoreSchemas";
import {FirebaseCallableValidationError, callValidatedFunction} from "../utils/firebaseFunctions";
import {graphemeLength} from "@qwordly/core/game";
import {getLocale} from "../i18n";

import {safeDelay} from "../utils/timing";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import {
  playerFirestoreConverter,
  riddleFirestoreConverter,
  withConverterIfAvailable,
} from "./firestoreConverters";
import {CURRENT_DAILY_RIDDLE_DOC_ID, getLocalizedRiddleCollection} from "./riddleCollections";

const DailyCompletionUserSchema = PlayerSchema.pick({lastDailyChallengeCompletedAt: true}).partial().passthrough();

const readDailyCompletionData = (data: unknown) => {
  const result = DailyCompletionUserSchema.safeParse(data);
  if (!result.success) {
    logger.warn("Ignoring malformed daily completion user data:", result.error.issues);
    return null;
  }
  return result.data;
};

const readRiddleData = (data: unknown, fallbackRiddleId: string) => {
  const rawData = typeof data === "object" && data !== null ? (data as {riddleId?: unknown}) : {};
  const riddleId = typeof rawData.riddleId === "string" && rawData.riddleId.length > 0 ? rawData.riddleId : fallbackRiddleId;
  const result = FirestoreRiddleSchema.safeParse({
    ...rawData,
    riddleId,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
};

const snapshotExists = (snapshot: unknown): boolean => {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  const typedSnapshot = snapshot as {exists?: boolean | (() => boolean)};
  if (typeof typedSnapshot.exists === "function") {
    return typedSnapshot.exists();
  }

  return Boolean(typedSnapshot.exists);
};

/**
 * Shared helper for testable async timing in riddle service flows.
 *
 * @param ms Delay duration in milliseconds.
 * @returns Promise resolved after `ms`.
 */
export const delay = (ms: number) => safeDelay(ms);

/**
 * Firestore and Cloud Function gateway for riddle retrieval and guess validation.
 */
export const RiddleService = {
  /**
   * Fetches the current daily riddle for the authenticated user.
   * It checks the user's progress for the day and returns the next uncompleted riddle.
   * Also checks if the daily challenge for the current UTC day has already been completed.
   * @returns Daily riddle payload, `{ completedToday: true }`, or `null` when unavailable.
   */
  async fetchDailyRiddle() {
    logger.debug("Fetching daily riddle from Firestore");
    const userId = getAuth(getApp()).currentUser?.uid;
    if (!userId) {
      logger.error("No authenticated user found.");
      return null;
    }

    const today = new Date().toISOString().slice(0, 10);

    try {
      const userDoc = await getDoc(
        withConverterIfAvailable(doc(getFirestore(), "users", userId), playerFirestoreConverter),
      );

      if (userDoc.exists()) {
        let userData: ReturnType<typeof readDailyCompletionData> = null;
        try {
          userData = readDailyCompletionData(userDoc.data());
        } catch (error) {
          if (error instanceof ZodError) {
            logger.warn("Ignoring malformed daily completion user data:", error.issues);
          } else {
            throw error;
          }
        }
        if (userData) {
          const lastCompletedAt = userData.lastDailyChallengeCompletedAt;
          if (lastCompletedAt) {
            const lastCompletedDate = new Date(lastCompletedAt);
            const lastCompletedDateUTC = lastCompletedDate.toISOString().slice(0, 10);

            if (lastCompletedDateUTC === today) {
              logger.debug(`User ${userId} has already completed the daily challenge for today (${today}).`);
              return {completedToday: true};
            }
          }
        }
      }

      const locale = getLocale();
      const localizedDailyDoc = await getDoc(
        withConverterIfAvailable(
          doc(getFirestore(), getLocalizedRiddleCollection(locale), CURRENT_DAILY_RIDDLE_DOC_ID),
          riddleFirestoreConverter,
        ),
      );
      const activeDailyDoc = localizedDailyDoc;

      const hasCurrentDocApi =
        !!activeDailyDoc &&
        ((typeof (activeDailyDoc as {exists?: unknown}).exists === "function" &&
          typeof (activeDailyDoc as {data?: unknown}).data === "function") ||
          (typeof (activeDailyDoc as {exists?: unknown}).exists === "boolean" &&
            typeof (activeDailyDoc as {data?: unknown}).data === "function"));

      if (!hasCurrentDocApi || !snapshotExists(activeDailyDoc)) {
        logger.debug(`No current daily challenge found for locale ${locale} on date: ${today}`);
        return null;
      }
      let currentDailyData: ReturnType<typeof readRiddleData> = null;
      let currentDailyRawData: unknown;
      try {
        currentDailyRawData = activeDailyDoc.data();
        currentDailyData = readRiddleData(
          currentDailyRawData,
          typeof activeDailyDoc.id === "string" ? activeDailyDoc.id : CURRENT_DAILY_RIDDLE_DOC_ID,
        );
      } catch (error) {
        if (error instanceof ZodError) {
          logger.error("Current daily riddle data failed validation:", error.issues);
          return null;
        }
        throw error;
      }
      if (!currentDailyData) {
        logger.error("Current daily riddle data or answer missing:", currentDailyRawData);
        return null;
      }

      logger.debug(`Fetched current daily riddle from ${getLocalizedRiddleCollection(locale)}/${activeDailyDoc.id}`);
      return {
        ...currentDailyData,
        riddleId: currentDailyData.riddleId ?? activeDailyDoc.id,
        completedToday: false,
        answerLength: graphemeLength(currentDailyData.answer, locale),
        locale: currentDailyData.locale ?? locale,
      };
    } catch (error) {
      logger.error("Error fetching daily riddle:", error);
      captureException(error);
      throw error;
    }
  },

  /**
   * Fetches a specific classic mode riddle by its level.
   * Riddles are now generated automatically server-side when needed.
   * @param {number} level - The level of the classic riddle to fetch.
   * @returns A Promise resolving to the classic riddle data, or null if not found.
   */
  async fetchClassicRiddle(level: number) {
    const locale = getLocale();
    logger.debug(`Fetching classic riddle for level ${level} from Firestore locale ${locale}`);

    try {
      const localizedSnapshot = await getDocs(
        query(
          withConverterIfAvailable(collection(getFirestore(), getLocalizedRiddleCollection(locale)), riddleFirestoreConverter),
          where("classicIndex", "==", level),
          limit(1),
        ),
      );
      const snapshot = localizedSnapshot;

      if (!snapshot.empty) {
        logger.debug(`Classic riddle found for level: ${level} in locale ${locale}`);
        let riddleData: ReturnType<typeof readRiddleData> = null;
        let rawRiddleData: unknown;
        try {
          rawRiddleData = snapshot.docs[0].data();
          riddleData = readRiddleData(
            rawRiddleData,
            typeof snapshot.docs[0].id === "string" ? snapshot.docs[0].id : "",
          );
        } catch (error) {
          if (error instanceof ZodError) {
            logger.error(`Classic riddle data failed validation for level: ${level}.`, error.issues);
            return null;
          }
          throw error;
        }
        if (riddleData) {
          return {
            ...riddleData,
            riddleId: snapshot.docs[0].id,
            answerLength: graphemeLength(riddleData.answer, riddleData.locale ?? locale),
            locale: riddleData.locale ?? locale,
          };
        } else {
          logger.error(`Riddle data or answer missing for level: ${level}. Data:`, rawRiddleData);
          return null;
        }
      } else {
        logger.debug(
          `No classic riddle found for level: ${level}. Riddles will be generated automatically on the server when needed.`,
        );
        return null;
      }
    } catch (error) {
      logger.error(`Error fetching classic riddle for level ${level}:`, error);
      captureException(error);
      throw error;
    }
  },

  /**
   * Submits a user's guess for a riddle to the backend for validation.
   * @param {z.infer<typeof SubmitGuessInputSchema>} guessData - The guess data to submit.
   * @returns A Promise resolving to the validation result from the backend.
   */
  async submitGuess(guessData: z.infer<typeof SubmitGuessInputSchema>) {
    logger.debug("Submitting guess for validation:", guessData);
    try {
      const validatedResult = await callValidatedFunction(
        "submitGuess",
        guessData,
        SubmitGuessInputSchema,
        SubmitGuessOutputSchema,
      );
      logger.debug("Guess validation result received and validated:", validatedResult);
      return validatedResult;
    } catch (error) {
      if (error instanceof ZodError || error instanceof FirebaseCallableValidationError) {
        const issues = error instanceof FirebaseCallableValidationError ? error.issues : error.issues;
        logger.error("Zod validation error for guess submission:", issues);
        captureException(error);
        throw new Error("Invalid guess data provided.");
      } else {
        logger.error("Error submitting guess to Cloud Function:", error);
        captureException(error);
        throw new Error("Failed to submit guess.");
      }
    }
  },
};
