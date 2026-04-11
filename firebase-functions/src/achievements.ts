/**
 * @fileoverview Server-side achievement evaluation for Qwordly.
 *
 * Evaluates unlock criteria after game actions (e.g. submitGuess) and appends
 * newly unlocked achievements to the user document. All authority is server-side
 * so clients cannot fake achievements.
 */

import * as functions from "firebase-functions";
import {getUser, appendUnlockedAchievements} from "./firestoreService";
import {captureException} from "./sentry";
import type {Player, UnlockedAchievement} from "./validation/firestoreSchemas";

/** Context passed from submitGuess (or other callers) for achievement evaluation. */
export interface AchievementContext {
  gameMode: "challenge" | "classic";
  isCorrect: boolean;
  attempts: number;
  gameOver: boolean;
}

/** Rule: (user, context) => true if achievement should be unlocked. */
type AchievementRule = (
  user: Player,
  context: AchievementContext,
) => boolean;

/** Achievement ID and its unlock rule. Server does not store name/description; client has definitions. */
const ACHIEVEMENT_RULES: Array<{id: string; rule: AchievementRule}> = [
  {
    id: "first_win",
    rule: (user) => (user.stats?.totalWins ?? 0) >= 1,
  },
  {
    id: "wins_5",
    rule: (user) => (user.stats?.totalWins ?? 0) >= 5,
  },
  {
    id: "wins_25",
    rule: (user) => (user.stats?.totalWins ?? 0) >= 25,
  },
  {
    id: "streak_3",
    rule: (user) => (user.stats?.bestStreak ?? 0) >= 3,
  },
  {
    id: "streak_7",
    rule: (user) => (user.stats?.bestStreak ?? 0) >= 7,
  },
  {
    id: "classic_10",
    rule: (user) => (user.stats?.highestLevelClassic ?? 0) >= 10,
  },
  {
    id: "daily_completed",
    rule: (user) => (user.stats?.dailyPuzzlesCompleted ?? 0) >= 1,
  },
  {
    id: "perfect_guess",
    rule: (user, ctx) => ctx.isCorrect && ctx.attempts === 1,
  },
  {
    id: "hint_user",
    rule: (user) => (user.stats?.totalHintsUsed ?? 0) >= 1,
  },
  {
    id: "first_purchase",
    rule: (user) => user.hasPurchasedApp === true,
  },
];

/**
 * Evaluates all achievement rules against the current user document and appends
 * any newly unlocked achievements. Call after stats/progress have been updated.
 *
 * @param userId - The user's ID.
 * @param context - Game context (gameMode, isCorrect, attempts, gameOver).
 * @returns List of achievement IDs that were newly unlocked (may be empty).
 */
export async function evaluateAchievements(
  userId: string,
  context: AchievementContext,
): Promise<string[]> {
  try {
    const user = await getUser(userId);
    if (!user) {
      functions.logger.warn(`evaluateAchievements: user ${userId} not found`);
      return [];
    }

    const existingIds = new Set(
      (user.unlockedAchievements ?? []).map((e) => e.achievementId),
    );
    const now = Date.now();
    const newEntries: UnlockedAchievement[] = [];

    for (const {id, rule} of ACHIEVEMENT_RULES) {
      if (existingIds.has(id)) continue;
      if (rule(user, context)) {
        newEntries.push({achievementId: id, unlockedAt: now});
        existingIds.add(id);
      }
    }

    if (newEntries.length === 0) return [];

    await appendUnlockedAchievements(userId, newEntries);
    return newEntries.map((e) => e.achievementId);
  } catch (error) {
    functions.logger.error(`evaluateAchievements: error for user ${userId}:`, error);
    captureException(error, {userId, context});
    return [];
  }
}
