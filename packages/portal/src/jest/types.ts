import type {BridgeProfile} from "@qwordly/core/bridge";
import type {Feedback, GameEngineSnapshot, ScoredGuess} from "@qwordly/core/game";

type JestPlayer = {playerId: string; registered: boolean};

export type JestRegistrationOverlayHandle = {
  loginButtonAction(): void;
  closeButtonAction(): void;
};

export type JestEntryIntent = {
  gameMode?: "classic" | "challenge";
  campaign?: string;
  reference?: string;
  challengeDestination?: string;
  customName?: string;
  inviterName?: string;
  challengeId?: string;
};

export type JestPreferences = {
  locale?: string;
  muted?: boolean;
  reducedMotion?: boolean;
  highContrast?: boolean;
  onboardingComplete?: boolean;
  registrationPromptDismissedAt?: number;
  firstMilestoneMarked?: boolean;
};

export type JestSavedGame = {
  schemaVersion: 1;
  savedAt: number;
  riddleId: string;
  gameMode: "classic" | "challenge";
  currentLetters: string[];
  activeSlotIndex: number;
  hintRevealedIndices: number[];
  guesses: ScoredGuess[];
  engineSnapshot: GameEngineSnapshot;
  letterStates: Record<string, Feedback>;
};

export type JestPlayerData = {
  schemaVersion: 1;
  updatedAt: number;
  profile?: BridgeProfile;
  activeGame?: JestSavedGame | null;
};

export type JestPlayerDataUpdate = Pick<JestPlayerData, "profile" | "activeGame">;

export type PlatformResult<T> =
  | {status: "success"; value: T}
  | {status: "cancelled"}
  | {status: "retryable-failure"; message: string}
  | {status: "terminal-failure"; message: string}
  | {status: "unavailable"; message: string};

type JestProduct = {
  sku: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
};

type JestPurchase = {purchaseToken: string; productSku: string; [key: string]: unknown};

export type JestSession = {
  player: JestPlayer;
  profile: {username?: string; avatarUrl?: string | null} | null;
  entryIntent: JestEntryIntent;
  preferences: JestPreferences;
  playerData: JestPlayerData | null;
  firebaseAuthenticated: boolean;
};

export type ScreenshotProvider = () => string | null | Promise<string | null>;

type JestReferralShare = {
  reference: string;
  title: string;
  text: string;
  onboardingSlug?: string;
  entryPayload: Record<string, string>;
};

export interface JestPlatformPort {
  init(): Promise<PlatformResult<void>>;
  getPlayer(): JestPlayer;
  getPlayerSigned(): Promise<{player: JestPlayer; playerSigned: string}>;
  login(): Promise<PlatformResult<JestPlayer>>;
  showRegistrationOverlay(options: {
    theme: "dark" | "light";
    entryPayload?: Record<string, string>;
    onClose: () => void;
  }): PlatformResult<JestRegistrationOverlayHandle>;
  readPreferences(): JestPreferences;
  writePreferences(preferences: JestPreferences): Promise<void>;
  readPlayerData(): JestPlayerData | null;
  writePlayerData(playerData: JestPlayerData): Promise<void>;
  getEntryIntent(): JestEntryIntent;
  getProfile(): Promise<{username?: string; avatarUrl?: string | null} | null>;
  scheduleNotification(input: {
    identifier: string;
    scheduledInDays: number;
    title?: string;
    body: string;
    ctaText: string;
    priority?: "low" | "medium" | "high" | "critical";
    assetReference?: string;
    entryPayload?: Record<string, string>;
  }): Promise<PlatformResult<void>>;
  removeNotification(identifier: string): Promise<PlatformResult<void>>;
  shareReferral(input: JestReferralShare): Promise<PlatformResult<void>>;
  listReferralsSigned(): Promise<PlatformResult<string>>;
  setScreenshotProvider(provider: ScreenshotProvider | null): void;
  getProducts(): Promise<PlatformResult<JestProduct[]>>;
  beginPurchase(productSku: string): Promise<PlatformResult<{purchase: JestPurchase; purchaseSigned: string}>>;
  getIncompletePurchases(): Promise<
    PlatformResult<{purchases: JestPurchase[]; purchasesSigned: string; hasMore: boolean}>
  >;
  completePurchase(purchaseToken: string): Promise<PlatformResult<void>>;
  markFirstMilestone(): Promise<PlatformResult<void>>;
  setLoadingProgress(progress: number): void;
  markGameLoaded(): void;
}
