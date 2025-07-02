import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import functions from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { z, ZodError } from "zod";
import {
  SubmitGuessInputSchema,
  SubmitGuessOutputSchema,
} from "../validation/cloudFunctionsSchemas";

import { safeDelay } from "../utils/timing";

export const delay = (ms: number) => safeDelay(ms);

export const RiddleService = {
  /**
   * Fetches the current daily riddle for the authenticated user.
   * It checks the user's progress for the day and returns the next uncompleted riddle.
   * Also checks if the daily challenge for the current UTC day has already been completed.
   * @returns A Promise resolving to the daily riddle data, or null if no riddle is available, all daily riddles are completed, or the daily challenge for today is already completed.
   */
  async fetchDailyRiddle() {
    console.log("Fetching daily riddle from Firestore");
    const userId = auth(getApp()).currentUser?.uid;
    if (!userId) {
      console.error("No authenticated user found.");
      return null;
    }

    const today = new Date().toISOString().slice(0, 10);

    try {
      const userDoc = await firestore(getApp())
        .collection("users")
        .doc(userId)
        .get();

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData) {
          const lastCompletedDateStr =
            userData.lastCompletedDailyChallengeDate as string | undefined;
          if (lastCompletedDateStr) {
            const lastCompletedDate = new Date(lastCompletedDateStr);
            const lastCompletedDateUTC = lastCompletedDate
              .toISOString()
              .slice(0, 10);

            if (lastCompletedDateUTC === today) {
              console.log(
                `User ${userId} has already completed the daily challenge for today (${today}).`
              );
              return { completedToday: true };
            }
          }
        }
      }

      const dailyChallengeDoc = await firestore(getApp())
        .collection("dailyChallenge")
        .doc(today)
        .get();

      if (!dailyChallengeDoc.exists()) {
        console.log(`No daily challenge found for date: ${today}`);
        return null;
      }

      const dailyChallengeData = dailyChallengeDoc.data();
      const riddleIds = dailyChallengeData?.riddleIds as string[] | undefined;

      if (!riddleIds || riddleIds.length === 0) {
        console.log(
          `Daily challenge found for ${today}, but no riddleIds array.`
        );
        return null;
      }

      const userAttemptsDoc = await firestore(getApp())
        .collection("userDailyChallengeAttempts")
        .doc(`${userId}_${today}`)
        .get();

      const userAttemptsData = userAttemptsDoc.data();
      const completedIndex = (userAttemptsData?.completedIndex as number) ?? 0;

      if (completedIndex < riddleIds.length) {
        const nextRiddleId = riddleIds[completedIndex];

        const riddleDoc = await firestore(getApp())
          .collection("riddles")
          .doc(nextRiddleId)
          .get();

        if (riddleDoc.exists()) {
          const riddleData = riddleDoc.data();
          if (riddleData && riddleData.answer !== undefined) {
            console.log(
              `Fetched daily riddle ID: ${nextRiddleId} at index ${completedIndex}`
            );
            return {
              ...riddleData,
              riddleId: riddleDoc.id,
              completedToday: false,
              answerLength: riddleData.answer.length,
            };
          } else {
            console.error(
              `Riddle data or answer missing for ID: ${nextRiddleId}. Data:`,
              riddleData
            );
            return null;
          }
        } else {
          console.log(`Riddle document not found for ID: ${nextRiddleId}`);
          return null;
        }
      } else {
        console.log(`User has completed all daily riddles for date: ${today}`);
        const userRef = firestore(getApp()).collection("users").doc(userId);
        await userRef.update({
          lastCompletedDailyChallengeDate: new Date().toISOString(),
        });
        return { completedToday: true };
      }
    } catch (error) {
      console.error("Error fetching daily riddle:", error);
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
    console.log(`Fetching classic riddle for level ${level} from Firestore`);

    try {
      const snapshot = await firestore(getApp())
        .collection("riddles")
        .where("classicIndex", "==", level)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        console.log(`Classic riddle found for level: ${level}`);
        const riddleData = snapshot.docs[0].data();
        if (riddleData && riddleData.answer !== undefined) {
          return {
            ...riddleData,
            riddleId: snapshot.docs[0].id,
            answerLength: riddleData.answer.length,
          };
        } else {
          console.error(
            `Riddle data or answer missing for level: ${level}. Data:`,
            riddleData
          );
          return null;
        }
      } else {
        console.log(
          `No classic riddle found for level: ${level}. Riddles will be generated automatically on the server when needed.`
        );
        return null;
      }
    } catch (error) {
      console.error(`Error fetching classic riddle for level ${level}:`, error);
      throw error;
    }
  },

  /**
   * Fetches a specific tutorial mode riddle by its level.
   * @param {number} level - The level of the tutorial riddle to fetch.
   * @returns A Promise resolving to the tutorial riddle data, or null if not found.
   */
  async fetchTutorialRiddle(level: number) {
    console.log(`Fetching tutorial riddle for level ${level} from Firestore`);
    try {
      const snapshot = await firestore(getApp())
        .collection("riddles")
        .where("category", "==", "tutorial")
        .where("tutorialIndex", "==", level)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const riddleData = snapshot.docs[0].data();
        if (riddleData && riddleData.answer !== undefined) {
          return {
            ...riddleData,
            riddleId: snapshot.docs[0].id,
            answerLength: riddleData.answer.length,
          };
        } else {
          console.error(
            `Riddle data or answer missing for level: ${level}. Data:`,
            riddleData
          );
          return null;
        }
      } else {
        console.log(`No tutorial riddle found for level: ${level}`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching tutorial riddle:", error);
      throw error;
    }
  },

  /**
   * Submits a user's guess for a riddle to the backend for validation.
   * @param {z.infer<typeof SubmitGuessInputSchema>} guessData - The guess data to submit.
   * @returns A Promise resolving to the validation result from the backend.
   */
  async submitGuess(guessData: z.infer<typeof SubmitGuessInputSchema>) {
    console.log("Submitting guess for validation:", guessData);
    try {
      SubmitGuessInputSchema.parse(guessData);

      const submitGuessCallable = functions(getApp()).httpsCallable(
        "submitGuess"
      );
      const result = await submitGuessCallable(guessData);

      const validatedResult = SubmitGuessOutputSchema.parse(result.data);
      console.log(
        "Guess validation result received and validated:",
        validatedResult
      );
      return validatedResult;
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(
          "Zod validation error for guess submission:",
          error.issues
        );
        throw new Error("Invalid guess data provided.");
      } else {
        console.error("Error submitting guess to Cloud Function:", error);
        throw new Error("Failed to submit guess.");
      }
    }
  },
};
