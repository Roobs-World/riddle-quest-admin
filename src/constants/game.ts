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
 * XP thresholds to reach each level (index 0 = level 1).
 * Calibrated against ~60 XP per average win (50 base + partial attempts bonus).
 *   Lv 1 →  2: ~2 wins   Lv 5 →  6: ~8 wins
 *   Lv 2 →  3: ~3 wins   Lv 6 →  7: ~17 wins
 *   Lv 3 →  4: ~5 wins   Lv 7 →  8: ~25 wins
 *   Lv 4 →  5: ~7 wins   Lv 8 →  9: ~42 wins
 *                          Lv 9 → 10: ~67 wins
 */
export const XP_LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 9000] as const;

export const XP_MAX_LEVEL = XP_LEVEL_THRESHOLDS.length;

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
  for (let i = 1; i < XP_LEVEL_THRESHOLDS.length; i++) {
    if (totalScore >= XP_LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  const isMax = level >= XP_MAX_LEVEL;
  const currentThreshold = XP_LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = isMax ? XP_LEVEL_THRESHOLDS[XP_MAX_LEVEL - 1] : XP_LEVEL_THRESHOLDS[level];
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
