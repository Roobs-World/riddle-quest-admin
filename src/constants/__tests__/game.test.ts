import {XP_LEVEL_THRESHOLDS, getXpLevel, getXpThresholdForLevel} from "../game";

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
