import {DAILY_STREAK_BONUS, SOLO_BONUS_COINS, SOLO_COIN_COSTS, SOLO_WIN_COINS, getDailyStreakBonusCoins} from "../../../src/progression/economy/rewardRules.js";

/** Server game constants share the provider-independent solo economy with the client. */

/** Coin cost to skip a level in Classic mode. */
export const SKIP_COST_CLASSIC = SOLO_COIN_COSTS.skip;

/** Coin cost to skip a level in Daily Challenge mode. */

/** Coin cost to reveal one hint letter. */
export const HINT_COST_COINS = SOLO_COIN_COSTS.hint;

/** Coin cost to continue after exhausting attempts. */
export const CONTINUE_COST_COINS = SOLO_COIN_COSTS.continue;

/** Maximum guesses allowed in Classic mode. */
export const MAX_ATTEMPTS_CLASSIC = 5;

/** Maximum guesses allowed in Challenge mode. */
export const MAX_ATTEMPTS_CHALLENGE = 5;

/** Coins earned for solving a Classic riddle. */
export const COINS_REWARD_CLASSIC = SOLO_WIN_COINS.classic.easy;
/** Coins earned for solving a Daily Challenge riddle. */
export const COINS_REWARD_CHALLENGE = SOLO_WIN_COINS.challenge.easy;
/** Daily streak bonus paid while a streak is active. */
export const INITIAL_STREAK_REWARD_BONUS = DAILY_STREAK_BONUS.initial;
/** Coin increase applied at each weekly daily-streak reward milestone. */
export const STREAK_REWARD_BONUS_STEP = DAILY_STREAK_BONUS.weeklyStep;
/** Maximum daily-streak reward bonus paid for a daily win. */
export const MAX_STREAK_REWARD_BONUS = DAILY_STREAK_BONUS.max;
/** Returns true when a daily streak has reached a weekly reward milestone. */
export function isStreakRewardMilestone(streakValue: number): boolean {
  /** Normalizes d streak. */
  const normalizedStreak = Math.max(0, Math.floor(streakValue));
  return normalizedStreak > 0 && normalizedStreak % DAILY_STREAK_BONUS.intervalDays === 0;
}
/** Returns the daily-streak bonus for the active streak day. */
export const getStreakRewardBonus = getDailyStreakBonusCoins;
/** Bonus coins awarded per level-up in solo play. */
export const LEVEL_UP_COIN_BONUS = SOLO_BONUS_COINS.levelUp;
/** Bonus coins awarded per newly unlocked solo (Classic/Daily) achievement. */
export const SOLO_ACHIEVEMENT_COIN_REWARD = SOLO_BONUS_COINS.achievement;
/**
 * Bonus coins per newly unlocked race or purchase achievement. Kept separate from
 * the solo rate because stored race settlements are validated against it.
 */
export const ACHIEVEMENT_UNLOCK_COIN_REWARD = 25;
/** Base score for a Classic win. */
export const BASE_SCORE_CLASSIC = 50;

/** Base score for a Challenge win. */
export const BASE_SCORE_CHALLENGE = 100;

/**
 * XP curve configuration.
 * Each new level needs a slightly larger XP amount than the previous level.
 */
export const XP_LEVEL_THRESHOLDS = {
  basePerLevel: 100,
  growthPerLevel: 10,
} as const;

/**
 * Returns total cumulative XP required to be at a given level (1-based).
 */
export function getXpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  /** Completes d level ups. */
  const completedLevelUps = level - 1;
  /** Provides {base per level, growth per level} behavior. */
  const {basePerLevel, growthPerLevel} = XP_LEVEL_THRESHOLDS;
  return completedLevelUps * basePerLevel + ((completedLevelUps - 1) * completedLevelUps * growthPerLevel) / 2;
}

/**
 * Converts cumulative XP into a 1-based level.
 */
export function getLevelFromXp(totalXp: number): number {
  /** Provides xp behavior. */
  const xp = Math.max(totalXp, 0);
  /** Provides {base per level, growth per level} behavior. */
  const {basePerLevel, growthPerLevel} = XP_LEVEL_THRESHOLDS;
  /** Provides a behavior. */
  const a = growthPerLevel / 2;
  /** Provides b behavior. */
  const b = basePerLevel - growthPerLevel / 2;
  /** Provides discriminant behavior. */
  const discriminant = b * b + 4 * a * xp;
  /** Completes d level ups. */
  const completedLevelUps = Math.floor((-b + Math.sqrt(discriminant)) / (2 * a));

  return completedLevelUps + 1;
}

/**
 * Threshold of remaining classic riddles (based on `totalClassicRiddles - currentClassicIndex`)
 * below which new riddles are auto-generated.
 *
 * With the current semantics (currentClassicIndex is the *next* riddle to play),
 * a value of 1 means "user is on the penultimate riddle or later".
 */
export const RIDDLE_GENERATION_THRESHOLD = 1;

/** Number of new classic riddles to generate when threshold is reached. */
export const RIDDLE_GENERATION_BATCH_SIZE = 5;

/** Maximum characters allowed in generated riddle answers. */
export {MAX_RIDDLE_ANSWER_CHARACTERS} from "../../../src/gameplay/rules/limits.js";
