import type {YouTubeSdkPort} from "../../../../src/web/playable/types";
/** Describes you tube sdk global. */
type YouTubeSdkGlobal = Readonly<{
  /** Stores in playables env. */
  IN_PLAYABLES_ENV: boolean;
  /** Stores game. */
  game: Readonly<{
    /** Provides first frame ready behavior. */
    firstFrameReady(): void;
    /** Provides game ready behavior. */
    gameReady(): void;
    /** Loads data. */
    loadData(): Promise<string>;
    /** Saves data. */
    saveData(data: string): Promise<void>;
  }>;
  /** Stores system. */
  system: Readonly<{
    /** Gets language. */
    getLanguage(): Promise<string>;
    /** Indicates whether is audio enabled. */
    isAudioEnabled(): boolean;
    /** Provides on audio enabled change behavior. */
    onAudioEnabledChange(callback: (enabled: boolean) => void): () => void;
    /** Provides on pause behavior. */
    onPause(callback: () => void): () => void;
    /** Provides on resume behavior. */
    onResume(callback: () => void): () => void;
  }>;
  /** Stores health. */
  health: Readonly<{
    /** Provides log error behavior. */
    logError(): void;
    /** Provides log warning behavior. */
    logWarning(): void;
  }>;
}>;
/** Documents global. */
declare global {
  // Loaded synchronously by the YouTube target document before its module entry.
  /** Provides ytgame behavior. */
  var ytgame: YouTubeSdkGlobal | undefined;
}
/** Indicates whether is sdk global. */
const isSdkGlobal = (value: unknown): value is YouTubeSdkGlobal => {
  if (typeof value !== "object" || value === null) return false;
  /** Provides candidate behavior. */
  const candidate = value as Partial<YouTubeSdkGlobal>;
  return (
    typeof candidate.IN_PLAYABLES_ENV === "boolean" &&
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
    typeof candidate.health.logWarning === "function"
  );
};
/** Returns the SDK injected by YouTube, failing closed when the required contract is incomplete. */
export function createYouTubeSdkPort(candidate: unknown = globalThis.ytgame): YouTubeSdkPort {
  if (!isSdkGlobal(candidate)) {
    throw new Error("youtube-sdk-unavailable");
  }
  /** Provides first frame sent behavior. */
  let firstFrameSent = false;
  /** Provides game ready sent behavior. */
  let gameReadySent = false;
  return {
    inPlayablesEnvironment: candidate.IN_PLAYABLES_ENV,
    /** Provides first frame ready behavior. */
    firstFrameReady() {
      if (firstFrameSent) return;
      candidate.game.firstFrameReady();
      firstFrameSent = true;
    },
    /** Provides game ready behavior. */
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
