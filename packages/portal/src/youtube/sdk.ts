import type {YouTubeSdkPort} from "./types";

/** Describes you tube sdk global. */
type YouTubeSdkGlobal = Readonly<{
  IN_PLAYABLES_ENV: boolean;
  game: Readonly<{
    firstFrameReady(): void;
    gameReady(): void;
    loadData(): Promise<string>;
    saveData(data: string): Promise<void>;
  }>;
  system: Readonly<{
    getLanguage(): Promise<string>;
    isAudioEnabled(): boolean;
    onAudioEnabledChange(callback: (enabled: boolean) => void): () => void;
    onPause(callback: () => void): () => void;
    onResume(callback: () => void): () => void;
  }>;
  health: Readonly<{
    logError(): void;
    logWarning(): void;
  }>;
}>;

/** Documents global. */
declare global {
  // Loaded synchronously by the YouTube target document before its module entry.
  var ytgame: YouTubeSdkGlobal | undefined;
}

/** Indicates whether is sdk global. */
const isSdkGlobal = (value: unknown): value is YouTubeSdkGlobal => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<YouTubeSdkGlobal>;
  return typeof candidate.IN_PLAYABLES_ENV === "boolean" &&
    typeof candidate.game?.firstFrameReady === "function" &&
    typeof candidate.game.gameReady === "function" &&
    typeof candidate.game.loadData === "function" &&
    typeof candidate.game.saveData === "function" &&
    typeof candidate.system?.getLanguage === "function" &&
    typeof candidate.system.isAudioEnabled === "function" &&
    typeof candidate.system.onAudioEnabledChange === "function" &&
    typeof candidate.system.onPause === "function" &&
    typeof candidate.system.onResume === "function" &&
    typeof candidate.health?.logError === "function" &&
    typeof candidate.health.logWarning === "function";
};

/** Returns the SDK injected by YouTube, failing closed when the required contract is incomplete. */
export function createYouTubeSdkPort(candidate: unknown = globalThis.ytgame): YouTubeSdkPort {
  if (!isSdkGlobal(candidate)) {
    throw new Error("youtube-sdk-unavailable");
  }

  let firstFrameSent = false;
  let gameReadySent = false;
  return {
    inPlayablesEnvironment: candidate.IN_PLAYABLES_ENV,
    firstFrameReady() {
      if (firstFrameSent) return;
      candidate.game.firstFrameReady();
      firstFrameSent = true;
    },
    gameReady() {
      if (gameReadySent) return;
      if (!firstFrameSent) throw new Error("youtube-first-frame-required");
      candidate.game.gameReady();
      gameReadySent = true;
    },
    loadData: () => candidate.game.loadData(),
    saveData: (data) => candidate.game.saveData(data),
    getLanguage: () => candidate.system.getLanguage(),
    isAudioEnabled: () => candidate.system.isAudioEnabled(),
    onAudioEnabledChange: (callback) => candidate.system.onAudioEnabledChange(callback),
    onPause: (callback) => candidate.system.onPause(callback),
    onResume: (callback) => candidate.system.onResume(callback),
    logError: () => candidate.health.logError(),
    logWarning: () => candidate.health.logWarning(),
  };
}
