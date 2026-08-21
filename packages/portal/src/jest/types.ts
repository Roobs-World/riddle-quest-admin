import type {PlayerData, PlayerDataUpdate, PlatformPreferences, SavedGame} from "../platform/types";
import type {PlatformResult} from "../platform/types";

export type {PlatformResult} from "../platform/types";

/** Describes the stable identity fields returned for a Jest player. */
type JestPlayer = {
  /** Platform-issued player identifier. */
  playerId: string;
  /** Indicates whether the player completed Jest registration. */
  registered: boolean;
};

/** Describes jest registration overlay handle. */
export type JestRegistrationOverlayHandle = {
  /** Provides login button action behavior. */
  loginButtonAction(): void;
  /** Provides close button action behavior. */
  closeButtonAction(): void;
};

/** Describes jest entry intent. */
export type JestEntryIntent = {
  /** Stores invite kind. */
  inviteKind?: "result" | "race" | "open";
  /** Stores game mode. */
  gameMode?: "classic" | "challenge";
  /** Stores campaign. */
  campaign?: string;
  /** Stores reference. */
  reference?: string;
  /** Stores challenge destination. */
  challengeDestination?: string;
  /** Stores custom name. */
  customName?: string;
  /** Stores inviter name. */
  inviterName?: string;
  /** Stores challenge id. */
  challengeId?: string;
  /** Stores riddle id. */
  riddleId?: string;
  /** Stores notification template. */
  notificationTemplate?: string;
  /** Stores notification offset. */
  notificationOffset?: string;
  /** Stores callback. */
  callback?: string;
  /** Stores utm source. */
  utmSource?: string;
  /** Stores utm medium. */
  utmMedium?: string;
  /** Stores utm campaign. */
  utmCampaign?: string;
  /** Stores utm term. */
  utmTerm?: string;
  /** Stores utm content. */
  utmContent?: string;
};

/** Describes jest preferences. */
export type JestPreferences = PlatformPreferences;

/** Describes jest saved game. */
export type JestSavedGame = SavedGame;

/** Describes jest player data. */
export type JestPlayerData = PlayerData;

/** Describes jest player data update. */
export type JestPlayerDataUpdate = PlayerDataUpdate;

/** Counters used to schedule engagement notifications and update player progress. */
export type JestEngagementProgress = {
  /** Current player level. */
  level: number;
  /** Current consecutive-win count. */
  winStreak: number;
  /** Total completed-win count. */
  wins: number;
};

/** Describes jest product. */
type JestProduct = {
  /** Stores sku. */
  sku: string;
  /** Stores name. */
  name: string;
  /** Stores description. */
  description?: string;
  /** Stores price. */
  price: number;
  /** Stores currency. */
  currency: string;
};

/** Describes a purchase returned by the Jest platform. */
type JestPurchase = {
  /** Signed purchase token exchanged with the authoritative backend. */
  purchaseToken: string;
  /** Catalog SKU associated with the purchase. */
  productSku: string;
  /** Preserves additional platform fields without weakening required identity fields. */
  [key: string]: unknown;
};

/** Describes jest subscription. */
export type JestSubscription = {
  /** Stores sku. */
  sku: string;
  /** Stores display name. */
  displayName: string;
  /** Stores display description. */
  displayDescription: string | null;
  /** Stores price. */
  price: number;
  /** Stores currency. */
  currency: string;
  /** Stores billing period. */
  billingPeriod: "weekly" | "monthly" | "yearly";
  /** Stores status. */
  status: "active" | "inactive";
  /** Stores trial eligible. */
  trialEligible?: boolean;
};

/** Describes jest session. */
export type JestSession = {
  /** Firebase UID returned by the verified Jest identity exchange. */
  firebaseUid: string;
  /** Stores player. */
  player: JestPlayer;
  /** Stores profile. */
  profile: {username?: string; avatarUrl?: string | null} | null;
  /** Stores entry intent. */
  entryIntent: JestEntryIntent;
  /** Stores preferences. */
  preferences: JestPreferences;
  /** Stores player data. */
  playerData: JestPlayerData | null;
  /** Stores firebase authenticated. */
  firebaseAuthenticated: boolean;
};

/** Describes screenshot provider. */
export type ScreenshotProvider = () => string | null | Promise<string | null>;

/** Describes jest referral share. */
type JestReferralShare = {
  /** Stores reference. */
  reference: string;
  /** Stores share title. */
  shareTitle: string;
  /** Stores share text. */
  shareText: string;
  /** Stores share image. */
  shareImage?: string;
  /** Stores onboarding slug. */
  onboardingSlug?: string;
  /** Stores entry payload. */
  entryPayload: Record<string, string>;
};

/** Describes jest notification content. */
type JestNotificationContent = {
  /** Stores identifier. */
  identifier?: string;
  /** Stores title. */
  title?: string;
  /** Stores body. */
  body: string;
  /** Stores cta text. */
  ctaText: string;
  /** Stores priority. */
  priority?: "low" | "medium" | "high" | "critical";
  /** Stores asset reference. */
  assetReference?: string;
  /** Stores entry payload. */
  entryPayload?: Record<string, string>;
};

/** Describes jest notification schedule. */
export type JestNotificationSchedule = JestNotificationContent & (
  | {scheduledInDays: number; scheduledAt?: never}
  | {scheduledAt: Date; scheduledInDays?: never}
);

/** Defines the contract for jest platform port. */
export interface JestPlatformPort {
  /** Provides init behavior. */
  init(): Promise<PlatformResult<void>>;
  /** Gets player. */
  getPlayer(): JestPlayer;
  /** Gets player signed. */
  getPlayerSigned(): Promise<{player: JestPlayer; playerSigned: string}>;
  /** Provides login behavior. */
  login(entryPayload?: Record<string, string>): Promise<PlatformResult<JestPlayer>>;
  /** Provides show registration overlay behavior. */
  showRegistrationOverlay(options: {
    theme: "dark" | "light";
    entryPayload?: Record<string, string>;
    onClose: () => void;
  }): PlatformResult<JestRegistrationOverlayHandle>;
  /** Reads preferences. */
  readPreferences(): JestPreferences;
  /** Provides write preferences behavior. */
  writePreferences(preferences: JestPreferences): Promise<void>;
  /** Reads player data. */
  readPlayerData(): JestPlayerData | null | Promise<JestPlayerData | null>;
  /** Provides write player data behavior. */
  writePlayerData(playerData: JestPlayerData): Promise<void>;
  /** Clears all client-writable state after authoritative account deletion. */
  clearPlayerState(): Promise<void>;
  /** Gets entry intent. */
  getEntryIntent(): JestEntryIntent;
  /** Gets profile. */
  getProfile(): Promise<{username?: string; avatarUrl?: string | null} | null>;
  /** Provides schedule notification behavior. */
  scheduleNotification(input: JestNotificationSchedule): Promise<PlatformResult<void>>;
  /** Removes notification. */
  removeNotification(identifier: string): Promise<PlatformResult<void>>;
  /** Provides share referral behavior. */
  shareReferral(input: JestReferralShare): Promise<PlatformResult<void>>;
  /** Lists referrals signed. */
  listReferralsSigned(): Promise<PlatformResult<string>>;
  /** Sets screenshot provider. */
  setScreenshotProvider(provider: ScreenshotProvider | null): void;
  /** Gets products. */
  getProducts(): Promise<PlatformResult<JestProduct[]>>;
  /** Provides begin purchase behavior. */
  beginPurchase(productSku: string): Promise<PlatformResult<{purchase: JestPurchase; purchaseSigned: string}>>;
  /** Gets incomplete purchases. */
  getIncompletePurchases(): Promise<
    PlatformResult<{purchases: JestPurchase[]; purchasesSigned: string; hasMore: boolean}>
  >;
  /** Completes purchase. */
  completePurchase(purchaseToken: string): Promise<PlatformResult<void>>;
  /** Gets subscriptions. */
  getSubscriptions(): Promise<
    PlatformResult<{subscriptions: JestSubscription[]; subscriptionsSigned: string}>
  >;
  /** Provides begin subscription behavior. */
  beginSubscription(subscriptionSku: string): Promise<
    PlatformResult<{subscription: JestSubscription; subscriptionSigned: string}>
  >;
  /** Captures event. */
  captureEvent(name: string, properties?: Record<string, string | number | boolean>): void;
  /** Provides mark first milestone behavior. */
  markFirstMilestone(): Promise<PlatformResult<void>>;
  /** Sets loading progress. */
  setLoadingProgress(progress: number): void;
  /** Provides mark game loaded behavior. */
  markGameLoaded(): void;
}
