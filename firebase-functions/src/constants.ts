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
 * XP thresholds to reach each level (index 0 = level 1).
 * Kept in sync with client `src/constants/game.ts`.
 */
export const XP_LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 9000] as const;

/** Maximum level based on XP thresholds. */
export const XP_MAX_LEVEL = XP_LEVEL_THRESHOLDS.length;

/**
 * Converts cumulative XP into a 1-based level.
 */
export function getLevelFromXp(totalXp: number): number {
  let level = 1;
  for (let i = 1; i < XP_LEVEL_THRESHOLDS.length; i++) {
    if (totalXp >= XP_LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

/** Threshold of remaining riddles below which new riddles are auto-generated. */
export const RIDDLE_GENERATION_THRESHOLD = 10;

/** Number of new riddles to generate when threshold is reached. */
export const RIDDLE_GENERATION_BATCH_SIZE = 25;
