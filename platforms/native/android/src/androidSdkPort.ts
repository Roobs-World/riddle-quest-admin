import AsyncStorage from "@react-native-async-storage/async-storage";
import type {YouTubeSdkPort} from "../../../../src/solo";
import {AppState, I18nManager, type AppStateStatus, type NativeEventSubscription} from "react-native";
/** Storage key holding the single local save document. */
export const ANDROID_SAVE_KEY = "riddle-quest:android:save-v1";
/** Narrow persistence surface so tests can substitute an in-memory store. */
export type AndroidSaveStore = Readonly<{
  /** Reads one value or `null` when the key is absent. */
  getItem(key: string): Promise<string | null>;
  /** Durably writes one value. */
  setItem(key: string, value: string): Promise<void>;
}>;
/** Narrow lifecycle surface mirroring React Native's `AppState`. */
export type AndroidLifecycle = Readonly<{
  /** Current foreground state; the platform may not know it yet at startup. */
  currentState: string | null | undefined;
  /** Subscribes to foreground changes. */
  addEventListener(type: "change", listener: (state: AppStateStatus) => void): NativeEventSubscription;
}>;
/** Host services the port may receive instead of the real device modules. */
export type AndroidSdkPortOptions = Readonly<{
  /** Save persistence; defaults to AsyncStorage. */
  store?: AndroidSaveStore;
  /** Foreground lifecycle; defaults to AppState. */
  lifecycle?: AndroidLifecycle;
  /** BCP-47 language tag; defaults to the device locale. */
  languageTag?: string;
}>;
/** Whether an app state counts as interactive foreground. */
const isActive = (state: string): boolean => state === "active";
/** Device language from the platform locale constants, without an extra native dependency. */
export function resolveDeviceLanguageTag(): string {
  /** Locale identifier published by the platform, such as `en_GB`. */
  const identifier = I18nManager.getConstants().localeIdentifier;
  if (typeof identifier === "string" && identifier.length > 0) return identifier.replace(/_/gu, "-");
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en";
  }
}
/**
 * Android host port for the shared solo play controllers.
 *
 * @remarks
 * Progress lives only in this app's private storage. Pause and resume follow the
 * foreground lifecycle so ordered saves never run while the app is backgrounded.
 */
export function createAndroidSdkPort(options: AndroidSdkPortOptions = {}): YouTubeSdkPort {
  /** Save persistence. */
  const store = options.store ?? AsyncStorage;
  /** Foreground lifecycle. */
  const lifecycle: AndroidLifecycle = options.lifecycle ?? AppState;
  /** Language resolved once per port. */
  const languageTag = options.languageTag ?? resolveDeviceLanguageTag();
  /** Invokes the callback only when the foreground predicate becomes true. */
  const listen = (predicate: (state: string) => boolean, callback: () => void): (() => void) => {
    /** Whether the predicate currently holds. */
    let satisfied = predicate(lifecycle.currentState ?? "unknown");
    /** Native subscription. */
    const subscription = lifecycle.addEventListener("change", (state) => {
      /** Whether the predicate holds after this change. */
      const next = predicate(state);
      if (next && !satisfied) callback();
      satisfied = next;
    });
    return () => subscription.remove();
  };
  return {
    inPlayablesEnvironment: false,
    /** No host paint signal exists on Android. */
    firstFrameReady() {},
    /** No host readiness signal exists on Android. */
    gameReady() {},
    /** Loads the raw save document; an absent key is an empty first run. */
    async loadData() {
      return (await store.getItem(ANDROID_SAVE_KEY)) ?? "";
    },
    /** Durably writes the exact serialized revision. */
    async saveData(data) {
      await store.setItem(ANDROID_SAVE_KEY, data);
    },
    /** Reports the device language. */
    async getLanguage() {
      return languageTag;
    },
    isAudioEnabled: () => true,
    onAudioEnabledChange: () => () => {},
    onPause: (callback) => listen((state) => !isActive(state), callback),
    onResume: (callback) => listen(isActive, callback),
    /** Errors are surfaced to the player through boot state; nothing leaves the device. */
    logError() {},
    /** Warnings are surfaced to the player through boot state; nothing leaves the device. */
    logWarning() {},
  };
}
