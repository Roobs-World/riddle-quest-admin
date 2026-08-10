import * as functions from "firebase-functions";
import {admin} from "../shared/firebaseAdmin";
import type {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {getUser, updateUserCoins, updateUserStats, ensureUserDocumentComplete} from "./firestoreService";
import type {PlayerStats, PlayerStatsUpdate} from "../validation/firestoreSchemas";
import type {CompleteGameRequestData, CompleteGameResponseData} from "../validation/requestSchemas";
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
  LEVEL_UP_COIN_BONUS,
  BASE_SCORE_CLASSIC,
  BASE_SCORE_CHALLENGE,
  getLevelFromXp,
} from "../shared/constants";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";
import {computeNextDailyWinStreak} from "../daily/dailyStreak";
import {triggerClassicRiddleGenerationIfNeeded} from "../riddles/riddleSupply";

/** Describes player top level update. */
type PlayerTopLevelUpdate = {
  /** Stores last daily challenge completed at. */
  lastDailyChallengeCompletedAt?: number | FieldValue;
};

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
      totalHintsUsed: 0,
      multiplayerGamesPlayed: 0,
      multiplayerWins: 0,
      multiplayerChallengesCreated: 0,
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

        // Award the current streak tier every day while the streak is active.
        dailyStreakBonus = getStreakRewardBonus(updatedDailyWinStreak ?? 0);

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
      statsUpdate.totalScore = admin.firestore.FieldValue.increment(xpEarned);
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
    } else if (gameMode === "challenge") {
      updatedDailyWinStreak = 0;
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
