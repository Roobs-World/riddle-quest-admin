/** Defines the contract for facebook player data. */
export interface FacebookPlayerData {
  /** Documents default export. */
  readonly [key: string]: unknown;
}

/** Defines the contract for facebook instant player. */
export interface FacebookInstantPlayer {
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
  /** Provides match player async behavior. */
  matchPlayerAsync(matchTag?: string, switchContextWhenMatched?: boolean, offlineMatch?: boolean): Promise<void>;
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
  /** Provides destroy overlay view behavior. */
  destroyOverlayView(): Promise<void>;
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
  purchaseTime: string;
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
  imageURI: string;
  /** Stores price. */
  price: string;
  /** Stores price currency code. */
  priceCurrencyCode: string;
  /** Stores price amount. */
  priceAmount: number | string;
}

/** Defines the contract for facebook instant payments. */
export interface FacebookInstantPayments {
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

/** Defines the contract for facebook instant sdk. */
export interface FacebookInstantSdk {
  /** Provides initialize async behavior. */
  initializeAsync(): Promise<void>;
  /** Sets loading progress. */
  setLoadingProgress(progress: number): void;
  /** Starts game async. */
  startGameAsync(): Promise<void>;
  /** Gets supported ap is. */
  getSupportedAPIs(): string[];
  /** Gets entry point data. */
  getEntryPointData?(): unknown;
  /** Provides on pause behavior. */
  onPause(callback: () => void): void;
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
