import type {BridgeProfile} from "../bridge/messages";
import {type Feedback, type ScoredGuess} from "../../gameplay/contracts/scoring";
import {type GameEngineSnapshot} from "../../gameplay/controllers/GameEngine";
import type {
  ListFacebookTournamentResponse,
  RaceLocale,
  RecordFacebookTournamentRunResponse,
  ListFacebookContextBoardResponse,
  RecordFacebookContextRunResponse,
} from "../../races/contracts/index";

/** Identifies the release target that owns the active browser session. */
export type PlatformId = "facebook" | "reddit" | "youtube";

/**
 * Declares which browser behaviors are owned by the game and which are delegated
 * to the active platform.
 *
 * @remarks
 * A target policy is a build-time boundary, not a feature-detection result. Code
 * must not infer unavailable integrations when a policy disables them.
 */
export type PlatformRuntimePolicy = Readonly<{
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

/**
 * Hosted-web policy retained by Facebook and Reddit.
 *
 * @remarks
 * YouTube supplies its own restrictive policy so adding that target cannot
 * silently change the behavior of an existing artifact.
 */
export const LEGACY_PLATFORM_RUNTIME_POLICY: PlatformRuntimePolicy = Object.freeze({
  lifecycleSource: "browser",
  browserConnectivityRequired: true,
  platformOwnsMasterAudio: false,
  platformOwnsLocale: false,
  allowSharingPrompts: true,
  allowAccountManagement: true,
  allowCommerce: true,
  allowExternalNavigation: true,
  allowMultiplayer: true,
  preventEscapeDefault: true,
});

/**
 * Normalized outcome returned by optional provider operations.
 *
 * @remarks
 * `cancelled` represents an expected player choice. `retryable-failure` may be
 * attempted again, while `terminal-failure` indicates invalid input or another
 * permanent condition. `unavailable` means the operation cannot run in the
 * current account, runtime, or release configuration. Only `success` carries a
 * value; callers should branch on `status` instead of catching provider errors.
 */
export type {PlatformResult} from "../../races/controllers/matchmaking";
import type {PlatformResult} from "../../races/controllers/matchmaking";

/**
 * Portable, client-writable preferences restored before the shared game mounts.
 *
 * @remarks
 * Every field is optional because provider storage can be empty, from an older
 * schema, or deliberately restricted. Adapters must validate untrusted stored
 * values and ignore fields that do not belong to their target.
 */
export type PlatformPreferences = {
  /** Provider-stored language tag, validated against supported locales before use. */
  locale?: string;
  /** Player-selected game mute state when the platform does not own master audio. */
  muted?: boolean;
  /** Player-selected reduced-motion accessibility preference. */
  reducedMotion?: boolean;
  /** Master preference for game reminders and challenge notifications; absent means on. */
  notificationsEnabled?: boolean;
  /** Indicates that the shared first-run onboarding flow has completed. */
  onboardingComplete?: boolean;
  /** Explicit player consent for account-wide presence publication. */
  presenceEnabled?: boolean;
  /** Last durable Facebook notification-prompt outcome. */
  facebookNotificationPermission?: "unknown" | "declined" | "accepted";
  /** Server-authorized Facebook prompt time in Unix epoch milliseconds. */
  facebookNotificationLastPromptAtMs?: number;
};

export type {SavedGame} from "../../gameplay/session/checkpoints/savedGame";
import type {SavedGame} from "../../gameplay/session/checkpoints/savedGame";

/** Versioned client-owned player projection persisted by a platform adapter. */
export type PlayerData = {
  /** Storage schema discriminator for safe future migration. */
  schemaVersion: 1;
  /** Unix epoch milliseconds of the latest assembled projection. */
  updatedAt: number;
  /** Cached profile used for startup rendering while authoritative data loads. */
  profile?: BridgeProfile;
  /** Resumable game, explicit absence, or an omitted field from older storage. */
  activeGame?: SavedGame | null;
};

/** Client-writable portion merged into a new versioned {@link PlayerData} snapshot. */
export type PlayerDataUpdate = Pick<PlayerData, "profile" | "activeGame">;

/**
 * Target-owned persistence used by the shared game without importing a provider SDK.
 *
 * @remarks
 * Implementations serialize writes and validate reads at the provider boundary.
 * Preference storage is intentionally separate from the versioned player snapshot.
 */
export interface PlatformStorage {
  /** @returns Validated preferences, or an empty object when no usable data exists. */
  readPreferences(): Promise<PlatformPreferences>;
  /**
   * Persists the supplied preference projection.
   *
   * @param preferences - Validated client-writable fields for this target.
   */
  writePreferences(preferences: PlatformPreferences): Promise<void>;
  /** @returns A validated snapshot, or `null` when storage is empty or invalid. */
  readPlayerData(): Promise<PlayerData | null>;
  /**
   * Persists one complete versioned player snapshot.
   *
   * @param playerData - Client-owned profile cache and resumable game state.
   */
  writePlayerData(playerData: PlayerData): Promise<void>;
  /** Removes all app-owned preference and player-state keys for this account. */
  clear(): Promise<void>;
  /** Waits until writes queued before this call have reached provider storage. */
  flush(): Promise<void>;
}

/** Provider lifecycle callbacks used when browser visibility is not sufficient. */
export type LifecycleCapability = {
  /**
   * Registers a pause handler.
   *
   * @param callback - Flushes or checkpoints state when the provider pauses play.
   * @returns An unsubscribe function owned by the caller.
   */
  onPause(callback: () => void | Promise<void>): () => void;
  /**
   * Registers an optional provider resume handler.
   *
   * @param callback - Reconciles state after play becomes active again.
   * @returns An unsubscribe function owned by the caller.
   */
  onResume?(callback: () => void | Promise<void>): () => void;
};

/** Provider-priced catalog item safe to present in the shared shop. */
export type CommerceProduct = {
  /** Provider catalog identifier passed unchanged to {@link CommerceCapability.purchase}. */
  id: string;
  /** Provider-localized display title. */
  title: string;
  /** Provider-localized display description. */
  description: string;
  /** Provider-formatted price including currency. */
  price: string;
  /** Fulfilment model used by the server-authoritative grant flow. */
  kind: "consumable" | "durable" | "subscription";
};

/**
 * Optional provider commerce boundary.
 *
 * @remarks
 * A successful checkout returns only a provider receipt identifier. Valuable
 * grants remain server-authoritative and must complete before provider purchases
 * are consumed. Targets without approved commerce omit this capability.
 */
export type CommerceCapability = {
  /** @returns The validated provider catalog, or a normalized availability/failure result. */
  listProducts(): Promise<PlatformResult<CommerceProduct[]>>;
  /**
   * Opens one provider checkout without granting value in shared client code.
   *
   * @param productId - Exact identifier returned by {@link listProducts}.
   * @returns A normalized outcome whose success carries the provider receipt used for reconciliation.
   */
  purchase(productId: string): Promise<
    PlatformResult<{
      /** Stores provider receipt id. */
      providerReceiptId: string;
    }>
  >;
  /** Reconciles unfinished provider purchases idempotently after startup. */
  recover(): Promise<PlatformResult<void>>;
};

/**
 * Optional ad surface implemented only by an approved target artifact.
 *
 * @remarks
 * Capability absence is authoritative. Shared code must not load an ad SDK or
 * emulate an ad flow when this property is missing.
 */
export type AdsCapability = {
  /** True only when an independently gated opt-in video placement exists. */
  rewardedAvailable?: boolean;
  /**
   * Shows a rewarded placement without granting value client-side.
   *
   * @param placement - Target-defined, allowlisted placement identifier.
   */
  showRewarded(placement: string): Promise<PlatformResult<void>>;
  /**
   * Shows an interstitial subject to provider and session frequency policies.
   *
   * @param placement - Target-defined, allowlisted placement identifier.
   */
  showInterstitial(placement: string): Promise<PlatformResult<void>>;
};

/** Target-owned recovery of one exhausted authoritative single-player attempt. */
export type AttemptRecoveryCapability = {
  /** Resolves only after the provider flow and authoritative continuation succeed. */
  request(input: {
  /** Single-player mode bound to the continuation session. */
  gameMode: "classic" | "challenge";
  /** Authority-owned question identity for the continuation grant. */
  riddleId: string;
  /** Server-issued session token binds continuation to the current question. */
  sessionToken: string}):
    Promise<PlatformResult<{
    /** Validated authoritative balance returned after the continuation grant. */
    newCoins: number}>>;
};

/** Optional provider-owned notification permission and scheduling boundary. */
export type NotificationCapability = {
  /** Requests permission from a player-initiated, policy-eligible UI flow. */
  requestPermission(): Promise<PlatformResult<void>>;
  /**
   * Schedules one provider template.
   *
   * @param templateId - Allowlisted provider template identifier.
   * @param deliverAt - Delivery time in Unix epoch milliseconds.
   * @param payload - Bounded template substitution values.
   * @returns The provider notification identifier used for cancellation.
   */
  schedule(templateId: string, deliverAt: number, payload: Record<string, string>): Promise<PlatformResult<string>>;
  /** Cancels a notification previously returned by {@link schedule}. */
  cancel(notificationId: string): Promise<PlatformResult<void>>;
};

/** Optional provider-owned outbound sharing surface. */
export type SharingCapability = {
  /**
   * Opens the provider share UI with bounded presentation and opaque attribution data.
   *
   * @param payload - Text, optional image, and target-owned entry metadata.
   */
  share(payload: {
    /** Stores text. */
    text: string; /** Stores image. */
    /** Stores image. */
    image?: string; /** Stores data. */
    /** Stores data. */
    data?: Record<string, string>;
  }): Promise<PlatformResult<void>>;
};

/** Optional provider context selection that never exposes a social graph to game code. */
export type NativeSocialCapability = {
  /** Observes successful provider context changes; unsubscribe retires the callback. */
  onContextChange?(callback: () => void): () => void;
  /** @returns The active provider thread/group, or `unavailable` outside one. */
  currentContext(): PlatformResult<{
    /** Stores context id. */
    contextId: string; /** Stores context type. */
    /** Stores context type. */
    contextType: "THREAD" | "GROUP";
  }>;
  /** Opens the provider's context chooser and returns the selected context. */
  chooseContext(): Promise<
    PlatformResult<{
      /** Stores context id. */
      contextId: string; /** Stores context type. */
      /** Stores context type. */
      contextType: "THREAD" | "GROUP";
    }>
  >;
  /**
   * Asks the provider to match the player into a context.
   *
   * @param tag - Optional bounded provider matchmaking hint.
   */
  matchPlayer(tag?: string): Promise<
    PlatformResult<{
      /** Stores context id. */
      contextId: string; /** Stores context type. */
      /** Stores context type. */
      contextType: "THREAD" | "GROUP";
    }>
  >;
};

export type {MatchmakingResult, MatchmakingCapability} from "../../races/controllers/matchmaking";
import type {MatchmakingCapability} from "../../races/controllers/matchmaking";

/** Privacy-safe activity vocabulary shared by provider presence adapters. */
export type PresenceState = "offline" | "online" | "playing" | "racing";
/** Lease-backed presence polling used by targets that cannot open browser sockets. */
export type PresenceCapability = {
  /** Publishes the current lease state and returns visible rivals in one round trip. */
  poll(input: {
    /** Stores session id. */
    sessionId: string; /** Stores state. */
    /** Stores state. */
    state: Exclude<PresenceState, "offline">; /** Stores enabled. */
    /** Stores enabled. */
    enabled: boolean;
  }): Promise<{
    /** Stores rivals. */
    rivals: Array<{
      /** Stores user id. */
      userId: string; /** Stores state. */
      /** Stores state. */
      state: PresenceState;
    }>;
  }>;
  /** Ends one session lease and removes it from aggregate presence. */
  disconnect(sessionId: string): Promise<void>;
};

/** Optional provider-owned identity overlay that avoids returning profile data to JavaScript. */
export type OverlayCapability = {
  /**
   * Mounts provider-owned current-player UI into a connected surface.
   *
   * @returns A successful async disposer that must be called when the surface unmounts.
   */
  renderPlayer(options: {
    /** Stores player id. */
    playerId: string; /** Stores surface. */
    /** Stores surface. */
    surface: HTMLElement;
    /** Retires partial initialization while original provider operations remain observed. */
    signal?: AbortSignal;
  }): Promise<PlatformResult<() => Promise<void>>>;
};

/** Server-authoritative Facebook tournament access; Meta standings remain presentation-only. */
export type TournamentCapability = {
  /** Lists the current authoritative tournament window for a content locale. */
  list(locale: RaceLocale): Promise<ListFacebookTournamentResponse>;
  /** Records an idempotent completed run and returns refreshed standings. */
  record(runId: string, locale: RaceLocale): Promise<RecordFacebookTournamentRunResponse>;
  /** Opens a provider-owned share dialog using its fresh authoritative best; cancellation retires preparation only. */
  share?(locale: RaceLocale, signal?: AbortSignal): Promise<PlatformResult<void>>;
};

/** Server-authoritative board for the currently active Facebook thread/group context. */
export type ContextBoardCapability = {
  /** Invalidates current rows immediately when the owning provider context changes. */
  onContextChange?(callback: () => void): () => void;
  /** Lists validated standings or null for absent social context; cancellation retires admission while membership settles. */
  list(locale: RaceLocale, signal?: AbortSignal): Promise<ListFacebookContextBoardResponse | null>;
  /** Records an idempotent run, or returns null when no social context can receive it. */
  record(runId: string, locale: RaceLocale): Promise<RecordFacebookContextRunResponse | null>;
};

/**
 * Optional integrations exposed by the active release target.
 *
 * @remarks
 * Absence means unsupported, disabled, or not approved for this artifact and must
 * be handled by hiding the corresponding shared UI. Consumers must never import
 * another target's SDK to fill a missing capability.
 */
export type PlatformCapabilities = {
  /** Account operations supported without a provider registration/upgrade flow. */
  accountManagement?: {
    /** Whether the game account permits username changes. */
    username: boolean;
    /** Whether the target permits uploaded game avatars. */
    avatar: boolean;
    /** Whether authoritative account deletion is available. */
    deletion: boolean;
  };
  /** Provider pause/resume callbacks, when browser lifecycle events are insufficient. */
  lifecycle?: LifecycleCapability;
  /** Provider catalog and server-authoritative purchase flow. */
  commerce?: CommerceCapability;
  /** Target-approved rewarded/interstitial surfaces; Facebook-only in current builds. */
  ads?: AdsCapability;
  /** Optional provider-funded extra attempt; supplied only by Facebook. */
  attemptRecovery?: AttemptRecoveryCapability;
  /** Provider notification permission and scheduling surface. */
  notifications?: NotificationCapability;
  /** Provider-owned outbound sharing surface. */
  sharing?: SharingCapability;
  /** Provider thread/group selection without exposing a social graph. */
  nativeSocial?: NativeSocialCapability;
  /** Server-authoritative offline opponent selection. */
  matchmaking?: MatchmakingCapability;
  /** Privacy-safe activity publication and rival visibility. */
  presence?: PresenceCapability;
  /** Provider-rendered identity presentation. */
  overlay?: OverlayCapability;
  /** Server-authoritative provider tournament standings. */
  tournaments?: TournamentCapability;
  /** Server-authoritative standings scoped to the active provider context. */
  contextBoard?: ContextBoardCapability;
};

/**
 * Initialized target session consumed by the shared game shell.
 *
 * @remarks
 * This object contains only the minimum provider identity and adapters needed by
 * shared code. Provider SDK objects and credentials remain behind target modules.
 */
export interface PlatformSession {
  /** Release target that created the session. */
  readonly platform: PlatformId;
  /** Target-scoped player/session identifier; never assume cross-target identity. */
  readonly playerId: string;
  /** Target-owned validated persistence adapter. */
  readonly storage: PlatformStorage;
  /** Explicitly available optional integrations for this runtime. */
  readonly capabilities: PlatformCapabilities;
  /** Preferences restored during platform bootstrap and ready to apply before play. */
  readonly initialPreferences?: PlatformPreferences;
  /** Provider account lifecycle generation used to bind destructive requests idempotently. */
  readonly accountGeneration?: number;
}

/** Initializes one target before shared gameplay is allowed to mount. */
export interface PlatformBootstrap {
  /**
   * Establishes provider lifecycle, storage, and the minimum safe session boundary.
   *
   * @param reportProgress - Receives non-regressing provider startup progress from 0 through 100.
   * @returns A ready session or a normalized cancellation, availability, or failure result.
   */
  initialize(reportProgress: (progress: number) => void): Promise<PlatformResult<PlatformSession>>;
}
