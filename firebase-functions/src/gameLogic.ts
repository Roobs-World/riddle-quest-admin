import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {updateUserCoins, getUser} from "./firestoreService";

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
    request: CallableRequest<{currentAttempt: string[]; riddleId: string}>,
  ): Promise<{revealedLetter: string; index: number; coinsCost: number} | null> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to get a hint.");
      }

      const currentUserId = request.auth.uid;
      const {currentAttempt, riddleId} = request.data;

      const riddleDoc = await admin.firestore().collection("riddles").doc(riddleId).get();

      if (!riddleDoc.exists) {
        throw new HttpsError("not-found", `Riddle with ID ${riddleId} not found.`);
      }
      const riddleData = riddleDoc.data();

      if (!riddleData || !riddleData.answer) {
        throw new HttpsError("internal", `Answer not found for riddle ID ${riddleId}.`);
      }

      const answer: string = riddleData.answer.toLowerCase();
      const coinsCost = 50;

      const user = await getUser(currentUserId);

      if (!user) {
        throw new HttpsError("not-found", "User data not found.");
      }

      if (user.coins < coinsCost) {
        throw new HttpsError("failed-precondition", "Insufficient coins to get a hint.");
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
        throw new HttpsError("failed-precondition", "Game is already completed.");
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
      // Only log unexpected errors, not expected business logic errors
      if (error instanceof HttpsError) {
        // These are expected errors (authentication, validation, business logic)
        // Don't log them as errors since they're part of normal operation
        throw error;
      }
      // Log unexpected errors (system errors, database errors, etc.)
      logger.error("Unexpected error getting hint:", error);
      throw new HttpsError("internal", "An error occurred while getting a hint.", error);
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
  async (request: CallableRequest<{amount: number; reason: string}>): Promise<{newCoins: number}> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    const {amount, reason} = request.data;
    const userId = request.auth.uid;

    if (typeof amount !== "number" || amount <= 0) {
      throw new HttpsError("invalid-argument", "Invalid amount specified.");
    }

    if (reason !== "hint") {
      throw new HttpsError("invalid-argument", "Invalid reason specified.");
    }

    try {
      // Check if user exists first
      const user = await getUser(userId);
      if (!user) {
        throw new HttpsError("not-found", "User data not found.");
      }

      if (user.coins < amount) {
        throw new HttpsError("failed-precondition", "Insufficient coins to spend.");
      }

      await updateUserCoins(userId, -amount);

      const updatedUser = await getUser(userId);

      if (!updatedUser) {
        throw new HttpsError("internal", "Could not retrieve updated user data after spending coins.");
      }

      logger.info(`User ${userId} spent ${amount} coins for reason: ${reason}. New balance: ${updatedUser.coins}.`);
      return {newCoins: updatedUser.coins};
    } catch (error: unknown) {
      // Only log unexpected errors, not expected business logic errors
      if (error instanceof HttpsError) {
        // These are expected errors (authentication, validation, business logic)
        // Don't log them as errors since they're part of normal operation
        throw error;
      }
      // Log unexpected errors (system errors, database errors, etc.)
      logger.error("Unexpected error spending coins:", error);
      throw new HttpsError("internal", "An error occurred while spending coins.", error);
    }
  },
);
