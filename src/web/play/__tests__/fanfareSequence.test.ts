import {describe, expect, it} from "@jest/globals";
import type {GameSessionState} from "../../../hosted/play/gameSession";
import {
  createRewardFanfareSteps,
  createVictoryFanfareSteps,
  getActiveCoinAward,
  getActiveFanfareStep,
  isFanfareModal,
  type FanfareAwardState,
  type FanfareStep,
} from "../modalPages/fanfare/fanfareSequence";

/** Creates the minimal state needed to resolve a fanfare coin award. */
function createAwardState(overrides: Partial<FanfareAwardState> = {}): FanfareAwardState {
  return {
    auxiliaryFanfare: null,
    lastOutcome: null,
    lastRewards: null,
    modal: null,
    profile: null,
    ...overrides,
  };
}

describe("fanfare sequence", () => {
  it("builds victory steps in display order", () => {
    expect(createVictoryFanfareSteps(null)).toEqual([{kind: "victory"}]);
    expect(
      createVictoryFanfareSteps({
        coinsEarned: 10,
        newlyUnlockedAchievementIds: [],
      }),
    ).toEqual([{kind: "victory"}]);
    expect(
      createVictoryFanfareSteps({
        coinsEarned: 10,
        newlyUnlockedAchievementIds: ["first_win"],
      }),
    ).toEqual([{kind: "victory"}, {kind: "achievement", achievementId: "first_win"}]);
    expect(
      createVictoryFanfareSteps({
        coinsEarned: 10,
        leveledUp: true,
        newLevel: 2,
        newlyUnlockedAchievementIds: [],
      }),
    ).toEqual([{kind: "victory"}, {kind: "level"}]);
  });

  it("shows level-up only on an actual level-up", () => {
    expect(
      createVictoryFanfareSteps({
        coinsEarned: 25,
        leveledUp: false,
        newLevel: 4,
        newXp: 380,
        newlyUnlockedAchievementIds: [],
      }),
    ).toEqual([{kind: "victory"}]);
    expect(
      createVictoryFanfareSteps({
        coinsEarned: 25,
        newLevel: 6,
        newlyUnlockedAchievementIds: [],
      }),
    ).toEqual([{kind: "victory"}]);
  });

  it("queues every milestone in order without dropping achievements", () => {
    /** Every follow-up candidate fires on the same completion. */
    const crowdedReward = {
      coinsEarned: 125,
      leveledUp: true,
      newLevel: 3,
      newlyUnlockedAchievementIds: ["first_win", "perfect_guess", "classic_perfect"],
    };
    expect(createVictoryFanfareSteps(crowdedReward)).toEqual([
      {kind: "victory"},
      {kind: "level"},
      {kind: "achievement", achievementId: "first_win"},
      {kind: "achievement", achievementId: "perfect_guess"},
      {kind: "achievement", achievementId: "classic_perfect"},
    ]);
    expect(createVictoryFanfareSteps({...crowdedReward, leveledUp: false})).toEqual([
      {kind: "victory"},
      {kind: "achievement", achievementId: "first_win"},
      {kind: "achievement", achievementId: "perfect_guess"},
      {kind: "achievement", achievementId: "classic_perfect"},
    ]);
  });

  it("queues First Win after the level-up the server reports for a first win", () => {
    expect(
      createVictoryFanfareSteps({
        coinsEarned: 10,
        leveledUp: true,
        newLevel: 2,
        newlyUnlockedAchievementIds: ["first_win"],
      }),
    ).toEqual([{kind: "victory"}, {kind: "level"}, {kind: "achievement", achievementId: "first_win"}]);
  });

  it("builds purchase and achievement reward steps", () => {
    expect(createRewardFanfareSteps(null)).toEqual([]);
    expect(
      createRewardFanfareSteps({
        id: "purchase-1",
        kind: "purchase",
        coinsAwarded: 100,
        totalCoins: 250,
        achievementIds: ["collector"],
      }),
    ).toEqual([{kind: "purchase"}, {kind: "achievement", achievementId: "collector"}]);
    expect(
      createRewardFanfareSteps({
        id: "achievement-1",
        kind: "achievement",
        coinsAwarded: 25,
        totalCoins: 250,
        achievementIds: ["first_win"],
      }),
    ).toEqual([{kind: "achievement", achievementId: "first_win"}, {kind: "coins"}]);
    expect(
      createRewardFanfareSteps({
        id: "achievement-2",
        kind: "achievement",
        coinsAwarded: 0,
        totalCoins: 250,
        achievementIds: [],
      }),
    ).toEqual([]);
  });

  it("clamps active sequence indices", () => {
    /** Provides steps behavior. */
    const steps: FanfareStep[] = [{kind: "victory"}, {kind: "level"}];
    expect(getActiveFanfareStep([], 0)).toBeUndefined();
    expect(getActiveFanfareStep(steps, -4)).toEqual({kind: "victory"});
    expect(getActiveFanfareStep(steps, 9)).toEqual({kind: "level"});
  });

  it("resolves victory and auxiliary coin awards", () => {
    /** Provides victory reward behavior. */
    const victoryReward: NonNullable<GameSessionState["lastRewards"]> = {
      coinsEarned: 30,
      totalCoins: 130,
      newlyUnlockedAchievementIds: [],
    };
    expect(
      getActiveCoinAward(
        createAwardState({
          modal: "victory",
          lastOutcome: {
            id: "win-1",
            kind: "win",
            riddleId: "riddle-1",
            gameMode: "classic",
            attempts: 2,
            isCorrect: true,
          },
          lastRewards: victoryReward,
        }),
        {kind: "victory"},
        undefined,
      ),
    ).toEqual({id: "victory-win-1", amount: 30, total: 130});

    expect(
      getActiveCoinAward(
        createAwardState({
          modal: "victory",
          profile: {coins: 9} as GameSessionState["profile"],
        }),
        {kind: "victory"},
        undefined,
      ),
    ).toEqual({id: "victory-current", amount: 0, total: 9});

    expect(
      getActiveCoinAward(
        createAwardState({
          modal: "victory",
          lastRewards: {...victoryReward, totalCoins: undefined},
          profile: {coins: 12} as GameSessionState["profile"],
        }),
        {kind: "victory"},
        undefined,
      ),
    ).toEqual({id: "victory-current", amount: 30, total: 12});

    expect(
      getActiveCoinAward(
        createAwardState({
          modal: "victory",
          lastRewards: {...victoryReward, totalCoins: undefined},
        }),
        {kind: "victory"},
        undefined,
      ),
    ).toEqual({id: "victory-current", amount: 30, total: 0});

    expect(
      getActiveCoinAward(
        createAwardState({
          modal: "reward",
          auxiliaryFanfare: {
            id: "purchase-1",
            kind: "purchase",
            coinsAwarded: 50,
            totalCoins: 80,
            achievementIds: [],
          },
        }),
        undefined,
        {kind: "purchase"},
      ),
    ).toEqual({id: "purchase-1-purchase", amount: 50, total: 80});

    expect(getActiveCoinAward(createAwardState({modal: "reward"}), undefined, {kind: "coins"})).toEqual({
      id: "reward-coins",
      amount: 0,
      total: 0,
    });
    expect(getActiveCoinAward(createAwardState({modal: "shop"}), {kind: "victory"}, {kind: "coins"})).toBeNull();
  });

  it("identifies fanfare modal kinds", () => {
    expect(isFanfareModal("victory")).toBe(true);
    expect(isFanfareModal("reward")).toBe(true);
    expect(isFanfareModal("profile")).toBe(false);
  });
});
