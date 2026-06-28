import {
  INITIAL_STREAK_REWARD_BONUS,
  MAX_STREAK_REWARD_BONUS,
  STREAK_REWARD_BONUS_STEP,
  XP_LEVEL_THRESHOLDS,
  getStreakRewardBonus,
  getXpLevel,
  getXpThresholdForLevel,
  isStreakRewardMilestone,
} from "../game";

describe("XP curve", () => {
  it("uses a config object instead of an array", () => {
    expect(Array.isArray(XP_LEVEL_THRESHOLDS)).toBe(false);
    expect(XP_LEVEL_THRESHOLDS.basePerLevel).toBeGreaterThan(0);
    expect(XP_LEVEL_THRESHOLDS.growthPerLevel).toBeGreaterThan(0);
  });

  it("increases required XP slightly more for each level", () => {
    for (let level = 2; level < 10; level++) {
      const previousDelta = getXpThresholdForLevel(level) - getXpThresholdForLevel(level - 1);
      const currentDelta = getXpThresholdForLevel(level + 1) - getXpThresholdForLevel(level);

      expect(currentDelta - previousDelta).toBe(XP_LEVEL_THRESHOLDS.growthPerLevel);
    }
  });

  it("calculates level progress correctly at exact level boundaries", () => {
    const level = 8;
    const boundaryXp = getXpThresholdForLevel(level);
    const xp = getXpLevel(boundaryXp);

    expect(xp.level).toBe(level);
    expect(xp.currentXp).toBe(0);
    expect(xp.progressPct).toBe(0);
    expect(xp.nextLevelXp).toBe(getXpThresholdForLevel(level + 1) - getXpThresholdForLevel(level));
  });

  it("supports unbounded levels without max-level capping", () => {
    const targetLevel = 50;
    const threshold = getXpThresholdForLevel(targetLevel);
    const result = getXpLevel(threshold + 5);

    expect(result.level).toBe(targetLevel);
    expect(result.currentXp).toBe(5);
    expect(result.nextLevelXp).toBe(getXpThresholdForLevel(targetLevel + 1) - threshold);
    expect(result.progressPct).toBeGreaterThan(0);
    expect(result.progressPct).toBeLessThan(1);
  });
});

describe("streak rewards", () => {
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
