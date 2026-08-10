import {computeGuestCompletionRewards} from "../completionStrategies";

describe("computeGuestCompletionRewards", () => {
  it("uses the challenge reward and default score model", () => {
    expect(computeGuestCompletionRewards("challenge", 1, {
      challengeCoinReward: 75,
      classicCoinReward: 50,
    })).toEqual({coins: 75, score: 150});
  });

  it("uses classic overrides and clamps a late-attempt bonus to zero", () => {
    expect(computeGuestCompletionRewards("classic", 8, {
      challengeCoinReward: 75,
      classicCoinReward: 25,
      scoreMaxAttempts: 3,
      classicBaseScore: 80,
      challengeBaseScore: 200,
    })).toEqual({coins: 25, score: 80});
  });

  it("uses a custom challenge base score", () => {
    expect(computeGuestCompletionRewards("challenge", 2, {
      challengeCoinReward: 90,
      classicCoinReward: 40,
      scoreMaxAttempts: 4,
      challengeBaseScore: 120,
    })).toEqual({coins: 90, score: 150});
  });

  it("uses the default classic base score", () => {
    expect(computeGuestCompletionRewards("classic", 1, {
      challengeCoinReward: 90,
      classicCoinReward: 40,
    })).toEqual({coins: 40, score: 100});
  });
});
