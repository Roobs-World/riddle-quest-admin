import type {Feedback, GameEngineSnapshot, ScoredGuess} from "@qwordly/core/game";
import type {BridgeLeaderboardEntry, BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import type {ProductSummary} from "./types";

/** Identifies the modal currently presented by the game session. */
export type GameModal =
  | "victory" | "continue" | "shop" | "profile" | "settings" | "leaderboard" | "achievements"
  | "statistics" | "ranks" | "instructions" | "credits" | "about" | "hint" | "skip" | "username"
  | "treasure" | "reward" | null;

/** Captures all reducer-owned state for a classic or daily game session. */
export type GameSessionState = {
  /** Indicates whether host initialization has completed. */ initialized: boolean;
  /** Indicates whether lifecycle signals have paused gameplay. */ paused: boolean;
  /** Active locale used for content and presentation. */ locale: string;
  /** Active single-player mode. */ gameMode: "classic" | "challenge";
  /** Authenticated or guest player identity. */ user: BridgeUser | null;
  /** Latest server-authoritative player profile. */ profile: BridgeProfile | null;
  /** Purchasable products exposed by the current platform. */ products: ProductSummary[];
  /** Current leaderboard page. */ leaderboard: BridgeLeaderboardEntry[];
  /** Metric used to rank the current leaderboard page. */ leaderboardType: "xp" | "totalWins" | "bestStreak";
  /** Indicates whether a leaderboard request is in flight. */ leaderboardLoading: boolean;
  /** Answer-bearing riddle currently loaded into the local engine. */ riddle: BridgeRiddle | null;
  /** Graphemes entered into the current guess. */ currentLetters: string[];
  /** Slot that receives the next keyboard input. */ activeSlotIndex: number;
  /** Answer positions locked by purchased hints. */ hintRevealedIndices: number[];
  /** Scored guesses already submitted for the current riddle. */ guesses: ScoredGuess[];
  /** Serializable snapshot of the deterministic game engine. */ engineSnapshot: GameEngineSnapshot | null;
  /** Modal currently presented above the game. */ modal: GameModal;
  /** Indicates whether game audio is muted. */ muted: boolean;
  /** Transient player-facing status or error message. */ notice: string | null;
  /** Rewards returned by the most recent authoritative completion. */
  lastRewards: {coinsEarned: number; totalCoins?: number; newXp?: number; newLevel?: number; leveledUp?: boolean; newWinStreak?: number; newlyUnlockedAchievementIds: string[]} | null;
  /** Optional non-completion reward animation queued for display. */
  auxiliaryFanfare: {id: string; kind: "purchase" | "achievement" | "referral"; coinsAwarded: number; totalCoins: number; achievementIds: string[]} | null;
  /** Immutable identity and result of the most recently completed riddle. */
  lastOutcome: {id: string; kind: "win" | "loss"; riddleId: string; gameMode: "classic" | "challenge"; attempts: number; isCorrect: boolean} | null;
  /** Best keyboard feedback accumulated from scored guesses. */ letterStates: Record<string, Feedback>;
};

/** Describes every transition accepted by the game-session reducer. */
export type GameSessionAction =
  | {type: "hostInit"; locale: string; gameMode: "classic" | "challenge"; user: BridgeUser | null; profile: BridgeProfile | null; products: ProductSummary[]}
  | {type: "authState"; user: BridgeUser | null; profile: BridgeProfile | null}
  | {type: "loadRiddle"; riddle: BridgeRiddle; profile?: BridgeProfile | null}
  | {type: "typeLetter"; letter: string} | {type: "backspace"} | {type: "selectSlot"; index: number}
  | {type: "submitGuess"} | {type: "applyHint"; index: number; letter: string; newCoins?: number}
  | {type: "coinsUpdated"; newCoins: number}
  | {type: "leaderboardLoaded"; leaderboardType: "xp" | "totalWins" | "bestStreak"; entries: BridgeLeaderboardEntry[]}
  | {type: "leaderboardRequested"; leaderboardType: "xp" | "totalWins" | "bestStreak"}
  | {type: "leaderboardLoadFailed"} | {type: "profileUpdated"; profile: BridgeProfile}
  | {type: "completionReward"; reward: NonNullable<GameSessionState["lastRewards"]>}
  | {type: "showAuxiliaryFanfare"; fanfare: NonNullable<GameSessionState["auxiliaryFanfare"]>}
  | {type: "restoreSession"; currentLetters: string[]; activeSlotIndex: number; hintRevealedIndices: number[]; guesses: ScoredGuess[]; engineSnapshot: GameEngineSnapshot; letterStates: Record<string, Feedback>}
  | {type: "continueGranted"} | {type: "declineContinue"} | {type: "openModal"; modal: Exclude<GameModal, null>}
  | {type: "closeModal"} | {type: "setNotice"; notice: string | null} | {type: "toggleMute"}
  | {type: "pause"} | {type: "resume"};
