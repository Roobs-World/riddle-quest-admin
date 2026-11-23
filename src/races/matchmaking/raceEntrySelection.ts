import type {RaceChallengePreview, RaceEntryResponse, RaceRunView} from "../contracts/index";
import type {RaceSessionState} from "../controllers/RaceSession.types.ts";

/** Accepted entry facts belong to the snapshot lifetime, independently of its exposed UI objects. */
const selections = new WeakMap<RaceSessionState, RaceEntryResponse>();
/** Waiting/terminal views omit identity, so retain their accepted request selection separately. */
const challengeIds = new WeakMap<RaceSessionState, string>();
/** Provider and direct-entry previews retain their authority before observers see them. */
const previews = new WeakMap<RaceSessionState, RaceChallengePreview>();

/** Copy accepted facts before publishing and carry them through unrelated presentation updates. */
export function preserveRaceEntrySelection(previous: RaceSessionState, next: RaceSessionState, patch: Partial<RaceSessionState>): void {
  if (Object.hasOwn(patch, "challenge")) {
    if (patch.challenge) previews.set(next, structuredClone(patch.challenge));
  } else {
    /** Unrelated view updates preserve the same accepted competitive recording. */
    const preview = previews.get(previous);
    if (preview) previews.set(next, preview);
  }
  if (Object.hasOwn(patch, "entryStatus")) {
    if (patch.entryStatus) {
      selections.set(next, structuredClone(patch.entryStatus));
      /** Authority response patches carry the original private command identity. */
      const challengeId = patch.activeChallengeId ?? challengeIds.get(previous) ?? previous.activeChallengeId;
      if (challengeId) challengeIds.set(next, challengeId);
    }
  } else {
    /** Previous public entry fields may already have been changed by a retained observer. */
    const selected = selections.get(previous);
    if (selected) selections.set(next, selected);
    /** Identity follows the same lifetime as accepted entry facts. */
    const challengeId = challengeIds.get(previous);
    if (challengeId) challengeIds.set(next, challengeId);
  }
}

/** Start validation receives only a copy of the accepted preview for the requested recording. */
export function raceStartPreview(state: RaceSessionState, challengeId: string | undefined): RaceChallengePreview | null {
  /** Another explicit challenge selection must not inherit the preceding preview. */
  const preview = previews.get(state);
  return preview && preview.challengeId === challengeId ? structuredClone(preview) : null;
}

/** Only the privately accepted pointer may authorize an automatic resume dispatch. */
export function existingRaceRunId(state: RaceSessionState): string | undefined {
  /** No mutable object from the private selection escapes to consumers. */
  const entry = selections.get(state);
  return entry?.status === "ready" ? entry.existingRunId : undefined;
}

/** Acceptance routing uses only the server-confirmed role for this exact recording. */
export function isCreatorRaceEntry(state: RaceSessionState, challengeId: string | undefined): boolean {
  /** Public viewer-role fields cannot grant or revoke recipient acceptance. */
  const entry = selections.get(state);
  return Boolean(challengeId && entry?.status === "ready" && entry.challenge.challengeId === challengeId &&
    (entry.viewerRole === "creator" || entry.invitation?.role === "creator"));
}

/** Default acceptance keeps the selected recording even if its public ID is overwritten. */
export function selectedRaceChallengeId(state: RaceSessionState): string | undefined {
  /** Ready authority carries the identity omitted from waiting presentation views. */
  const entry = selections.get(state);
  return entry?.status === "ready" ? entry.challenge.challengeId : challengeIds.get(state) ?? previews.get(state)?.challengeId ?? state.activeChallengeId;
}

/** Rendering receives a copy rather than a mutable reference into private accepted facts. */
export function raceEntryView(state: RaceSessionState): RaceEntryResponse | null {
  /** Real session states carry private facts; explicit synthetic views retain their public input. */
  const entry = selections.get(state);
  return entry ? structuredClone(entry) : state.entryStatus;
}

/** Verify a cold existing-attempt response against its privately accepted challenge facts. */
export function assertExistingRaceRun(state: RaceSessionState, run: RaceRunView): void {
  /** Synthetic authority consumers retain explicit validation; real session snapshots use private facts. */
  const entry = selections.get(state) ?? state.entryStatus;
  if (entry?.status === "ready" && entry.existingRunId &&
    (run.runId !== entry.existingRunId || run.challengeId !== entry.challenge.challengeId ||
      run.role !== "challenger" || run.categoryId !== entry.challenge.categoryId ||
      run.opponent && (run.opponent.displayName !== entry.challenge.creator.displayName ||
        run.opponent.adjustedFinishMs !== entry.challenge.adjustedTimeToBeatMs))) throw new Error("Wrong existing challenge attempt");
}

/** Only an accepted creator capability permits cancellation of an open or incompatible invitation. */
export function canCancelRaceInvitation(entry: RaceEntryResponse | null | undefined): boolean {
  return Boolean(entry && (entry.status === "ready" || entry.status === "waiting" || entry.status === "unavailable" && entry.reason === "invalid") &&
    entry.invitation?.role === "creator" && entry.invitation.canCancel);
}
