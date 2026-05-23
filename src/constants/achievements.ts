/**
 * @fileoverview Achievement definitions for UI display and progress calculation.
 *
 * This module is the client-side source of truth for achievement names, descriptions,
 * criteria types, thresholds, icons, and progress calculation.  Unlock authority
 * lives server-side in firebase-functions/src/achievements.ts; this file is used for:
 * - Rendering the achievements list (AchievementsModal)
 * - Computing per-achievement progress from player stats/progress.
 *
 * Each definition owns its own `getProgress` method so adding a new achievement
 * only requires one place to change.
 */

import type { PlayerStats, PlayerProgress } from "../validation/firestoreSchemas";

export type AchievementCriteriaType =
  | "first_win"
  | "wins_5"
  | "wins_25"
  | "wins_50"
  | "wins_100"
  | "win_rate_80"
  | "efficient_10"
  | "games_25"
  | "games_100"
  | "streak_3"
  | "streak_7"
  | "streak_14"
  | "streak_30"
  | "classic_10"
  | "classic_25"
  | "classic_50"
  | "classic_100"
  | "daily_completed"
  | "daily_7"
  | "daily_30"
  | "daily_100"
  | "challenge_5"
  | "challenge_25"
  | "challenge_50"
  | "perfect_guess"
  | "classic_perfect"
  | "challenge_perfect"
  | "last_chance"
  | "classic_last_chance"
  | "challenge_last_chance"
  | "lesson_learned"
  | "hint_user"
  | "hints_10"
  | "hints_25"
  | "level_5"
  | "level_10"
  | "level_20"
  | "xp_1000"
  | "xp_5000"
  | "coin_hoarder"
  | "treasure_vault"
  | "first_purchase";

/** Subset of player data needed to evaluate achievement progress. */
export type AchievementPlayerData = {
  stats?: PlayerStats | null;
  progress?: PlayerProgress | null;
  coins?: number | null;
  hasPurchasedApp?: boolean | null;
};

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  criteriaType: AchievementCriteriaType;
  /** The target value at which this achievement unlocks. */
  threshold: number;
  /** Emoji shown in the achievement icon circle. */
  icon: string;
  /**
   * Returns the current progress value in the range [0, threshold].
   * Used to draw the progress bar and label.
   * For binary achievements with no measurable progress (e.g. perfect_guess),
   * returns 0 — the component will show a full bar if `isUnlocked`.
   */
  getProgress(player: AchievementPlayerData): number;
}

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
];

/**
 * @deprecated Use `def.getProgress(playerData)` instead.
 * Kept for any external callers during migration.
 */
export function getAchievementProgress(
  criteriaType: AchievementCriteriaType,
  stats: PlayerStats | undefined | null,
  progress: PlayerProgress | undefined | null,
  hasPurchasedApp?: boolean | null
): number {
  const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.criteriaType === criteriaType);
  if (!def) return 0;
  return def.getProgress({ stats, progress, hasPurchasedApp });
}
