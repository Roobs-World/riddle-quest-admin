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

  it("contains errors while acquiring browser storage during startup", () => {
    /** Provides original storage descriptor behavior. */
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    /** Provides storage error behavior. */
    const storageError = new DOMException("Storage access denied", "SecurityError");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw storageError;
      },
    });
    /** Provides warn behavior. */
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      expect(() => resetDevelopmentFirstRunState()).not.toThrow();
      expect(warn).toHaveBeenCalledWith("[riddle-quest] Could not reset development first-run state", storageError);
    } finally {
      if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });

  it("acquires both browser storage areas when startup does not inject them", () => {
    /** Provides original local storage descriptor behavior. */
    const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    /** Provides original session storage descriptor behavior. */
    const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    /** Provides local storage behavior. */
    const localStorage = createStorage({"riddleQuest:progress": "seen", unrelated: "preserved"});
    /** Provides session storage behavior. */
    const sessionStorage = createStorage({"riddleQuest:welcomeSession:user": "seen", unrelated: "preserved"});
    Object.defineProperty(globalThis, "localStorage", {configurable: true, value: localStorage});
    Object.defineProperty(globalThis, "sessionStorage", {configurable: true, value: sessionStorage});

    try {
      resetDevelopmentFirstRunState();

      expect(localStorage.entries()).toEqual({unrelated: "preserved"});
      expect(sessionStorage.entries()).toEqual({unrelated: "preserved"});
    } finally {
      if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
      else Reflect.deleteProperty(globalThis, "localStorage");
      if (originalSessionStorage) Object.defineProperty(globalThis, "sessionStorage", originalSessionStorage);
      else Reflect.deleteProperty(globalThis, "sessionStorage");
    }
  });
});
