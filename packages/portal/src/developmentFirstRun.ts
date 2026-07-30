type BrowserStorage = Pick<Storage, "key" | "length" | "removeItem">;

const removeMatchingKeys = (
  storage: BrowserStorage,
  shouldRemove: (key: string) => boolean,
) => {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && shouldRemove(key)) {
      storage.removeItem(key);
    }
  }
};

export const resetDevelopmentFirstRunState = (
  localStorage: BrowserStorage,
  sessionStorage: BrowserStorage,
) => {
  try {
    removeMatchingKeys(
      localStorage,
      (key) => key.startsWith("riddleQuest:") || key === "appLanguage",
    );
    removeMatchingKeys(sessionStorage, (key) => key.startsWith("riddleQuest:"));
  } catch (error) {
    console.warn("[riddle-quest] Could not reset development first-run state", error);
  }
};
