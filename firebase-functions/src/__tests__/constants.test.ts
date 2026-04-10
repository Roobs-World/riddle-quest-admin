import {
  XP_LEVEL_THRESHOLDS,
  getLevelFromXp,
  getXpThresholdForLevel,
} from "../constants";

describe("server XP curve", () => {
  it("uses an object config instead of threshold array", () => {
    expect(Array.isArray(XP_LEVEL_THRESHOLDS)).toBe(false);
    expect(XP_LEVEL_THRESHOLDS.basePerLevel).toBeGreaterThan(0);
    expect(XP_LEVEL_THRESHOLDS.growthPerLevel).toBeGreaterThan(0);
  });

  it("adds a slight increase to each next level requirement", () => {
    for (let level = 2; level < 10; level++) {
      const previousDelta =
        getXpThresholdForLevel(level) - getXpThresholdForLevel(level - 1);
      const currentDelta =
        getXpThresholdForLevel(level + 1) - getXpThresholdForLevel(level);

      expect(currentDelta - previousDelta).toBe(
        XP_LEVEL_THRESHOLDS.growthPerLevel
      );
    }
  });

  it("handles threshold boundaries correctly", () => {
    const level = 12;
    const threshold = getXpThresholdForLevel(level);

    expect(getLevelFromXp(threshold)).toBe(level);
    expect(getLevelFromXp(threshold - 1)).toBe(level - 1);
  });

  it("does not cap at a max level", () => {
    const veryHighLevel = 120;
    const threshold = getXpThresholdForLevel(veryHighLevel);

    expect(getLevelFromXp(threshold)).toBe(veryHighLevel);
    expect(getLevelFromXp(threshold + 999)).toBeGreaterThanOrEqual(veryHighLevel);
  });
});
