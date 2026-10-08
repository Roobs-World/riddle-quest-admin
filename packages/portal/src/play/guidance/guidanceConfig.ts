import type {CSSProperties} from "react";
import type {GameModal, GameSessionState} from "../gameSession";

/** Stable identifier for one tooltip or guided-tour step. */
export type TooltipId =
  | "submitAnswer"
  | "gameCoins"
  | "gameHint"
  | "gameSkip"
  | "hintAfterWrongGuess"
  | "achievementEarned"
  | "leaderboardFifthCorrectAnswer"
  | "classicFromDaily"
  | "profileProgression"
  | "profileIdentity"
  | "profileDailyPuzzles"
  | "profileStats"
  | "profileAchievements"
  | "profileRanks"
  | "profileStatistics"
  | "profileLeaderboard"
  | "profileTreasure";

/**
 * Ordered tooltips shown on a new player's first riddle.
 * @remarks The coin shop is deliberately absent so new players go straight into
 * play; it is introduced contextually at the start of a riddle after their first win.
 */
export const GAME_TOUR: readonly TooltipId[] = ["gameHint", "submitAnswer", "gameSkip"];

/** Profile steps whose card must never overlap the control it explains. */
const SEPARATED_PROFILE_TOOLTIPS = new Set<TooltipId>([
  "profileAchievements", "profileRanks", "profileStatistics", "profileLeaderboard", "profileTreasure",
]);

/** Tooltips positioned above their highlighted target. */
export const ABOVE_TARGET_TOOLTIPS = new Set<TooltipId>([
  "gameHint", "submitAnswer", "gameSkip",
  "profileAchievements", "profileStatistics", "profileLeaderboard", "profileTreasure",
]);

/** Ordered tooltips shown during the profile tour. */
export const PROFILE_TOUR: readonly TooltipId[] = [
  "profileIdentity",
  "profileProgression",
  "profileDailyPuzzles",
  "profileStats",
  "profileAchievements",
  "profileRanks",
  "profileStatistics",
  "profileLeaderboard",
  "profileTreasure",
];

/** Version used to invalidate previously completed tooltip tours. */
export const TOOLTIP_TOUR_VERSION = "v2";

/** Profile-specific version so a new profile step does not replay the game tour. */
export const PROFILE_TOOLTIP_TOUR_VERSION = "v3";

/** Game-tour version without the coin shop step. */
export const GAME_TOOLTIP_TOUR_VERSION = "v3";

/** Superseded game tour version that still counts as seen and already showed the coin shop step. */
const LEGACY_GAME_TOOLTIP_TOUR_VERSION = "v2";

/** Translation keys for every tooltip title and body. */
export const TOOLTIP_KEYS: Record<TooltipId, readonly [title: string, body: string]> = {
  submitAnswer: ["Tooltips.SUBMIT_ANSWER_TITLE", "Tooltips.SUBMIT_ANSWER_BODY"],
  gameCoins: ["Tooltips.GAME_COINS_TITLE", "Tooltips.GAME_COINS_BODY"],
  gameHint: ["Tooltips.GAME_HINT_TITLE", "Tooltips.GAME_HINT_BODY"],
  gameSkip: ["Tooltips.GAME_SKIP_TITLE", "Tooltips.GAME_SKIP_BODY"],
  hintAfterWrongGuess: ["Tooltips.HINT_AFTER_WRONG_TITLE", "Tooltips.HINT_AFTER_WRONG_BODY"],
  achievementEarned: ["Tooltips.ACHIEVEMENT_EARNED_TITLE", "Tooltips.ACHIEVEMENT_EARNED_BODY"],
  leaderboardFifthCorrectAnswer: [
    "Tooltips.LEADERBOARD_FIFTH_CORRECT_TITLE",
    "Tooltips.LEADERBOARD_FIFTH_CORRECT_BODY",
  ],
  classicFromDaily: ["Tooltips.CLASSIC_FROM_DAILY_TITLE", "Tooltips.CLASSIC_FROM_DAILY_BODY"],
  profileProgression: ["Tooltips.PROFILE_PROGRESSION_TITLE", "Tooltips.PROFILE_PROGRESSION_BODY"],
  profileIdentity: ["Tooltips.PROFILE_IDENTITY_TITLE", "Tooltips.PROFILE_IDENTITY_BODY"],
  profileDailyPuzzles: ["Tooltips.PROFILE_DAILY_PUZZLES_TITLE", "Tooltips.PROFILE_DAILY_PUZZLES_BODY"],
  profileStats: ["Tooltips.PROFILE_STATS_TITLE", "Tooltips.PROFILE_STATS_BODY"],
  profileAchievements: ["Tooltips.PROFILE_ACHIEVEMENTS_TITLE", "Tooltips.PROFILE_ACHIEVEMENTS_BODY"],
  profileRanks: ["Ranks.TITLE", "Tooltips.PROFILE_RANKS_BODY"],
  profileStatistics: ["Tooltips.PROFILE_STATISTICS_TITLE", "Tooltips.PROFILE_STATISTICS_BODY"],
  profileLeaderboard: ["Tooltips.PROFILE_LEADERBOARD_TITLE", "Tooltips.PROFILE_LEADERBOARD_BODY"],
  profileTreasure: ["Profile.TREASURE_CHEST_TITLE", "Tooltips.PROFILE_TREASURE_BODY"],
};

/** DOM selector for tooltips that highlight an existing control. */
export const TOOLTIP_SELECTORS: Partial<Record<TooltipId, string>> = {
  gameCoins: "[data-tooltip='gameCoins']",
  gameHint: "[data-tooltip='gameHint']",
  submitAnswer: "[data-tooltip='submitAnswer']",
  gameSkip: "[data-tooltip='gameSkip']",
  achievementEarned: "[data-tooltip='achievementEarned']",
  profileIdentity: "[data-tooltip='profileIdentity']",
  profileProgression: "[data-tooltip='profileProgression']",
  profileDailyPuzzles: "[data-tooltip='profileDailyPuzzles']",
  profileStats: "[data-tooltip='profileStats']",
  profileAchievements: "[data-tooltip='profileAchievements']",
  profileRanks: "[data-tooltip='profileRanks']",
  profileStatistics: "[data-tooltip='profileStatistics']",
  profileLeaderboard: "[data-tooltip='profileLeaderboard']",
  profileTreasure: "[data-tooltip='profileTreasure']",
};

/** Builds a user-scoped persistence key for guidance state. */
export function createGuidanceStorageKey(kind: string, userId?: string): string {
  return `riddleQuest:${kind}:${userId ?? "anonymous"}`;
}

/** Builds the versioned persistence key for a completed tooltip tour. */
export function createTooltipTourStorageKey(tourName: string, userId?: string, version?: string): string {
  /** Provides resolved version behavior. */
  const resolvedVersion = version ?? (tourName === "profileTour" ? PROFILE_TOOLTIP_TOUR_VERSION
    : tourName === "gameTour" ? GAME_TOOLTIP_TOUR_VERSION : TOOLTIP_TOUR_VERSION);
  return createGuidanceStorageKey(`tooltipSequenceSeen:${tourName}:${resolvedVersion}`, userId);
}

/** Checks persisted guidance markers in local storage. */
export type GuidanceSeenReader = {
  /** Returns whether a marker was completed. */
  hasSeen(area: "local", key: string): boolean;
};

/** Returns whether the player completed the legacy game tour that opened with the coin shop step. */
function hasSeenLegacyGameTour(markers: GuidanceSeenReader, userId?: string): boolean {
  return markers.hasSeen("local", createTooltipTourStorageKey("gameTour", userId, LEGACY_GAME_TOOLTIP_TOUR_VERSION));
}

/** Returns whether a tour was completed, accepting the legacy game tour for returning players. */
export function hasSeenTooltipTour(markers: GuidanceSeenReader, tourName: string, userId?: string): boolean {
  return markers.hasSeen("local", createTooltipTourStorageKey(tourName, userId)) ||
    (tourName === "gameTour" && hasSeenLegacyGameTour(markers, userId));
}

/** Returns whether a contextual tooltip was dismissed or was already presented by the legacy game tour. */
export function hasSeenContextualTooltip(markers: GuidanceSeenReader, id: TooltipId, userId?: string): boolean {
  return markers.hasSeen("local", createGuidanceStorageKey(`tooltipSeen:${id}`, userId)) ||
    (id === "gameCoins" && hasSeenLegacyGameTour(markers, userId));
}

/** Returns the onboarding step count for registered and guest players. */
export function getOnboardingTotalSteps(): number {
  return 2;
}

/** Omits actions unavailable in the current mode or platform's commerce capability. */
export function getGameTour(gameMode: GameSessionState["gameMode"], commerceAvailable = true, economyAvailable = true): TooltipId[] {
  return GAME_TOUR.filter((id) =>
    (gameMode !== "challenge" || id !== "gameSkip") && (commerceAvailable || id !== "gameCoins") &&
    (economyAvailable || id === "submitAnswer"));
}

/** Avoids advertising a coin shop when the active provider has no checkout. */
export function getProfileTour(commerceAvailable = true): TooltipId[] {
  return PROFILE_TOUR.filter((id) => commerceAvailable || id !== "profileTreasure");
}

/** Returns contextual tooltip candidates in their display priority order. */
export function getContextualTooltipCandidates(
  state: Pick<GameSessionState, "gameMode" | "guesses" | "lastOutcome" | "lastRewards" | "products" | "profile" | "riddle">,
  modal: GameModal,
  economyAvailable = true,
): Array<{
  /** Stores id. */
  id: TooltipId; /** Stores when. */
  /** Stores when. */
  when: boolean;
}> {
  return [
    {
      id: "achievementEarned",
      when: modal === null && (state.lastRewards?.newlyUnlockedAchievementIds.length ?? 0) > 0,
    },
    {
      id: "leaderboardFifthCorrectAnswer",
      when:
        modal === null &&
        state.lastOutcome?.kind === "win" &&
        (state.profile?.totalWins ?? state.profile?.wins ?? 0) >= 5,
    },
    {
      id: "classicFromDaily",
      when: modal === null && state.lastOutcome?.kind === "win" && state.gameMode === "challenge",
    },
    {
      // The coin shop is introduced only after the player has won a level and earned coins, and never at
      // the stage transition: it waits until a later riddle has loaded and before its first guess.
      id: "gameCoins",
      when: economyAvailable && modal === null && state.products.length > 0 && state.riddle !== null &&
        !state.lastOutcome && state.guesses.length === 0 &&
        (state.profile?.totalWins ?? state.profile?.wins ?? 0) > 0,
    },
    {
      id: "hintAfterWrongGuess",
      when: economyAvailable && modal === null && state.guesses.length > 0 && !state.lastOutcome,
    },
  ];
}

/** Calculates tooltip panel placement from an optional highlighted target. */
export function getTooltipPanelStyle(
  activeTooltip: TooltipId,
  targetRect: Pick<DOMRect, "bottom" | "top"> | null,
  viewportHeight: number,
  panelHeight: number,
): CSSProperties {
  if (!targetRect) return {top: "50%", transform: "translate(-50%, -50%)"};
  /** Preferred placement, clamped to keep the entire card and button reachable. */
  const belowTop = targetRect.bottom + 18;
  /** Provides above top behavior. */
  const aboveTop = targetRect.top - panelHeight - 18;
  /** Provides fits below behavior. */
  const fitsBelow = belowTop + panelHeight <= viewportHeight - 14;
  /** Provides prefer below behavior. */
  const preferBelow = !ABOVE_TARGET_TOOLTIPS.has(activeTooltip) && targetRect.bottom < viewportHeight * 0.58;
  if (aboveTop < 14 && !fitsBelow && SEPARATED_PROFILE_TOOLTIPS.has(activeTooltip) &&
    targetRect.top >= 0 && targetRect.bottom <= viewportHeight) {
    // Neither side fits on a short phone: never cover the highlighted control.
    // Use the roomier side and let the card scroll within it instead.
    /** Space between the top margin and the target. */
    const roomAbove = Math.floor(targetRect.top - 18 - 14);
    /** Space between the target and the bottom margin. */
    const roomBelow = Math.floor(viewportHeight - 14 - belowTop);
    return roomBelow >= roomAbove
      ? {top: belowTop, maxHeight: roomBelow, overflowY: "auto"}
      : {top: 14, maxHeight: roomAbove, overflowY: "auto"};
  }
  /** Profile scrolling can leave an above-target step without enough room; use the clear side when available. */
  const preferredTop = preferBelow || (activeTooltip.startsWith("profile") && aboveTop < 14 && fitsBelow)
    ? belowTop : aboveTop;
  return {top: Math.max(14, Math.min(preferredTop, viewportHeight - panelHeight - 14))};
}
