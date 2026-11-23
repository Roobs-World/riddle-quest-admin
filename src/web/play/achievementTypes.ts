import type {AchievementMilestoneId} from "../../core/game";
import type {PlayerProgress, PlayerStats} from "../../core/validation";

/** Identifies the supported criteria used to unlock an achievement. */
export type AchievementCriteriaType =
  | AchievementMilestoneId
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
  | "first_purchase"
  | "race_debut"
  | "race_first_win"
  | "race_wins_5"
  | "race_wins_25"
  | "race_host"
  | "race_hosts_5"
  | "race_clean_run";

/** Contains the subset of player data needed to evaluate achievement progress. */
export type AchievementPlayerData = {
  /** Aggregated gameplay statistics used by achievement counters. */
  stats?: PlayerStats | null;
  /** Persistent progression values used by mode-specific achievements. */
  progress?: PlayerProgress | null;
  /** Current spendable balance used by coin achievements. */
  coins?: number | null;
  /** Indicates whether the player has completed a qualifying purchase. */
  hasPurchasedApp?: boolean | null;
};

/** Defines the display metadata and progress calculation for one achievement. */
export interface AchievementDefinition {
  /** Stable achievement identifier shared with the authoritative backend. */
  id: string;
  /** Default English display name. */
  name: string;
  /** Default English unlock description. */
  description: string;
  /** Optional localization key for the display name. */
  nameKey?: string;
  /** Optional localization key for the description. */
  descriptionKey?: string;
  /** Server-recognized condition used to grant the achievement. */
  criteriaType: AchievementCriteriaType;
  /** Target value at which the achievement unlocks. */
  threshold: number;
  /** Emoji shown in the achievement icon circle. */
  icon: string;
  /** Returns the player's current progress, clamped by the caller to the configured threshold. */
  getProgress(player: AchievementPlayerData): number;
}
