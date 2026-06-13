import {PLAYER_RANKS, getNextRankForLevel, getRankForLevel} from "../ranks";

describe("player ranks", () => {
  it("keeps rank thresholds in ascending order", () => {
    expect(PLAYER_RANKS.map((rank) => rank.minimumLevel)).toEqual([1, 3, 6, 10, 15, 21, 28, 36]);
  });

  it("resolves the highest rank unlocked by the current level", () => {
    expect(getRankForLevel(1).id).toBe("stargazer");
    expect(getRankForLevel(9).id).toBe("riddleScout");
    expect(getRankForLevel(36).id).toBe("questLegend");
    expect(getRankForLevel(999).id).toBe("questLegend");
  });

  it("returns the next locked rank or null at the top rank", () => {
    expect(getNextRankForLevel(10)?.id).toBe("oracle");
    expect(getNextRankForLevel(35)?.id).toBe("questLegend");
    expect(getNextRankForLevel(36)).toBeNull();
  });
});
