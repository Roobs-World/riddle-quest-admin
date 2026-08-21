import type {BridgeProfile} from "@qwordly/core/bridge";
import type {Feedback, GameEngineSnapshot, ScoredGuess} from "@qwordly/core/game";
import type {
  ListFacebookTournamentResponse,
  FindRedditRaceMatchResponse,
  RaceLocale,
  RecordFacebookTournamentRunResponse,
  ListFacebookContextBoardResponse,
  RecordFacebookContextRunResponse,
} from "@qwordly/core/race";

/** Describes platform id. */
export type PlatformId = "jest" | "facebook" | "reddit" | "youtube";

/** Cross-target browser/runtime behavior. Existing targets retain this legacy default. */
export type PlatformRuntimePolicy = Readonly<{
  lifecycleSource: "browser" | "platform";
  browserConnectivityRequired: boolean;
  platformOwnsMasterAudio: boolean;
  platformOwnsLocale: boolean;
  allowSharingPrompts: boolean;
  allowAccountManagement: boolean;
  allowCommerce: boolean;
  allowExternalNavigation: boolean;
  allowMultiplayer: boolean;
  preventEscapeDefault: boolean;
}>;

/** Default policy for Jest, Facebook, and Reddit; adding YouTube does not alter them. */
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

/** Describes platform result. */
export type PlatformResult<T> =
  | {status: "success"; value: T}
  | {status: "cancelled"}
  | {status: "retryable-failure"; message: string}
  | {status: "terminal-failure"; message: string}
  | {status: "unavailable"; message: string};

/** Describes platform preferences. */
export type PlatformPreferences = {
  /** Stores locale. */
  locale?: string;
  /** Stores muted. */
  muted?: boolean;
  /** Stores reduced motion. */
  reducedMotion?: boolean;
  /** Stores high contrast. */
  highContrast?: boolean;
  /** Stores onboarding complete. */
  onboardingComplete?: boolean;
  /** Stores registration prompt dismissed at. */
  registrationPromptDismissedAt?: number;
  /** Stores first milestone marked. */
  firstMilestoneMarked?: boolean;
  /** Stores presence enabled. */
  presenceEnabled?: boolean;
  /** Stores facebook notification permission. */
  facebookNotificationPermission?: "unknown" | "declined" | "accepted";
  /** Stores facebook notification last prompt at ms. */
  facebookNotificationLastPromptAtMs?: number;
};

/** Describes saved game. */
export type SavedGame = {
  /** Stores schema version. */
  schemaVersion: 1;
  /** Stores saved at. */
  savedAt: number;
  /** Stores riddle id. */
  riddleId: string;
  /** Stores game mode. */
  gameMode: "classic" | "challenge";
  /** Stores session token. */
  sessionToken: string;
  /** Stores current letters. */
  currentLetters: string[];
  /** Stores active slot index. */
  activeSlotIndex: number;
  /** Stores hint revealed indices. */
  hintRevealedIndices: number[];
  /** Stores guesses. */
  guesses: ScoredGuess[];
  /** Stores engine snapshot. */
  engineSnapshot: GameEngineSnapshot;
  /** Stores awaiting continue. */
  awaitingContinue: boolean;
  /** Stores letter states. */
  letterStates: Record<string, Feedback>;
  /** Stores pending outcome. */
  pendingOutcome?: {
    id: string;
    kind: "win" | "loss";
    riddleId: string;
    gameMode: "classic" | "challenge";
    sessionToken: string;
    attempts: number;
    isCorrect: boolean;
  };
};

/** Describes player data. */
export type PlayerData = {
  /** Stores schema version. */
  schemaVersion: 1;
  /** Stores updated at. */
  updatedAt: number;
  /** Stores profile. */
  profile?: BridgeProfile;
  /** Stores active game. */
  activeGame?: SavedGame | null;
};

/** Describes player data update. */
export type PlayerDataUpdate = Pick<PlayerData, "profile" | "activeGame">;

/** Defines the contract for platform storage. */
export interface PlatformStorage {
  /** Reads preferences. */
  readPreferences(): Promise<PlatformPreferences>;
  /** Provides write preferences behavior. */
  writePreferences(preferences: PlatformPreferences): Promise<void>;
  /** Reads player data. */
  readPlayerData(): Promise<PlayerData | null>;
  /** Provides write player data behavior. */
  writePlayerData(playerData: PlayerData): Promise<void>;
  /** Provides clear behavior. */
  clear(): Promise<void>;
  /** Provides flush behavior. */
  flush(): Promise<void>;
}

/** Describes account upgrade capability. */
export type AccountUpgradeCapability = {
  /** Stores state. */
  state: "available" | "complete";
  /** Provides begin behavior. */
  begin(): Promise<PlatformResult<void>>;
};

/** Describes lifecycle capability. */
export type LifecycleCapability = {
  /** Provides on pause behavior. */
  onPause(callback: () => void | Promise<void>): () => void;
  /** Provides on resume behavior. */
  onResume?(callback: () => void | Promise<void>): () => void;
};

/** Describes commerce product. */
export type CommerceProduct = {
  /** Stores id. */
  id: string;
  /** Stores title. */
  title: string;
  /** Stores description. */
  description: string;
  /** Stores price. */
  price: string;
  /** Stores kind. */
  kind: "consumable" | "durable" | "subscription";
};

/** Describes commerce capability. */
export type CommerceCapability = {
  /** Lists products. */
  listProducts(): Promise<PlatformResult<CommerceProduct[]>>;
  /** Provides purchase behavior. */
  purchase(productId: string): Promise<PlatformResult<{providerReceiptId: string}>>;
  /** Provides recover behavior. */
  recover(): Promise<PlatformResult<void>>;
};

/** Describes ads capability. */
export type AdsCapability = {
  /** Provides show rewarded behavior. */
  showRewarded(placement: string): Promise<PlatformResult<void>>;
  /** Provides show interstitial behavior. */
  showInterstitial(placement: string): Promise<PlatformResult<void>>;
};

/** Describes notification capability. */
export type NotificationCapability = {
  /** Requests permission. */
  requestPermission(): Promise<PlatformResult<void>>;
  /** Provides schedule behavior. */
  schedule(templateId: string, deliverAt: number, payload: Record<string, string>): Promise<PlatformResult<string>>;
  /** Provides cancel behavior. */
  cancel(notificationId: string): Promise<PlatformResult<void>>;
};

/** Describes sharing capability. */
export type SharingCapability = {
  /** Provides share behavior. */
  share(payload: {text: string; image?: string; data?: Record<string, string>}): Promise<PlatformResult<void>>;
};

/** Describes native social capability. */
export type NativeSocialCapability = {
  /** Provides current context behavior. */
  currentContext(): PlatformResult<{contextId: string; contextType: "THREAD" | "GROUP"}>;
  /** Provides choose context behavior. */
  chooseContext(): Promise<PlatformResult<{contextId: string; contextType: "THREAD" | "GROUP"}>>;
  /** Provides match player behavior. */
  matchPlayer(tag?: string): Promise<PlatformResult<{contextId: string; contextType: "THREAD" | "GROUP"}>>;
};

/** Provider-wide, server-authoritative offline opponent selection. */
export type MatchmakingCapability = {
  /** Provides find behavior. */
  find(locale: RaceLocale): Promise<PlatformResult<FindRedditRaceMatchResponse>>;
};

/** Describes presence state. */
export type PresenceState = "offline" | "online" | "playing" | "racing";
/** Describes presence capability. */
export type PresenceCapability = {
  /** Provides poll behavior. */
  poll(input: {sessionId: string; state: Exclude<PresenceState, "offline">; enabled: boolean}):
    Promise<{rivals: Array<{userId: string; state: PresenceState}>}>;
  /** Provides disconnect behavior. */
  disconnect(sessionId: string): Promise<void>;
};

/** Describes overlay capability. */
export type OverlayCapability = {
  /** Renders player. */
  renderPlayer(options: {playerId: string; surface: HTMLElement}): Promise<PlatformResult<() => Promise<void>>>;
};

/** Server-authoritative Facebook tournament access; Meta standings remain presentation-only. */
export type TournamentCapability = {
  /** Provides list behavior. */
  list(locale: RaceLocale): Promise<ListFacebookTournamentResponse>;
  /** Provides record behavior. */
  record(runId: string, locale: RaceLocale): Promise<RecordFacebookTournamentRunResponse>;
};

/** Server-authoritative board for the currently active Facebook thread/group context. */
export type ContextBoardCapability = {
  /** Provides list behavior. */
  list(locale: RaceLocale): Promise<ListFacebookContextBoardResponse>;
  /** Provides record behavior. */
  record(runId: string, locale: RaceLocale): Promise<RecordFacebookContextRunResponse>;
};

/** Describes platform capabilities. */
export type PlatformCapabilities = {
  /** Stores account upgrade. */
  accountUpgrade?: AccountUpgradeCapability;
  /** Stores lifecycle. */
  lifecycle?: LifecycleCapability;
  /** Stores commerce. */
  commerce?: CommerceCapability;
  /** Stores ads. */
  ads?: AdsCapability;
  /** Stores notifications. */
  notifications?: NotificationCapability;
  /** Stores sharing. */
  sharing?: SharingCapability;
  /** Stores native social. */
  nativeSocial?: NativeSocialCapability;
  /** Stores matchmaking. */
  matchmaking?: MatchmakingCapability;
  /** Stores presence. */
  presence?: PresenceCapability;
  /** Stores overlay. */
  overlay?: OverlayCapability;
  /** Stores tournaments. */
  tournaments?: TournamentCapability;
  /** Stores context board. */
  contextBoard?: ContextBoardCapability;
};

/** Defines the contract for platform session. */
export interface PlatformSession {
  /** Stores platform. */
  readonly platform: PlatformId;
  /** Stores player id. */
  readonly playerId: string;
  /** Stores storage. */
  readonly storage: PlatformStorage;
  /** Stores capabilities. */
  readonly capabilities: PlatformCapabilities;
  /** Preferences restored during platform bootstrap and ready to apply before play. */
  readonly initialPreferences?: PlatformPreferences;
  /** Provider account lifecycle generation used to bind destructive requests. */
  readonly accountGeneration?: number;
}

/** Defines the contract for platform bootstrap. */
export interface PlatformBootstrap {
  /** Provides initialize behavior. */
  initialize(reportProgress: (progress: number) => void): Promise<PlatformResult<PlatformSession>>;
}
