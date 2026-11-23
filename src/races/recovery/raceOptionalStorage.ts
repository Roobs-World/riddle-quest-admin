import type {RaceSessionOptions} from "../controllers/RaceSession.types.ts";
import {parseRaceRecovery, type RaceRecoveryPersistence} from "./raceRecoveryStorage";
import {parseActiveRaceRunId} from "./activeRaceStorage";

/** Optional synchronous storage never determines authority acceptance or transport eligibility. */
const attempt = <T>(operation: () => T, fallback: T): T => {
  try {return operation();} catch {return fallback;}
};

/** Keeps denied or broken selection storage from interrupting an owned journey. */
export const isolateRaceRecovery = (adapter: RaceRecoveryPersistence): RaceRecoveryPersistence => ({
  /** Preserve failed observations while allowing independent in-memory and resume recovery. */
  read: (...args) => attempt(() => {
    /** Unavailable journals cannot authorize completion replacement writes. */
    const saved = adapter.read(...args);
    return saved === undefined ? undefined : parseRaceRecovery(saved, ...args);
  }, undefined),
  /** Failed optional writes leave the current in-memory mutation receipt intact. */
  save: (...args) => {attempt(() => adapter.save(...args), undefined);},
  /** Cleanup failure cannot undo a confirmed authority transition or prevent close. */
  clear: (...args) => {attempt(() => adapter.clear(...args), undefined);},
});

/** Isolates account-bound resume hints while retaining adapter method receivers. */
export const isolateRaceResume = (adapter: NonNullable<RaceSessionOptions["persistence"]>): NonNullable<RaceSessionOptions["persistence"]> => ({
  /** Failed reads remain distinguishable from empty hints without blocking independent recovery. */
  read: (...args) => attempt(() => {
    /** Preserve an unavailable observation through the isolated adapter. */
    const saved = adapter.read(...args);
    return saved === undefined ? undefined : parseActiveRaceRunId(saved);
  }, undefined),
  /** Accepted gameplay continues even if optional reload persistence is unavailable. */
  save: (...args) => {attempt(() => adapter.save(...args), undefined);},
  /** A failed hint removal never rolls back server-confirmed abandonment. */
  clear: (...args) => {attempt(() => adapter.clear(...args), undefined);},
});
