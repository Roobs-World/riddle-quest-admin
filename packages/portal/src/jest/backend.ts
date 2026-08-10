/** Operations exposed by the authoritative Jest backend to the browser client. */
export interface JestBackendPort {
  /** Exchanges a signed Jest player assertion for a Firebase custom token. */
  exchangeIdentity(playerSigned: string): Promise<{customToken: string; uid: string}>;
  /** Verifies and grants an idempotent signed Jest purchase. */
  grantPurchase(purchaseSigned: string, playerId: string, purchaseToken: string): Promise<{
    granted: boolean;
    purchaseToken: string;
    coinsAwarded: number;
    newCoins: number;
    newlyUnlockedAchievementIds?: string[];
  }>;
  /** Verifies signed Jest referral data for the authenticated player. */
  verifyReferrals(referralsSigned: string, playerId: string): Promise<JestReferralVerificationResult>;
  /** Synchronizes signed Jest subscription entitlements for the player. */
  syncSubscriptions(subscriptionsSigned: string, playerId: string): Promise<{
    verified: boolean;
    activeSkus: string[];
    blockedSkus?: string[];
  }>;
}

/** Trusted result of reconciling Jest-signed referral registrations. */
export type JestReferralVerificationResult = {
  /** Stores verified. */
  verified: boolean;
  /** Stores references. */
  references?: string[];
  /** Stores conversion count. */
  conversionCount?: number;
  /** Stores rewards granted. */
  rewardsGranted?: number;
  /** Stores referred rewards granted. */
  referredRewardsGranted?: number;
  /** Stores coins per player. */
  coinsPerPlayer?: number;
  /** Stores new coins. */
  newCoins?: number;
};

/** Construction options for the HTTPS-only Jest backend client. */
export type JestBackendClientOptions = {
  /** Allows plaintext HTTP only for a loopback Firebase emulator during local development. */
  allowInsecureLoopback?: boolean;
};

/**
 * Resolves and validates a Jest backend URL before any signed identity or
 * purchase payload is transmitted.
 */
export function resolveSecureBackendUrl(baseUrl: string, options: JestBackendClientOptions = {}): string {
  const trimmedBaseUrl = baseUrl.trim();
  if (trimmedBaseUrl.startsWith("/")) {
    if (trimmedBaseUrl.startsWith("//")) throw new Error("Jest backend URL must not be protocol-relative.");
    return trimmedBaseUrl;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedBaseUrl);
  } catch {
    throw new Error("Jest backend URL must be an HTTPS URL or a root-relative path.");
  }

  if (parsedUrl.protocol === "https:") return parsedUrl.toString();

  const isLoopback = parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "[::1]";
  if (options.allowInsecureLoopback && parsedUrl.protocol === "http:" && isLoopback) return parsedUrl.toString();

  throw new Error("Jest backend URL must use HTTPS.");
}

/** HTTPS-only client for the server-authoritative Jest trust boundary. */
export class JestBackendClient implements JestBackendPort {
  /** Stores base url. */
  private readonly baseUrl: string;

  /** Creates a jest backend client instance. */
  constructor(baseUrl: string, options: JestBackendClientOptions = {}) {
    this.baseUrl = resolveSecureBackendUrl(baseUrl, options);
  }

  /** Provides post behavior. */
  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Jest backend ${path} failed (${response.status})`);
    return response.json() as Promise<T>;
  }

  /** Provides exchange identity behavior. */
  exchangeIdentity(playerSigned: string) { return this.post<{customToken: string; uid: string}>("exchangeJestIdentity", {playerSigned}); }
  /** Provides grant purchase behavior. */
  grantPurchase(purchaseSigned: string, playerId: string, purchaseToken: string) {
    return this.post<{
      granted: boolean;
      purchaseToken: string;
      coinsAwarded: number;
      newCoins: number;
      newlyUnlockedAchievementIds?: string[];
    }>(
      "grantJestPurchase",
      {purchaseSigned, playerId, purchaseToken},
    );
  }
  /** Provides verify referrals behavior. */
  verifyReferrals(referralsSigned: string, playerId: string) {
    return this.post<JestReferralVerificationResult>("verifyJestReferrals", {referralsSigned, playerId});
  }
  /** Provides sync subscriptions behavior. */
  syncSubscriptions(subscriptionsSigned: string, playerId: string) {
    return this.post<{verified: boolean; activeSkus: string[]; blockedSkus?: string[]}>(
      "syncJestSubscriptions",
      {subscriptionsSigned, playerId},
    );
  }
}
