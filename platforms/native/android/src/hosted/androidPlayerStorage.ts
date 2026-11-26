import AsyncStorage from "@react-native-async-storage/async-storage";

/** Device-private persistence used by account-owned game controllers. */
export type AndroidPlayerStore = Pick<typeof AsyncStorage, "getItem" | "setItem" | "removeItem">;
/** Each retired account loses write access before its saved data is removed. */
let generation = 0;
/** No controller may refill storage while confirmed deletion is being retried. */
let accepting = true;
/** All game writes finish before the deletion boundary clears the device store. */
let pending: Promise<void> = Promise.resolve();

/** Gives one controller lifetime access to the current account's private storage. */
export function createAndroidPlayerStorage(store: AndroidPlayerStore = AsyncStorage): AndroidPlayerStore {
  const owner = generation;
  const mutate = (operation: () => Promise<void>): Promise<void> => {
    const result = pending.then(async () => {if (accepting && owner === generation) await operation();});
    pending = result.catch(() => undefined);
    return result;
  };
  return {
    async getItem(key) {
      if (!accepting || owner !== generation) return null;
      const value = await store.getItem(key);
      return accepting && owner === generation ? value : null;
    },
    setItem: (key, value) => mutate(() => store.setItem(key, value)),
    removeItem: key => mutate(() => store.removeItem(key)),
  };
}

/** Invalidates old callbacks immediately and drains writes already inside the native store. */
export async function retireAndroidPlayerStorage(): Promise<void> {
  accepting = false;
  generation++;
  await pending;
}

/** Only controllers created after successful cleanup may use the fresh private store. */
export function startFreshAndroidPlayerStorage(): void {
  generation++;
  accepting = true;
}
