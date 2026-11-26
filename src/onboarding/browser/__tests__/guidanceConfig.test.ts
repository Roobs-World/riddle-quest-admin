import {describe, expect, it} from "@jest/globals";
import {createInitialGameSession} from "../../../gameplay/session/gameSession";
import {
  createGuidanceStorageKey,
  createTooltipTourStorageKey,
  getContextualTooltipCandidates,
  getGameTour,
  getProfileTour,
  getOnboardingTotalSteps,
  getTooltipPanelStyle,
  hasSeenContextualTooltip,
  hasSeenTooltipTour,
  PROFILE_TOUR,
} from "../guidanceConfig";
import type {ProductSummary} from "../../../platform/contracts/hostServices";

/** Provides a purchasable coin pack so shop guidance is eligible. */
const shopProduct: ProductSummary = {
  productId: "coins_small",
  name: "Coins",
  description: "A small coin pack",
  coins: 100,
  displayPrice: "$0.99",
};

/** Provides a completed classic win. */
const classicWin = {
  id: "classic-win-1",
  kind: "win" as const,
  riddleId: "riddle-1",
  gameMode: "classic" as const,
  sessionToken: "session-token-classic-win-0001",
  attempts: 2,
  isCorrect: true,
};

/** Creates an in-memory local guidance marker reader. */
const createMarkers = (seen: string[]) => ({hasSeen: (_area: "local", key: string) => seen.includes(key)});

describe("guidance configuration", () => {
  it("builds anonymous and user-scoped storage keys", () => {
    expect(createGuidanceStorageKey("onboarding")).toBe("riddleQuest:onboarding:anonymous");
    expect(createGuidanceStorageKey("onboarding", "user-1")).toBe("riddleQuest:onboarding:user-1");
    expect(createTooltipTourStorageKey("gameTour", "user-1")).toBe(
      "riddleQuest:tooltipSequenceSeen:gameTour:v4:user-1",
    );
    expect(createTooltipTourStorageKey("gameTour", "user-1", "v2")).toBe(
      "riddleQuest:tooltipSequenceSeen:gameTour:v2:user-1",
    );
    expect(createTooltipTourStorageKey("profileTour", "user-1")).toBe(
      "riddleQuest:tooltipSequenceSeen:profileTour:v3:user-1",
    );
    expect(createTooltipTourStorageKey("otherTour", "user-1")).toBe(
      "riddleQuest:tooltipSequenceSeen:otherTour:v2:user-1",
    );
  });

  it("selects onboarding and game tour steps for each player mode", () => {
    expect(getOnboardingTotalSteps()).toBe(2);
    expect(getGameTour("classic")).toEqual(["gameHint", "submitAnswer", "gameSkip"]);
    expect(getGameTour("challenge")).toEqual(["gameHint", "submitAnswer", "gameSkip"]);
    expect(getGameTour("classic", false)).toEqual(["gameHint", "submitAnswer", "gameSkip"]);
    expect(getGameTour("challenge", false)).toEqual(["gameHint", "submitAnswer", "gameSkip"]);
    expect(getGameTour("classic", false, false)).toEqual(["submitAnswer"]);
    expect(getGameTour("classic", true, false)).toEqual(["submitAnswer"]);
    expect(getGameTour("challenge", false, false)).toEqual(["submitAnswer", "gameSkip"]);
    expect(getGameTour("classic", true, true, true, true)).toEqual([
      "gameCoins", "gameHint", "submitAnswer", "gameSkip", "gameMultiplayer",
    ]);
    expect(getGameTour("challenge", true, true, true, true)).toEqual([
      "gameCoins", "gameHint", "submitAnswer", "gameSkip", "gameMultiplayer",
    ]);
    expect(getGameTour("classic", false, true, true, true)).toEqual([
      "gameHint", "submitAnswer", "gameSkip", "gameMultiplayer",
    ]);
    expect(getGameTour("classic", true, false, true, true)).toEqual(["submitAnswer", "gameMultiplayer"]);
    expect(getGameTour("challenge", true, false, true, true)).toEqual(["submitAnswer", "gameSkip", "gameMultiplayer"]);
    expect(getProfileTour()).toEqual(PROFILE_TOUR);
    expect(getProfileTour(false)).toEqual(PROFILE_TOUR.filter(id => id !== "profileTreasure"));
  });

  it("introduces the coin shop at the start of a later riddle, never before the first win", () => {
    expect(getGameTour("classic", true, true, true, false)).toEqual([
      "gameHint", "submitAnswer", "gameSkip", "gameMultiplayer",
    ]);
    expect(getGameTour("classic", true, true, true, true)).toEqual([
      "gameCoins", "gameHint", "submitAnswer", "gameSkip", "gameMultiplayer",
    ]);
    /** Provides first riddle state behavior. */
    const firstRiddle: ReturnType<typeof createInitialGameSession> = {
      ...createInitialGameSession(),
      products: [shopProduct],
      riddle: {riddleId: "riddle-2"} as NonNullable<ReturnType<typeof createInitialGameSession>["riddle"]>,
    };
    /** Provides coin tip eligibility behavior. */
    const coinTip = (
      state: typeof firstRiddle,
      modal: Parameters<typeof getContextualTooltipCandidates>[1],
      economy = true,
    ) =>
      getContextualTooltipCandidates(state, modal, economy).find(({id}) => id === "gameCoins")?.when;
    /** Provides profile with wins behavior. */
    const withWins = (totalWins: number, overrides: Partial<typeof firstRiddle> = {}) => ({
      ...firstRiddle,
      profile: {totalWins, wins: totalWins} as typeof firstRiddle.profile,
      ...overrides,
    });
    // Never before the first win.
    expect(coinTip(firstRiddle, null)).toBe(false);
    expect(coinTip(withWins(0), null)).toBe(false);
    expect(coinTip(withWins(0, {lastOutcome: classicWin}), null)).toBe(false);
    // Never at the stage transition: the won riddle is still on the board, with or without its popup.
    expect(coinTip(withWins(1, {lastOutcome: classicWin}), "victory")).toBe(false);
    expect(coinTip(withWins(1, {lastOutcome: classicWin}), null)).toBe(false);
    expect(coinTip(withWins(1, {lastOutcome: {...classicWin, kind: "loss", isCorrect: false}}), null)).toBe(false);
    // Only once a later riddle has loaded and the player has not guessed yet.
    expect(coinTip(withWins(1), null)).toBe(true);
    expect(coinTip(withWins(1, {riddle: null}), null)).toBe(false);
    expect(coinTip(withWins(1, {guesses: [{}] as typeof firstRiddle.guesses}), null)).toBe(false);
    expect(coinTip(withWins(1), "hint")).toBe(false);
    expect(coinTip(withWins(1, {products: []}), null)).toBe(false);
    expect(coinTip(withWins(1), null, false)).toBe(false);
    // Older profiles report wins without totalWins; profiles with neither count as no wins.
    expect(coinTip({...firstRiddle, profile: {wins: 2} as typeof firstRiddle.profile}, null)).toBe(true);
    expect(coinTip({...firstRiddle, profile: {} as typeof firstRiddle.profile}, null)).toBe(false);
  });

  it("reintroduces the current game tour while retaining legacy coin guidance markers", () => {
    expect(hasSeenTooltipTour(createMarkers([]), "gameTour", "user-1")).toBe(false);
    expect(hasSeenContextualTooltip(createMarkers([]), "gameCoins", "user-1")).toBe(false);
    /** Provides legacy markers behavior. */
    const legacy = createMarkers(["riddleQuest:tooltipSequenceSeen:gameTour:v2:user-1"]);
    expect(hasSeenTooltipTour(legacy, "gameTour", "user-1")).toBe(false);
    expect(hasSeenContextualTooltip(legacy, "gameCoins", "user-1")).toBe(true);
    expect(hasSeenContextualTooltip(legacy, "hintAfterWrongGuess", "user-1")).toBe(false);
    expect(hasSeenTooltipTour(legacy, "profileTour", "user-1")).toBe(false);
    /** The previous tour does not include the newly introduced Daily and multiplayer controls. */
    const previous = createMarkers(["riddleQuest:tooltipSequenceSeen:gameTour:v3:user-1"]);
    expect(hasSeenTooltipTour(previous, "gameTour", "user-1")).toBe(false);
    /** Current tour completion suppresses its replay without marking unseen coin guidance. */
    const current = createMarkers(["riddleQuest:tooltipSequenceSeen:gameTour:v4:user-1"]);
    expect(hasSeenTooltipTour(current, "gameTour", "user-1")).toBe(true);
    expect(hasSeenContextualTooltip(current, "gameCoins", "user-1")).toBe(false);
    expect(
      hasSeenContextualTooltip(
        createMarkers(["riddleQuest:tooltipSeen:gameCoins:user-1"]),
        "gameCoins",
        "user-1",
      ),
    ).toBe(true);
  });

  it("keeps wrong-answer hint guidance absent when the target has no economy", () => {
    /** A real wrong answer would normally qualify for the paid hint reminder. */
    const state = {...createInitialGameSession(), guesses: [{guess: ["Q"], feedback: ["red" as const]}]};
    expect(getContextualTooltipCandidates(state, null, false).find(candidate=>candidate.id==="hintAfterWrongGuess")?.when).toBe(false);
    expect(getContextualTooltipCandidates(state, null, true).find(candidate=>candidate.id==="hintAfterWrongGuess")?.when).toBe(true);
  });

  it("shows ranks immediately after achievements in the profile tour", () => {
    /** Provides achievements index behavior. */
    const achievementsIndex = PROFILE_TOUR.indexOf("profileAchievements");
    expect(PROFILE_TOUR[achievementsIndex + 1]).toBe("profileRanks");
  });

  it("derives contextual tooltip eligibility in priority order", () => {
    /** Provides base state behavior. */
    const baseState = createInitialGameSession();
    expect(getContextualTooltipCandidates(baseState, null).map(({id}) => id)).toEqual([
      "achievementEarned",
      "leaderboardFifthCorrectAnswer",
      "classicFromDaily",
      "gameCoins",
      "hintAfterWrongGuess",
    ]);
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
        sessionToken: "daily-win-session-token-0001",
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
      )[4]?.when,
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

  it("keeps the full profile card in view when neither side of its target fits", () => {
    expect(getTooltipPanelStyle("profileStatistics", {top: 243, bottom: 315}, 568, 230))
      .toEqual({top: 14});
    expect(getTooltipPanelStyle("profileStatistics", {top: 323, bottom: 395}, 568, 300))
      .toEqual({top: 14});
    expect(getTooltipPanelStyle("profileIdentity", {top: 200, bottom: 330}, 591, 380)).toEqual({top: 197});
  });

  it("preserves a full treasure card in the observed 424 by 452 hosted viewport", () => {
    // Representative target geometry from the hosted screenshot, not an exact DOM measurement.
    expect(getTooltipPanelStyle("profileTreasure", {top: 144, bottom: 342}, 452, 230))
      .toEqual({top: 14});
  });
});
