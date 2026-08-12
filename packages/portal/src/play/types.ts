import type {BridgeLeaderboardEntry, BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import type {ProductPricing} from "@qwordly/core/pricing/catalog";
import type {
  AbandonRaceRunRequest,
  AbandonRaceRunResponse,
  ListRaceCategoriesResponse,
  ListRaceInboxResponse,
  PublishRaceChallengeRequest,
  PublishRaceChallengeResponse,
  RaceAccessResponse,
  RaceAnalyticsEventRequest,
  RaceChallengePreview,
  RaceOutcome,
  RaceRunResponse,
  RequestRaceHintRequest,
  RequestRaceHintResponse,
  SkipRaceRiddleRequest,
  SkipRaceRiddleResponse,
  StartRaceRunRequest,
  SubmitRaceGuessRequest,
  SubmitRaceGuessResponse,
} from "@qwordly/core/race";

/** Describes web game mode. */
export type WebGameMode = "classic" | "challenge";
/** Describes leaderboard type. */
export type LeaderboardType = "xp" | "totalWins" | "bestStreak";

/** Describes product summary. */
export type ProductSummary = {
  /** Stores product id. */
  productId: string;
  /** Stores product type. */
  productType?: "consumable" | "subscription";
  /** Stores name. */
  name: string;
  /** Stores description. */
  description: string;
  /** Stores coins. */
  coins: number;
  /** Stores display price. */
  displayPrice: string;
  /** Stores price. */
  price?: number;
  /** Stores currency. */
  currency?: string;
  /** Stores featured badge. */
  featuredBadge?: string;
  /** Stores billing period. */
  billingPeriod?: "weekly" | "monthly" | "yearly";
  /** Stores subscription status. */
  subscriptionStatus?: "active" | "inactive";
  /** Stores trial eligible. */
  trialEligible?: boolean;
};

/** Describes auth snapshot. */
export type AuthSnapshot = {
  /** Stores user. */
  user: BridgeUser | null;
  /** Stores profile. */
  profile: BridgeProfile | null;
};

/** Describes auth adapter. */
type AuthAdapter = {
  /** Provides subscribe behavior. */
  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void;
};

/** Describes hint result. */
type HintResult = {
  revealedLetter: string;
  index: number;
  coinsCost: number;
  newCoins?: number;
  newlyUnlockedAchievementIds?: string[];
} | null;

/** Describes completion result. */
export type CompletionResult = {
  /** Stores server-counted attempts. */
  attempts: number;
  /** Stores canonical server-derived correctness. */
  isCorrect: boolean;
  /** Stores coins earned. */
  coinsEarned: number;
  /** Stores newly unlocked achievement ids. */
  newlyUnlockedAchievementIds: string[];
  /** Stores new xp. */
  newXp?: number;
  /** Stores new level. */
  newLevel?: number;
  /** Stores leveled up. */
  leveledUp?: boolean;
  /** Stores new win streak. */
  newWinStreak?: number;
  /** Stores reward breakdown. */
  rewardBreakdown?: {
    newBalance: number;
    totalAwarded: number;
  };
};

/** Describes spend coins result. */
type SpendCoinsResult = {
  /** Stores new coins. */
  newCoins: number;
};

/** Describes one server-authoritative single-player guess result. */
export type SinglePlayerGuessResult = {
  /** Per-letter canonical feedback. */
  feedback: Array<{letter: string; status: "green" | "yellow" | "red"}>;
  /** Server-counted attempts. */
  attempts: number;
  /** Canonical correctness. */
  isCorrect: boolean;
  /** Indicates a terminal outcome. */
  gameOver: boolean;
  /** Indicates that the paid extra attempt can be offered. */
  canContinue?: boolean;
};

/** Describes skip result. */
type SkipResult = {
  /** Stores success. */
  success: boolean;
  /** Stores message. */
  message: string;
  /** Stores cost deducted. */
  costDeducted: number;
  /** Stores new progress. */
  newProgress?: {
    classicIndex?: number;
    dailyChallengeIndex?: number;
    dailyChallengeCurrentQuestion?: number;
  } | null;
};

/** Describes a completed or player-cancelled checkout. */
export type PurchaseResult =
  | {
      /** Indicates that the checkout completed. */
      success: true;
      /** Prevents a completed checkout from being mistaken for a cancellation. */
      cancelled?: never;
      /** Stores product id. */
      productId: string;
      /** Stores purchase type. */
      purchaseType?: "consumable" | "subscription";
      /** Stores coins awarded. */
      coinsAwarded?: number;
      /** Stores new coins. */
      newCoins?: number;
      /** Stores newly unlocked achievement ids. */
      newlyUnlockedAchievementIds?: string[];
    }
  | {
      /** Indicates that no purchase completed. */
      success: false;
      /** Identifies an expected player cancellation. */
      cancelled: true;
      /** Stores product id. */
      productId: string;
      /** Stores purchase type. */
      purchaseType: "consumable" | "subscription";
      /** Prevents cancelled checkouts from carrying a coin grant. */
      coinsAwarded?: never;
      /** Prevents cancelled checkouts from carrying a new balance. */
      newCoins?: never;
      /** Prevents cancelled checkouts from carrying achievements. */
      newlyUnlockedAchievementIds?: never;
    };

/** Describes host services. */
export type HostServices = {
  /** Stores products. */
  readonly products: ProductSummary[];
  /** Stores auth. */
  readonly auth: AuthAdapter;
  /** Loads riddle. */
  loadRiddle(input: {
    gameMode: WebGameMode;
    locale: string;
    classicIndex?: number;
    sessionToken?: string;
    riddleId?: string;
  }): Promise<BridgeRiddle>;
  /** Loads profile. */
  loadProfile(userId: string): Promise<BridgeProfile | null>;
  /** Completes game. */
  completeGame(input: {
    riddleId: string;
    gameMode: WebGameMode;
    sessionToken: string;
  }): Promise<CompletionResult>;
  /** Submits one authoritative single-player guess. */
  submitGuess(input: {
    riddleId: string;
    gameMode: WebGameMode;
    sessionToken: string;
    guess: string;
    requestId: string;
  }): Promise<SinglePlayerGuessResult>;
  /** Requests hint. */
  requestHint(input: {
    riddleId: string;
    gameMode: WebGameMode;
    sessionToken: string;
    requestId: string;
    currentAttempt: string[];
  }): Promise<HintResult>;
  /** Provides spend coins behavior. */
  spendCoins(input: {
    reason: "continue";
    gameMode: WebGameMode;
    riddleId: string;
    sessionToken: string;
    requestId: string;
    amount?: number;
  }): Promise<SpendCoinsResult>;
  /** Provides skip riddle behavior. */
  skipRiddle(input: {
    riddleId: string;
    gameMode: WebGameMode;
    sessionToken: string;
    requestId: string;
  }): Promise<SkipResult>;
  /** Requests purchase. */
  requestPurchase(productId: string): Promise<PurchaseResult>;
  /** Loads leaderboard. */
  loadLeaderboard(type: LeaderboardType): Promise<BridgeLeaderboardEntry[]>;
  /** Updates username. */
  updateUsername(username: string): Promise<BridgeProfile | null>;
  /** Updates avatar. */
  updateAvatar(imageDataUrl: string): Promise<BridgeProfile | null>;
  /** Deletes account. */
  deleteAccount(): Promise<void>;
  /** Lists race categories. */
  listRaceCategories(locale: StartRaceRunRequest["locale"]): Promise<ListRaceCategoriesResponse>;
  /** Starts race. */
  startRace(input: StartRaceRunRequest): Promise<RaceRunResponse>;
  /** Submits race guess. */
  submitRaceGuess(input: SubmitRaceGuessRequest): Promise<SubmitRaceGuessResponse>;
  /** Requests race hint. */
  requestRaceHint(input: RequestRaceHintRequest): Promise<RequestRaceHintResponse>;
  /** Provides skip race riddle behavior. */
  skipRaceRiddle(input: SkipRaceRiddleRequest): Promise<SkipRaceRiddleResponse>;
  /** Provides resume race behavior. */
  resumeRace(runId: string): Promise<RaceRunResponse>;
  /** Provides abandon race behavior. */
  abandonRace(input: AbandonRaceRunRequest): Promise<AbandonRaceRunResponse>;
  /** Publishes race. */
  publishRace(input: PublishRaceChallengeRequest): Promise<PublishRaceChallengeResponse>;
  /** Gets race challenge. */
  getRaceChallenge(challengeId: string): Promise<RaceChallengePreview>;
  /** Gets race outcome. */
  getRaceOutcome(runId: string): Promise<RaceOutcome>;
  /** Lists race inbox. */
  listRaceInbox(input?: {cursor?: string; limit?: number}): Promise<ListRaceInboxResponse>;
  /** Gets race access. */
  getRaceAccess(): Promise<RaceAccessResponse>;
  /** Records race analytics. */
  recordRaceAnalytics(input: RaceAnalyticsEventRequest): Promise<{accepted: true}>;
};

/** Provides to product summaries behavior. */
export const toProductSummaries = (products: ProductPricing[]): ProductSummary[] =>
  products
    .filter((product) => product.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((product) => ({
      productId: product.productId,
      name: product.name,
      description: product.description,
      coins: product.coins,
      displayPrice: product.regionalPrices[0]?.displayPrice ?? "$0.00",
      featuredBadge: product.featuredBadge,
    }));
