import AsyncStorage from "@react-native-async-storage/async-storage";
import type {PendingPlayStorage} from "@riddle-quest/hosted/play/pendingPlayAdapters";
/** Device key-value persistence; AsyncStorage satisfies it. */
export type PendingPlayDeviceStore = Readonly<{
  /** Reads one value or `null` when the key is absent. */
  getItem(key: string): Promise<string | null>;
  /** Writes one value. */
  setItem(key: string, value: string): Promise<void>;
  /** Removes one key. */
  removeItem(key: string): Promise<void>;
}>;
/** Keys the shared Provisional Play journal writes for one account scope. */
const scopeKeys = (scope: string): string[] => [`riddleQuest:pendingPlay:v1:${scope}`, `riddleQuest:pendingPlayLease:v1:${scope}`];
/** Synchronous journal storage over the device's asynchronous key-value store. */
export type AndroidPendingPlayStorage = PendingPlayStorage &
  Readonly<{
    /** Loads one scope's journal and lease from the device before the first synchronous read. */
    hydrate(scope: string): Promise<void>;
    /** Resolves once every queued device write has been attempted. */
    settled(): Promise<void>;
  }>;
/**
 * Creates the Android journal storage: reads and writes hit an in-memory cache
 * synchronously, and every write is replayed to the device store in order.
 *
 * @param store - Device persistence; defaults to AsyncStorage.
 */
export const createAndroidPendingPlayStorage = (store: PendingPlayDeviceStore = AsyncStorage): AndroidPendingPlayStorage => {
  /** Current values by key. */
  const cache = new Map<string, string>();
  /** Scopes already loaded from the device. */
  const hydrated = new Set<string>();
  /** Ordered device work; failures are swallowed so later writes still run. */
  let tail: Promise<void> = Promise.resolve();
  /** Appends device work to the queue. */
  const enqueue = (work: () => Promise<void>): Promise<void> => {
    tail = tail.then(work).catch(() => undefined);
    return tail;
  };
  return {
    getItem: (key) => cache.get(key) ?? null,
    setItem: (key, value) => {
      cache.set(key, value);
      void enqueue(() => store.setItem(key, value));
    },
    removeItem: (key) => {
      cache.delete(key);
      void enqueue(() => store.removeItem(key));
    },
    hydrate: (scope) => {
      if (hydrated.has(scope)) return tail;
      hydrated.add(scope);
      return enqueue(async () => {
        for (const key of scopeKeys(scope)) {
          /** Device value, read after earlier queued writes. */
          const value = await store.getItem(key);
          if (value !== null && !cache.has(key)) cache.set(key, value);
        }
      });
    },
    settled: () => tail,
  };
};
