/**
 * Server-side game constants. Must stay in sync with client src/constants/game.ts
 * for skip costs and hint cost so UI and backend behavior match.
 */

/** Coin cost to skip a level in Tutorial mode. */
export const SKIP_COST_TUTORIAL = 25;

/** Coin cost to skip a level in Classic mode. */
export const SKIP_COST_CLASSIC = 100;

/** Coin cost to skip a level in Daily Challenge mode. */
export const SKIP_COST_DAILY = 150;

/** Maximum guesses allowed in Classic mode. */
export const MAX_ATTEMPTS_CLASSIC = 5;

/** Maximum guesses allowed in Challenge mode. */
export const MAX_ATTEMPTS_CHALLENGE = 5;

/** Maximum guesses allowed in Tutorial mode. */
export const MAX_ATTEMPTS_TUTORIAL = 3;

/** Coins earned for solving a Classic riddle. */
export const COINS_REWARD_CLASSIC = 10;

/** Coins earned for solving a Tutorial riddle. */
export const COINS_REWARD_TUTORIAL = 5;

/** Base score for a Classic win. */
export const BASE_SCORE_CLASSIC = 50;

/** Base score for a Challenge win. */
export const BASE_SCORE_CHALLENGE = 100;

/** Base score for a Tutorial win. */
export const BASE_SCORE_TUTORIAL = 25;

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
  const completedLevelUps = level - 1;
  const { basePerLevel, growthPerLevel } = XP_LEVEL_THRESHOLDS;
  return (
    completedLevelUps * basePerLevel +
    ((completedLevelUps - 1) * completedLevelUps * growthPerLevel) / 2
  );
}

/**
 * Converts cumulative XP into a 1-based level.
 */
export function getLevelFromXp(totalXp: number): number {
  const xp = Math.max(totalXp, 0);
  const { basePerLevel, growthPerLevel } = XP_LEVEL_THRESHOLDS;
  const a = growthPerLevel / 2;
  const b = basePerLevel - growthPerLevel / 2;
  const discriminant = b * b + 4 * a * xp;
  const completedLevelUps = Math.floor((-b + Math.sqrt(discriminant)) / (2 * a));

  return completedLevelUps + 1;
}

/** Threshold of remaining riddles below which new riddles are auto-generated. */
export const RIDDLE_GENERATION_THRESHOLD = 10;

/** Number of new riddles to generate when threshold is reached. */
export const RIDDLE_GENERATION_BATCH_SIZE = 25;
