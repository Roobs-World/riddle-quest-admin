import {
  INITIAL_STREAK_REWARD_BONUS,
  MAX_STREAK_REWARD_BONUS,
  STREAK_REWARD_BONUS_STEP,
  XP_LEVEL_THRESHOLDS,
  getLevelFromXp,
  getStreakRewardBonus,
  getXpThresholdForLevel,
  isStreakRewardMilestone,
} from "../shared/constants";

describe("server XP curve", () => {
  it("uses an object config instead of threshold array", () => {
    expect(Array.isArray(XP_LEVEL_THRESHOLDS)).toBe(false);
    expect(XP_LEVEL_THRESHOLDS.basePerLevel).toBeGreaterThan(0);
    expect(XP_LEVEL_THRESHOLDS.growthPerLevel).toBeGreaterThan(0);
  });

  it("adds a slight increase to each next level requirement", () => {
    for (let level = 2; level < 10; level++) {
      /** Provides previous delta behavior. */
      const previousDelta = getXpThresholdForLevel(level) - getXpThresholdForLevel(level - 1);
      /** Provides current delta behavior. */
      const currentDelta = getXpThresholdForLevel(level + 1) - getXpThresholdForLevel(level);

      expect(currentDelta - previousDelta).toBe(XP_LEVEL_THRESHOLDS.growthPerLevel);
    }
  });

  it("handles threshold boundaries correctly", () => {
    /** Provides level behavior. */
    const level = 12;
    /** Provides threshold behavior. */
    const threshold = getXpThresholdForLevel(level);

    expect(getLevelFromXp(threshold)).toBe(level);
    expect(getLevelFromXp(threshold - 1)).toBe(level - 1);
  });

  it("does not cap at a max level", () => {
    /** Provides very high level behavior. */
    const veryHighLevel = 120;
    /** Provides threshold behavior. */
    const threshold = getXpThresholdForLevel(veryHighLevel);

    expect(getLevelFromXp(threshold)).toBe(veryHighLevel);
    expect(getLevelFromXp(threshold + 999)).toBeGreaterThanOrEqual(veryHighLevel);
  });
});

describe("server streak rewards", () => {
  it.each([
    [1, false],
    [6, false],
    [7, true],
    [8, false],
    [14, true],
  ])("reports milestone status for a %s-day streak", (streak, expected) => {
    expect(isStreakRewardMilestone(streak)).toBe(expected);
  });

  it.each([
    [0, 0],
    [1, INITIAL_STREAK_REWARD_BONUS],
    [6, INITIAL_STREAK_REWARD_BONUS],
    [7, INITIAL_STREAK_REWARD_BONUS + STREAK_REWARD_BONUS_STEP],
    [8, INITIAL_STREAK_REWARD_BONUS + STREAK_REWARD_BONUS_STEP],
    [14, INITIAL_STREAK_REWARD_BONUS + STREAK_REWARD_BONUS_STEP * 2],
    [98, MAX_STREAK_REWARD_BONUS],
    [112, MAX_STREAK_REWARD_BONUS],
  ])("calculates the bonus for a %s-day streak", (streak, expectedBonus) => {
    expect(getStreakRewardBonus(streak)).toBe(expectedBonus);
  });
});
