import type {RaceMatchFailure, RaceMatchRequest, RaceRecoveryIntent} from "../../../core/race";
import type {MatchmakingCapability} from "../matchmaking";
import type {RaceSessionState} from "../RaceSession.types";
import {raceMatchErrorKey} from "../RaceSessionAuthority";

/** Private provider selection and accepted recovery facts for one discovery receipt. */
export type RaceMatchIntent = {
  /** Authenticated provider adapter selected by the current session. */ adapter: MatchmakingCapability;
  /** Exact preferences and receipt reused for same-intent recovery. */ request: RaceMatchRequest;
  /** Earliest permitted retry on the session's monotonic clock. */ retryAtMs: number;
  /** Accepted recovery policy is private even when displayed guidance is edited. */ failure?: RaceMatchFailure;
};

/** The same accepted policy drives retry dispatch and derived presentation readiness. */
export function canRetryRaceMatch(intent: RaceMatchIntent, now: number): boolean {
  return Boolean(intent.failure && intent.failure.recovery !== "none" && now >= intent.retryAtMs);
}

/** Explicit policy rotation leaves same-intent transport receipts unchanged. */
export function retryRaceMatchIntent(intent: RaceMatchIntent, requestId: () => string): RaceMatchIntent {
  return intent.failure?.recovery === "new-intent" ? {...intent, request: {...intent.request, requestId: requestId()}} : intent;
}

/** Retained wall-clock hints can shorten, but never extend, the accepted retry delay. */
export function restoredRaceFailure(failure: RaceMatchFailure, retryAtMs: number | undefined, now: number): RaceMatchFailure {
  return {...failure, retryAfterMs: Math.max(0, Math.min(failure.retryAfterMs, (retryAtMs ?? now) - now))};
}

/** Only an idle category hub may issue its missing catalog read. */
export function needsRaceCatalog(state: RaceSessionState): boolean {
  return state.stage === "categories" && !state.categories.length && !state.pending && !state.findingOpponent;
}

/** Catalog delivery ends its own diagnostic and restores the privately accepted search guidance. */
export function recoveredRaceCatalog(state: RaceSessionState, intent: RaceMatchIntent | null): Partial<RaceSessionState> {
  return {error: intent?.failure ? state.matchSearchStatus === "empty" ? "RaceTo10.MATCH_EMPTY" : raceMatchErrorKey(intent.failure) : null};
}

/** Publish copied failure guidance without exposing the privately accepted recovery policy. */
export function failedRaceDiscovery(failure: RaceMatchFailure, error: string): Partial<RaceSessionState> {
  return {matchSearchStatus: "failed", matchFailure: structuredClone(failure),
    matchRetryReady: failure.recovery !== "none" && failure.retryAfterMs === 0, error};
}

/** Keep policy and monotonic cooldown private before preparing its optional persisted hint. */
export function failedRaceRecovery(intent: RaceMatchIntent, failure: RaceMatchFailure, now: number, wallNow: () => number): RaceRecoveryIntent | null {
  intent.failure = structuredClone(failure);
  intent.retryAtMs = now + failure.retryAfterMs;
  return failure.recovery === "none" ? null : {kind: "search", request: intent.request, failure, retryAtMs: wallNow() + failure.retryAfterMs};
}
