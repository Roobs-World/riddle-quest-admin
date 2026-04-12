/**
 * Gameplay constants used in GameScreen and related flows.
 * Keeps magic numbers for skip costs and UI timing in one place.
 */

/** Coin cost to skip a level in Daily Challenge mode. */
export const SKIP_COST_DAILY = 150;

/** Coin cost to skip a level in Classic mode. */
export const SKIP_COST_CLASSIC = 100;

/**
 * XP curve configuration.
 * Each new level needs a slightly larger XP amount than the previous level.
 */
export const XP_LEVEL_THRESHOLDS = {
  /** XP needed for each level-up before growth is applied. */
  basePerLevel: 100,
  /** Extra XP added per level-up as level increases. */
  growthPerLevel: 10,
} as const;

/**
 * XP progress details for the current score snapshot.
 */
interface XpLevelSnapshot {
  /** One-based player level derived from total score. */
  level: number;
  /** Level progress clamped to [0, 1]. */
  progressPct: number;
  /** XP earned toward the current level only. */
  currentXp: number;
  /** XP required to complete the current level. */
  nextLevelXp: number;
}

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
 * Returns the player's current level (1-based), progress fraction [0,1]
 * within that level, and the raw XP values for display.
 */
export function getXpLevel(totalScore: number): XpLevelSnapshot {
  const score = Math.max(totalScore, 0);
  const { basePerLevel, growthPerLevel } = XP_LEVEL_THRESHOLDS;
  const a = growthPerLevel / 2;
  const b = basePerLevel - growthPerLevel / 2;
  const discriminant = b * b + 4 * a * score;
  const completedLevelUps = Math.floor((-b + Math.sqrt(discriminant)) / (2 * a));

  const level = completedLevelUps + 1;
  const currentThreshold = getXpThresholdForLevel(level);
  const nextThreshold = getXpThresholdForLevel(level + 1);
  const progressPct = (score - currentThreshold) / (nextThreshold - currentThreshold);

  const snapshot: XpLevelSnapshot = {
    level,
    progressPct: Math.min(Math.max(progressPct, 0), 1),
    currentXp: score - currentThreshold,
    nextLevelXp: nextThreshold - currentThreshold,
  };

  return snapshot;
}
/** The initial coins a user starts with */
export const INITIAL_COINS = 300;

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
