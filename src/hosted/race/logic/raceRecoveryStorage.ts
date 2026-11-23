import {RaceRecoverySchema, RACE_RECOVERY_TTL_MS, RACE_RECOVERY_KEY, type RaceRecovery} from "../../../core/race";
export {RACE_RECOVERY_TTL_MS, RACE_RECOVERY_KEY, type RaceRecovery, type RaceRecoveryIntent} from "../../../core/race";

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

/** Targets opt into persistence by supplying their own account-owned adapter. */
export const unpersistedRaceRecovery: RaceRecoveryPersistence = {
  read: () => null, save: () => undefined, clear: () => undefined,
};
