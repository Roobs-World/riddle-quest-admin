/**
 * Gameplay constants used in GameScreen and related flows.
 * Keeps magic numbers for skip costs and UI timing in one place.
 */

/** Coin cost to skip a level in Daily Challenge mode. */
export const SKIP_COST_DAILY = 150;

/** Coin cost to skip a level in Classic mode. */
export const SKIP_COST_CLASSIC = 100;

/** Coin cost to skip a level in Tutorial mode. */
export const SKIP_COST_TUTORIAL = 25;

/**
 * XP curve configuration.
 * Each new level needs a slightly larger XP amount than the previous level.
 */
export const XP_LEVEL_THRESHOLDS = {
  basePerLevel: 100,
  growthPerLevel: 10,
} as const;

export const XP_MAX_LEVEL = 10;

/**
 * Returns total cumulative XP required to be at a given level (1-based).
 */
export function getXpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  const clampedLevel = Math.min(level, XP_MAX_LEVEL);
  const completedLevelUps = clampedLevel - 1;
  const { basePerLevel, growthPerLevel } = XP_LEVEL_THRESHOLDS;
  return (
    completedLevelUps * basePerLevel +
    ((completedLevelUps - 1) * completedLevelUps * growthPerLevel) / 2
  );
}

/**
 * Returns the player's current level (1-based), progress fraction [0,1]
 * within that level, and the raw XP values for display.
 */
export function getXpLevel(totalScore: number): {
  level: number;
  progressPct: number;
  currentXp: number;
  nextLevelXp: number;
} {
  let level = 1;
  for (let nextLevel = 2; nextLevel <= XP_MAX_LEVEL; nextLevel++) {
    if (totalScore >= getXpThresholdForLevel(nextLevel)) level = nextLevel;
    else break;
  }

  const isMax = level >= XP_MAX_LEVEL;
  const currentThreshold = getXpThresholdForLevel(level);
  const nextThreshold = isMax ? getXpThresholdForLevel(XP_MAX_LEVEL) : getXpThresholdForLevel(level + 1);
  const progressPct = isMax
    ? 1
    : (totalScore - currentThreshold) / (nextThreshold - currentThreshold);

  return {
    level,
    progressPct: Math.min(Math.max(progressPct, 0), 1),
    currentXp: totalScore - currentThreshold,
    nextLevelXp: isMax ? 0 : nextThreshold - currentThreshold,
  };
}

/** Delay (ms) after closing a modal before opening another, to avoid overlap. */
export const MODAL_CLOSE_DELAY_MS = 100;

/** Coin cost to reveal one hint letter (must match backend getHint). */
export const HINT_COST_COINS = 50;

/** Coin cost to continue after exhausting initial attempts. */
export const CONTINUE_COST_COINS = 100;

/** Delay (ms) before resuming background music after sound is enabled. */
export const SOUND_RESUME_DELAY_MS = 500;

/** Win flow: fade-out duration for background music (ms). */
export const WIN_FADE_OUT_DURATION_MS = 500;
/** Win flow: delay before playing success sound (ms). */
export const WIN_SUCCESS_DELAY_MS = 500;
/** Win flow: delay before fading background music back in (ms). */
export const WIN_FADE_IN_DELAY_MS = 1000;
/** Win flow: fade-in duration for background music (ms). */
export const WIN_FADE_IN_DURATION_MS = 1000;
/** Loss flow: duration for negative sound fade-in (ms). */
export const LOSS_NEGATIVE_FADE_DURATION_MS = 2000;
