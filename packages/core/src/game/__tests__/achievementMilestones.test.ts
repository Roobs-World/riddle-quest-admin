import {findNewMilestoneAchievementIds} from "../achievementMilestones";

describe("additional milestone rules", () => {
  it("handles absent and empty legacy stats without awarding progress", () => {
    expect(findNewMilestoneAchievementIds(undefined, [])).toEqual([]);
    expect(findNewMilestoneAchievementIds(null, [])).toEqual([]);
    expect(findNewMilestoneAchievementIds({}, [])).toEqual([]);
  });

  it("awards crossed milestones together and excludes previously unlocked IDs", () => {
    expect(findNewMilestoneAchievementIds({totalWins: 250, highestLevelClassic: 150}, ["wins_10", "classic_5"])).toEqual([
      "wins_250", "classic_150",
    ]);
  });

  it("rejects invalid runtime counters", () => {
    expect(findNewMilestoneAchievementIds({totalWins: Number.NaN, xp: -1, bestStreak: 0}, [])).toEqual([]);
  });
});
