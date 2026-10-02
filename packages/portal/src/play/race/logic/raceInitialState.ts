import {preserveRaceEntrySelection} from "./raceEntrySelection";
import type {RaceSessionEntry, RaceSessionState} from "../RaceSession.types";

/** Retiring discovery resets its attribution and recovery UI while preserving the selected hub. */
export const idleRaceDiscovery = (stage: RaceSessionState["stage"]): Partial<RaceSessionState> =>
  ({stage, activeChallengeId: undefined, challenge: null, findingOpponent: false,
    matchSearchStatus: "idle", matchFailure: null, matchRetryReady: true, error: null});

/** Copies presentation state while reflecting the private transport recovery barrier. */
export const updateRaceSessionState = (state: RaceSessionState, patch: Partial<RaceSessionState>, requiresRunRefresh: boolean): RaceSessionState => {
  /** Capture private accepted entry facts before the next snapshot reaches observers. */
  const next = {...state, ...patch, requiresRunRefresh};
  preserveRaceEntrySelection(state, next, patch);
  return next;
};

/** Builds a complete fresh player journey without dispatching commands or hydrating authority. */
export const initialRaceSessionState = (entry: RaceSessionEntry, now: number): RaceSessionState => {
    return {stage: entry.tournamentLocale ? "tournaments" : entry.openInbox ? "inbox" : entry.challengeId ? "challenge" : "categories",
      activeChallengeId: entry.tournamentLocale || entry.openInbox ? undefined : entry.challengeId,
      entryStatus: null, challenge: null, categories: entry.initialCategories ?? [], inboxItems: [], run: null, outcome: null,
      receivedAtMs: now, adjustedNow: 0, currentLetters: [], activeSlotIndex: 0, raceGuesses: [],
      feedback: null, penaltyFlash: null,
      error: entry.tournamentLocale && entry.tournamentLocale !== entry.locale ? "RaceTo10.ERROR_LOCALE_MISMATCH" : null,
      safetyNotice: null, safetyTargetUserId: null,
      pending: null, raceGuessLoading: false, allowTypingWhilePending: false, requiresRunRefresh: false,
      countdown: 3, loadingProgress: 0, countdownReady: false, closeAfterStart: false,
      quitConfirmationOpen: false, publishRequested: false, published: null, findingOpponent: false,
      matchSearchStatus: "idle", matchFailure: null, matchRetryReady: true};
};

/** Publishes a fresh snapshot only while clock and reset observers retain its journey. */
export const resetOwnedRaceState = (
  entry: RaceSessionEntry,
  now: () => number,
  current: () => boolean,
  publish: (state: RaceSessionState) => void,
  retained?: Pick<RaceSessionState, "categories" | "inboxItems">,
): boolean => {
  if (!current()) return false;
  /** Capture reset time before any new snapshot can reach observers. */
  const receivedAt = now();
  if (!current()) return false;
  /** Retained catalog and Activity lists belong only to the originating reset. */
  const state = {...initialRaceSessionState(entry, receivedAt), ...retained};
  if (!current()) return false;
  publish(state);
  return current();
};
