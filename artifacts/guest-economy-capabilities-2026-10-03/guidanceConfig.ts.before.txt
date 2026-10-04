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

/** Ordered tooltips shown during the main game tour. */
export const GAME_TOUR: readonly TooltipId[] = ["gameCoins", "gameHint", "submitAnswer", "gameSkip"];

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
export function createTooltipTourStorageKey(tourName: string, userId?: string): string {
  /** Provides version behavior. */
  const version = tourName === "profileTour" ? PROFILE_TOOLTIP_TOUR_VERSION : TOOLTIP_TOUR_VERSION;
  return createGuidanceStorageKey(`tooltipSequenceSeen:${tourName}:${version}`, userId);
}

/** Returns the onboarding step count for registered and guest players. */
export function getOnboardingTotalSteps(): number {
  return 2;
}

/** Omits actions unavailable in the current mode or platform's commerce capability. */
export function getGameTour(gameMode: GameSessionState["gameMode"], commerceAvailable = true): TooltipId[] {
  return GAME_TOUR.filter((id) =>
    (gameMode !== "challenge" || id !== "gameSkip") && (commerceAvailable || id !== "gameCoins"));
}

/** Avoids advertising a coin shop when the active provider has no checkout. */
export function getProfileTour(commerceAvailable = true): TooltipId[] {
  return PROFILE_TOUR.filter((id) => commerceAvailable || id !== "profileTreasure");
}

/** Returns contextual tooltip candidates in their display priority order. */
export function getContextualTooltipCandidates(
  state: Pick<GameSessionState, "gameMode" | "guesses" | "lastOutcome" | "lastRewards" | "profile">,
  modal: GameModal,
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
      id: "hintAfterWrongGuess",
      when: modal === null && state.guesses.length > 0 && !state.lastOutcome,
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
  /** Profile scrolling can leave an above-target step without enough room; use the clear side when available. */
  const preferredTop = preferBelow || (activeTooltip.startsWith("profile") && aboveTop < 14 && fitsBelow)
    ? belowTop : aboveTop;
  return {top: Math.max(14, Math.min(preferredTop, viewportHeight - panelHeight - 14))};
}
