/**
 * @fileoverview Achievement definitions for UI display and progress calculation.
 *
 * This module is the client-side source of truth for achievement names, descriptions,
 * criteria types, thresholds, icons, and progress calculation.  Unlock authority
 * lives server-side in firebase-functions/src/gameplay/achievements.ts; this file is used for:
 * - Rendering the achievements list (AchievementsModal)
 * - Computing per-achievement progress from player stats/progress.
 *
 * Each definition owns its own `getProgress` method so adding a new achievement
 * only requires one place to change.
 */

import type {BridgeProfile} from "@qwordly/core/bridge";
import type {PlayerStats, PlayerProgress} from "@qwordly/core/validation";
import {RACE_ACHIEVEMENT_DEFINITIONS} from "./race/raceAchievementDefinitions";
import type {AchievementCriteriaType, AchievementDefinition} from "./achievementTypes";

export type {AchievementCriteriaType, AchievementDefinition, AchievementPlayerData} from "./achievementTypes";

/** Defines the achievement definitions value. */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "first_win",
    name: "First Win",
    description: "Win your first riddle",
    criteriaType: "first_win",
    threshold: 1,
    icon: "🏆",
    getProgress: (p) => p.stats?.totalWins ?? 0,
  },
  {
    id: "wins_5",
    name: "Getting Started",
    description: "Win 5 riddles",
    criteriaType: "wins_5",
    threshold: 5,
    icon: "⭐",
    getProgress: (p) => p.stats?.totalWins ?? 0,
  },
  {
    id: "wins_25",
    name: "Riddle Master",
    description: "Win 25 riddles",
    criteriaType: "wins_25",
    threshold: 25,
    icon: "🌟",
    getProgress: (p) => p.stats?.totalWins ?? 0,
  },
  {
    id: "wins_50",
    name: "Grand Solver",
    description: "Win 50 riddles",
    criteriaType: "wins_50",
    threshold: 50,
    icon: "👑",
    getProgress: (p) => p.stats?.totalWins ?? 0,
  },
  {
    id: "wins_100",
    name: "Century Solver",
    description: "Win 100 riddles",
    criteriaType: "wins_100",
    threshold: 100,
    icon: "🏛️",
    getProgress: (p) => p.stats?.totalWins ?? 0,
  },
  {
    id: "win_rate_80",
    name: "Sharp Record",
    description: "Hold an 80% win rate after 10 games",
    criteriaType: "win_rate_80",
    threshold: 80,
    icon: "🎯",
    getProgress: (p) => p.stats?.winRate ?? 0,
  },
  {
    id: "efficient_10",
    name: "Efficient Solver",
    description: "Average 3 guesses or fewer after 10 wins",
    criteriaType: "efficient_10",
    threshold: 10,
    icon: "🧠",
    getProgress: (p) =>
      (p.stats?.totalWins ?? 0) >= 10 && (p.stats?.averageGuesses ?? Number.POSITIVE_INFINITY) <= 3
        ? 10
        : Math.min(p.stats?.totalWins ?? 0, 10),
  },
  {
    id: "games_25",
    name: "Riddle Regular",
    description: "Play 25 riddles",
    criteriaType: "games_25",
    threshold: 25,
    icon: "🎲",
    getProgress: (p) => p.stats?.gamesPlayed ?? 0,
  },
  {
    id: "games_100",
    name: "Puzzle Patron",
    description: "Play 100 riddles",
    criteriaType: "games_100",
    threshold: 100,
    icon: "🎟️",
    getProgress: (p) => p.stats?.gamesPlayed ?? 0,
  },
  {
    id: "streak_3",
    name: "On a Roll",
    description: "Reach a 3-day win streak",
    criteriaType: "streak_3",
    threshold: 3,
    icon: "🔥",
    getProgress: (p) => p.stats?.bestStreak ?? 0,
  },
  {
    id: "streak_7",
    name: "Unstoppable",
    description: "Reach a 7-day win streak",
    criteriaType: "streak_7",
    threshold: 7,
    icon: "⚡",
    getProgress: (p) => p.stats?.bestStreak ?? 0,
  },
  {
    id: "streak_14",
    name: "Two-Week Spark",
    description: "Reach a 14-day win streak",
    criteriaType: "streak_14",
    threshold: 14,
    icon: "🌋",
    getProgress: (p) => p.stats?.bestStreak ?? 0,
  },
  {
    id: "streak_30",
    name: "Monthly Momentum",
    description: "Reach a 30-day win streak",
    criteriaType: "streak_30",
    threshold: 30,
    icon: "🌠",
    getProgress: (p) => p.stats?.bestStreak ?? 0,
  },
  {
    id: "classic_10",
    name: "Classic Explorer",
    description: "Complete 10 classic levels",
    criteriaType: "classic_10",
    threshold: 10,
    icon: "🎮",
    getProgress: (p) => p.stats?.highestLevelClassic ?? 0,
  },
  {
    id: "classic_25",
    name: "Classic Voyager",
    description: "Complete 25 classic levels",
    criteriaType: "classic_25",
    threshold: 25,
    icon: "🧭",
    getProgress: (p) => p.stats?.highestLevelClassic ?? 0,
  },
  {
    id: "classic_50",
    name: "Classic Cartographer",
    description: "Complete 50 classic levels",
    criteriaType: "classic_50",
    threshold: 50,
    icon: "🗺️",
    getProgress: (p) => p.stats?.highestLevelClassic ?? 0,
  },
  {
    id: "classic_100",
    name: "Classic Legend",
    description: "Complete 100 classic levels",
    criteriaType: "classic_100",
    threshold: 100,
    icon: "🏰",
    getProgress: (p) => p.stats?.highestLevelClassic ?? 0,
  },
  {
    id: "daily_completed",
    name: "Daily Challenger",
    description: "Complete a daily challenge",
    criteriaType: "daily_completed",
    threshold: 1,
    icon: "📅",
    getProgress: (p) => p.stats?.dailyPuzzlesCompleted ?? 0,
  },
  {
    id: "daily_7",
    name: "Weekly Ritual",
    description: "Complete 7 daily challenges",
    criteriaType: "daily_7",
    threshold: 7,
    icon: "🗓️",
    getProgress: (p) => p.stats?.dailyPuzzlesCompleted ?? 0,
  },
  {
    id: "daily_30",
    name: "Daily Devotee",
    description: "Complete 30 daily challenges",
    criteriaType: "daily_30",
    threshold: 30,
    icon: "🏅",
    getProgress: (p) => p.stats?.dailyPuzzlesCompleted ?? 0,
  },
  {
    id: "daily_100",
    name: "Daily Sentinel",
    description: "Complete 100 daily challenges",
    criteriaType: "daily_100",
    threshold: 100,
    icon: "📆",
    getProgress: (p) => p.stats?.dailyPuzzlesCompleted ?? 0,
  },
  {
    id: "challenge_5",
    name: "Challenge Climber",
    description: "Win 5 daily challenges",
    criteriaType: "challenge_5",
    threshold: 5,
    icon: "⛰️",
    getProgress: (p) => p.stats?.challengeWins ?? 0,
  },
  {
    id: "challenge_25",
    name: "Challenge Champion",
    description: "Win 25 daily challenges",
    criteriaType: "challenge_25",
    threshold: 25,
    icon: "🏔️",
    getProgress: (p) => p.stats?.challengeWins ?? 0,
  },
  {
    id: "challenge_50",
    name: "Challenge Conqueror",
    description: "Win 50 daily challenges",
    criteriaType: "challenge_50",
    threshold: 50,
    icon: "🛡️",
    getProgress: (p) => p.stats?.challengeWins ?? 0,
  },
  {
    id: "perfect_guess",
    name: "First Try",
    description: "Solve a riddle on your first guess",
    criteriaType: "perfect_guess",
    threshold: 1,
    icon: "💎",
    // No stat tracks first-try guesses; evaluated in real-time by the server.
    // Returns 0 so the bar stays empty until the server grants the unlock.
    getProgress: () => 0,
  },
  {
    id: "classic_perfect",
    name: "Classic Bullseye",
    description: "Solve a classic riddle on your first guess",
    criteriaType: "classic_perfect",
    threshold: 1,
    icon: "🏹",
    getProgress: () => 0,
  },
  {
    id: "challenge_perfect",
    name: "Daily Bullseye",
    description: "Solve a daily challenge on your first guess",
    criteriaType: "challenge_perfect",
    threshold: 1,
    icon: "🌞",
    getProgress: () => 0,
  },
  {
    id: "last_chance",
    name: "Last Chance Save",
    description: "Solve a riddle on your final guess",
    criteriaType: "last_chance",
    threshold: 1,
    icon: "⏳",
    getProgress: () => 0,
  },
  {
    id: "classic_last_chance",
    name: "Classic Comeback",
    description: "Solve a classic riddle on your final guess",
    criteriaType: "classic_last_chance",
    threshold: 1,
    icon: "🎬",
    getProgress: () => 0,
  },
  {
    id: "challenge_last_chance",
    name: "Daily Comeback",
    description: "Solve a daily challenge on your final guess",
    criteriaType: "challenge_last_chance",
    threshold: 1,
    icon: "🌅",
    getProgress: () => 0,
  },
  {
    id: "lesson_learned",
    name: "Lesson Learned",
    description: "Finish a riddle without solving it",
    criteriaType: "lesson_learned",
    threshold: 1,
    icon: "📘",
    getProgress: () => 0,
  },
  {
    id: "hint_user",
    name: "Need a Clue",
    description: "Use a hint",
    criteriaType: "hint_user",
    threshold: 1,
    icon: "💡",
    getProgress: (p) => p.stats?.totalHintsUsed ?? 0,
  },
  {
    id: "hints_10",
    name: "Clue Collector",
    description: "Use 10 hints",
    criteriaType: "hints_10",
    threshold: 10,
    icon: "🔎",
    getProgress: (p) => p.stats?.totalHintsUsed ?? 0,
  },
  {
    id: "hints_25",
    name: "Clue Archivist",
    description: "Use 25 hints",
    criteriaType: "hints_25",
    threshold: 25,
    icon: "🕯️",
    getProgress: (p) => p.stats?.totalHintsUsed ?? 0,
  },
  {
    id: "level_5",
    name: "Level Five",
    description: "Reach player level 5",
    criteriaType: "level_5",
    threshold: 5,
    icon: "🚀",
    getProgress: (p) => p.stats?.level ?? 1,
  },
  {
    id: "level_10",
    name: "Double Digits",
    description: "Reach player level 10",
    criteriaType: "level_10",
    threshold: 10,
    icon: "🛰️",
    getProgress: (p) => p.stats?.level ?? 1,
  },
  {
    id: "level_20",
    name: "Orbit Breaker",
    description: "Reach player level 20",
    criteriaType: "level_20",
    threshold: 20,
    icon: "🪐",
    getProgress: (p) => p.stats?.level ?? 1,
  },
  {
    id: "xp_1000",
    name: "XP Collector",
    description: "Earn 1,000 XP",
    criteriaType: "xp_1000",
    threshold: 1000,
    icon: "✨",
    getProgress: (p) => p.stats?.xp ?? 0,
  },
  {
    id: "xp_5000",
    name: "XP Engine",
    description: "Earn 5,000 XP",
    criteriaType: "xp_5000",
    threshold: 5000,
    icon: "⚙️",
    getProgress: (p) => p.stats?.xp ?? 0,
  },
  {
    id: "coin_hoarder",
    name: "Coin Hoarder",
    description: "Hold 1,000 coins",
    criteriaType: "coin_hoarder",
    threshold: 1000,
    icon: "🪙",
    getProgress: (p) => p.coins ?? 0,
  },
  {
    id: "treasure_vault",
    name: "Treasure Vault",
    description: "Hold 2,500 coins",
    criteriaType: "treasure_vault",
    threshold: 2500,
    icon: "💰",
    getProgress: (p) => p.coins ?? 0,
  },
  {
    id: "first_purchase",
    name: "Supporter",
    description: "Buy an item from the shop",
    criteriaType: "first_purchase",
    threshold: 1,
    icon: "❤️",
    getProgress: (p) => (p.hasPurchasedApp ? 1 : 0),
  },
  ...RACE_ACHIEVEMENT_DEFINITIONS,
];

/** Terminal result fields that can be evaluated without trusting client rewards. */
export type AchievementCompletionPreview = {
  /** Single-player mode being completed. */ gameMode: "classic" | "challenge";
  /** Whether the locally scored terminal answer is correct. */ isCorrect: boolean;
  /** Number of guesses used. */ attempts: number;
  /** Whether the riddle has ended. */ gameOver: boolean;
};

/**
 * Predicts unlocks whose inputs are already present in the server-issued riddle
 * and profile projection. The backend remains authoritative and may add further
 * unlocks when its completion transaction reconciles XP, coins, and daily dates.
 */
export function predictCompletionAchievementIds(
  profile: BridgeProfile | null,
  completion: AchievementCompletionPreview,
): string[] {
  if (!profile || !completion.gameOver) return [];
  /** IDs already visible in the last authoritative/local profile projection. */
  const existing = new Set(profile.achievements);
  /** Projected aggregate values produced by a successful completion. */
  const gamesPlayed = profile.gamesPlayed + 1;
  const totalWins = (profile.totalWins ?? profile.wins) + (completion.isCorrect ? 1 : 0);
  const totalGuessesInWins = (profile.totalGuessesInWins ?? 0) +
    (completion.isCorrect ? completion.attempts : 0);
  const averageGuesses = totalWins > 0 ? Number((totalGuessesInWins / totalWins).toFixed(2)) : 0;
  const winRate = gamesPlayed > 0 ? Number(((totalWins / gamesPlayed) * 100).toFixed(2)) : 0;
  const highestLevelClassic = completion.gameMode === "classic" && completion.isCorrect
    ? Math.max(profile.highestLevelClassic ?? 0, profile.classicIndex + 1)
    : (profile.highestLevelClassic ?? 0);
  const dailyPuzzlesCompleted = (profile.dailyPuzzlesCompleted ?? 0) +
    (completion.gameMode === "challenge" && completion.isCorrect ? 1 : 0);
  const challengeWins = (profile.challengeWins ?? 0) +
    (completion.gameMode === "challenge" && completion.isCorrect ? 1 : 0);
  /** Rules whose result does not depend on unprojected server-only state. */
  const rules: Array<readonly [string, boolean]> = [
    ["first_win", totalWins >= 1], ["wins_5", totalWins >= 5], ["wins_25", totalWins >= 25],
    ["wins_50", totalWins >= 50], ["wins_100", totalWins >= 100],
    ["win_rate_80", gamesPlayed >= 10 && winRate >= 80],
    ["efficient_10", totalWins >= 10 && averageGuesses <= 3],
    ["games_25", gamesPlayed >= 25], ["games_100", gamesPlayed >= 100],
    ["classic_10", highestLevelClassic >= 10], ["classic_25", highestLevelClassic >= 25],
    ["classic_50", highestLevelClassic >= 50], ["classic_100", highestLevelClassic >= 100],
    ["daily_completed", dailyPuzzlesCompleted >= 1], ["daily_7", dailyPuzzlesCompleted >= 7],
    ["daily_30", dailyPuzzlesCompleted >= 30], ["daily_100", dailyPuzzlesCompleted >= 100],
    ["challenge_5", challengeWins >= 5], ["challenge_25", challengeWins >= 25],
    ["challenge_50", challengeWins >= 50],
    ["perfect_guess", completion.isCorrect && completion.attempts === 1],
    ["classic_perfect", completion.gameMode === "classic" && completion.isCorrect && completion.attempts === 1],
    ["challenge_perfect", completion.gameMode === "challenge" && completion.isCorrect && completion.attempts === 1],
    ["last_chance", completion.isCorrect && completion.attempts === 5],
    ["classic_last_chance", completion.gameMode === "classic" && completion.isCorrect && completion.attempts === 5],
    ["challenge_last_chance", completion.gameMode === "challenge" && completion.isCorrect && completion.attempts === 5],
    ["lesson_learned", !completion.isCorrect],
  ];
  return rules.filter(([id, unlocked]) => unlocked && !existing.has(id)).map(([id]) => id);
}

/**
 * @deprecated Use `def.getProgress(playerData)` instead.
 * Kept for any external callers during migration.
 */
export function getAchievementProgress(
  criteriaType: AchievementCriteriaType,
  stats: PlayerStats | undefined | null,
  progress: PlayerProgress | undefined | null,
  hasPurchasedApp?: boolean | null,
): number {
  /** Provides def behavior. */
  const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.criteriaType === criteriaType);
  if (!def) return 0;
  return def.getProgress({stats, progress, hasPurchasedApp});
}
