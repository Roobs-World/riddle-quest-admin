import {safeBrowserStorageGet, safeBrowserStorageRemove, safeBrowserStorageSet} from "../../playerPreferences";

/** Existing key retained so account deletion also clears the owner-bound record. */
export const ACTIVE_RACE_KEY = "riddleQuest:activeRaceRun";

/** Reads a resume hint only when it belongs to the authenticated game account. */
export function readActiveRace(ownerId: string | undefined): string | null {
  if (!ownerId) return null;
  /** Untrusted browser resume hint, never an authorization credential. */
  const raw = safeBrowserStorageGet("local", ACTIVE_RACE_KEY);
  if (!raw) return null;
  try {
    /** Stored account binding and run identifier. */
    const saved = JSON.parse(raw);
    if (saved?.ownerId === ownerId && typeof saved.runId === "string" && saved.runId.trim()) {
      return saved.runId;
    }
  } catch {
    // Legacy bare IDs have no provable owner and must never be resumed.
    safeBrowserStorageRemove("local", ACTIVE_RACE_KEY);
  }
  return null;
}

/** Saves an account-bound hint after receiving an authoritative run. */
export function saveActiveRace(ownerId: string | undefined, runId: string): void {
  if (ownerId) safeBrowserStorageSet("local", ACTIVE_RACE_KEY, JSON.stringify({ownerId, runId}));
}

/** Clears this account's expected run, preserving a newer hint from another tab. */
export function clearActiveRace(ownerId: string | undefined, runId?: string): void {
  /** Storage may now point to a newer run belonging to the same account. */
  const savedRunId = readActiveRace(ownerId);
  if (savedRunId && (runId === undefined || savedRunId === runId)) safeBrowserStorageRemove("local", ACTIVE_RACE_KEY);
}
