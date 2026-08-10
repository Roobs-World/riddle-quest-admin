import {logger} from "firebase-functions/v2";
import {admin} from "../shared/firebaseAdmin";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {updateUserCoins, getUser, getRiddleByGameMode, updateUserStats} from "./firestoreService";
import {
  SKIP_COST_CLASSIC,
  HINT_COST_COINS,
  CONTINUE_COST_COINS,
  ACHIEVEMENT_UNLOCK_COIN_REWARD,
} from "../shared/constants";
import {triggerClassicRiddleGenerationIfNeeded} from "../riddles/riddleSupply";
import {captureException} from "../shared/sentry";
import type {PlayerProgress} from "../validation/firestoreSchemas";
import {z} from "zod";
import {
  SkipRiddleRequest,
  SkipRiddleRequestSchema,
  SkipRiddleResponse,
  SkipRiddleResponseSchema,
  SpendCoinsRequest,
  SpendCoinsRequestSchema,
  SpendCoinsResponseSchema,
  GetHintRequestSchema,
  GetHintResponseSchema,
} from "../validation/requestSchemas";
import {evaluateAchievements} from "./achievements";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";

import {splitGraphemes, lowerCaseGraphemes} from "@qwordly/core/game";

/**
 * Skips the current riddle by marking it as completed and advancing to the next level/question.
 * @param data - The request data object containing riddleId and gameMode.
 * @param data.riddleId - The ID of the riddle being skipped.
 * @param data.gameMode - The game mode. Daily challenge riddles are rejected.
 * @param context - The context object representing the request context.
 * @return An object containing success status and new progress information.
 */
export const skipRiddle = onCall(
  browserCallableSecurityOptions,
  async (request: CallableRequest<SkipRiddleRequest>): Promise<SkipRiddleResponse> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to skip a riddle.");
      }

      const currentUserId = request.auth.uid;
      const {riddleId, gameMode} = validateCallableRequest(
        SkipRiddleRequestSchema,
        request.data,
        "skipRiddle",
        (error) =>
          error.issues.some((issue) => issue.path[0] === "gameMode")
            ? "Invalid game mode specified."
            : "Invalid request payload for skipRiddle.",
      );

      if (gameMode === "challenge") {
        throw new HttpsError("failed-precondition", "Daily riddles cannot be skipped.");
      }

      // Check if user has enough coins.
      const user = await getUser(currentUserId);
      if (!user) {
        throw new HttpsError("not-found", "User data not found.");
      }

      const skipCost = SKIP_COST_CLASSIC;

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

      let newProgress: PlayerProgress | null = null;
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

        await triggerClassicRiddleGenerationIfNeeded(currentUserId, newClassicIndex, "en");

        // Update stats
        await userRef.update({
          "stats.classicSkipped": admin.firestore.FieldValue.increment(1),
        });

        progressMessage = `Advanced to classic level ${newClassicIndex + 1}`;
      }

      logger.info(
        `User ${currentUserId} skipped riddle ${riddleId} in ${gameMode} mode for ${skipCost} coins. ${progressMessage}`,
      );

      return validateCallableResponse(
        SkipRiddleResponseSchema,
        {
          success: true,
          newProgress,
          message: `Riddle skipped successfully. ${skipCost} coins deducted. ${progressMessage}`,
          costDeducted: skipCost,
        },
        "skipRiddle",
      );
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
 * Callable function to handle spending user coins in a server-authoritative manner.
 * Resolves expected costs by reason and optional gameMode.
 * @param data - The request data.
 * @param data.reason - The reason for spending coins ('hint', 'skip', 'continue').
 * @param data.gameMode - Optional game mode ('classic', 'challenge').
 * @param data.amount - Optional legacy amount; validated against calculated cost.
 * @param context - The CallableContext object.
 * @return {Promise<{ newCoins: number }>} A Promise resolving to the new coin balance.
 */
export const spendCoins = onCall(
  browserCallableSecurityOptions,
  async (request: CallableRequest<SpendCoinsRequest>): Promise<{newCoins: number}> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    const {reason, gameMode, amount} = validateCallableRequest(
      SpendCoinsRequestSchema,
      request.data,
      "spendCoins",
      (error) => {
        if (error.issues.some((issue) => issue.path[0] === "reason")) {
          return "Invalid reason specified. Must be 'hint', 'skip', or 'continue'.";
        }
        return "Invalid request payload for spendCoins.";
      },
    );
    const userId = request.auth.uid;

    try {
      if (reason === "skip" && gameMode === "challenge") {
        throw new HttpsError("failed-precondition", "Daily riddles cannot be skipped.");
      }

      // Check if user exists
      const user = await getUser(userId);
      if (!user) {
        throw new HttpsError("not-found", "User data not found.");
      }

      // Calculate expected cost based on reason and optional gameMode
      let expectedCost: number;
      switch (reason) {
        case "hint":
          expectedCost = HINT_COST_COINS;
          break;
        case "skip":
          // Default to classic if gameMode not specified
          expectedCost = SKIP_COST_CLASSIC;
          break;
        case "continue":
          expectedCost = CONTINUE_COST_COINS;
          break;
        default:
          throw new HttpsError("invalid-argument", "Invalid reason specified.");
      }

      // Validate legacy amount if provided
      if (amount !== undefined && amount !== expectedCost) {
        throw new HttpsError(
          "invalid-argument",
          `Supplied amount (${amount}) does not match expected cost (${expectedCost}) for ${reason}.`,
        );
      }

      // Check if user has enough coins
      if (user.coins < expectedCost) {
        throw new HttpsError(
          "failed-precondition",
          `Insufficient coins to spend. Required: ${expectedCost}, Available: ${user.coins}`,
        );
      }

      // Deduct coins
      await updateUserCoins(userId, -expectedCost);

      const updatedUser = await getUser(userId);
      if (!updatedUser) {
        throw new HttpsError("internal", "Could not retrieve updated user data after spending coins.");
      }

      logger.info(
        `User ${userId} spent ${expectedCost} coins for reason: ${reason}${gameMode ? ` (${gameMode})` : ""}. New balance: ${updatedUser.coins}.`,
      );
      return validateCallableResponse(SpendCoinsResponseSchema, {newCoins: updatedUser.coins}, "spendCoins");
    } catch (error: unknown) {
      // Only log unexpected errors, not expected business logic errors
      if (error instanceof HttpsError) {
        throw error;
      }
      // Log unexpected errors
      logger.error("Unexpected error spending coins:", error);
      captureException(error);
      throw new HttpsError("internal", "An error occurred while spending coins.", error);
    }
  },
);

/**
 * Callable function to reveal a single hint letter for an active riddle.
 * Charges `HINT_COST_COINS`, updates riddle state, increments `stats.totalHintsUsed`,
 * evaluates hint-related achievements, and returns the revealed letter index and costs.
 */
export const getHint = onCall(
  browserCallableSecurityOptions,
  async (request: CallableRequest<z.infer<typeof GetHintRequestSchema>>) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
      }

      const data = validateCallableRequest(GetHintRequestSchema, request.data, "getHint");
      const {riddleId, gameMode, currentAttempt} = data;
      const currentUserId = request.auth.uid;

      const riddleData = await getRiddleByGameMode(riddleId, gameMode);
      if (!riddleData) {
        throw new HttpsError("not-found", `${gameMode} riddle with ID ${riddleId} not found.`);
      }
      if (!riddleData.answer) {
        throw new HttpsError("internal", `Answer not found for ${gameMode} riddle ID ${riddleId}.`);
      }

      const riddleLocale = riddleData.locale ?? "en";
      const answer: string = lowerCaseGraphemes(riddleData.answer, riddleLocale).join("");
      const coinsCost = HINT_COST_COINS;

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
      const hintRevealedIndices: number[] = (gameState?.hintRevealedIndices as number[]) || [];
      const isGameCompleted = gameState?.isCompleted === true;

      if (isGameCompleted) {
        logger.warn(`User ${currentUserId} requested hint for completed ${gameMode} riddle ${riddleId}.`);
        throw new HttpsError("failed-precondition", "Game is already completed.");
      }

      const guessedLetters: string[] = Array.isArray(currentAttempt)
        ? currentAttempt.map((letter: string) => String(letter).toLowerCase())
        : [];
      const answerLetters = splitGraphemes(answer, riddleLocale);

      let revealedLetter: string | null = null;
      let index: number | null = null;

      for (let i = 0; i < answerLetters.length; i++) {
        const answerLetter: string = answerLetters[i];
        const guessedLetter: string = guessedLetters[i] ?? "";

        if (guessedLetter !== answerLetter && !hintRevealedIndices.includes(i)) {
          revealedLetter = answerLetter;
          index = i;
          break;
        }
      }

      if (revealedLetter === null || index === null) {
        logger.warn(
          `No hint available for user ${currentUserId}, ${gameMode} riddle ${riddleId}. All letters revealed or guessed correctly.`,
        );
        return validateCallableResponse(GetHintResponseSchema, null, "getHint");
      }

      // Deduct coins
      await updateUserCoins(currentUserId, -coinsCost);

      // Mark hint revealed
      await gameStateRef.set(
        {
          hintRevealedIndices: [...hintRevealedIndices, index],
        },
        {merge: true},
      );

      // Increment totalHintsUsed stat
      try {
        await updateUserStats(currentUserId, {totalHintsUsed: admin.firestore.FieldValue.increment(1)});
      } catch (err) {
        logger.error("Error updating totalHintsUsed stat:", err);
      }

      // Evaluate achievements after stat update
      let newlyUnlockedAchievementIds: string[] = [];
      try {
        newlyUnlockedAchievementIds = await evaluateAchievements(currentUserId, {
          gameMode,
          isCorrect: false,
          attempts: 0,
          gameOver: false,
        });

        if (newlyUnlockedAchievementIds.length > 0) {
          const achievementBonus = newlyUnlockedAchievementIds.length * ACHIEVEMENT_UNLOCK_COIN_REWARD;
          await updateUserCoins(currentUserId, achievementBonus);
        }
      } catch (error) {
        logger.error("Error evaluating/awarding hint achievements:", error);
        captureException(error);
      }

      const finalUser = await getUser(currentUserId);

      logger.info(
        `User ${currentUserId} used a hint for ${gameMode} riddle ${riddleId}, revealing letter ${revealedLetter.toUpperCase()} at index ${index}.`,
      );

      return validateCallableResponse(
        GetHintResponseSchema,
        {
          revealedLetter: revealedLetter.toUpperCase(),
          index,
          coinsCost,
          newCoins: finalUser?.coins,
          newlyUnlockedAchievementIds: newlyUnlockedAchievementIds.length ? newlyUnlockedAchievementIds : undefined,
        },
        "getHint",
      );
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      logger.error("Unexpected error in getHint:", error);
      captureException(error);
      throw new HttpsError("internal", "An unexpected error occurred in getHint.", error);
    }
  },
);
