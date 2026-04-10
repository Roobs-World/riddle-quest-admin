import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {
  getUser,
  updateUserCoins,
  updateUserStats,
  getRiddleByGameMode,
  ensureUserDocumentComplete,
} from "./firestoreService";
import {PlayerStats, PlayerStatsUpdate, PlayerSchema} from "./validation/firestoreSchemas";
import type {FeedbackItem} from "./validation/requestSchemas";
import {generateAndAppendRiddles, initializeRiddleDatabaseIfEmpty} from "./riddleGeneration";
import {evaluateAchievements} from "./achievements";
import {updateLeaderboardEntry} from "./leaderboard";
import {captureException} from "./sentry";
import {
  MAX_ATTEMPTS_CLASSIC,
  MAX_ATTEMPTS_CHALLENGE,
  MAX_ATTEMPTS_TUTORIAL,
  COINS_REWARD_CLASSIC,
  COINS_REWARD_TUTORIAL,
  BASE_SCORE_CLASSIC,
  BASE_SCORE_CHALLENGE,
  BASE_SCORE_TUTORIAL,
  getLevelFromXp,
  RIDDLE_GENERATION_THRESHOLD,
  RIDDLE_GENERATION_BATCH_SIZE,
} from "./constants";

// Define a type for potential top-level updates to the Player document
type PlayerTopLevelUpdate = {
  lastDailyChallengeCompletedAt?: number | admin.firestore.FieldValue;
  // Add other top-level fields here if they are updated similarly
};

// Type for feedback
export type FeedbackColor = "green" | "yellow" | "red";

interface SubmitGuessRequestData {
  guess: string;
  riddleId: string;
  gameMode: "challenge" | "classic" | "tutorial";
  attempts: number;
}

interface SubmitGuessAuthContext {
  uid: string;
  // Potentially include other auth details if your core logic needs them,
  // e.g., token for further verification, although uid is usually sufficient.
}

interface SubmitGuessResponseData {
  feedback: FeedbackItem[];
  isCorrect: boolean;
  gameOver: boolean;
  correctAnswer?: string;
  coinsEarned?: number;
  /** Achievement IDs newly unlocked by this guess (server-authoritative). */
  newlyUnlockedAchievementIds?: string[];
}

// Core logic, now separated and exportable for testing
export async function handleGuessLogic(
  data: SubmitGuessRequestData,
  auth: SubmitGuessAuthContext,
): Promise<SubmitGuessResponseData> {
  const {guess, riddleId, gameMode, attempts} = data;
  const userId = auth.uid;

  if (!guess || !riddleId || !gameMode || attempts === undefined) {
    throw new HttpsError("invalid-argument", "Missing required parameters: guess, riddleId, gameMode, attempts.");
  }

  try {
    // Ensure user document has all required stats and progress fields (defensive programming)
    await ensureUserDocumentComplete(userId);

    // Initialize database if empty (for new deployments)
    await initializeRiddleDatabaseIfEmpty();

    // Get riddle from the appropriate collection based on game mode
    const riddle = await getRiddleByGameMode(riddleId, gameMode);
    functions.logger.debug("handleGuessLogic - Fetched riddle:", JSON.stringify(riddle));

    if (!riddle || !riddle.answer) {
      const errorMessage = !riddle
        ? `${gameMode} riddle with ID ${riddleId} not found.`
        : `Answer not found for ${gameMode} riddle ${riddleId}.`;
      functions.logger.error(errorMessage);
      throw new HttpsError("not-found", errorMessage);
    }

    const correctAnswerClean = riddle.answer.toLowerCase();
    const guessClean = guess.toLowerCase();

    const feedback: FeedbackItem[] = [];
    const answerChars = correctAnswerClean.split("");
    const guessChars = guessClean.split("");
    const answerCharCounts: {[key: string]: number} = {};

    for (const char of answerChars) {
      answerCharCounts[char] = (answerCharCounts[char] || 0) + 1;
    }

    // Initialize feedback with all red
    for (let i = 0; i < guessChars.length; i++) {
      feedback.push({letter: guessChars[i], status: "red"});
    }

    // First pass for green
    for (let i = 0; i < guessChars.length; i++) {
      if (i < answerChars.length && guessChars[i] === answerChars[i]) {
        feedback[i] = {letter: guessChars[i], status: "green"};
        if (answerCharCounts[guessChars[i]]) {
          // check before decrementing
          answerCharCounts[guessChars[i]]--;
        }
      }
    }

    // Second pass for yellow
    for (let i = 0; i < guessChars.length; i++) {
      if (feedback[i].status === "green") continue;
      if (i < answerChars.length && answerChars.includes(guessChars[i]) && answerCharCounts[guessChars[i]] > 0) {
        feedback[i] = {letter: guessChars[i], status: "yellow"};
        if (answerCharCounts[guessChars[i]]) {
          // check before decrementing
          answerCharCounts[guessChars[i]]--;
        }
      }
    }

    // Ensure feedback length matches guess length if guess is longer than answer
    // (This scenario might imply an issue with guess validation before this function, but good to handle)
    while (feedback.length < guessChars.length) {
      // This case should ideally not be hit if guess length is validated earlier
      feedback.push({letter: guessChars[feedback.length], status: "red"});
    }
    if (feedback.length > guessChars.length) {
      feedback.splice(guessChars.length);
    }

    const isCorrect = guessClean === correctAnswerClean;
    let coinsEarned = 0;
    const maxAttempts =
      gameMode === "challenge" ? MAX_ATTEMPTS_CHALLENGE : gameMode === "tutorial" ? MAX_ATTEMPTS_TUTORIAL : MAX_ATTEMPTS_CLASSIC;
    const gameOver = isCorrect || attempts >= maxAttempts;

    const user = await getUser(userId);
    if (!user) {
      throw new HttpsError("internal", "User not found while trying to update stats.");
    }

    const currentStats: PlayerStats = user.stats || {
      xp: 0,
      level: 1,
      dailyPuzzlesCompleted: 0,
      bestStreak: 0,
      totalWordsGuessed: 0,
      winRate: 0,
      averageGuesses: 0,
      totalScore: 0,
      highestLevelClassic: 0,
      gamesPlayed: 0,
      wins: 0,
      challengeWins: 0,
      winStreak: 0,
      totalWins: 0,
      totalGuessesInWins: 0,
    };

    const statsUpdate: PlayerStatsUpdate = {
      totalWordsGuessed: admin.firestore.FieldValue.increment(1),
    };

    if (gameOver) {
      statsUpdate.gamesPlayed = admin.firestore.FieldValue.increment(1);
    }

    if (isCorrect) {
      statsUpdate.wins = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalWins = admin.firestore.FieldValue.increment(1);
      statsUpdate.winStreak = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalGuessesInWins = admin.firestore.FieldValue.increment(attempts);

      const playerProfileUpdate: PlayerTopLevelUpdate = {};

      if (gameMode === "challenge") {
        statsUpdate.challengeWins = admin.firestore.FieldValue.increment(1);
        statsUpdate.dailyPuzzlesCompleted = admin.firestore.FieldValue.increment(1);
        coinsEarned = Math.max(0, 20 - (attempts - 1) * 5);
        playerProfileUpdate.lastDailyChallengeCompletedAt = admin.firestore.FieldValue.serverTimestamp();

        await admin
          .firestore()
          .collection("users")
          .doc(userId)
          .update({
            "progress.dailyChallengeIndex": admin.firestore.FieldValue.increment(1),
          });
        functions.logger.info(`User ${userId} completed daily challenge. Incremented dailyChallengeIndex.`);
      } else if (gameMode === "tutorial") {
        coinsEarned = COINS_REWARD_TUTORIAL;

        await admin
          .firestore()
          .collection("users")
          .doc(userId)
          .update({
            "progress.tutorialIndex": admin.firestore.FieldValue.increment(1),
          });
        functions.logger.info(`User ${userId} completed tutorial level. Incremented tutorialIndex.`);
      } else {
        coinsEarned = COINS_REWARD_CLASSIC;
      }

      const baseScore = gameMode === "challenge" ? BASE_SCORE_CHALLENGE : gameMode === "tutorial" ? BASE_SCORE_TUTORIAL : BASE_SCORE_CLASSIC;
      const attemptsBonus = Math.max(0, (maxAttempts - attempts + 1) * 10);
      const scoreEarned = baseScore + attemptsBonus;
      const currentXp = currentStats.xp ?? 0;
      const newXp = currentXp + scoreEarned;
      const priorLevel = currentStats.level ?? getLevelFromXp(currentXp);
      const newLevel = getLevelFromXp(newXp);
      statsUpdate.xp = admin.firestore.FieldValue.increment(scoreEarned);
      if (newLevel !== priorLevel) {
        statsUpdate.level = newLevel;
      }
      await updateUserCoins(userId, coinsEarned);

      if (Object.keys(playerProfileUpdate).length > 0) {
        await admin.firestore().collection("users").doc(userId).update(playerProfileUpdate);
      }

      if ((currentStats.winStreak || 0) + 1 > (currentStats.bestStreak || 0)) {
        statsUpdate.bestStreak = (currentStats.winStreak || 0) + 1;
      }

      // Update leaderboard entry with computed post-win stats (non-blocking)
      try {
        const newTotalXp = (currentStats.xp ?? 0) + scoreEarned;
        const newTotalWins = (currentStats.totalWins ?? 0) + 1;
        const newBestStreak = Math.max((currentStats.bestStreak ?? 0), (currentStats.winStreak ?? 0) + 1);
        await updateLeaderboardEntry(
          userId,
          user.username,
          {level: newLevel, xp: newTotalXp, totalWins: newTotalWins, bestStreak: newBestStreak},
          user.avatarUrl ?? null,
        );
      } catch (error) {
        functions.logger.error("Error updating leaderboard entry:", error);
        captureException(error);
      }
    } else if (gameOver) {
      statsUpdate.winStreak = 0;
    }

    const newTotalWins = (currentStats.totalWins || 0) + (isCorrect ? 1 : 0);
    const newGamesPlayed = (currentStats.gamesPlayed || 0) + (gameOver ? 1 : 0);
    const newTotalGuessesInWins = (currentStats.totalGuessesInWins || 0) + (isCorrect ? attempts : 0);

    if (newTotalWins > 0 && newTotalGuessesInWins > 0) {
      statsUpdate.averageGuesses = parseFloat((newTotalGuessesInWins / newTotalWins).toFixed(2));
    } else if (isCorrect && newTotalWins > 0) {
      statsUpdate.averageGuesses = parseFloat((attempts / newTotalWins).toFixed(2));
    }

    if (newGamesPlayed > 0) {
      statsUpdate.winRate = parseFloat(((newTotalWins / newGamesPlayed) * 100).toFixed(2));
    }

    await updateUserStats(userId, statsUpdate);

    if (isCorrect && gameMode === "classic") {
      const userRef = admin.firestore().collection("users").doc(userId);
      await userRef.update({
        "progress.classicIndex": admin.firestore.FieldValue.increment(1),
      });
      functions.logger.info(`User ${userId} solved Classic riddle ${riddleId}. Incremented classicIndex.`);

      // Update highestLevelClassic stat to match the new progress
      const newClassicLevel = (user.progress?.classicIndex || 0) + 1;
      if (newClassicLevel > (currentStats.highestLevelClassic || 0)) {
        await updateUserStats(userId, {
          highestLevelClassic: newClassicLevel,
        });
      }

      // Check if new riddles need to be generated
      const updatedUserDoc = await userRef.get();
      const updatedPlayerData = PlayerSchema.parse(updatedUserDoc.data());
      const currentClassicIndex = updatedPlayerData.progress?.classicIndex || 0;

      try {
        // Count total classic riddles in Firestore
        const classicRiddlesSnapshot = await admin
          .firestore()
          .collection("riddles")
          .where("classicIndex", ">=", 0)
          .get();

        const totalClassicRiddles = classicRiddlesSnapshot.size;

        functions.logger.info(
          `User ${userId} currentClassicIndex: ${currentClassicIndex}, totalClassicRiddles: ${totalClassicRiddles}`,
        );

        if (totalClassicRiddles - currentClassicIndex <= RIDDLE_GENERATION_THRESHOLD) {
          functions.logger.info(`User ${userId} has <= ${RIDDLE_GENERATION_THRESHOLD} classic riddles remaining. Triggering generation of ${RIDDLE_GENERATION_BATCH_SIZE} new riddles.`);
          try {
            await generateAndAppendRiddles(RIDDLE_GENERATION_BATCH_SIZE);
            functions.logger.info("Successfully triggered generation of 25 new classic riddles.");
          } catch (error) {
            functions.logger.error("Error triggering generation of new classic riddles:", error);
            captureException(error);
            // Decide if this error should be surfaced to the client or just logged
          }
        }
      } catch (error) {
        functions.logger.error("Error checking classic riddle count:", error);
        captureException(error);
      }
    }

    let newlyUnlockedAchievementIds: string[] = [];
    try {
      newlyUnlockedAchievementIds = await evaluateAchievements(userId, {
        gameMode,
        isCorrect,
        attempts,
        gameOver,
      });
    } catch (error) {
      functions.logger.error("Error evaluating achievements:", error);
      captureException(error);
    }

    return {
      feedback,
      isCorrect,
      gameOver,
      correctAnswer: gameOver ? riddle.answer : undefined,
      coinsEarned,
      newlyUnlockedAchievementIds,
    };
  } catch (error: unknown) {
    functions.logger.error("Error in handleGuessLogic:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred in handleGuessLogic.", error);
  }
}

// This is the callable function wrapper
export const submitGuess = onCall<SubmitGuessRequestData, Promise<SubmitGuessResponseData>>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  return handleGuessLogic(request.data, request.auth);
});

// ---------------------------------------------------------------------------
// completeGame â€” called once when a game truly ends (win or final loss).
// Feedback is computed client-side; this function handles all server-side
// side-effects: coins, stats, progress advancement, and achievements.
// ---------------------------------------------------------------------------

interface CompleteGameRequestData {
  riddleId: string;
  gameMode: "challenge" | "classic" | "tutorial";
  /** Total number of guesses made during the game. */
  attempts: number;
  isCorrect: boolean;
}

interface CompleteGameResponseData {
  coinsEarned: number;
  newlyUnlockedAchievementIds: string[];
  scoreEarned: number;
  xpEarned: number;
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
}

export async function handleCompleteGameLogic(
  data: CompleteGameRequestData,
  auth: {uid: string},
): Promise<CompleteGameResponseData> {
  const {riddleId, gameMode, attempts, isCorrect} = data;
  const userId = auth.uid;

  if (!riddleId || !gameMode || attempts === undefined || isCorrect === undefined) {
    throw new HttpsError("invalid-argument", "Missing required parameters: riddleId, gameMode, attempts, isCorrect.");
  }

  try {
    await ensureUserDocumentComplete(userId);

    const user = await getUser(userId);
    if (!user) {
      throw new HttpsError("internal", "User not found while trying to update stats.");
    }

    const currentStats: PlayerStats = user.stats || {
      xp: 0,
      level: 1,
      dailyPuzzlesCompleted: 0,
      bestStreak: 0,
      totalWordsGuessed: 0,
      winRate: 0,
      averageGuesses: 0,
      totalScore: 0,
      highestLevelClassic: 0,
      gamesPlayed: 0,
      wins: 0,
      challengeWins: 0,
      winStreak: 0,
      totalWins: 0,
      totalGuessesInWins: 0,
    };

    // Batch all guesses (attempts) into totalWordsGuessed at game end
    const statsUpdate: PlayerStatsUpdate = {
      totalWordsGuessed: admin.firestore.FieldValue.increment(attempts),
      gamesPlayed: admin.firestore.FieldValue.increment(1),
    };

    let coinsEarned = 0;
    let xpEarned = 0;
    let newXp = currentStats.xp ?? 0;
    let newLevel = currentStats.level ?? getLevelFromXp(newXp);
    let leveledUp = false;

    if (isCorrect) {
      statsUpdate.wins = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalWins = admin.firestore.FieldValue.increment(1);
      statsUpdate.winStreak = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalGuessesInWins = admin.firestore.FieldValue.increment(attempts);

      const playerProfileUpdate: PlayerTopLevelUpdate = {};

      const maxAttempts =
        gameMode === "challenge" ? MAX_ATTEMPTS_CHALLENGE : gameMode === "tutorial" ? MAX_ATTEMPTS_TUTORIAL : MAX_ATTEMPTS_CLASSIC;

      if (gameMode === "challenge") {
        statsUpdate.challengeWins = admin.firestore.FieldValue.increment(1);
        statsUpdate.dailyPuzzlesCompleted = admin.firestore.FieldValue.increment(1);
        coinsEarned = Math.max(0, 20 - (attempts - 1) * 5);
        playerProfileUpdate.lastDailyChallengeCompletedAt = admin.firestore.FieldValue.serverTimestamp();

        await admin.firestore().collection("users").doc(userId).update({
          "progress.dailyChallengeIndex": admin.firestore.FieldValue.increment(1),
        });
        functions.logger.info(`User ${userId} completed daily challenge. Incremented dailyChallengeIndex.`);
      } else if (gameMode === "tutorial") {
        coinsEarned = COINS_REWARD_TUTORIAL;

        await admin.firestore().collection("users").doc(userId).update({
          "progress.tutorialIndex": admin.firestore.FieldValue.increment(1),
        });
        functions.logger.info(`User ${userId} completed tutorial level. Incremented tutorialIndex.`);
      } else {
        // classic
        coinsEarned = COINS_REWARD_CLASSIC;
      }

      const baseScore =
        gameMode === "challenge" ? BASE_SCORE_CHALLENGE : gameMode === "tutorial" ? BASE_SCORE_TUTORIAL : BASE_SCORE_CLASSIC;
      const attemptsBonus = Math.max(0, (maxAttempts - attempts + 1) * 10);
      xpEarned = baseScore + attemptsBonus;
      statsUpdate.xp = admin.firestore.FieldValue.increment(xpEarned);
      newXp = (currentStats.xp ?? 0) + xpEarned;
      const previousLevel = currentStats.level ?? getLevelFromXp(currentStats.xp ?? 0);
      newLevel = getLevelFromXp(newXp);
      leveledUp = newLevel > previousLevel;
      if (newLevel !== previousLevel) {
        statsUpdate.level = newLevel;
      }

      await updateUserCoins(userId, coinsEarned);

      if (Object.keys(playerProfileUpdate).length > 0) {
        await admin.firestore().collection("users").doc(userId).update(playerProfileUpdate);
      }

      if ((currentStats.winStreak || 0) + 1 > (currentStats.bestStreak || 0)) {
        statsUpdate.bestStreak = (currentStats.winStreak || 0) + 1;
      }

      // Update leaderboard entry with computed post-win stats (non-blocking)
      try {
        const scoreEarned = xpEarned;
        const newTotalXp = (currentStats.xp ?? 0) + scoreEarned;
        const newTotalWins = (currentStats.totalWins ?? 0) + 1;
        const newBestStreak = Math.max((currentStats.bestStreak ?? 0), (currentStats.winStreak ?? 0) + 1);
        await updateLeaderboardEntry(
          userId,
          user.username,
          {level: newLevel, xp: newTotalXp, totalWins: newTotalWins, bestStreak: newBestStreak},
          user.avatarUrl ?? null,
        );
      } catch (error) {
        functions.logger.error("Error updating leaderboard entry:", error);
        captureException(error);
      }

      if (gameMode === "classic") {
        const userRef = admin.firestore().collection("users").doc(userId);
        await userRef.update({"progress.classicIndex": admin.firestore.FieldValue.increment(1)});
        functions.logger.info(`User ${userId} solved Classic riddle ${riddleId}. Incremented classicIndex.`);

        const newClassicLevel = (user.progress?.classicIndex || 0) + 1;
        if (newClassicLevel > (currentStats.highestLevelClassic || 0)) {
          await updateUserStats(userId, {highestLevelClassic: newClassicLevel});
        }

        try {
          const updatedUserDoc = await userRef.get();
          const updatedPlayerData = PlayerSchema.parse(updatedUserDoc.data());
          const currentClassicIndex = updatedPlayerData.progress?.classicIndex || 0;

          const classicRiddlesSnapshot = await admin
            .firestore()
            .collection("riddles")
            .where("classicIndex", ">=", 0)
            .get();

          if (classicRiddlesSnapshot.size - currentClassicIndex <= RIDDLE_GENERATION_THRESHOLD) {
            functions.logger.info(
              `User ${userId} has <= ${RIDDLE_GENERATION_THRESHOLD} classic riddles remaining. Triggering generation.`,
            );
            await generateAndAppendRiddles(RIDDLE_GENERATION_BATCH_SIZE);
          }
        } catch (error) {
          functions.logger.error("Error checking classic riddle count:", error);
          captureException(error);
        }
      }
    } else {
      statsUpdate.winStreak = 0;
    }

    const newTotalWins = (currentStats.totalWins || 0) + (isCorrect ? 1 : 0);
    const newGamesPlayed = (currentStats.gamesPlayed || 0) + 1;
    const newTotalGuessesInWins = (currentStats.totalGuessesInWins || 0) + (isCorrect ? attempts : 0);

    if (newTotalWins > 0 && newTotalGuessesInWins > 0) {
      statsUpdate.averageGuesses = parseFloat((newTotalGuessesInWins / newTotalWins).toFixed(2));
    }
    if (newGamesPlayed > 0) {
      statsUpdate.winRate = parseFloat(((newTotalWins / newGamesPlayed) * 100).toFixed(2));
    }

    await updateUserStats(userId, statsUpdate);

    let newlyUnlockedAchievementIds: string[] = [];
    try {
      newlyUnlockedAchievementIds = await evaluateAchievements(userId, {
        gameMode,
        isCorrect,
        attempts,
        gameOver: true,
      });
    } catch (error) {
      functions.logger.error("Error evaluating achievements:", error);
      captureException(error);
    }

    const scoreEarned = xpEarned;

    return {coinsEarned, newlyUnlockedAchievementIds, scoreEarned, xpEarned, newXp, newLevel, leveledUp};
  } catch (error: unknown) {
    functions.logger.error("Error in handleCompleteGameLogic:", error);
    captureException(error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An unexpected error occurred in handleCompleteGameLogic.", error);
  }
}

export const completeGame = onCall<CompleteGameRequestData, Promise<CompleteGameResponseData>>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  return handleCompleteGameLogic(request.data, request.auth);
});

