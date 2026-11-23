import type {YouTubeSdkPort} from "../../../../packages/web-game/src/playable/types";
/** Describes game snacks runtime. */
type GameSnacksRuntime = Readonly<{
  /** Stores audio. */
  audio: Readonly<{
    /** Indicates whether provider audio is enabled. */
    isEnabled: boolean;
    /** Subscribes to provider audio-state changes. */
    subscribe(callback: (enabled: boolean) => void): void;
  }>;
  /** Stores game. */
  game: Readonly<{
    /** Provides first frame ready behavior. */
    firstFrameReady(): void;
    /** Provides ready behavior. */
    ready(): void;
    /** Provides on pause behavior. */
    onPause(callback: () => void): void;
    /** Provides on resume behavior. */
    onResume(callback: () => void): void;
  }>;
  /** Stores storage. */
  storage: Readonly<{
    /** Gets item. */
    getItem(key: string): string | null;
    /** Sets item. */
    setItem(key: string, value: string): void;
  }>;
}>;
/** Documents global. */
declare global {
  /** Defines the contract for window. */
  interface Window {
    /** Stores the provider-injected GameSnacks runtime. */
    GameSnacks?: GameSnacksRuntime;
  }
}
/** Saves key. */
const saveKey = "riddle-quest-save-v1";
/** Provides runtime behavior. */
function runtime(): GameSnacksRuntime {
  /** Provides sdk behavior. */
  const sdk = globalThis.window.GameSnacks;
  if (!sdk) throw new Error("gamesnacks-sdk-missing");
  return sdk;
}
/** Adapts the provider-injected GameSnacks SDK to the self-contained playable runtime. */
export function createGameSnacksSdkPort(): YouTubeSdkPort {
  return {
    inPlayablesEnvironment: true,
    firstFrameReady: () => runtime().game.firstFrameReady(),
    gameReady: () => runtime().game.ready(),
    /** Loads data. */
    async loadData() {
      return runtime().storage.getItem(saveKey) ?? "";
    },
    /** Saves data. */
    async saveData(data) {
      runtime().storage.setItem(saveKey, data);
    },
    /** Gets language. */
    async getLanguage() {
      return globalThis.navigator.language || "en";
    },
    isAudioEnabled: () => runtime().audio.isEnabled,
    /** Provides on audio enabled change behavior. */
    onAudioEnabledChange(callback) {
      runtime().audio.subscribe(callback);
      return () => {};
    },
    /** Provides on pause behavior. */
    onPause(callback) {
      runtime().game.onPause(callback);
      return () => {};
    },
    /** Provides on resume behavior. */
    onResume(callback) {
      runtime().game.onResume(callback);
      return () => {};
    },
    logError: () => {},
    logWarning: () => {},
  };
}
