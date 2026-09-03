/** Describes browser storage. */
type BrowserStorage = Pick<Storage, "key" | "length" | "removeItem">;

/** Removes matching keys. */
const removeMatchingKeys = (storage: BrowserStorage, shouldRemove: (key: string) => boolean) => {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    /** Provides key behavior. */
    const key = storage.key(index);
    if (key && shouldRemove(key)) {
      storage.removeItem(key);
    }
  }
};

/** Resets development first run state. */
export const resetDevelopmentFirstRunState = (localStorage?: BrowserStorage, sessionStorage?: BrowserStorage) => {
  try {
    /** Provides active local storage behavior. */
    const activeLocalStorage = localStorage ?? globalThis.localStorage;
    /** Provides active session storage behavior. */
    const activeSessionStorage = sessionStorage ?? globalThis.sessionStorage;
    removeMatchingKeys(activeLocalStorage, (key) => key.startsWith("riddleQuest:") || key === "appLanguage");
    removeMatchingKeys(activeSessionStorage, (key) => key.startsWith("riddleQuest:"));
  } catch (error) {
    console.warn("[riddle-quest] Could not reset development first-run state", error);
  }
};
