import type {BridgeLeaderboardEntry, BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import type {ProductPricing} from "@qwordly/core/pricing/catalog";
import type {
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

export type WebGameMode = "classic" | "challenge";
export type LeaderboardType = "xp" | "totalWins" | "bestStreak";

export type ProductSummary = {
  productId: string;
  productType?: "consumable" | "subscription";
  name: string;
  description: string;
  coins: number;
  displayPrice: string;
  featuredBadge?: string;
  billingPeriod?: "weekly" | "monthly" | "yearly";
  subscriptionStatus?: "active" | "inactive";
  trialEligible?: boolean;
};

export type AuthSnapshot = {
  user: BridgeUser | null;
  profile: BridgeProfile | null;
};

type AuthAdapter = {
  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void;
};

type HintResult = {
  revealedLetter: string;
  index: number;
  coinsCost: number;
  newCoins?: number;
  newlyUnlockedAchievementIds?: string[];
} | null;

export type CompletionResult = {
  coinsEarned: number;
  newlyUnlockedAchievementIds: string[];
  newXp?: number;
  newLevel?: number;
  leveledUp?: boolean;
  newWinStreak?: number;
  rewardBreakdown?: {
    newBalance: number;
    totalAwarded: number;
  };
};

type SpendCoinsResult = {
  newCoins: number;
};

type SkipResult = {
  success: boolean;
  message: string;
  costDeducted: number;
  newProgress?: {
    classicIndex?: number;
    dailyChallengeIndex?: number;
    dailyChallengeCurrentQuestion?: number;
  } | null;
};

export type PurchaseResult = {
  success: boolean;
  productId: string;
  purchaseType?: "consumable" | "subscription";
  coinsAwarded?: number;
  newCoins?: number;
  newlyUnlockedAchievementIds?: string[];
};

export type HostServices = {
  readonly products: ProductSummary[];
  readonly auth: AuthAdapter;
  loadRiddle(input: {gameMode: WebGameMode; locale: string; classicIndex?: number}): Promise<BridgeRiddle>;
  loadProfile(userId: string): Promise<BridgeProfile | null>;
  completeGame(input: {
    riddleId: string;
    gameMode: WebGameMode;
    attempts: number;
    isCorrect: boolean;
  }): Promise<CompletionResult>;
  requestHint(input: {riddleId: string; gameMode: WebGameMode; currentAttempt: string[]}): Promise<HintResult>;
  spendCoins(input: {
    reason: "hint" | "skip" | "continue";
    gameMode?: WebGameMode;
    amount?: number;
  }): Promise<SpendCoinsResult>;
  skipRiddle(input: {riddleId: string; gameMode: WebGameMode}): Promise<SkipResult>;
  requestPurchase(productId: string): Promise<PurchaseResult>;
  loadLeaderboard(type: LeaderboardType): Promise<BridgeLeaderboardEntry[]>;
  updateUsername(username: string): Promise<BridgeProfile | null>;
  updateAvatar(imageDataUrl: string): Promise<BridgeProfile | null>;
  listRaceCategories(locale: StartRaceRunRequest["locale"]): Promise<ListRaceCategoriesResponse>;
  startRace(input: StartRaceRunRequest): Promise<RaceRunResponse>;
  submitRaceGuess(input: SubmitRaceGuessRequest): Promise<SubmitRaceGuessResponse>;
  requestRaceHint(input: RequestRaceHintRequest): Promise<RequestRaceHintResponse>;
  skipRaceRiddle(input: SkipRaceRiddleRequest): Promise<SkipRaceRiddleResponse>;
  resumeRace(runId: string): Promise<RaceRunResponse>;
  publishRace(input: PublishRaceChallengeRequest): Promise<PublishRaceChallengeResponse>;
  getRaceChallenge(challengeId: string): Promise<RaceChallengePreview>;
  getRaceOutcome(runId: string): Promise<RaceOutcome>;
  listRaceInbox(input?: {cursor?: string; limit?: number}): Promise<ListRaceInboxResponse>;
  getRaceAccess(): Promise<RaceAccessResponse>;
  recordRaceAnalytics(input: RaceAnalyticsEventRequest): Promise<{accepted: true}>;
};

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
