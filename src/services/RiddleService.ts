import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  limit,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { z, ZodError } from "zod";
import {
  SubmitGuessInputSchema,
  SubmitGuessOutputSchema,
} from "../validation/cloudFunctionsSchemas";

import { safeDelay } from "../utils/timing";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

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
      const userDoc = await getDoc(doc(getFirestore(), "users", userId));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData) {
          const lastCompletedDateStr =
            userData.lastDailyChallengeCompletedAt as string | undefined;
          if (lastCompletedDateStr) {
            const lastCompletedDate = new Date(lastCompletedDateStr);
            const lastCompletedDateUTC = lastCompletedDate
              .toISOString()
              .slice(0, 10);

            if (lastCompletedDateUTC === today) {
              logger.debug(
                `User ${userId} has already completed the daily challenge for today (${today}).`
              );
              return { completedToday: true };
            }
          }
        }
      }

      const dailyChallengeDoc = await getDoc(doc(getFirestore(), "dailyChallenge", today));

      if (!dailyChallengeDoc.exists()) {
        logger.debug(`No daily challenge found for date: ${today}`);
        return null;
      }

      const dailyChallengeData = dailyChallengeDoc.data();
      const riddleIds = dailyChallengeData?.riddleIds as string[] | undefined;

      if (!riddleIds || riddleIds.length === 0) {
        logger.debug(
          `Daily challenge found for ${today}, but no riddleIds array.`
        );
        return null;
      }

      const userAttemptsDoc = await getDoc(doc(getFirestore(), "userDailyChallengeAttempts", `${userId}_${today}`));

      const userAttemptsData = userAttemptsDoc.data();
      const completedIndex = (userAttemptsData?.completedIndex as number) ?? 0;

      if (completedIndex < riddleIds.length) {
        const nextRiddleId = riddleIds[completedIndex];

        const riddleDoc = await getDoc(doc(getFirestore(), "dailyRiddles", nextRiddleId));

        if (riddleDoc.exists()) {
          const riddleData = riddleDoc.data();
          if (riddleData && riddleData.answer !== undefined) {
            logger.debug(
              `Fetched daily riddle ID: ${nextRiddleId} at index ${completedIndex}`
            );
            return {
              ...riddleData,
              riddleId: riddleDoc.id,
              completedToday: false,
              answerLength: riddleData.answer.length,
            };
          } else {
            logger.error(
              `Daily riddle data or answer missing for ID: ${nextRiddleId}. Data:`,
              riddleData
            );
            return null;
          }
        } else {
          logger.debug(
            `Daily riddle document not found for ID: ${nextRiddleId}`
          );
          return null;
        }
      } else {
        logger.debug(`User has completed all daily riddles for date: ${today}`);
        await updateDoc(doc(getFirestore(), "users", userId), {
          lastDailyChallengeCompletedAt: new Date().toISOString(),
        });
        return { completedToday: true };
      }
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
    logger.debug(`Fetching classic riddle for level ${level} from Firestore`);

    try {
      const snapshot = await getDocs(
        query(collection(getFirestore(), "riddles"), where("classicIndex", "==", level), limit(1))
      );

      if (!snapshot.empty) {
        logger.debug(`Classic riddle found for level: ${level}`);
        const riddleData = snapshot.docs[0].data();
        if (riddleData && riddleData.answer !== undefined) {
          return {
            ...riddleData,
            riddleId: snapshot.docs[0].id,
            answerLength: riddleData.answer.length,
          };
        } else {
          logger.error(
            `Riddle data or answer missing for level: ${level}. Data:`,
            riddleData
          );
          return null;
        }
      } else {
        logger.debug(
          `No classic riddle found for level: ${level}. Riddles will be generated automatically on the server when needed.`
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
      SubmitGuessInputSchema.parse(guessData);

      const submitGuessCallable = httpsCallable(getFunctions(getApp()), "submitGuess");
      const result = await submitGuessCallable(guessData);

      const validatedResult = SubmitGuessOutputSchema.parse(result.data);
      logger.debug(
        "Guess validation result received and validated:",
        validatedResult
      );
      return validatedResult;
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error(
          "Zod validation error for guess submission:",
          error.issues
        );
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
