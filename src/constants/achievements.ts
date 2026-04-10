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
  | "streak_3"
  | "streak_7"
  | "classic_10"
  | "daily_completed"
  | "perfect_guess"
  | "tutorial_started"
  | "hint_user"
  | "first_purchase";

/** Subset of player data needed to evaluate achievement progress. */
export type AchievementPlayerData = {
  stats?: PlayerStats | null;
  progress?: PlayerProgress | null;
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
    id: "classic_10",
    name: "Classic Explorer",
    description: "Complete 10 classic levels",
    criteriaType: "classic_10",
    threshold: 10,
    icon: "🎮",
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
    id: "tutorial_started",
    name: "Learner",
    description: "Complete a tutorial step",
    criteriaType: "tutorial_started",
    threshold: 1,
    icon: "📚",
    getProgress: (p) => p.progress?.tutorialIndex ?? 0,
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
    id: "first_purchase",
    name: "Supporter",
    description: "Remove ads with a purchase",
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

