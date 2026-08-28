import {describe, expect, it} from "@jest/globals";
import {createInitialGameSession} from "../gameSession";
import {
  createGuidanceStorageKey,
  createTooltipTourStorageKey,
  getContextualTooltipCandidates,
  getGameTour,
  getOnboardingTotalSteps,
  getTooltipPanelStyle,
} from "../guidance/guidanceConfig";

describe("guidance configuration", () => {
  it("builds anonymous and user-scoped storage keys", () => {
    expect(createGuidanceStorageKey("onboarding")).toBe("riddleQuest:onboarding:anonymous");
    expect(createGuidanceStorageKey("onboarding", "user-1")).toBe("riddleQuest:onboarding:user-1");
    expect(createTooltipTourStorageKey("gameTour", "user-1")).toBe(
      "riddleQuest:tooltipSequenceSeen:gameTour:v2:user-1",
    );
  });

  it("selects onboarding and game tour steps for each player mode", () => {
    expect(getOnboardingTotalSteps(2, true)).toBe(3);
    expect(getOnboardingTotalSteps(0, false)).toBe(3);
    expect(getOnboardingTotalSteps(0, true)).toBe(2);
    expect(getGameTour("classic")).toEqual(["gameCoins", "gameHint", "submitAnswer", "gameSkip"]);
    expect(getGameTour("challenge")).toEqual(["gameCoins", "gameHint", "submitAnswer"]);
  });

  it("derives contextual tooltip eligibility in priority order", () => {
    /** Provides base state behavior. */
    const baseState = createInitialGameSession();
    expect(getContextualTooltipCandidates(baseState, null).map(({when}) => when)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);

    /** Provides achievement state behavior. */
    const achievementState = {
      ...baseState,
      lastRewards: {coinsEarned: 1, newlyUnlockedAchievementIds: ["first_win"]},
    };
    expect(getContextualTooltipCandidates(achievementState, null)[0]?.when).toBe(true);

    /** Provides win state behavior. */
    const winState = {
      ...baseState,
      gameMode: "challenge" as const,
      lastOutcome: {
        id: "win-1",
        kind: "win" as const,
        riddleId: "riddle-1",
        gameMode: "challenge" as const,
        attempts: 2,
        isCorrect: true,
      },
      profile: {totalWins: 5, wins: 5} as typeof baseState.profile,
    };
    /** Provides win candidates behavior. */
    const winCandidates = getContextualTooltipCandidates(winState, null);
    expect(winCandidates[1]?.when).toBe(true);
    expect(winCandidates[2]?.when).toBe(true);
    expect(
      getContextualTooltipCandidates(
        {
          ...winState,
          profile: {wins: 5} as typeof baseState.profile,
        },
        null,
      )[1]?.when,
    ).toBe(true);
    expect(getContextualTooltipCandidates({...winState, profile: null}, null)[1]?.when).toBe(false);

    expect(getContextualTooltipCandidates({...baseState, profile: null}, "shop")[3]?.when).toBe(true);
    expect(
      getContextualTooltipCandidates(
        {
          ...baseState,
          profile: {coins: 4} as typeof baseState.profile,
        },
        "shop",
      )[3]?.when,
    ).toBe(false);
    expect(
      getContextualTooltipCandidates(
        {
          ...baseState,
          guesses: [{}] as typeof baseState.guesses,
        },
        null,
      )[4]?.when,
    ).toBe(true);
  });

  it("positions tooltip panels below, above, or centrally", () => {
    expect(getTooltipPanelStyle("profileStats", null, 1000)).toEqual({top: "50%", transform: "translate(-50%, -50%)"});
    expect(getTooltipPanelStyle("profileStats", {top: 100, bottom: 200}, 1000)).toEqual({top: 218});
    expect(getTooltipPanelStyle("gameHint", {top: 100, bottom: 200}, 1000)).toEqual({bottom: 918});
    expect(getTooltipPanelStyle("profileStats", {top: 700, bottom: 800}, 1000)).toEqual({bottom: 318});
  });
});
