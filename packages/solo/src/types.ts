import type {Feedback} from "@riddle-quest/core/game";
/** Capability policy declared by a self-contained host; shared UI must not infer unavailable integrations. */
export type YouTubeRuntimePolicy = Readonly<{
  /** Selects browser events or provider callbacks as the authoritative pause/resume source. */
  lifecycleSource: "browser" | "platform";
  /** Requires live browser connectivity before gameplay may proceed. */
  browserConnectivityRequired: boolean;
  /** Prevents the game from overriding the provider's master-audio state. */
  platformOwnsMasterAudio: boolean;
  /** Prevents the game from overriding the provider-selected locale. */
  platformOwnsLocale: boolean;
  /** Allows the shared UI to offer outbound sharing flows. */
  allowSharingPrompts: boolean;
  /** Allows account profile, registration, and deletion controls. */
  allowAccountManagement: boolean;
  /** Allows the shared UI to expose provider-backed purchases. */
  allowCommerce: boolean;
  /** Allows navigation outside the self-contained game artifact. */
  allowExternalNavigation: boolean;
  /** Allows multiplayer and social-opponent surfaces. */
  allowMultiplayer: boolean;
  /** Indicates that the host expects Escape key handling to remain inside the game. */
  preventEscapeDefault: boolean;
}>;
/** Locale identifiers supported by the bundled YouTube content pack. */
export type YouTubeLocale =
  "en" | "es" | "pt" | "fr" | "de" | "ja" | "ko" | "hi" | "ru" | "tr" | "ar" | "id" | "it" | "nl" | "pl" | "vi";
/** The two self-contained game modes available in the Playable. */
export type YouTubeGameMode = "classic" | "daily";
/** Riddle data bundled into the artifact. Answers are never written to Cloud Save. */
export type YouTubeRiddle = Readonly<{
  /** Stores canonical id. */
  canonicalId: string;
  /** Stores text. */
  text: string;
  /** Stores answer. */
  answer: string;
  /** Stores category id. */
  categoryId: string;
  /** Stores difficulty band. */
  difficultyBand: "easy" | "medium" | "hard";
  /** Stores content fingerprint. */
  contentFingerprint: string;
}>;
/** A locale-specific, release-versioned view of the bundled content. */
export type YouTubeContent = Readonly<{
  /** Stores content version. */
  contentVersion: string;
  /** Stores locale. */
  locale: YouTubeLocale;
  /** Stores classic order. */
  classicOrder: readonly string[];
  /** Stores daily. */
  daily: Readonly<{
    /** Stores schedule version. */
    scheduleVersion: number;
    /** Stores segments. */
    segments: readonly Readonly<{
      /** Stores starts on. */
      startsOn: string;
      /** Stores canonical ids. */
      canonicalIds: readonly string[];
    }>[];
  }>;
  /** Stores riddles. */
  riddles: ReadonlyMap<string, YouTubeRiddle>;
}>;
/** Narrow surface used by the game; ads, engagement, and identity are absent by design. */
export interface YouTubeSdkPort {
  /** Stores in playables environment. */
  readonly inPlayablesEnvironment: boolean;
  /** Provides first frame ready behavior. */
  firstFrameReady(): void;
  /** Provides game ready behavior. */
  gameReady(): void;
  /** Loads data. */
  loadData(): Promise<string>;
  /** Saves data. */
  saveData(data: string): Promise<void>;
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
  /** Provides log error behavior. */
  logError(): void;
  /** Provides log warning behavior. */
  logWarning(): void;
}
/** Defines the youtube runtime policy value. */
export const YOUTUBE_RUNTIME_POLICY: YouTubeRuntimePolicy = Object.freeze({
  lifecycleSource: "platform",
  browserConnectivityRequired: false,
  platformOwnsMasterAudio: true,
  platformOwnsLocale: true,
  allowSharingPrompts: false,
  allowAccountManagement: false,
  allowCommerce: false,
  allowExternalNavigation: false,
  allowMultiplayer: false,
  preventEscapeDefault: false,
});
/** Serializable feedback row for a submitted guess. */
export type YouTubeSavedGuess = Readonly<{
  /** Stores letters. */
  letters: string[];
  /** Stores feedback. */
  feedback: Feedback[];
}>;
/** Active puzzle state. It deliberately identifies content rather than storing its answer. */
export type YouTubeActiveGame = {
  /** Revision that created this play session; scopes idempotency keys across replays. */
  sessionRevision: number;
  /** Stores mode. */
  mode: YouTubeGameMode;
  /** Stores riddle id. */
  riddleId: string;
  /** Stores content fingerprint. */
  contentFingerprint: string;
  /** Stores daily date. */
  dailyDate?: string;
  /** Stores hint revealed indices. */
  hintRevealedIndices: number[];
  /** Stores guesses. */
  guesses: YouTubeSavedGuess[];
  /** Stores attempts used. */
  attemptsUsed: number;
  /** Stores has used continue. */
  hasUsedContinue: boolean;
  /** Stores awaiting continue. */
  awaitingContinue: boolean;
};
/** Target-local progression. No field represents a user identity or cross-target economy. */
export type YouTubeProgress = {
  /** Stores coins. */
  coins: number;
  /** Stores xp. */
  xp: number;
  /** Stores level. */
  level: number;
  /** Stores classic index. */
  classicIndex: number;
  /** Stores games played. */
  gamesPlayed: number;
  /** Stores total wins. */
  totalWins: number;
  /** Stores challenge wins. */
  challengeWins: number;
  /** Stores daily puzzles completed. */
  dailyPuzzlesCompleted: number;
  /** Stores current daily streak. */
  currentDailyStreak: number;
  /** Stores best daily streak. */
  bestDailyStreak: number;
  /** Stores last daily completed date. */
  lastDailyCompletedDate?: string;
  /** Stores total guesses. */
  totalGuesses: number;
  /** Stores total guesses in wins. */
  totalGuessesInWins: number;
  /** Stores total hints used. */
  totalHintsUsed: number;
  /** Stores highest classic level. */
  highestClassicLevel: number;
  /** Stores unlocked achievement ids. */
  unlockedAchievementIds: string[];
};
/** Describes you tube operation receipt. */
export type YouTubeOperationReceipt = Readonly<{
  /** Stores id. */
  id: string;
  /** Stores revision. */
  revision: number;
}>;
/** First Cloud Save schema for the self-contained YouTube target. */
export type YouTubeSaveV1 = {
  /** Stores schema version. */
  schemaVersion: 1;
  /** Stores revision. */
  revision: number;
  /** Stores content version. */
  contentVersion: string;
  /** Stores progression. */
  progression: YouTubeProgress;
  /** Stores active game. */
  activeGame: YouTubeActiveGame | null;
  /** Stores operation receipts. */
  operationReceipts: YouTubeOperationReceipt[];
  /** Stores preferences. */
  preferences: {
    /** Stores reduced motion. */
    reducedMotion: boolean;
    /** Stores high contrast. */
    highContrast: boolean;
    /** Stores guidance complete. */
    guidanceComplete: boolean;
  };
};
/** Describes you tube result. */
export type YouTubeResult = Readonly<{
  /** Stores kind. */
  kind: "win" | "loss" | "skip";
  /** Stores mode. */
  mode: YouTubeGameMode;
  /** Stores attempts. */
  attempts: number;
  /** Stores coins earned. */
  coinsEarned: number;
  /** Stores xp earned. */
  xpEarned: number;
  /** Stores newly unlocked achievement ids. */
  newlyUnlockedAchievementIds: readonly string[];
}>;
