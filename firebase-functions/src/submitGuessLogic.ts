import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {onCall, HttpsError, CallableOptions} from "firebase-functions/v2/https";
import {
  getUser,
  updateUserCoins,
  updateUserStats,
  getRiddleByGameMode,
  ensureUserDocumentComplete,
} from "./firestoreService";
import {PlayerStats, PlayerStatsUpdate} from "./validation/firestoreSchemas";
import {
  CompleteGameRequestDataSchema,
  CompleteGameResponseDataSchema,
  SubmitGuessRequestDataSchema,
  SubmitGuessResponseDataSchema,
} from "./validation/requestSchemas";
import type {
  CompleteGameRequestData,
  CompleteGameResponseData,
  FeedbackItem,
  SubmitGuessAuthContext,
  SubmitGuessRequestData,
  SubmitGuessResponseData,
} from "./validation/requestSchemas";
import * as riddleGeneration from "./riddleGeneration";
import {evaluateAchievements} from "./achievements";
import {updateLeaderboardEntry} from "./leaderboard";
import {captureException} from "./sentry";
import {validateCallableRequest, validateCallableResponse} from "./validation/callableValidation";
import {
  MAX_ATTEMPTS_CLASSIC,
  MAX_ATTEMPTS_CHALLENGE,
  COINS_REWARD_CLASSIC,
  COINS_REWARD_CHALLENGE,
  DAILY_COMPLETION_BONUS,
  ACHIEVEMENT_UNLOCK_COIN_REWARD,
  LEVEL_UP_COIN_BONUS,
  BASE_SCORE_CLASSIC,
  BASE_SCORE_CHALLENGE,
  getLevelFromXp,
  RIDDLE_GENERATION_THRESHOLD,
  RIDDLE_GENERATION_BATCH_SIZE,
} from "./constants";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";

// Define a type for potential top-level updates to the Player document
type PlayerTopLevelUpdate = {
  /** Daily challenge completion timestamp for challenge mode wins. */
  lastDailyChallengeCompletedAt?: number | admin.firestore.FieldValue;
  /** Canonical daily challenge key for replay protection across locales. */
  lastCompletedDailyChallengeKey?: string;
  // Add other top-level fields here if they are updated similarly
};

type TimestampLike = {
  toDate?: () => Date;
  toMillis?: () => number;
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
};

function coerceToDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    const timestampLike = value as TimestampLike;

    if (typeof timestampLike.toDate === "function") {
      const parsed = timestampLike.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof timestampLike.toMillis === "function") {
      const parsed = new Date(timestampLike.toMillis());
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const seconds =
      typeof timestampLike.seconds === "number"
        ? timestampLike.seconds
        : typeof timestampLike._seconds === "number"
          ? timestampLike._seconds
          : null;

    if (seconds !== null) {
      const nanos =
        typeof timestampLike.nanoseconds === "number"
          ? timestampLike.nanoseconds
          : typeof timestampLike._nanoseconds === "number"
            ? timestampLike._nanoseconds
            : 0;
      const parsed = new Date(seconds * 1000 + Math.floor(nanos / 1_000_000));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

function getUtcDayString(value: unknown): string | null {
  const date = coerceToDate(value);
  if (!date) return null;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

function getYesterdayUtcDayString(): string {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

function computeNextDailyWinStreak(currentWinStreak: number, lastDailyChallengeCompletedAt: unknown): number {
  const lastCompletedDay = getUtcDayString(lastDailyChallengeCompletedAt);
  const yesterdayUtcDay = getYesterdayUtcDayString();
  return lastCompletedDay === yesterdayUtcDay ? currentWinStreak + 1 : 1;
}

/**
 * Generates additional classic riddles when a user is at the configured low-supply threshold.
 * This keeps progression seamless as players approach the end of the current Firestore set.
 */
async function triggerClassicRiddleGenerationIfNeeded(
  userId: string,
  currentClassicIndex: number,
  locale: SupportedLocale,
): Promise<void> {
  try {
    const localizedClassicCollection = `localizedRiddles/${locale}/classic`;
    const classicRiddlesSnapshot = await admin
      .firestore()
      .collection(localizedClassicCollection)
      .where("classicIndex", ">=", 0)
      .get();

    const totalClassicRiddles = classicRiddlesSnapshot.size;
    const remainingClassicRiddles = totalClassicRiddles - currentClassicIndex;

    functions.logger.info(
      `User ${userId} currentClassicIndex: ${currentClassicIndex}, totalClassicRiddles: ${totalClassicRiddles}, remainingClassicRiddles: ${remainingClassicRiddles}`,
    );

    if (remainingClassicRiddles <= RIDDLE_GENERATION_THRESHOLD) {
      functions.logger.info(
        `User ${userId} has <= ${RIDDLE_GENERATION_THRESHOLD} classic riddles remaining. Triggering generation of ${RIDDLE_GENERATION_BATCH_SIZE} new riddles.`,
      );
      try {
        await (riddleGeneration.generateLocalizedClassicRiddles ?? riddleGeneration.generateAndAppendRiddles)(
          RIDDLE_GENERATION_BATCH_SIZE,
        );
        functions.logger.info(
          `Successfully triggered generation of ${RIDDLE_GENERATION_BATCH_SIZE} new classic riddles.`,
        );
      } catch (error) {
        functions.logger.error("Error triggering generation of new classic riddles:", error);
        captureException(error);
      }
    }
  } catch (error) {
    functions.logger.error("Error checking classic riddle count:", error);
    captureException(error);
  }
}

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
        coinsEarned = COINS_REWARD_CHALLENGE;
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

// This is the callable function wrapper
export const submitGuess = onCall<SubmitGuessRequestData, Promise<SubmitGuessResponseData>>(
  {
    secrets: ["OPENAI_API_KEY"],
  } as CallableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const data = validateCallableRequest(SubmitGuessRequestDataSchema, request.data, "submitGuess");
    const response = await handleGuessLogic(data, {
      uid: request.auth.uid,
      isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
    });
    return validateCallableResponse(SubmitGuessResponseDataSchema, response, "submitGuess");
  },
);

// ---------------------------------------------------------------------------
// completeGame â€” called once when a game truly ends (win or final loss).
// Feedback is computed client-side; this function handles all server-side
// side-effects: coins, stats, progress advancement, and achievements.
// ---------------------------------------------------------------------------

/**
 * Finalizes server-side game side effects for a completed win/loss.
 *
 * @param data Completion payload.
 * @param auth Auth context (uid).
 * @returns Rewards and progression snapshot.
 */
export async function handleCompleteGameLogic(
  data: CompleteGameRequestData,
  auth: {uid: string; isAnonymous?: boolean},
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
    const preferredLanguage = user.preferredLanguage ?? "en";
    const locale = SUPPORTED_LOCALES.includes(preferredLanguage as SupportedLocale)
      ? (preferredLanguage as SupportedLocale)
      : "en";

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

    let baseWinCoins = 0;
    let levelUpBonus = 0;
    let dailyStreakBonus = 0;
    let achievementBonus = 0;
    let coinsEarned = 0;
    let xpEarned = 0;
    let newXp = currentStats.xp ?? 0;
    let newLevel = currentStats.level ?? getLevelFromXp(newXp);
    let leveledUp = false;

    let updatedDailyWinStreak: number | undefined;

    if (isCorrect) {
      statsUpdate.wins = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalWins = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalGuessesInWins = admin.firestore.FieldValue.increment(attempts);

      const playerProfileUpdate: PlayerTopLevelUpdate = {};

      const maxAttempts = gameMode === "challenge" ? MAX_ATTEMPTS_CHALLENGE : MAX_ATTEMPTS_CLASSIC;

      if (gameMode === "challenge") {
        updatedDailyWinStreak = computeNextDailyWinStreak(
          currentStats.winStreak || 0,
          user.lastDailyChallengeCompletedAt,
        );
        statsUpdate.winStreak = updatedDailyWinStreak;
        statsUpdate.challengeWins = admin.firestore.FieldValue.increment(1);
        statsUpdate.dailyPuzzlesCompleted = admin.firestore.FieldValue.increment(1);
        baseWinCoins = COINS_REWARD_CHALLENGE;

        // Award daily streak bonus when streak is active (> 0)
        if (updatedDailyWinStreak && updatedDailyWinStreak > 0) {
          dailyStreakBonus = DAILY_COMPLETION_BONUS;
        }

        playerProfileUpdate.lastDailyChallengeCompletedAt = admin.firestore.FieldValue.serverTimestamp();

        await admin
          .firestore()
          .collection("users")
          .doc(userId)
          .update({
            "progress.dailyChallengeIndex": admin.firestore.FieldValue.increment(1),
          });
        functions.logger.info(`User ${userId} completed daily challenge. Incremented dailyChallengeIndex.`);
      } else {
        // classic
        baseWinCoins = COINS_REWARD_CLASSIC;
      }

      const baseScore = gameMode === "challenge" ? BASE_SCORE_CHALLENGE : BASE_SCORE_CLASSIC;
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

      // Award base win coins
      await updateUserCoins(userId, baseWinCoins);
      coinsEarned = baseWinCoins;

      // Award daily streak bonus if applicable
      if (dailyStreakBonus > 0) {
        await updateUserCoins(userId, dailyStreakBonus);
        coinsEarned += dailyStreakBonus;
      }

      // Award level-up bonus if applicable
      if (leveledUp) {
        levelUpBonus = LEVEL_UP_COIN_BONUS;
        await updateUserCoins(userId, levelUpBonus);
        coinsEarned += levelUpBonus;
      }

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
          const scoreEarned = xpEarned;
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

      if (gameMode === "classic") {
        const userRef = admin.firestore().collection("users").doc(userId);
        await userRef.update({"progress.classicIndex": admin.firestore.FieldValue.increment(1)});
        functions.logger.info(`User ${userId} solved Classic riddle ${riddleId}. Incremented classicIndex.`);

        const newClassicLevel = (user.progress?.classicIndex || 0) + 1;
        if (newClassicLevel > (currentStats.highestLevelClassic || 0)) {
          await updateUserStats(userId, {highestLevelClassic: newClassicLevel});
        }

        const updatedUserDoc = await userRef.get();
        const updatedUserData = updatedUserDoc.data() as {progress?: {classicIndex?: number}} | undefined;
        const currentClassicIndex = updatedUserData?.progress?.classicIndex || 0;
        await triggerClassicRiddleGenerationIfNeeded(userId, currentClassicIndex, locale);
      }
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

      if (isCorrect && newlyUnlockedAchievementIds.length > 0) {
        achievementBonus = newlyUnlockedAchievementIds.length * ACHIEVEMENT_UNLOCK_COIN_REWARD;
        await updateUserCoins(userId, achievementBonus);
        coinsEarned += achievementBonus;
      }
    } catch (error) {
      functions.logger.error("Error evaluating achievements:", error);
      captureException(error);
    }

    const scoreEarned = xpEarned;

    // Get final user balance for reward breakdown
    const finalUser = await getUser(userId);
    const newBalance = finalUser?.coins ?? 0;
    const totalAwarded = isCorrect ? coinsEarned : 0;

    return {
      coinsEarned,
      newlyUnlockedAchievementIds,
      scoreEarned,
      xpEarned,
      newXp,
      newLevel,
      leveledUp,
      newWinStreak: updatedDailyWinStreak,
      rewardBreakdown: isCorrect
        ? {
            baseWinCoins,
            levelUpBonus,
            dailyStreakBonus,
            achievementBonus,
            totalAwarded,
            newBalance,
          }
        : undefined,
    };
  } catch (error: unknown) {
    functions.logger.error("Error in handleCompleteGameLogic:", error);
    captureException(error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An unexpected error occurred in handleCompleteGameLogic.", error);
  }
}

export const completeGame = onCall<CompleteGameRequestData, Promise<CompleteGameResponseData>>(
  {
    secrets: ["OPENAI_API_KEY"],
  } as CallableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const data = validateCallableRequest(CompleteGameRequestDataSchema, request.data, "completeGame");
    const response = await handleCompleteGameLogic(data, {
      uid: request.auth.uid,
      isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
    });
    return validateCallableResponse(CompleteGameResponseDataSchema, response, "completeGame");
  },
);
