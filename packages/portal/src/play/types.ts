import type {
  BridgeLeaderboardEntry,
  BridgeProfile,
  BridgeRiddle,
  BridgeUser,
} from "@qwordly/core/bridge";
import type {ProductPricing} from "@qwordly/core/pricing/catalog";

export type WebGameMode = "classic" | "challenge";
export type RewardedAdPlacement = "loss_continue" | "coin_shop";
export type LeaderboardType = "xp" | "totalWins" | "bestStreak";

export type ProductSummary = {
  productId: string;
  name: string;
  description: string;
  coins: number;
  displayPrice: string;
  featuredBadge?: string;
};

export type AuthSnapshot = {
  user: BridgeUser | null;
  profile: BridgeProfile | null;
};

export type AuthAdapter = {
  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void;
  signInGuest(): Promise<void>;
  signInEmail(email: string, password: string): Promise<void>;
  signInGoogle(): Promise<void>;
  signInFacebook(): Promise<void>;
  signOut(): Promise<void>;
};

export type HintResult = {
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

export type SpendCoinsResult = {
  newCoins: number;
};

export type SkipResult = {
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
  coinsAwarded: number;
  newCoins: number;
  newlyUnlockedAchievementIds?: string[];
};

export type RewardedAdResult = {
  success: boolean;
  placement: RewardedAdPlacement;
  callbackId: string;
  provider: string;
  rewardCoins: number;
  newCoins: number;
  alreadyProcessed?: boolean;
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
  requestHint(input: {
    riddleId: string;
    gameMode: WebGameMode;
    currentAttempt: string[];
  }): Promise<HintResult>;
  spendCoins(input: {
    reason: "hint" | "skip" | "continue";
    gameMode?: WebGameMode;
    amount?: number;
  }): Promise<SpendCoinsResult>;
  skipRiddle(input: {riddleId: string; gameMode: WebGameMode}): Promise<SkipResult>;
  requestPurchase(productId: string): Promise<PurchaseResult>;
  requestRewardedAd(input: {placement: RewardedAdPlacement; userId: string}): Promise<RewardedAdResult>;
  loadLeaderboard(type: LeaderboardType): Promise<BridgeLeaderboardEntry[]>;
  updateUsername(username: string): Promise<BridgeProfile | null>;
};

export type WebPurchaseProvider = {
  readonly id: string;
  purchase(product: ProductSummary, profile: BridgeProfile | null): Promise<PurchaseResult>;
};

export type WebRewardedAdProvider = {
  readonly id: string;
  requestReward(placement: RewardedAdPlacement): Promise<{
    callbackId: string;
    provider: string;
    rewardCoins: number;
  }>;
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
