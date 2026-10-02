import {describe, expect, it} from "@jest/globals";
import {createInitialGameSession} from "../gameSession";
import {
  createGuidanceStorageKey,
  createTooltipTourStorageKey,
  getContextualTooltipCandidates,
  getGameTour,
  getProfileTour,
  getOnboardingTotalSteps,
  getTooltipPanelStyle,
  PROFILE_TOUR,
} from "../guidance/guidanceConfig";

describe("guidance configuration", () => {
  it("builds anonymous and user-scoped storage keys", () => {
    expect(createGuidanceStorageKey("onboarding")).toBe("riddleQuest:onboarding:anonymous");
    expect(createGuidanceStorageKey("onboarding", "user-1")).toBe("riddleQuest:onboarding:user-1");
    expect(createTooltipTourStorageKey("gameTour", "user-1")).toBe(
      "riddleQuest:tooltipSequenceSeen:gameTour:v2:user-1",
    );
    expect(createTooltipTourStorageKey("profileTour", "user-1")).toBe(
      "riddleQuest:tooltipSequenceSeen:profileTour:v3:user-1",
    );
  });

  it("selects onboarding and game tour steps for each player mode", () => {
    expect(getOnboardingTotalSteps()).toBe(2);
    expect(getGameTour("classic")).toEqual(["gameCoins", "gameHint", "submitAnswer", "gameSkip"]);
    expect(getGameTour("challenge")).toEqual(["gameCoins", "gameHint", "submitAnswer"]);
    expect(getGameTour("classic", false)).toEqual(["gameHint", "submitAnswer", "gameSkip"]);
    expect(getGameTour("challenge", false)).toEqual(["gameHint", "submitAnswer"]);
    expect(getProfileTour()).toEqual(PROFILE_TOUR);
    expect(getProfileTour(false)).toEqual(PROFILE_TOUR.filter(id => id !== "profileTreasure"));
  });

  it("shows ranks immediately after achievements in the profile tour", () => {
    /** Provides achievements index behavior. */
    const achievementsIndex = PROFILE_TOUR.indexOf("profileAchievements");
    expect(PROFILE_TOUR[achievementsIndex + 1]).toBe("profileRanks");
  });

  it("derives contextual tooltip eligibility in priority order", () => {
    /** Provides base state behavior. */
    const baseState = createInitialGameSession();
    expect(getContextualTooltipCandidates(baseState, null).map(({when}) => when)).toEqual([
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

    expect(getContextualTooltipCandidates({...baseState, profile: null}, "shop").some(({when}) => when)).toBe(false);
    expect(
      getContextualTooltipCandidates(
        {...baseState, profile: {coins: 0} as typeof baseState.profile},
        "shop",
      ).some(({when}) => when),
    ).toBe(false);
    expect(
      getContextualTooltipCandidates(
        {
          ...baseState,
          profile: {coins: 4} as typeof baseState.profile,
        },
        "shop",
      ).some(({when}) => when),
    ).toBe(false);
    expect(
      getContextualTooltipCandidates(
        {
          ...baseState,
          guesses: [{}] as typeof baseState.guesses,
        },
        null,
      )[3]?.when,
    ).toBe(true);
  });

  it("positions tooltip panels below, above, or centrally", () => {
    expect(getTooltipPanelStyle("profileStats", null, 1000, 200)).toEqual({top: "50%", transform: "translate(-50%, -50%)"});
    expect(getTooltipPanelStyle("profileStats", {top: 100, bottom: 200}, 1000, 200)).toEqual({top: 218});
    expect(getTooltipPanelStyle("gameHint", {top: 100, bottom: 200}, 1000, 200)).toEqual({top: 14});
    expect(getTooltipPanelStyle("profileAchievements", {top: 213, bottom: 253}, 568, 224)).toEqual({top: 271});
    expect(getTooltipPanelStyle("profileStats", {top: 700, bottom: 800}, 1000, 200)).toEqual({top: 482});
    expect(getTooltipPanelStyle("profileIdentity", {top: 200, bottom: 330}, 591, 380)).toEqual({top: 197});
    expect(getTooltipPanelStyle("profileTreasure", {top: 1200, bottom: 1300}, 591, 200)).toEqual({top: 377});
  });
});
