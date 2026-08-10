import {afterEach, describe, expect, it, jest} from "@jest/globals";
import {resetDevelopmentFirstRunState} from "../developmentFirstRun";

const createStorage = (initial: Record<string, string>) => {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    entries() {
      return Object.fromEntries(values);
    },
  };
};

describe("development first-run reset", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("clears Riddle Quest progress and preferences without touching unrelated storage", () => {
    const localStorage = createStorage({
      "riddleQuest:onboarding:jest-guest": "seen",
      "riddleQuest:mockJestPlayerData": "{\"level\":3}",
      "riddleQuest:soundEnabled": "false",
      appLanguage: "fr",
      unrelated: "preserved",
    });
    const sessionStorage = createStorage({
      "riddleQuest:welcomeSession:jest-guest": "seen",
      unrelatedSession: "preserved",
    });

    resetDevelopmentFirstRunState(localStorage, sessionStorage);

    expect(localStorage.entries()).toEqual({unrelated: "preserved"});
    expect(sessionStorage.entries()).toEqual({unrelatedSession: "preserved"});
  });

  it("ignores empty storage slots while walking backwards", () => {
    const storage = createStorage({"riddleQuest:progress": "seen"});
    const originalKey = storage.key;
    storage.key = (index: number) => index === 0 ? null : originalKey(index);

    resetDevelopmentFirstRunState(storage, createStorage({}));

    expect(storage.entries()).toEqual({"riddleQuest:progress": "seen"});
  });

  it("warns instead of breaking startup when browser storage is unavailable", () => {
    const storageError = new Error("storage blocked");
    const blockedStorage = {
      get length(): number {
        throw storageError;
      },
      key: jest.fn<() => string | null>(),
      removeItem: jest.fn<(key: string) => void>(),
    };
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    resetDevelopmentFirstRunState(blockedStorage, createStorage({}));

    expect(warn).toHaveBeenCalledWith(
      "[riddle-quest] Could not reset development first-run state",
      storageError,
    );
  });
});
