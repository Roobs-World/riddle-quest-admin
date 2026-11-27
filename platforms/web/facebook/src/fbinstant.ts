/** Defines the contract for facebook player data. */
export interface FacebookPlayerData {
  /** Documents default export. */
  readonly [key: string]: unknown;
}

/** Defines the contract for facebook instant player. */
export interface FacebookInstantPlayer {
  /** Checks whether Meta permits a game bot subscription prompt for this player. */
  canSubscribeBotAsync?(): Promise<boolean>;
  /** Reads the player's existing game bot subscription from Meta. */
  isSubscribedBotAsync?(): Promise<boolean>;
  /** Opens Meta's own game bot subscription prompt after an eligibility check. */
  subscribeBotAsync?(): Promise<void>;
  /** Gets id. */
  getID(): string;
  /** Gets signed player info async. */
  getSignedPlayerInfoAsync(requestPayload: string): Promise<{
    /** Gets signature. */
    getSignature(): string; /** Gets player id. */
    /** Gets player id. */
    getPlayerID(): string;
  }>;
  /** Gets data async. */
  getDataAsync(keys: string[]): Promise<FacebookPlayerData>;
  /** Sets data async. */
  setDataAsync(data: FacebookPlayerData): Promise<void>;
  /** Provides flush data async behavior. */
  flushDataAsync(): Promise<void>;
}

/** Defines the contract for facebook instant context. */
export interface FacebookInstantContext {
  /** Gets id. */
  getID(): string | null;
  /** Gets type. */
  getType(): "SOLO" | "THREAD" | "GROUP";
  /** Provides choose async behavior. */
  chooseAsync(options?: {
    /** Stores min size. */
    minSize?: number; /** Stores max size. */
    /** Stores max size. */
    maxSize?: number;
  }): Promise<void>;
}

/** Defines the contract for facebook ad instance. */
export interface FacebookAdInstance {
  /** Gets placement id. */
  getPlacementID?(): string;
  /** Loads async. */
  loadAsync(): Promise<void>;
  /** Provides show async behavior. */
  showAsync(): Promise<void>;
}

/** Defines the contract for facebook overlay view. */
export interface FacebookOverlayView {
  /** Provides show async behavior. */
  showAsync(): Promise<void>;
  /** Provides dismiss async behavior. */
  dismissAsync?(): Promise<void>;
  /** Optional runtime extension; documented v8 views need only show/dismiss lifecycle APIs. */
  destroyAsync?(): Promise<void>;
}

/** Defines the contract for facebook overlay views. */
export interface FacebookOverlayViews {
  /** Creates profile picture overlay view async. */
  createProfilePictureOverlayViewAsync(
    surface: HTMLElement,
    imageStyle: string,
    iframeStyle: string,
  ): Promise<FacebookOverlayView>;
  /** Creates profile name overlay view async. */
  createProfileNameOverlayViewAsync(
    surface: HTMLElement,
    textStyle: string,
    iframeStyle: string,
    pathToCss: string,
  ): Promise<FacebookOverlayView>;
}

/** Defines the contract for facebook instant purchase. */
export interface FacebookInstantPurchase {
  /** Stores developer payload. */
  developerPayload?: string | null;
  /** Stores is consumed. */
  isConsumed: boolean;
  /** Stores payment action type. */
  paymentActionType: string;
  /** Stores payment id. */
  paymentID: string;
  /** Stores product id. */
  productID: string;
  /** Stores purchase platform. */
  purchasePlatform: string;
  /** Stores purchase price. */
  purchasePrice: unknown;
  /** Stores purchase time. */
  purchaseTime: number | string;
  /** Stores purchase token. */
  purchaseToken: string;
  /** Stores signed request. */
  signedRequest: string;
}

/** Defines the contract for facebook instant product. */
export interface FacebookInstantProduct {
  /** Stores title. */
  title: string;
  /** Stores product id. */
  productID: string;
  /** Stores description. */
  description: string;
  /** Stores image uri. */
  imageURI?: string | null;
  /** Stores price. */
  price: string;
  /** Stores price currency code. */
  priceCurrencyCode: string;
  /** Stores price amount. */
  priceAmount: number | string;
}

/** Defines the contract for facebook instant payments. */
export interface FacebookInstantPayments {
  /** Registers Meta's payment initialization signal. */
  onReady?(callback: () => void): void;
  /** Gets catalog async. */
  getCatalogAsync(): Promise<unknown>;
  /** Provides purchase async behavior. */
  purchaseAsync(configuration: {
    /** Stores product id. */ /** Stores product id. */
    productID: string;
  }): Promise<unknown>;
  /** Gets purchases async. */
  getPurchasesAsync(): Promise<unknown>;
  /** Provides consume purchase async behavior. */
  consumePurchaseAsync(purchaseToken: string): Promise<void>;
}

/** Native Meta share payload; entry data contains only game-owned opaque references. */
export interface FacebookSharePayload {
  /** Requested provider share surface. */
  intent: "INVITE" | "CHALLENGE" | "SHARE";
  /** Locally rendered PNG data URL. */
  image: string;
  /** Localized share text. */
  text: string;
  /** Bounded game entry data. */
  data: Record<string, string>;
  /** Keeps a share from changing the currently active race context. */
  switchContext: false;
}

/** Native friend picker payload, with only an opaque game-owned lobby handle. */
export interface FacebookInvitePayload {
  /** Locally rendered identity-free invitation card. */
  image: string;
  /** Copy in the active game locale. */
  text: {
    /** Fallback copy understood by the native picker. */
    default: string;
  };
  /** Opaque server-owned challenge reference. */
  data: Record<string, string>;
  /** Localized native invitation action. */
  cta: string;
  /** Localized friend picker heading. */
  dialogTitle: string;
}

/** Meta's current native tournament getters, inspected in the public v8 SDK. */
export interface FacebookInstantTournament {
  /** Meta's opaque tournament identifier, never an official game ranking key. */
  getID(): string;
  /** Context selected by the native tournament. */
  getContextID(): string;
  /** Native expiration in Unix seconds. */
  getEndTime(): number;
  /** Untrusted developer presentation data returned by Meta. */
  getPayload(): unknown;
}

/** Current v8 native tournament dialog and score APIs. */
export interface FacebookInstantTournaments {
  /** Creates a native presentation tournament through Meta's dialog. */
  createAsync(payload: {
    /** Server-derived adjusted milliseconds, never a browser-computed score. */
    initialScore: number;
    /** Lower-time native presentation and the official UTC deadline. */
    config: {
      /** Translated title. */
      title: string;
      /** Identity-free local PNG. */
      image: string;
      /** Lower adjusted milliseconds wins. */
      sortOrder: "LOWER_IS_BETTER";
      /** Milliseconds remain numeric to avoid an undocumented TIME unit conversion. */
      scoreFormat: "NUMERIC";
      /** Official window expiration in Unix seconds. */
      endTime: number;
    };
    /** Bounded official-window presentation hints with no identity or authority. */
    data: Record<string, string | number>;
  }): Promise<FacebookInstantTournament>;
  /** Shares the current tournament; v8 takes score/data, not a tournamentID field. */
  shareAsync(payload: {
    /** Fresh server-derived current best time. */
    score: number;
    /** Bounded official-window hints. */
    data: Record<string, string | number>;
  }): Promise<void>;
  /** Updates presentation only; official ranks never read this leaderboard. */
  postScoreAsync(score: number): Promise<void>;
}

/** Defines the contract for facebook instant sdk. */
export interface FacebookInstantSdk {
  /** Sends native Meta events; a returned error means the event was rejected. */
  logEvent?(name: string, valueToSum: number | null, parameters: Record<string, string>): {
    /** Stable provider failure category. */
    code: string;
    /** Provider failure description, never forwarded to event parameters. */
    message: string;
  } | null;
  /** Reads the current native tournament without opening a dialog. */
  getTournamentAsync?(): Promise<FacebookInstantTournament>;
  /** Optional native tournament APIs advertised by this host. */
  tournament?: FacebookInstantTournaments;
  /** Provides initialize async behavior. */
  initializeAsync(): Promise<void>;
  /** Sets loading progress. */
  setLoadingProgress(progress: number): void;
  /** Starts game async. */
  startGameAsync(): Promise<void>;
  /** Gets supported ap is. */
  getSupportedAPIs(): string[];
  /** Returns Meta's player locale after the game has started. */
  getLocale?(): string | null;
  /** Opens Meta's top-level matchmaking API and optionally switches the context. */
  matchPlayerAsync?(matchTag?: string, switchContextWhenMatched?: boolean, offlineMatch?: boolean): Promise<void>;
  /** Opens Meta's native share dialog after the game has started. */
  shareAsync?(payload: FacebookSharePayload): Promise<void>;
  /** Opens Meta's native friend invitation picker when supported by this host. */
  inviteAsync?(payload: FacebookInvitePayload): Promise<void>;
  /** Posts a player-requested custom update to the current native context. */
  updateAsync?(payload: {
    /** Native custom-update action. */ action: "CUSTOM";
    /** Identifier declared in the uploaded game bundle's custom update templates. */ template: string;
    /** Locally rendered PNG invitation image. */ image: string;
    /** English fallback and the selected game's localized invitation copy. */ text: {
      /** English fallback. */ default: string;
      /** Provider locale codes mapped to existing translated copy. */ localizations: Record<string, string>;
    };
    /** Entry data contains no identity, economy or answer state. */
    data: {
      /** Opaque server invitation, with no identity or economy data. */
      challengeId: string;
    };
    /** Explicit player requests are delivered immediately. */ strategy: "IMMEDIATE";
    /** Context invitations never subscribe or send push notifications. */ notification: "NO_PUSH";
  }): Promise<void>;
  /** Gets entry point data. */
  getEntryPointData?(): unknown;
  /** Provides on pause behavior. */
  onPause(callback: () => void): void;
  /** Registers the Meta v8 resume signal when the host supports it. */
  onResume?(callback: () => void): void;
  /** Observes context switches from JavaScript and native overlay actions. */
  onContextChange?(success: (contextId: string | null) => void, failure: (error: unknown) => void): void;
  /** Gets interstitial ad async. */
  getInterstitialAdAsync?(placementId: string): Promise<FacebookAdInstance>;
  /** Gets rewarded video async. */
  getRewardedVideoAsync?(placementId: string): Promise<FacebookAdInstance>;
  /** Stores overlay views. */
  overlayViews?: FacebookOverlayViews;
  /** Stores payments. */
  payments?: FacebookInstantPayments;
  /** Stores context. */
  context?: FacebookInstantContext;
  /** Stores player. */
  player: FacebookInstantPlayer;
}

/** Documents global. */
declare global {
  /** Defines the contract for window. */
  interface Window {
    /** Stores fb instant. */
    FBInstant?: FacebookInstantSdk;
  }
}

/** Returns the SDK injected by the Facebook artifact entry document. */
export function requireFacebookInstant(): FacebookInstantSdk {
  if (!window.FBInstant) throw new Error("facebook-sdk-unavailable");
  return window.FBInstant;
}
