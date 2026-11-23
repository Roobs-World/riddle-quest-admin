import {RaceRunIdRequestSchema, type RaceRunView} from "../../../core/race";
import type {RaceSessionOptions} from "../RaceSession.types";

/** Existing key retained so account deletion also clears the owner-bound record. */
export const ACTIVE_RACE_KEY = "riddleQuest:activeRaceRun";

/** Restored IDs must use the same normalization and bounds as authoritative requests. */
export function parseActiveRaceRunId(value: unknown): string | null {
  /** Parsing also rejects non-string adapter values without installing a pending request. */
  const parsed = RaceRunIdRequestSchema.safeParse({runId: value});
  return parsed.success ? parsed.data.runId : null;
}

/** Shared sessions remain usable when target storage is unavailable. */
export const unpersistedRaceResume: NonNullable<RaceSessionOptions["persistence"]> = {
  read: () => null, save: () => undefined, clear: () => undefined,
};

/** Refreshes an owned hint; only an explicit new start can replace another selected run. */
export function persistConfirmedRace(
  run: RaceRunView,
  ownerId: string | undefined,
  persistence: NonNullable<RaceSessionOptions["persistence"]>,
  current: () => boolean,
  selectNewRun = false,
  allowMissingRun = false,
): void {
  /** Optional adapters may replace the account while reading its saved pointer. */
  const savedRunId = persistence.read(ownerId);
  if (!current() || savedRunId === undefined || savedRunId && savedRunId !== run.runId &&
    (!selectNewRun || ["completed", "timed_out"].includes(run.status))) return;
  if (["prepared", "scheduled", "active", "completed", "timed_out"].includes(run.status)) {
    if (savedRunId === null && !selectNewRun && !allowMissingRun) return;
    persistence.save(ownerId, run.runId);
  }
  else persistence.clear(ownerId, run.runId);
}
