import type {EconomyDifficulty} from "@qwordly/core/game";
import type {PlayerProgress} from "../validation/firestoreSchemas";
import type {
  SubmitSinglePlayerGuessRequestData,
  SubmitSinglePlayerGuessResponseData,
} from "@qwordly/core/validation/requestSchemas";

/** Authoritative response for one replay-safe hint purchase. */
export type AuthoritativeHintResult = {
  /** Canonical letter revealed to the player. */
  revealedLetter: string;
  /** Server-selected answer index. */
  index: number;
  /** Coins charged for this hint. */
  coinsCost: number;
  /** Balance after the atomic purchase. */
  newCoins: number;
  /** Achievement identifiers unlocked by this purchase. */
  newlyUnlockedAchievementIds?: string[];
} | null;

/** Authoritative response for one replay-safe Classic skip. */
export type AuthoritativeSkipResult = {
  /** Balance after the atomic skip. */
  newCoins: number;
  /** Progress after advancing the Classic entitlement. */
  newProgress: PlayerProgress;
  /** Coins charged for this skip. */
  costDeducted: number;
};

/** Internal post-commit supply inputs accompany the immutable skip response without entering its receipt. */
export type CommittedAuthoritativeSkipResult = AuthoritativeSkipResult & {
  /** Fresh transaction-owned progression and issued content locale used only by the backend supply task. */
  classicSupply: {
    /** Current Classic entitlement after this attempt commits. */
    classicIndex: number;
    /** Validated locale from the session read in this same attempt. */
    locale: string;
  };
};

/** Internal issuance result carries only the session selected by the committed transaction attempt. */
export type IssuedAuthoritativeSession = {
  /** Opaque token bound to canonical content under the authenticated account. */
  sessionToken: string;
  /** Created or resumed canonical state used for backend public-response projection. */
  state: SinglePlayerSessionState;
};

/** Stores one replay-safe guess receipt. */
type GuessReceipt = {
  /** Hash of the normalized guess bound to the request id. */
  guessHash: string;
  /** Cached authoritative response. */
  result: SubmitSinglePlayerGuessResponseData;
};

/** Stores one replay-safe hint receipt. */
type HintReceipt = {
  /** Hash of the player attempt bound to the request id. */
  attemptHash: string;
  /** Cached authoritative hint response. */
  result: Exclude<AuthoritativeHintResult, null>;
};

/** Stores server-owned state for one single-player riddle. */
export type SinglePlayerSessionState = {
  /** Riddle mode. */ gameMode: "classic" | "challenge";
  /** Canonical riddle id. */ riddleId: string;
  /** Server-only immutable content identity. */ contentKey: string;
  /** Locale-independent entitlement identity used to deduplicate rewards. */ completionKey: string;
  /** Locale bound when the session was issued. */ locale: string;
  /** Private canonical answer snapshot. */ answer: string;
  /** Difficulty pinned from server-owned content when the session was issued. */ difficultyBand?: EconomyDifficulty;
  /** Trusted Firestore expiry bounding private state and replay lifetime. */ expiresAt: FirebaseFirestore.Timestamp;
  /** Authoritative Classic progression index. */ classicIndex?: number;
  /** Authoritative UTC challenge date. */ challengeDate?: string;
  /** Server-counted submitted guesses. */ attempts: number;
  /** Most recently accepted normalized guess. */ lastGuess?: string;
  /** Most recently returned result for semantic replay. */ lastGuessResult?: SubmitSinglePlayerGuessResponseData;
  /** Indicates whether the one extra attempt was granted by either funding route. */ hasUsedContinue: boolean;
  /** Server-only funding provenance; never accepted from a gameplay request. */ continueFunding?: "coins" | "facebook-rewarded";
  /** Indicates that the base attempt limit was reached. */ awaitingContinue: boolean;
  /** Indicates that no more guesses may be accepted. */ terminal: boolean;
  /** Canonical correctness of the terminal guess. */ isCorrect: boolean;
  /** Server timestamp proving when the terminal state committed. */ terminalAt?: FirebaseFirestore.Timestamp;
  /** Replay receipts keyed by an opaque request-id hash. */ guessReceipts: Record<string, GuessReceipt>;
  /** Hash of the idempotent continue request. */ continueRequestHash?: string;
  /** Server-owned answer indices already revealed. */ hintRevealedIndices?: number[];
  /** Replay receipts for charged hint requests. */ hintReceipts?: Record<string, HintReceipt>;
  /** Hash of the most recent hint input. */ lastHintAttemptHash?: string;
  /** Most recent hint result for semantic replay. */ lastHintResult?: Exclude<AuthoritativeHintResult, null>;
  /** Hash of the idempotent Classic skip request. */ skipRequestHash?: string;
  /** Cached authoritative Classic skip result. */ skipResult?: AuthoritativeSkipResult;
  /** Indicates the terminal session ended by a paid skip. */ isSkipped?: boolean;
};

/** Describes the pure authoritative-guess transition input. */
export type GuessTransitionInput = {
  /** Existing session state. */ state?: SinglePlayerSessionState;
  /** Validated player request. */ request: SubmitSinglePlayerGuessRequestData;
  /** Canonical server-only answer. */ answer: string;
  /** Canonical content locale. */ locale: string;
};

/** Describes an accepted or replayed authoritative guess transition. */
export type GuessTransition = {
  /** Next persisted state. */ state: SinglePlayerSessionState;
  /** Authoritative response. */ result: SubmitSinglePlayerGuessResponseData;
  /** Indicates that no state write is necessary. */ replayed: boolean;
};
