import type {RaceSessionOptions} from "../RaceSession.types";
import {parseRaceRecovery, type RaceRecoveryPersistence} from "./raceRecoveryStorage";
import {parseActiveRaceRunId} from "./activeRaceStorage";

/** Optional synchronous storage never determines authority acceptance or transport eligibility. */
const attempt = <T>(operation: () => T, fallback: T): T => {
  try {return operation();} catch {return fallback;}
};

/** Keeps denied or broken selection storage from interrupting an owned journey. */
export const isolateRaceRecovery = (adapter: RaceRecoveryPersistence): RaceRecoveryPersistence => ({
  /** Unavailable selection hints behave like an empty optional store. */
  read: (...args) => attempt(() => parseRaceRecovery(adapter.read(...args), ...args), null),
  /** Failed optional writes leave the current in-memory mutation receipt intact. */
  save: (...args) => {attempt(() => adapter.save(...args), undefined);},
  /** Cleanup failure cannot undo a confirmed authority transition or prevent close. */
  clear: (...args) => {attempt(() => adapter.clear(...args), undefined);},
});

/** Isolates account-bound resume hints while retaining adapter method receivers. */
export const isolateRaceResume = (adapter: NonNullable<RaceSessionOptions["persistence"]>): NonNullable<RaceSessionOptions["persistence"]> => ({
  /** Failed reads cannot hide an independently valid selection-recovery receipt. */
  read: (...args) => attempt(() => parseActiveRaceRunId(adapter.read(...args)), null),
  /** Accepted gameplay continues even if optional reload persistence is unavailable. */
  save: (...args) => {attempt(() => adapter.save(...args), undefined);},
  /** A failed hint removal never rolls back server-confirmed abandonment. */
  clear: (...args) => {attempt(() => adapter.clear(...args), undefined);},
});
