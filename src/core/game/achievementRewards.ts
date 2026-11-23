/** Hint badges recognize usage without refunding their action cost. */
const NON_PAYING_ACHIEVEMENTS = new Set(["hint_user", "hints_10", "hints_25"]);

/** Counts coin-eligible badges while preserving all achievement unlocks. */
export function countCoinRewardAchievements(achievementIds: readonly string[]): number {
  return achievementIds.filter((id) => !NON_PAYING_ACHIEVEMENTS.has(id)).length;
}
