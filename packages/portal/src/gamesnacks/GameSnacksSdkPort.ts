import type {YouTubeSdkPort} from "../youtube/types";

type GameSnacksRuntime = Readonly<{
  audio: Readonly<{isEnabled: boolean; subscribe(callback: (enabled: boolean) => void): void}>;
  game: Readonly<{
    firstFrameReady(): void;
    ready(): void;
    onPause(callback: () => void): void;
    onResume(callback: () => void): void;
  }>;
  storage: Readonly<{
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  }>;
}>;

declare global {
  interface Window { GameSnacks?: GameSnacksRuntime }
}

const saveKey = "riddle-quest-save-v1";

function runtime(): GameSnacksRuntime {
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
    async loadData() { return runtime().storage.getItem(saveKey) ?? ""; },
    async saveData(data) { runtime().storage.setItem(saveKey, data); },
    async getLanguage() { return globalThis.navigator.language || "en"; },
    isAudioEnabled: () => runtime().audio.isEnabled,
    onAudioEnabledChange(callback) {
      runtime().audio.subscribe(callback);
      return () => {};
    },
    onPause(callback) {
      runtime().game.onPause(callback);
      return () => {};
    },
    onResume(callback) {
      runtime().game.onResume(callback);
      return () => {};
    },
    logError: () => {},
    logWarning: () => {},
  };
}
