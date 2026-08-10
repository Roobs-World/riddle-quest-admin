import * as functions from "firebase-functions";
import {admin} from "../shared/firebaseAdmin";
import type {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {
  getUser,
  updateUserCoins,
  updateUserStats,
  getRiddleByGameMode,
  ensureUserDocumentComplete,
} from "./firestoreService";
import {PlayerStats, PlayerStatsUpdate} from "../validation/firestoreSchemas";
import type {
  FeedbackItem,
  SubmitGuessAuthContext,
  SubmitGuessRequestData,
  SubmitGuessResponseData,
} from "../validation/requestSchemas";
import * as riddleGeneration from "../riddles/riddleGeneration";
import {evaluateAchievements} from "./achievements";
import {updateLeaderboardEntry} from "./leaderboard";
import {captureException} from "../shared/sentry";
import {
  MAX_ATTEMPTS_CLASSIC,
  MAX_ATTEMPTS_CHALLENGE,
  COINS_REWARD_CLASSIC,
  COINS_REWARD_CHALLENGE,
  getStreakRewardBonus,
  ACHIEVEMENT_UNLOCK_COIN_REWARD,
  BASE_SCORE_CLASSIC,
  BASE_SCORE_CHALLENGE,
  getLevelFromXp,
} from "../shared/constants";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";
import {computeNextDailyWinStreak} from "../daily/dailyStreak";
import {triggerClassicRiddleGenerationIfNeeded} from "../riddles/riddleSupply";

// Define a type for potential top-level updates to the Player document
/** Describes player top level update. */
type PlayerTopLevelUpdate = {
  /** Daily challenge completion timestamp for challenge mode wins. */
  lastDailyChallengeCompletedAt?: number | FieldValue;
  /** Canonical daily challenge key for replay protection across locales. */
  lastCompletedDailyChallengeKey?: string;
  // Add other top-level fields here if they are updated similarly
};

/**
 * Core server-side guess handling logic, exported for unit testing.
 *
 * @param data Callable request payload.
 * @param auth Auth context (uid).
 * @returns Guess feedback and game outcome payload.
 */
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
    await (riddleGeneration.initializeLocalizedRiddleDatabaseIfEmpty ??
      riddleGeneration.initializeRiddleDatabaseIfEmpty)();

    const user = await getUser(userId);
    if (!user) {
      throw new HttpsError("internal", "User not found while trying to update stats.");
    }
    const preferredLanguage = user.preferredLanguage ?? "en";
    const locale = SUPPORTED_LOCALES.includes(preferredLanguage as SupportedLocale)
      ? (preferredLanguage as SupportedLocale)
      : "en";

    // Get riddle from the appropriate collection based on game mode
    const riddle = await getRiddleByGameMode(riddleId, gameMode, locale);
    functions.logger.debug("Fetched canonical riddle for server-side guess validation.", {
      gameMode,
      locale,
      riddleId,
    });

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
    const maxAttempts = gameMode === "challenge" ? MAX_ATTEMPTS_CHALLENGE : MAX_ATTEMPTS_CLASSIC;
    const gameOver = isCorrect || attempts >= maxAttempts;

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
      totalHintsUsed: 0,
      multiplayerGamesPlayed: 0,
      multiplayerWins: 0,
      multiplayerChallengesCreated: 0,
    };

    const statsUpdate: PlayerStatsUpdate = {
      totalWordsGuessed: admin.firestore.FieldValue.increment(1),
    };

    if (gameOver) {
      statsUpdate.gamesPlayed = admin.firestore.FieldValue.increment(1);
    }

    let updatedDailyWinStreak: number | undefined;

    if (isCorrect) {
      statsUpdate.wins = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalWins = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalGuessesInWins = admin.firestore.FieldValue.increment(attempts);

      const playerProfileUpdate: PlayerTopLevelUpdate = {};

      if (gameMode === "challenge") {
        updatedDailyWinStreak = computeNextDailyWinStreak(
          currentStats.winStreak || 0,
          user.lastDailyChallengeCompletedAt,
        );
        statsUpdate.winStreak = updatedDailyWinStreak;
        statsUpdate.challengeWins = admin.firestore.FieldValue.increment(1);
        statsUpdate.dailyPuzzlesCompleted = admin.firestore.FieldValue.increment(1);
        coinsEarned = COINS_REWARD_CHALLENGE + getStreakRewardBonus(updatedDailyWinStreak ?? 0);
        playerProfileUpdate.lastDailyChallengeCompletedAt = admin.firestore.FieldValue.serverTimestamp();
        playerProfileUpdate.lastCompletedDailyChallengeKey =
          typeof riddle.challengeKey === "string"
            ? riddle.challengeKey
            : typeof riddle.canonicalKey === "string"
              ? riddle.canonicalKey
              : undefined;

        await admin
          .firestore()
          .collection("users")
          .doc(userId)
          .update({
            "progress.dailyChallengeIndex": admin.firestore.FieldValue.increment(1),
          });
        functions.logger.info(`User ${userId} completed daily challenge. Incremented dailyChallengeIndex.`);
      } else {
        coinsEarned = COINS_REWARD_CLASSIC;
      }

      const baseScore = gameMode === "challenge" ? BASE_SCORE_CHALLENGE : BASE_SCORE_CLASSIC;
      const attemptsBonus = Math.max(0, (maxAttempts - attempts + 1) * 10);
      const scoreEarned = baseScore + attemptsBonus;
      const currentXp = currentStats.xp ?? 0;
      const newXp = currentXp + scoreEarned;
      const priorLevel = currentStats.level ?? getLevelFromXp(currentXp);
      const newLevel = getLevelFromXp(newXp);
      statsUpdate.xp = admin.firestore.FieldValue.increment(scoreEarned);
      statsUpdate.totalScore = admin.firestore.FieldValue.increment(scoreEarned);
      if (newLevel !== priorLevel) {
        statsUpdate.level = newLevel;
      }
      await updateUserCoins(userId, coinsEarned);

      if (Object.keys(playerProfileUpdate).length > 0) {
        await admin.firestore().collection("users").doc(userId).update(playerProfileUpdate);
      }

      const bestStreakCandidate =
        gameMode === "challenge"
          ? (updatedDailyWinStreak ?? (currentStats.winStreak || 0))
          : currentStats.bestStreak || 0;
      if (bestStreakCandidate > (currentStats.bestStreak || 0)) {
        statsUpdate.bestStreak = bestStreakCandidate;
      }

      if (!auth.isAnonymous) {
        // Update leaderboard entry with computed post-win stats (non-blocking)
        try {
          const newTotalXp = (currentStats.xp ?? 0) + scoreEarned;
          const newTotalWins = (currentStats.totalWins ?? 0) + 1;
          const newBestStreak = Math.max(
            currentStats.bestStreak ?? 0,
            gameMode === "challenge" ? (updatedDailyWinStreak ?? 0) : (currentStats.bestStreak ?? 0),
          );
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
      }
    } else if (gameOver && gameMode === "challenge") {
      updatedDailyWinStreak = 0;
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

      const updatedUserDoc = await userRef.get();
      const updatedUserData = updatedUserDoc.data() as {progress?: {classicIndex?: number}} | undefined;
      const currentClassicIndex = updatedUserData?.progress?.classicIndex || 0;
      await triggerClassicRiddleGenerationIfNeeded(userId, currentClassicIndex, locale);
    }

    let newlyUnlockedAchievementIds: string[] = [];
    try {
      newlyUnlockedAchievementIds = await evaluateAchievements(userId, {
        gameMode,
        isCorrect,
        attempts,
        gameOver,
      });

      if (isCorrect && newlyUnlockedAchievementIds.length > 0) {
        const achievementBonusCoins = newlyUnlockedAchievementIds.length * ACHIEVEMENT_UNLOCK_COIN_REWARD;
        await updateUserCoins(userId, achievementBonusCoins);
        coinsEarned += achievementBonusCoins;
      }
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
      newWinStreak: updatedDailyWinStreak,
    };
  } catch (error: unknown) {
    functions.logger.error("Error in handleGuessLogic:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred in handleGuessLogic.", error);
  }
}

export {handleCompleteGameLogic} from "./completeGameLogic";
