import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {updateUserCoins, getUser, getRiddleByGameMode} from "./firestoreService";
import {SKIP_COST_CLASSIC, SKIP_COST_DAILY, SKIP_COST_TUTORIAL} from "./constants";
import {captureException} from "./sentry";

/**
 * Skips the current riddle by marking it as completed and advancing to the next level/question.
 * @param data - The request data object containing riddleId and gameMode.
 * @param data.riddleId - The ID of the riddle being skipped.
 * @param data.gameMode - The game mode ('classic', 'challenge', or 'tutorial').
 * @param context - The context object representing the request context.
 * @return An object containing success status and new progress information.
 */
export const skipRiddle = onCall(
  {},
  async (
    request: CallableRequest<{riddleId: string; gameMode: "classic" | "challenge" | "tutorial"}>,
  ): Promise<{success: boolean; newProgress?: any; message: string; costDeducted: number}> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to skip a riddle.");
      }

      const currentUserId = request.auth.uid;
      const {riddleId, gameMode} = request.data;

      // Validate game mode
      if (!["classic", "challenge", "tutorial"].includes(gameMode)) {
        throw new HttpsError("invalid-argument", "Invalid game mode specified.");
      }

      // Check if user has enough coins (different costs for different modes)
      const user = await getUser(currentUserId);
      if (!user) {
        throw new HttpsError("not-found", "User data not found.");
      }

      // Different skip costs for different modes (must match client src/constants/game.ts)
      let skipCost: number;
      switch (gameMode) {
        case "tutorial":
          skipCost = SKIP_COST_TUTORIAL;
          break;
        case "classic":
          skipCost = SKIP_COST_CLASSIC;
          break;
        case "challenge":
          skipCost = SKIP_COST_DAILY;
          break;
        default:
          skipCost = SKIP_COST_CLASSIC;
      }

      if (user.coins < skipCost) {
        throw new HttpsError(
          "failed-precondition",
          `Insufficient coins to skip a ${gameMode} riddle. Required: ${skipCost}, Available: ${user.coins}`,
        );
      }

      // Check if riddle exists in the appropriate collection
      const riddleData = await getRiddleByGameMode(riddleId, gameMode);
      if (!riddleData) {
        throw new HttpsError("not-found", `${gameMode} riddle with ID ${riddleId} not found.`);
      }

      // Check if riddle is already completed
      const gameStateRef = admin
        .firestore()
        .collection("users")
        .doc(currentUserId)
        .collection("riddleStates")
        .doc(riddleId);
      const gameStateDoc = await gameStateRef.get();
      const gameState = gameStateDoc.data();

      if (gameState?.isCompleted === true) {
        throw new HttpsError("failed-precondition", "Riddle is already completed.");
      }

      // Deduct coins
      await updateUserCoins(currentUserId, -skipCost);

      // Mark riddle as completed (skipped)
      await gameStateRef.set(
        {
          isCompleted: true,
          isSkipped: true,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
      );

      // Update user progress based on game mode
      const userRef = admin.firestore().collection("users").doc(currentUserId);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      let newProgress = null;
      let progressMessage = "";

      if (gameMode === "classic") {
        const currentClassicIndex = userData?.progress?.classicIndex || 0;
        const newClassicIndex = currentClassicIndex + 1;

        newProgress = {
          ...userData?.progress,
          classicIndex: newClassicIndex,
        };

        await userRef.update({
          "progress.classicIndex": newClassicIndex,
        });

        // Update stats
        await userRef.update({
          "stats.classicSkipped": admin.firestore.FieldValue.increment(1),
        });

        progressMessage = `Advanced to classic level ${newClassicIndex + 1}`;
      } else if (gameMode === "tutorial") {
        const currentTutorialIndex = userData?.progress?.tutorialIndex || 0;
        const newTutorialIndex = currentTutorialIndex + 1;

        newProgress = {
          ...userData?.progress,
          tutorialIndex: newTutorialIndex,
        };

        await userRef.update({
          "progress.tutorialIndex": newTutorialIndex,
        });

        // Update stats
        await userRef.update({
          "stats.tutorialSkipped": admin.firestore.FieldValue.increment(1),
        });

        progressMessage = `Advanced to tutorial level ${newTutorialIndex + 1}`;
      } else if (gameMode === "challenge") {
        const currentQuestionIndex = userData?.progress?.dailyChallengeCurrentQuestion || 0;

        if (currentQuestionIndex >= 5) {
          throw new HttpsError("failed-precondition", "Daily challenge already completed (all 5 questions finished).");
        }

        const newQuestionIndex = currentQuestionIndex + 1;
        const isFullyCompleted = newQuestionIndex >= 5;

        newProgress = {
          ...userData?.progress,
          dailyChallengeCurrentQuestion: newQuestionIndex,
        };

        const updates: any = {
          "progress.dailyChallengeCurrentQuestion": newQuestionIndex,
        };

        // If all 5 questions are completed, mark daily challenge as fully completed
        if (isFullyCompleted) {
          updates.lastDailyChallengeCompletedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        await userRef.update(updates);

        // Update stats
        await userRef.update({
          "stats.challengeSkipped": admin.firestore.FieldValue.increment(1),
        });

        progressMessage = isFullyCompleted
          ? "Daily challenge completed! All 5 questions finished."
          : `Advanced to daily challenge question ${newQuestionIndex + 1}/5`;
      }

      logger.info(
        `User ${currentUserId} skipped riddle ${riddleId} in ${gameMode} mode for ${skipCost} coins. ${progressMessage}`,
      );

      return {
        success: true,
        newProgress,
        message: `Riddle skipped successfully. ${skipCost} coins deducted. ${progressMessage}`,
        costDeducted: skipCost,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Unexpected error skipping riddle:", error);
      captureException(error);
      throw new HttpsError("internal", "An error occurred while skipping the riddle.", error);
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

    if (!["hint", "skip", "continue"].includes(reason)) {
      throw new HttpsError("invalid-argument", "Invalid reason specified. Must be 'hint', 'skip', or 'continue'.");
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
      captureException(error);
      throw new HttpsError("internal", "An error occurred while spending coins.", error);
    }
  },
);
