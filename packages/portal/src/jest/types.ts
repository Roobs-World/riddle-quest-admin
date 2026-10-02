import type {PlayerData, PlayerDataUpdate, PlatformPreferences, SavedGame} from "../platform/types";
import type {PlatformResult} from "../platform/types";

export type {PlatformResult} from "../platform/types";

/** Stable, target-scoped identity fields returned directly by the Jest SDK. */
type JestPlayer = {
  /** Platform-issued player identifier. */
  playerId: string;
  /** Indicates whether the player completed Jest registration. */
  registered: boolean;
};

/** Imperative controls for the provider-rendered registration overlay. */
export type JestRegistrationOverlayHandle = {
  /** Invokes the provider overlay's login/registration action. */
  loginButtonAction(): void;
  /** Closes the provider overlay without asserting that registration completed. */
  closeButtonAction(): void;
};

/**
 * Bounded, sanitized launch attribution parsed from Jest entry data and approved query fields.
 *
 * @remarks
 * Every field is optional because direct launches carry no attribution. Values
 * are presentation or routing hints only; authorization and rewards must be
 * verified independently by the authoritative backend.
 */
export type JestEntryIntent = {
  /** Kind of provider invite that opened the game. */
  inviteKind?: "result" | "race" | "open";
  /** Requested initial single-player mode. */
  gameMode?: "classic" | "challenge";
  /** Bounded campaign code used for low-cardinality attribution. */
  campaign?: string;
  /** Opaque per-share reference; it is not a player identifier. */
  reference?: string;
  /** Sanitized in-game destination such as the race inbox or a challenge. */
  challengeDestination?: string;
  /** Optional display name supplied by approved provider entry data. */
  customName?: string;
  /** Optional inviter display name used only for launch presentation. */
  inviterName?: string;
  /** Opaque multiplayer challenge identifier, subject to invite-kind validation. */
  challengeId?: string;
  /** Opaque riddle identifier associated with a result share. */
  riddleId?: string;
  /** Notification template that produced the launch. */
  notificationTemplate?: string;
  /** Bounded notification schedule offset used for attribution. */
  notificationOffset?: string;
  /** Bounded callback campaign variant. */
  callback?: string;
  /** Sanitized UTM source from provider data or the launch query. */
  utmSource?: string;
  /** Sanitized UTM medium from provider data or the launch query. */
  utmMedium?: string;
  /** Sanitized UTM campaign from provider data or the launch query. */
  utmCampaign?: string;
  /** Sanitized UTM term from provider data or the launch query. */
  utmTerm?: string;
  /** Sanitized UTM content from provider data or the launch query. */
  utmContent?: string;
};

/** Jest SDK storage projection of the cross-target preference schema. */
export type JestPreferences = PlatformPreferences;

/** Jest SDK storage projection of a versioned resumable game. */
export type JestSavedGame = SavedGame;

/** Complete versioned player snapshot stored under the Jest app-owned data key. */
export type JestPlayerData = PlayerData;

/** Client-writable fields merged into the next Jest player snapshot. */
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

/** Validated Jest consumable returned by the provider catalog. */
type JestProduct = {
  /** Provider SKU passed unchanged to checkout. */
  sku: string;
  /** Provider-localized product name. */
  name: string;
  /** Optional provider-localized product description. */
  description?: string;
  /** Numeric price paired with {@link currency}. */
  price: number;
  /** ISO-style currency code reported by Jest. */
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

/** Validated subscription catalog/entitlement projection returned by Jest. */
export type JestSubscription = {
  /** Provider subscription SKU used for checkout and entitlement matching. */
  sku: string;
  /** Provider-localized display name. */
  displayName: string;
  /** Provider-localized description, when supplied. */
  displayDescription: string | null;
  /** Numeric recurring price paired with {@link currency}. */
  price: number;
  /** Currency code reported by Jest. */
  currency: string;
  /** Recurrence interval used for presentation. */
  billingPeriod: "weekly" | "monthly" | "yearly";
  /** Current provider entitlement status. */
  status: "active" | "inactive";
  /** Whether Jest currently allows a trial for this player and SKU. */
  trialEligible?: boolean;
};

/**
 * Fully initialized Jest session ready for the shared game shell.
 *
 * @remarks
 * The provider-signed player payload has already been exchanged by the backend
 * before this value is published. The Firebase UID is provider-scoped; SDK data
 * remains client-writable and must not be treated as an economy authority.
 */
export type JestSession = {
  /** Firebase UID returned by the verified Jest identity exchange. */
  firebaseUid: string;
  /** Current player identity reported by the Jest SDK. */
  player: JestPlayer;
  /** Optional provider profile used only for display. */
  profile: {
    /** Stores username. */
    username?: string; /** Stores avatar url. */
    /** Stores avatar url. */
    avatarUrl?: string | null;
  } | null;
  /** Sanitized launch attribution and initial routing hints. */
  entryIntent: JestEntryIntent;
  /** Client-writable preferences restored from Jest SDK storage. */
  preferences: JestPreferences;
  /** Validated, client-writable resumable state restored from Jest SDK storage. */
  playerData: JestPlayerData | null;
  /** Confirms that the verified custom-token sign-in completed for this session. */
  firebaseAuthenticated: boolean;
};

/**
 * Lazily captures a share image for the provider.
 *
 * @returns A data URL, `null` when capture is unavailable, or a promise of either.
 */
export type ScreenshotProvider = () => string | null | Promise<string | null>;

/** Provider share payload with an opaque reference and sanitized entry attribution. */
type JestReferralShare = {
  /** Unique opaque reference used for server-side referral reconciliation. */
  reference: string;
  /** Provider share-dialog title. */
  shareTitle: string;
  /** Provider share-dialog body. */
  shareText: string;
  /** Optional bounded screenshot or bundled image. */
  shareImage?: string;
  /** Sanitized values returned to a recipient launch; never trusted as authority. */
  entryPayload: Record<string, string>;
};

/** Provider notification content and launch attribution. */
type JestNotificationContent = {
  /** Stable identifier used to replace or unschedule a notification. */
  identifier?: string;
  /** Optional provider notification title. */
  title?: string;
  /** Localized notification body. */
  body: string;
  /** Localized call-to-action text. */
  ctaText: string;
  /** Delivery priority understood by the Jest scheduler. */
  priority?: "low" | "medium" | "high" | "critical";
  /** Sanitized launch data delivered when the notification is opened. */
  entryPayload?: Record<string, string>;
};

/** Exactly one inline image or approved library reference, or the platform Hero fallback. */
export type JestNotificationAsset =
  | {
      /** PNG, JPEG, or WebP base64 data URL, at most 2MiB decoded. */
      asset: string;
      /** Inline images cannot accompany a library reference. */
      assetReference?: never;
    }
  | {
      /** Library references cannot accompany an inline image. */
      asset?: never;
      /** Approved library asset, or omitted to use the platform Hero image. */
      assetReference?: string;
    };

/**
 * Notification request with exactly one delivery time and at most one asset source.
 *
 * @remarks
 * The mutually exclusive fields prevent ambiguous provider scheduling. Eligibility
 * and registration checks still occur at the {@link JestPlatformPort} boundary.
 */
export type JestNotificationSchedule = JestNotificationContent & JestNotificationAsset &
  (
    | {
        /** Stores scheduled in days. */
        scheduledInDays: number; /** Stores scheduled at. */
        /** Stores scheduled at. */
        scheduledAt?: never;
      }
    | {
        /** Stores scheduled at. */
        scheduledAt: Date; /** Stores scheduled in days. */
        /** Stores scheduled in days. */
        scheduledInDays?: never;
      }
  );

/**
 * Narrow Jest SDK adapter consumed by startup, storage, sharing, notification,
 * and payment coordinators.
 *
 * @remarks
 * Provider exceptions are normalized into {@link PlatformResult} where the
 * interface declares one. Signed payloads remain opaque until exchanged with the
 * authoritative backend; SDK storage and catalog responses never grant value.
 */
export interface JestPlatformPort {
  /**
   * Initializes the provider SDK with automatic login reminders disabled.
   *
   * @returns `success` when SDK APIs are ready, otherwise a normalized failure.
   */
  init(): Promise<PlatformResult<void>>;
  /** @returns The current target-scoped player identity from the initialized SDK. */
  getPlayer(): JestPlayer;
  /**
   * Requests the signed identity envelope used by the backend exchange.
   *
   * @returns The current player projection and opaque signed payload.
   */
  getPlayerSigned(): Promise<{
    /** Stores player. */
    player: JestPlayer; /** Stores player signed. */
    /** Stores player signed. */
    playerSigned: string;
  }>;
  /**
   * Opens Jest login/registration when the player is still a guest.
   *
   * @param entryPayload - Optional sanitized attribution forwarded through the provider flow.
   * @returns The resulting player identity, cancellation, or normalized failure.
   */
  login(entryPayload?: Record<string, string>): Promise<PlatformResult<JestPlayer>>;
  /**
   * Creates the provider-owned registration overlay without assuming completion.
   *
   * @param options - Theme, sanitized entry attribution, and close callback.
   * @returns Imperative overlay controls or a normalized synchronous failure.
   */
  showRegistrationOverlay(options: {
    /** Stores theme. */
    theme: "dark" | "light";
    /** Branded SMS/RCS request containing the provider-owned registration-code placeholder. */
    message: string;
    /** Stores entry payload. */
    entryPayload?: Record<string, string>;
    /** Stores on close. */
    onClose: () => void;
  }): PlatformResult<JestRegistrationOverlayHandle>;
  /** @returns Validated app-owned preference fields from synchronous SDK storage. */
  readPreferences(): JestPreferences;
  /**
   * Writes and flushes app-owned preference fields.
   *
   * @param preferences - Validated partial preference projection.
   */
  writePreferences(preferences: JestPreferences): Promise<void>;
  /** @returns The validated versioned snapshot, or `null` for empty/invalid storage. */
  readPlayerData(): JestPlayerData | null | Promise<JestPlayerData | null>;
  /** Writes and flushes one complete versioned snapshot under the app-owned key. */
  writePlayerData(playerData: JestPlayerData): Promise<void>;
  /** Clears all client-writable state after authoritative account deletion. */
  clearPlayerState(): Promise<void>;
  /** @returns Sanitized launch attribution from provider entry data and approved query fields. */
  getEntryIntent(): JestEntryIntent;
  /** @returns Optional provider display profile; it is not used for authorization. */
  getProfile(): Promise<{
    /** Stores username. */
    username?: string; /** Stores avatar url. */
    /** Stores avatar url. */
    avatarUrl?: string | null;
  } | null>;
  /**
   * Schedules a notification for a registered player.
   *
   * @param input - Localized content plus exactly one delivery-time form.
   */
  scheduleNotification(input: JestNotificationSchedule): Promise<PlatformResult<void>>;
  /**
   * Removes a registered player's scheduled notification.
   *
   * @param identifier - Stable identifier supplied when the notification was scheduled.
   */
  removeNotification(identifier: string): Promise<PlatformResult<void>>;
  /**
   * Opens Jest's referral-share surface.
   *
   * @returns `cancelled` for an expected player dismissal rather than a failure.
   */
  shareReferral(input: JestReferralShare): Promise<PlatformResult<void>>;
  /** @returns An opaque signed referral list for authoritative backend verification. */
  listReferralsSigned(): Promise<PlatformResult<string>>;
  /** Registers or removes the lazy screenshot callback used by provider sharing. */
  setScreenshotProvider(provider: ScreenshotProvider | null): void;
  /** @returns Provider-priced consumables for presentation; no grants are implied. */
  getProducts(): Promise<PlatformResult<JestProduct[]>>;
  /**
   * Opens a consumable checkout.
   *
   * @param productSku - Exact SKU returned by {@link getProducts}.
   * @returns Provider purchase data and its opaque signature for backend granting.
   */
  beginPurchase(productSku: string): Promise<
    PlatformResult<{
      /** Stores purchase. */
      purchase: JestPurchase; /** Stores purchase signed. */
      /** Stores purchase signed. */
      purchaseSigned: string;
    }>
  >;
  /**
   * Lists purchases that still require authoritative grant or provider completion.
   *
   * @returns Bounded provider purchases, their aggregate signature, and pagination state.
   */
  getIncompletePurchases(): Promise<
    PlatformResult<{
      /** Stores purchases. */
      purchases: JestPurchase[]; /** Stores purchases signed. */
      /** Stores purchases signed. */
      purchasesSigned: string; /** Stores has more. */
      /** Stores has more. */
      hasMore: boolean;
    }>
  >;
  /**
   * Marks a provider purchase complete after the backend grant succeeds idempotently.
   *
   * @param purchaseToken - Exact token returned by Jest for the granted purchase.
   */
  completePurchase(purchaseToken: string): Promise<PlatformResult<void>>;
  /** @returns Provider subscription state and an opaque signature for backend entitlement sync. */
  getSubscriptions(): Promise<
    PlatformResult<{
      /** Stores subscriptions. */
      subscriptions: JestSubscription[]; /** Stores subscriptions signed. */
      /** Stores subscriptions signed. */
      subscriptionsSigned: string;
    }>
  >;
  /** Opens provider cancellation confirmation without revoking the paid-period entitlement. */
  cancelSubscription(subscriptionSku: string): Promise<PlatformResult<void>>;
  /**
   * Opens a bounded subscription checkout.
   *
   * @param subscriptionSku - Exact provider subscription SKU.
   * @returns The resulting subscription and signed entitlement envelope.
   */
  beginSubscription(subscriptionSku: string): Promise<
    PlatformResult<{
      /** Stores subscription. */
      subscription: JestSubscription; /** Stores subscription signed. */
      /** Stores subscription signed. */
      subscriptionSigned: string;
    }>
  >;
  /** Sends one low-cardinality event through the optional Jest analytics surface. */
  captureEvent(name: string, properties?: import("../analytics/events").SanitizedAnalyticsParams): void;
  /** Idempotently reports the provider-defined first gameplay milestone. */
  markFirstMilestone(): Promise<PlatformResult<void>>;
  /** Reports provider loading progress on the inclusive 0-100 scale. */
  setLoadingProgress(progress: number): void;
  /** Dismisses Jest's loading surface after the game is interactive. */
  markGameLoaded(): void;
}
