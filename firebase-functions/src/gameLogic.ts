import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {onCall, HttpsError as HttpsErrorV2, CallableRequest as CallableRequestV2} from "firebase-functions/v2/https";
import {updateUserCoins, getUser} from "./firestoreService";
import type {FirestoreRiddle} from "./validation/firestoreSchemas";

/**
 * Provides a hint (reveals a letter) for the current riddle based on the user's
 * current attempt.
 * @param data - The request data object containing currentAttempt, and
 * riddleId.
 * @param data.currentAttempt - An array of strings representing the user's
 * current guess attempt.
 * @param data.riddleId - The ID of the riddle being attempted.
 * @param context - The context object representing the request context.
 * @return An object containing the revealed letter, its index, and the coin cost,
 * or null if no hint is available/applicable.
 */
export const getHint = onCall(
  {},
  async (
    request: CallableRequestV2<{currentAttempt: string[]; riddleId: string}>,
  ): Promise<{revealedLetter: string; index: number; coinsCost: number} | null> => {
    try {
      if (!request.auth) {
        throw new HttpsErrorV2("unauthenticated", "The user must be authenticated to get a hint.");
      }

      const currentUserId = request.auth.uid;
      const {currentAttempt, riddleId} = request.data;

      const riddleDoc = await admin.firestore().collection("riddles").doc(riddleId).get();

      if (!riddleDoc.exists) {
        throw new HttpsErrorV2("not-found", `Riddle with ID ${riddleId} not found.`);
      }
      const riddleData = riddleDoc.data();

      if (!riddleData || !riddleData.answer) {
        throw new HttpsErrorV2("internal", `Answer not found for riddle ID ${riddleId}.`);
      }

      const answer: string = riddleData.answer.toLowerCase();
      const coinsCost = 50;

      const user = await getUser(currentUserId);

      if (!user) {
        throw new HttpsErrorV2("not-found", "User data not found.");
      }

      if (user.coins < coinsCost) {
        throw new HttpsErrorV2("failed-precondition", "Insufficient coins to get a hint.");
      }

      const gameStateRef = admin
        .firestore()
        .collection("users")
        .doc(currentUserId)
        .collection("riddleStates")
        .doc(riddleId);
      const gameStateDoc = await gameStateRef.get();
      const gameState = gameStateDoc.data();
      const hintRevealedIndices: number[] = gameState?.hintRevealedIndices || [];
      const isGameCompleted = gameState?.isCompleted === true;

      if (isGameCompleted) {
        logger.warn(`User ${currentUserId} requested hint for completed riddle ${riddleId}.`);
        throw new HttpsErrorV2("failed-precondition", "Game is already completed.");
      }

      const guessedLetters: string[] = currentAttempt.map((letter: string) => letter.toLowerCase());

      let revealedLetter: string | null = null;
      let index: number | null = null;

      for (let i = 0; i < answer.length; i++) {
        const answerLetter: string = answer[i];
        const guessedLetter: string = guessedLetters[i];

        if (guessedLetter !== answerLetter && !hintRevealedIndices.includes(i)) {
          revealedLetter = answerLetter;
          index = i;
          break;
        }
      }

      if (revealedLetter === null || index === null) {
        logger.warn(
          `No hint available for user ${currentUserId}, riddle ${riddleId}. All letters revealed or guessed correctly.`,
        );
        return null;
      }

      await updateUserCoins(currentUserId, -coinsCost);

      await gameStateRef.set(
        {
          hintRevealedIndices: [...hintRevealedIndices, index],
        },
        {merge: true},
      );

      logger.info(
        `User ${currentUserId} used a hint for riddle ${riddleId}, revealing letter ${revealedLetter.toUpperCase()} at index ${index}.`,
      );

      return {
        revealedLetter: revealedLetter.toUpperCase(),
        index,
        coinsCost,
      };
    } catch (error) {
      logger.error("Error getting hint:", error);
      if (error instanceof HttpsErrorV2) {
        throw error;
      }
      throw new HttpsErrorV2("internal", "An error occurred while getting a hint.", error);
    }
  },
);

/**
 * Callable function to handle spending user coins.
 * @param data - The request data.
 * @param data.amount - The amount of coins to spend.
 * @param reason - The reason for spending coins.
 * @param context - The CallableContext object.
 * @return {Promise<{ newCoins: number }>} A Promise resolving to the new coin
 * balance.
 */
export const spendCoins = onCall(
  {},
  async (request: CallableRequestV2<{amount: number; reason: string}>): Promise<{newCoins: number}> => {
    if (!request.auth) {
      throw new HttpsErrorV2("unauthenticated", "The function must be called while authenticated.");
    }

    const {amount, reason} = request.data;
    const userId = request.auth.uid;

    if (typeof amount !== "number" || amount <= 0) {
      throw new HttpsErrorV2("invalid-argument", "Invalid amount specified.");
    }

    if (reason !== "hint" && reason !== "skip" && reason !== "skip riddle") {
      throw new HttpsErrorV2("invalid-argument", "Invalid reason specified.");
    }

    try {
      // Check if user exists first
      const user = await getUser(userId);
      if (!user) {
        throw new HttpsErrorV2("not-found", "User data not found.");
      }

      if (user.coins < amount) {
        throw new HttpsErrorV2("failed-precondition", "Insufficient coins to spend.");
      }

      await updateUserCoins(userId, -amount);

      const updatedUser = await getUser(userId);

      if (!updatedUser) {
        throw new HttpsErrorV2("internal", "Could not retrieve updated user data after spending coins.");
      }

      logger.info(`User ${userId} spent ${amount} coins for reason: ${reason}. New balance: ${updatedUser.coins}.`);
      return {newCoins: updatedUser.coins};
    } catch (error: unknown) {
      logger.error("Error spending coins:", error);
      if (error instanceof HttpsErrorV2) {
        throw error;
      }
      throw new HttpsErrorV2("internal", "An error occurred while spending coins.", error);
    }
  },
);

/**
 * Skips the current riddle and provides a new one.
 * @param data - The request data object containing gameMode and riddleId.
 * @param data.gameMode - The game mode.
 * @param data.riddleId - The ID of the current riddle.
 * @param context - The context object representing the request context.
 * @return An object containing the new riddle's index, question, answer length,
 * and the coin cost.
 */
export const skipRiddle = onCall(
  {},
  async (
    request: CallableRequestV2<{gameMode: string; riddleId: string}>,
  ): Promise<
    | {newRiddleIndex: number; newQuestion: string; newAnswerLength: number; coinsCost: number; newRiddleId: string}
    | HttpsErrorV2
  > => {
    try {
      if (!request.auth) {
        throw new HttpsErrorV2("unauthenticated", "The user must be authenticated to skip a riddle.");
      }

      const currentUserId = request.auth.uid;
      const {gameMode, riddleId} = request.data;

      const user = await getUser(currentUserId);

      if (!user) {
        throw new HttpsErrorV2("not-found", "User data not found.");
      }

      const coinsCost = 50;

      if (user.coins < coinsCost) {
        throw new HttpsErrorV2("failed-precondition", "Insufficient coins to skip the riddle.");
      }

      await updateUserCoins(currentUserId, -coinsCost);

      let newRiddleData: FirestoreRiddle | null = null;
      let newRiddleIndex = -1;

      if (gameMode === "Classic") {
        const currentRiddleDoc = await admin.firestore().collection("riddles").doc(riddleId).get();

        if (!currentRiddleDoc.exists) {
          throw new HttpsErrorV2("not-found", "Current riddle not found.");
        }

        const currentRiddle = currentRiddleDoc.data() as FirestoreRiddle;

        if (currentRiddle.classicIndex === undefined) {
          throw new HttpsErrorV2("failed-precondition", "Current riddle does not have a classic index.");
        }

        newRiddleIndex = currentRiddle.classicIndex + 1;

        const nextRiddleQuerySnapshot = await admin
          .firestore()
          .collection("riddles")
          .where("classicIndex", "==", newRiddleIndex)
          .limit(1)
          .get();

        if (!nextRiddleQuerySnapshot.empty) {
          newRiddleData = nextRiddleQuerySnapshot.docs[0].data() as FirestoreRiddle;
          // Get the document ID as the riddleId
          const newRiddleDocumentId = nextRiddleQuerySnapshot.docs[0].id;
          // Add the riddleId to the riddle data for consistency
          newRiddleData.riddleId = newRiddleDocumentId;
        } else {
          logger.info(
            `End of available classic riddles for user ${currentUserId} at index ${currentRiddle.classicIndex}. Triggering generation.`,
          );
          try {
            await admin.firestore().collection("functionCalls").add({
              functionName: "generateClassicRiddles",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              status: "requested",
            });
          } catch (genError) {
            logger.error("Failed to trigger generateClassicRiddles:", genError);
          }

          throw new HttpsErrorV2(
            "not-found",
            "No more classic riddles available. More are being generated. Please try again soon.",
          );
        }
      } else {
        throw new HttpsErrorV2("failed-precondition", "Skipping is only allowed in Classic mode.");
      }

      await admin.firestore().collection("users").doc(currentUserId).update({
        "progress.classicIndex": newRiddleIndex,
      });

      if (!newRiddleData) {
        throw new HttpsErrorV2("internal", "Failed to load next riddle data after fetching.");
      }

      return {
        newRiddleIndex: newRiddleIndex,
        newQuestion: newRiddleData.text,
        newAnswerLength: newRiddleData.answer.length,
        coinsCost,
        newRiddleId: newRiddleData.riddleId,
      };
    } catch (error) {
      logger.error("Error skipping riddle:", error);
      if (error instanceof HttpsErrorV2) {
        throw error;
      }
      throw new HttpsErrorV2("internal", "An error occurred while skipping the riddle.", error);
    }
  },
);
