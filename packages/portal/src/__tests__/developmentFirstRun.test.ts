import {afterEach, describe, expect, it, jest} from "@jest/globals";
import {resetDevelopmentFirstRunState} from "../developmentFirstRun";

/** Creates storage. */
const createStorage = (initial: Record<string, string>) => {
  /** Provides values behavior. */
  const values = new Map(Object.entries(initial));
  return {
    /** Gets length. */
    get length() {
      return values.size;
    },
    /** Provides key behavior. */
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    /** Removes item. */
    removeItem(key: string) {
      values.delete(key);
    },
    /** Provides entries behavior. */
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
    /** Provides local storage behavior. */
    const localStorage = createStorage({
      "riddleQuest:onboarding:jest-guest": "seen",
      "riddleQuest:mockJestPlayerData": '{"level":3}',
      "riddleQuest:soundEnabled": "false",
      appLanguage: "fr",
      unrelated: "preserved",
    });
    /** Provides session storage behavior. */
    const sessionStorage = createStorage({
      "riddleQuest:welcomeSession:jest-guest": "seen",
      unrelatedSession: "preserved",
    });

    resetDevelopmentFirstRunState(localStorage, sessionStorage);

    expect(localStorage.entries()).toEqual({unrelated: "preserved"});
    expect(sessionStorage.entries()).toEqual({unrelatedSession: "preserved"});
  });

  it("ignores empty storage slots while walking backwards", () => {
    /** Provides storage behavior. */
    const storage = createStorage({"riddleQuest:progress": "seen"});
    /** Provides original key behavior. */
    const originalKey = storage.key;
    storage.key = (index: number) => (index === 0 ? null : originalKey(index));

    resetDevelopmentFirstRunState(storage, createStorage({}));

    expect(storage.entries()).toEqual({"riddleQuest:progress": "seen"});
  });

  it("warns instead of breaking startup when browser storage is unavailable", () => {
    /** Provides storage error behavior. */
    const storageError = new Error("storage blocked");
    /** Provides blocked storage behavior. */
    const blockedStorage = {
      /** Gets length. */
      get length(): number {
        throw storageError;
      },
      key: jest.fn<() => string | null>(),
      removeItem: jest.fn<(key: string) => void>(),
    };
    /** Provides warn behavior. */
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    resetDevelopmentFirstRunState(blockedStorage, createStorage({}));

    expect(warn).toHaveBeenCalledWith("[riddle-quest] Could not reset development first-run state", storageError);
  });
});
