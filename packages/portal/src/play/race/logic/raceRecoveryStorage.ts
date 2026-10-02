import {RaceRecoverySchema, RACE_RECOVERY_TTL_MS, RACE_RECOVERY_KEY, type RaceRecovery} from "@qwordly/core/race";
export {RACE_RECOVERY_TTL_MS, RACE_RECOVERY_KEY, type RaceRecovery, type RaceRecoveryIntent} from "@qwordly/core/race";
import {observeBrowserStorage} from "../../../platform/browserStorage";
import {safeBrowserStorageGet, safeBrowserStorageRemove, safeBrowserStorageSet} from "../../playerPreferences";

/** Injectable storage seam for reloads and stale-tab replacement tests. */
export type RaceRecoveryPersistence = {
  /** Reads this owner's unexpired hint; undefined means the store could not be observed. */ read: (ownerId: string | undefined, locale: RaceRecovery["locale"], nowMs: number) => RaceRecovery | null | undefined;
  /** Stores one validated selection. */ save: (record: RaceRecovery) => void;
  /** Deletes only the exact record last observed by this lifetime. */ clear: (ownerId: string | undefined, expectedId: string) => void;
};

/** Validates untrusted local selection and retention without accepting it as authority. */
export function parseRaceRecovery(value: unknown, ownerId: string | undefined, locale: RaceRecovery["locale"], nowMs: number): RaceRecovery | null {
  /** Reject unknown fields before interpreting local identifiers. */
  const parsed = RaceRecoverySchema.safeParse(value);
  if (!parsed.success || !ownerId || !Number.isSafeInteger(nowMs)) return null;
  /** Validated shape still requires current ownership, language and clock checks. */
  const record = parsed.data;
  if (record.ownerId !== ownerId || record.locale !== locale || record.savedAtMs > nowMs || record.expiresAtMs <= nowMs ||
    record.expiresAtMs <= record.savedAtMs || record.expiresAtMs - record.savedAtMs > RACE_RECOVERY_TTL_MS ||
    record.intent.kind === "search" && record.intent.request.locale !== locale ||
    record.intent.kind === "start" && record.intent.request.locale !== locale) return null;
  return record;
}

/** Browser storage remains optional; restricted storage never prevents gameplay. */
export const browserRaceRecovery: RaceRecoveryPersistence = {
  /** Read only a bounded local hint; never hydrate gameplay state. */
  read(ownerId, locale, nowMs) {
    /** Shared storage may have changed since this session last read it. */
    const raw = observeBrowserStorage("local", RACE_RECOVERY_KEY);
    if (raw === undefined) return undefined;
    if (!raw || raw.length > 4096) return null;
    try {return parseRaceRecovery(JSON.parse(raw), ownerId, locale, nowMs);} catch {return null;}
  },
  /** Validate before serializing so callers cannot persist scoring payloads. */
  save(record) {
    if (parseRaceRecovery(record, record.ownerId, record.locale, record.savedAtMs)) safeBrowserStorageSet("local", RACE_RECOVERY_KEY, JSON.stringify(record));
  },
  /** Compare the observed revision before best-effort removal. */
  clear(ownerId, expectedId) {
    /** Shared storage may have changed since this session last read it. */
    const raw = safeBrowserStorageGet("local", RACE_RECOVERY_KEY);
    if (!ownerId || !raw || raw.length > 4096) return;
    try {
      /** Cleanup requires both owner identity and exact replacement revision. */
      const parsed = RaceRecoverySchema.safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data.ownerId === ownerId && parsed.data.id === expectedId &&
        safeBrowserStorageGet("local", RACE_RECOVERY_KEY) === raw) safeBrowserStorageRemove("local", RACE_RECOVERY_KEY);
    } catch { /* Invalid hints never authorize cleanup of another lifetime. */ }
  },
};
