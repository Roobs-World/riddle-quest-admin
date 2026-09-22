import type {Feedback, GameEngineSnapshot, ScoredGuess} from "@qwordly/core/game";
import type {BridgeLeaderboardEntry, BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import type {ProductSummary} from "./types";

/** Identifies the modal currently presented by the game session. */
export type GameModal =
  | "victory"
  | "continue"
  | "shop"
  | "profile"
  | "settings"
  | "leaderboard"
  | "achievements"
  | "statistics"
  | "ranks"
  | "instructions"
  | "credits"
  | "about"
  | "hint"
  | "skip"
  | "username"
  | "treasure"
  | "reward"
  | null;

/** Gameplay fields restored when server confirmation rejects a feedback preview. */
export type PendingGuessState = Pick<GameSessionState,
  "currentLetters" | "activeSlotIndex" | "guesses" | "engineSnapshot" |
  "modal" | "lastOutcome" | "completionAcknowledged" | "letterStates"
>;

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
  /** Indicates that an authoritative guess request is in flight. */ guessPending: boolean;
  /** Confirmed gameplay state before an immediate feedback preview. */ pendingGuessState: PendingGuessState | null;
  /** Serializable snapshot of the deterministic game engine. */ engineSnapshot: GameEngineSnapshot | null;
  /** Modal currently presented above the game. */ modal: GameModal;
  /** Indicates whether game audio is muted. */ muted: boolean;
  /** Transient player-facing status or error message. */ notice: string | null;
  /** Rewards returned by the most recent authoritative completion. */
  lastRewards: {
    /** Stores coins earned. */
    coinsEarned: number; /** Stores total coins. */
    /** Stores total coins. */
    totalCoins?: number; /** Stores new xp. */
    /** Stores new xp. */
    newXp?: number; /** Stores new level. */
    /** Stores new level. */
    newLevel?: number; /** Stores leveled up. */
    /** Stores leveled up. */
    leveledUp?: boolean; /** Stores new win streak. */
    /** Stores new win streak. */
    newWinStreak?: number; /** Stores newly unlocked achievement ids. */
    /** Stores newly unlocked achievement ids. */
    newlyUnlockedAchievementIds: string[];
  } | null;
  /** Optional non-completion reward animation queued for display. */
  auxiliaryFanfare: {
    /** Stores id. */
    id: string; /** Stores kind. */
    /** Stores kind. */
    kind: "purchase" | "achievement" | "referral"; /** Stores coins awarded. */
    /** Stores coins awarded. */
    coinsAwarded: number; /** Stores total coins. */
    /** Stores total coins. */
    totalCoins: number; /** Stores achievement ids. */
    /** Stores achievement ids. */
    achievementIds: string[];
  } | null;
  /** Immutable identity and result of the most recently completed riddle. */
  lastOutcome: {
    /** Stores id. */
    id: string;
    /** Stores kind. */
    kind: "win" | "loss";
    /** Stores riddle id. */
    riddleId: string;
    /** Stores game mode. */
    gameMode: "classic" | "challenge";
    /** Stores session token. */
    sessionToken: string;
    /** Stores attempts. */
    attempts: number;
    /** Stores is correct. */
    isCorrect: boolean;
  } | null;
  /** Indicates the authoritative completion response was received and persisted. */
  completionAcknowledged: boolean;
  /** Best keyboard feedback accumulated from scored guesses. */ letterStates: Record<string, Feedback>;
};

/** Describes every transition accepted by the game-session reducer. */
export type GameSessionAction =
  | {
      /** Stores type. */
      type: "hostInit"; /** Stores locale. */
      /** Stores locale. */
      locale: string; /** Stores game mode. */
      /** Stores game mode. */
      gameMode: "classic" | "challenge"; /** Stores user. */
      /** Stores user. */
      user: BridgeUser | null; /** Stores profile. */
      /** Stores profile. */
      profile: BridgeProfile | null; /** Stores products. */
      /** Stores products. */
      products: ProductSummary[];
    }
  | {
      /** Stores type. */
      type: "authState"; /** Stores user. */
      /** Stores user. */
      user: BridgeUser | null; /** Stores profile. */
      /** Stores profile. */
      profile: BridgeProfile | null;
    }
  | {
      /** Stores type. */
      type: "loadRiddle"; /** Stores riddle. */
      /** Stores riddle. */
      riddle: BridgeRiddle; /** Stores profile. */
      /** Stores profile. */
      profile?: BridgeProfile | null;
    }
  | {
      /** Stores type. */
      type: "typeLetter"; /** Stores letter. */
      /** Stores letter. */
      letter: string;
    }
  | {
      /** Stores type. */
      type: "backspace";
    }
  | {
      /** Stores type. */
      type: "selectSlot"; /** Stores index. */
      /** Stores index. */
      index: number;
    }
  | {
      /** Stores type. */
      type: "guessRequested";
    }
  | {
      /** Stores type. */
      type: "guessFailed";
    }
  | {
      /** Stores type. */
      type: "guessResolved"; /** Stores feedback. */
      /** Stores feedback. */
      feedback: ScoredGuess; /** Stores attempts. */
      /** Stores attempts. */
      attempts: number; /** Stores is correct. */
      /** Stores is correct. */
      isCorrect: boolean; /** Stores game over. */
      /** Stores game over. */
      gameOver: boolean; /** Stores can continue. */
      /** Stores can continue. */
      canContinue: boolean;
    }
  | {
      /** Stores type. */
      type: "applyHint"; /** Stores index. */
      /** Stores index. */
      index: number; /** Stores letter. */
      /** Stores letter. */
      letter: string; /** Stores new coins. */
      /** Stores new coins. */
      newCoins?: number;
    }
  | {
      /** Stores type. */
      type: "coinsUpdated"; /** Stores new coins. */
      /** Stores new coins. */
      newCoins: number;
    }
  | {
      /** Stores type. */
      type: "leaderboardLoaded"; /** Stores leaderboard type. */
      /** Stores leaderboard type. */
      leaderboardType: "xp" | "totalWins" | "bestStreak"; /** Stores entries. */
      /** Stores entries. */
      entries: BridgeLeaderboardEntry[];
    }
  | {
      /** Stores type. */
      type: "leaderboardRequested"; /** Stores leaderboard type. */
      /** Stores leaderboard type. */
      leaderboardType: "xp" | "totalWins" | "bestStreak";
    }
  | {
      /** Stores type. */
      type: "leaderboardLoadFailed";
    }
  | {
      /** Stores type. */
      type: "profileUpdated"; /** Stores profile. */
      /** Stores profile. */
      profile: BridgeProfile;
    }
  | {
      /** Stores type. */
      type: "completionReward"; /** Stores reward. */
      /** Stores reward. */
      reward: NonNullable<GameSessionState["lastRewards"]>;
    }
  | {
      /** Stores type. */
      type: "completionAcknowledged";
    }
  | {
      /** Stores type. */
      type: "showAuxiliaryFanfare"; /** Stores fanfare. */
      /** Stores fanfare. */
      fanfare: NonNullable<GameSessionState["auxiliaryFanfare"]>;
    }
  | {
      /** Stores type. */
      type: "restoreSession"; /** Stores current letters. */
      /** Stores current letters. */
      currentLetters: string[]; /** Stores active slot index. */
      /** Stores active slot index. */
      activeSlotIndex: number; /** Stores hint revealed indices. */
      /** Stores hint revealed indices. */
      hintRevealedIndices: number[]; /** Stores guesses. */
      /** Stores guesses. */
      guesses: ScoredGuess[]; /** Stores engine snapshot. */
      /** Stores engine snapshot. */
      engineSnapshot: GameEngineSnapshot; /** Stores letter states. */
      /** Stores letter states. */
      letterStates: Record<string, Feedback>; /** Stores awaiting continue. */
      /** Stores awaiting continue. */
      awaitingContinue: boolean; /** Stores pending outcome. */
      /** Stores pending outcome. */
      pendingOutcome?: GameSessionState["lastOutcome"];
    }
  | {
      /** Stores type. */
      type: "continueGranted";
    }
  | {
      /** Stores type. */
      type: "declineContinue";
    }
  | {
      /** Stores type. */
      type: "openModal"; /** Stores modal. */
      /** Stores modal. */
      modal: Exclude<GameModal, null>;
    }
  | {
      /** Stores type. */
      type: "closeModal";
    }
  | {
      /** Stores type. */
      type: "setNotice"; /** Stores notice. */
      /** Stores notice. */
      notice: string | null;
    }
  | {
      /** Stores type. */
      type: "toggleMute";
    }
  | {
      /** Stores type. */
      type: "pause";
    }
  | {
      /** Stores type. */
      type: "resume";
    };
