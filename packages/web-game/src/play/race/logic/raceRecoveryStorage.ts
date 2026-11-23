import {RaceRecoverySchema, RACE_RECOVERY_KEY} from "@riddle-quest/core/race";
export {RACE_RECOVERY_TTL_MS, RACE_RECOVERY_KEY, type RaceRecovery, type RaceRecoveryIntent} from "@riddle-quest/core/race";
import {observeBrowserStorage} from "../../../platform/browserStorage";
import {safeBrowserStorageGet, safeBrowserStorageRemove, safeBrowserStorageSet} from "../../playerPreferences";

import {parseRaceRecovery, type RaceRecoveryPersistence} from "@riddle-quest/hosted/race/logic/raceRecoveryStorage";
export {parseRaceRecovery, type RaceRecoveryPersistence} from "@riddle-quest/hosted/race/logic/raceRecoveryStorage";

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
