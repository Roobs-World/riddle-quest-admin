import {describe, expect, it} from "@jest/globals";
import type {AppStateStatus} from "react-native";
import {ANDROID_SAVE_KEY, createAndroidSdkPort, type AndroidLifecycle, type AndroidSaveStore} from "../androidSdkPort";

/** Builds an in-memory store that records writes. */
const createStore = (): AndroidSaveStore & {
  /** Values written so far. */
  values: Map<string, string>;
} => {
  /** Backing map. */
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
};
/** Builds a controllable lifecycle that can emit foreground changes. */
const createLifecycle = (initial: AppStateStatus = "active"): AndroidLifecycle & {
  /** Emits a state change to every listener. */
  emit: (state: AppStateStatus) => void;
} => {
  /** Registered listeners. */
  const listeners = new Set<(state: AppStateStatus) => void>();
  return {
    currentState: initial,
    addEventListener: (_type, listener) => {
      listeners.add(listener);
      return {remove: () => listeners.delete(listener)};
    },
    emit: (state) => {
      for (const listener of listeners) listener(state);
    },
  };
};

describe("createAndroidSdkPort", () => {
  it("treats an absent save as an empty first run and persists exact bytes", async () => {
    /** Recording store. */
    const store = createStore();
    /** Port under test. */
    const port = createAndroidSdkPort({store, lifecycle: createLifecycle(), languageTag: "en-GB"});
    await expect(port.loadData()).resolves.toBe("");
    await port.saveData('{"revision":1}');
    expect(store.values.get(ANDROID_SAVE_KEY)).toBe('{"revision":1}');
    await expect(port.loadData()).resolves.toBe('{"revision":1}');
  });

  it("reports the configured language tag", async () => {
    /** Port under test. */
    const port = createAndroidSdkPort({store: createStore(), lifecycle: createLifecycle(), languageTag: "es-MX"});
    await expect(port.getLanguage()).resolves.toBe("es-MX");
    expect(port.inPlayablesEnvironment).toBe(false);
    expect(port.isAudioEnabled()).toBe(true);
  });

  it("pauses when leaving the foreground and resumes once on return", () => {
    /** Controllable lifecycle. */
    const lifecycle = createLifecycle();
    /** Port under test. */
    const port = createAndroidSdkPort({store: createStore(), lifecycle, languageTag: "en"});
    /** Observed callbacks in order. */
    const events: string[] = [];
    /** Removes the pause subscription. */
    const removePause = port.onPause(() => events.push("pause"));
    /** Removes the resume subscription. */
    const removeResume = port.onResume(() => events.push("resume"));
    lifecycle.emit("inactive");
    lifecycle.emit("background");
    lifecycle.emit("active");
    lifecycle.emit("active");
    expect(events).toEqual(["pause", "resume"]);
    removePause();
    removeResume();
    lifecycle.emit("background");
    expect(events).toEqual(["pause", "resume"]);
  });

  it("does not resume immediately when subscribed while already active", () => {
    /** Controllable lifecycle. */
    const lifecycle = createLifecycle("active");
    /** Port under test. */
    const port = createAndroidSdkPort({store: createStore(), lifecycle, languageTag: "en"});
    /** Observed resumes. */
    let resumes = 0;
    port.onResume(() => {
      resumes += 1;
    });
    lifecycle.emit("active");
    expect(resumes).toBe(0);
  });
});
