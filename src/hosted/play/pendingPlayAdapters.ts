import type {createPendingPlayRecoveryStorage} from "./pendingGuessJournal";

/** Synchronous key-value storage holding the Provisional Play journal and lease; browsers pass `localStorage`. */
export type PendingPlayStorage = {
  /** @returns The stored value, or `null` when the key is absent. */
  getItem(key: string): string | null;
  /** Stores one value under a key. */
  setItem(key: string, value: string): void;
  /** Removes one key. */
  removeItem(key: string): void;
};
/** Clock seam for retry, lease renewal and account-scope cleanup. */
export type PendingPlayClock = {
  /** Current lease and retransmission time. */
  now: () => number;
  /** Schedules one callback. */
  setTimeout: (callback: () => void, delay: number) => number;
  /** Cancels a scheduled callback. */
  clearTimeout: (timer: number) => void;
  /** Schedules a repeating callback. */
  setInterval: (callback: () => void, delay: number) => number;
  /** Cancels a repeating callback. */
  clearInterval: (timer: number) => void;
};
/** Stable adapters used for one mounted Provisional Play recovery owner. */
export type PendingPlayRecoveryAdapters = {
  /** Durable journal and cross-tab lease adapter. */
  journal: ReturnType<typeof createPendingPlayRecoveryStorage>;
  /** Retry and lease time adapter. */
  clock: PendingPlayClock;
};
