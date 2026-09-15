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

/** Clears only this account's hint, preserving another tab's account state. */
export function clearActiveRace(ownerId: string | undefined): void {
  if (readActiveRace(ownerId)) safeBrowserStorageRemove("local", ACTIVE_RACE_KEY);
}
