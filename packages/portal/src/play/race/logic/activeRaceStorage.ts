import {safeBrowserStorageGet, safeBrowserStorageRemove, safeBrowserStorageSet} from "../../playerPreferences";
import {observeBrowserStorage} from "../../../platform/browserStorage";
import {RaceRunIdRequestSchema, type RaceRunView} from "@riddle-quest/core/race";
import type {RaceSessionOptions} from "../RaceSession.types";

/** Existing key retained so account deletion also clears the owner-bound record. */
export const ACTIVE_RACE_KEY = "riddleQuest:activeRaceRun";

/** Restored IDs must use the same normalization and bounds as authoritative requests. */
export function parseActiveRaceRunId(value: unknown): string | null {
  /** Parsing also rejects non-string adapter values without installing a pending request. */
  const parsed = RaceRunIdRequestSchema.safeParse({runId: value});
  return parsed.success ? parsed.data.runId : null;
}

/** Reads a resume hint only when it belongs to the authenticated game account. */
export function readActiveRace(ownerId: string | undefined): string | null | undefined {
  if (!ownerId) return null;
  /** Untrusted browser resume hint, never an authorization credential. */
  const raw = observeBrowserStorage("local", ACTIVE_RACE_KEY);
  if (raw === undefined) return undefined;
  if (!raw || raw.length > 4096) return null;
  try {
    /** Stored account binding and run identifier. */
    const saved = JSON.parse(raw);
    if (saved?.ownerId === ownerId) return parseActiveRaceRunId(saved.runId);
  } catch {
    // Legacy bare IDs have no provable owner and must never be resumed.
    if (safeBrowserStorageGet("local", ACTIVE_RACE_KEY) === raw) safeBrowserStorageRemove("local", ACTIVE_RACE_KEY);
  }
  return null;
}

/** Saves an account-bound hint after receiving an authoritative run. */
export function saveActiveRace(ownerId: string | undefined, runId: string): void {
  if (ownerId) safeBrowserStorageSet("local", ACTIVE_RACE_KEY, JSON.stringify({ownerId, runId}));
}

/** Clears this account's expected run, preserving a newer hint from another tab. */
export function clearActiveRace(ownerId: string | undefined, runId?: string): void {
  /** Retain the exact serialized snapshot until account/run ownership has been checked. */
  const raw = safeBrowserStorageGet("local", ACTIVE_RACE_KEY);
  if (!ownerId || !raw || raw.length > 4096) return;
  try {
    /** Only a matching owned hint may authorize removal of this observed value. */
    const saved = JSON.parse(raw), savedRunId = parseActiveRaceRunId(saved?.runId);
    if (saved?.ownerId === ownerId && savedRunId && (runId === undefined || savedRunId === runId) &&
      safeBrowserStorageGet("local", ACTIVE_RACE_KEY) === raw) safeBrowserStorageRemove("local", ACTIVE_RACE_KEY);
  } catch { /* Malformed values do not authorize cleanup of a replacement hint. */ }
}

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
