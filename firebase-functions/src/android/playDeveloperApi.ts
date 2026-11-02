import {ANDROID_PACKAGE_NAME} from "./androidPlayCatalog";

/** Fields the backend reads from a Play `ProductPurchase`. */
export type PlayProductPurchase = {
  /** Product the token was bought for, when Play reports it. */
  productId?: string;
  /** 0 purchased, 1 cancelled, 2 pending. */
  purchaseState?: number;
  /** 0 not yet consumed, 1 consumed. */
  consumptionState?: number;
  /** Account binding supplied by the app at checkout. */
  obfuscatedExternalAccountId?: string;
  /** Play order id, kept for support lookups. */
  orderId?: string;
  /** Present and 0 for licence-tester purchases. */
  purchaseType?: number;
};

/** Fields the backend reads from a Play `SubscriptionPurchaseV2`. */
export type PlaySubscriptionPurchase = {
  /** Lifecycle state, for example `SUBSCRIPTION_STATE_ACTIVE`. */
  subscriptionState?: string;
  /** `ACKNOWLEDGEMENT_STATE_PENDING` until the backend acknowledges it. */
  acknowledgementState?: string;
  /** Account binding supplied by the app at checkout. */
  externalAccountIdentifiers?: {
    /** Opaque account id. */
    obfuscatedExternalAccountId?: string;
  };
  /** One entry per subscribed product. */
  lineItems?: Array<{
    /** Subscription product id. */
    productId?: string;
    /** RFC 3339 end of the current entitlement period. */
    expiryTime?: string;
  }>;
};

/** Google Play Developer API operations the purchase backend needs. */
export type PlayDeveloperApi = Readonly<{
  /** Reads a one-time product purchase. */
  getProductPurchase(productId: string, purchaseToken: string): Promise<PlayProductPurchase>;
  /** Consumes a granted one-time product so it can be bought again. */
  consumeProductPurchase(productId: string, purchaseToken: string): Promise<void>;
  /** Reads a subscription purchase. */
  getSubscriptionPurchase(purchaseToken: string): Promise<PlaySubscriptionPurchase>;
  /** Acknowledges a subscription so Play does not refund it after three days. */
  acknowledgeSubscription(subscriptionId: string, purchaseToken: string): Promise<void>;
}>;

/** Play reported that the token does not exist for this package. */
export class PlayPurchaseNotFoundError extends Error {
  constructor() {
    super("play-purchase-not-found");
  }
}

/** OAuth scope required by the Play Developer API. */
const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
/** Metadata-server token endpoint for the function's runtime service account. */
const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

/** Dependencies of {@link createPlayDeveloperApi}. */
export type PlayDeveloperApiOptions = {
  /** Package whose purchases are read. */
  packageName?: string;
  /** HTTP transport. */
  fetch?: typeof fetch;
  /** Supplies a bearer token with the androidpublisher scope. */
  getAccessToken?: () => Promise<string>;
};

/**
 * Reads a scoped token for the runtime service account from the metadata server.
 *
 * @remarks
 * The runtime service account must be invited in Play Console with permission
 * to view financial data and manage orders and subscriptions.
 */
export function createMetadataAccessToken(fetchImpl: typeof fetch = fetch): () => Promise<string> {
  /** Cached token and its expiry in epoch milliseconds. */
  let cached: {token: string; expiresAt: number} | null = null;
  return async () => {
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    /** Metadata server response. */
    const response = await fetchImpl(`${METADATA_TOKEN_URL}?scopes=${encodeURIComponent(ANDROID_PUBLISHER_SCOPE)}`, {
      headers: {"Metadata-Flavor": "Google"},
    });
    if (!response.ok) throw new Error("play-api-unavailable");
    /** Token payload. */
    const body = (await response.json()) as {access_token?: unknown; expires_in?: unknown};
    if (typeof body.access_token !== "string") throw new Error("play-api-unavailable");
    /** Lifetime in seconds, refreshed a minute early. */
    const lifetime = typeof body.expires_in === "number" ? body.expires_in : 300;
    cached = {token: body.access_token, expiresAt: Date.now() + Math.max(0, lifetime - 60) * 1_000};
    return cached.token;
  };
}

/** Creates the Play Developer API client used by the Android purchase callables. */
export function createPlayDeveloperApi(options: PlayDeveloperApiOptions = {}): PlayDeveloperApi {
  /** HTTP transport. */
  const fetchImpl = options.fetch ?? fetch;
  /** Token source. */
  const getAccessToken = options.getAccessToken ?? createMetadataAccessToken(fetchImpl);
  /** Purchases root for the package. */
  const root = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    options.packageName ?? ANDROID_PACKAGE_NAME,
  )}/purchases`;
  /** Sends one authenticated request and maps Play's not-found responses. */
  const request = async (path: string, method: "GET" | "POST"): Promise<unknown> => {
    /** Play response. */
    const response = await fetchImpl(`${root}/${path}`, {
      method,
      headers: {Authorization: `Bearer ${await getAccessToken()}`},
    });
    if (response.status === 404 || response.status === 410) throw new PlayPurchaseNotFoundError();
    if (!response.ok) throw new Error("play-api-unavailable");
    return method === "GET" ? response.json() : undefined;
  };
  /** Encodes one path segment. */
  const segment = encodeURIComponent;
  return {
    getProductPurchase: async (productId, purchaseToken) =>
      (await request(`products/${segment(productId)}/tokens/${segment(purchaseToken)}`, "GET")) as PlayProductPurchase,
    consumeProductPurchase: async (productId, purchaseToken) => {
      await request(`products/${segment(productId)}/tokens/${segment(purchaseToken)}:consume`, "POST");
    },
    getSubscriptionPurchase: async (purchaseToken) =>
      (await request(`subscriptionsv2/tokens/${segment(purchaseToken)}`, "GET")) as PlaySubscriptionPurchase,
    acknowledgeSubscription: async (subscriptionId, purchaseToken) => {
      await request(`subscriptions/${segment(subscriptionId)}/tokens/${segment(purchaseToken)}:acknowledge`, "POST");
    },
  };
}
