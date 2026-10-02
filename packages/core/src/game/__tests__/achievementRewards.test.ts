import {countCoinRewardAchievements} from "../achievementRewards";

describe("achievement coin eligibility", () => {
  it("excludes all hint badges, including unlocks discovered during completion", () => {
    expect(countCoinRewardAchievements(["hint_user", "hints_10", "hints_25"])).toBe(0);
    expect(countCoinRewardAchievements(["hint_user", "first_win", "hints_10", "race_debut", "hints_25"])).toBe(2);
  });
  it("preserves ordinary badge rewards and empty unlock batches", () => {
    expect(countCoinRewardAchievements(["first_win", "first_purchase", "race_clean_run"])).toBe(3);
    expect(countCoinRewardAchievements([])).toBe(0);
  });
});
