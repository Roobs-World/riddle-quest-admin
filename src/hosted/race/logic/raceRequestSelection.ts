import type {RaceRunView} from "../../../core/race";
import type {RaceSessionState} from "../RaceSession.types";
import type {RaceOperation} from "./raceOperations";
import {raceEntryView, raceStartPreview} from "./raceEntrySelection";

/** Private command context is independent of mutable presentation selections. */
type RaceRequestSelection = {
  /** Correlated authority operation. */ operation: RaceOperation;
  /** Originally dispatched preferences. */ payload: Record<string, unknown>;
  /** Exact requested run when the operation targets an existing attempt. */ runId?: string;
};

/** Entry response selection comes from its private request rather than the current UI field. */
export function requestedRaceState(state: RaceSessionState, request: RaceRequestSelection): RaceSessionState {
  if (["raceBlock", "raceReport"].includes(request.operation) && typeof request.payload.targetUserId === "string")
    return {...state, safetyTargetUserId: request.payload.targetUserId};
  if (request.operation === "raceStart") {
    /** Creator starts have no challenge identity, regardless of mutable UI fields. */
    const challengeId = typeof request.payload.challengeId === "string" ? request.payload.challengeId : undefined;
    return {...state, activeChallengeId: challengeId, challenge: raceStartPreview(state, challengeId)};
  }
  return ["raceEntry", "raceInviteCancel", "raceChallenge"].includes(request.operation) && typeof request.payload.challengeId === "string"
    ? {...state, entryStatus: raceEntryView(state), activeChallengeId: request.payload.challengeId} : state;
}

/** Preserve exact requested run, role and category checks before authority is adopted. */
export function assertRequestedRaceRun(request: RaceRequestSelection, run: RaceRunView | null | undefined): void {
  if (!run) return;
  if (request.runId && run.runId !== request.runId) throw new Error("Wrong requested run");
  if (request.operation === "raceStart" &&
    (run.challengeId !== request.payload.challengeId || run.rivalryChallengeId !== request.payload.rivalryChallengeId ||
      Boolean(run.opponent) !== Boolean(request.payload.challengeId || request.payload.fallbackOfferId) ||
      run.role !== (request.payload.challengeId || request.payload.fallbackOfferId ? "challenger" : "creator") ||
      request.payload.categoryId && run.categoryId !== request.payload.categoryId)) throw new Error("Wrong start selection");
}
