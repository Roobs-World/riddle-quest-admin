/** Operations exposed by the authoritative Jest backend to the browser client. */
export interface JestBackendPort {
  /** Exchanges a signed Jest player assertion for a Firebase custom token. */
  exchangeIdentity(playerSigned: string): Promise<JestIdentityExchangeResult>;
  /** Idempotently retries deletion from a fresh signed Jest assertion without minting auth. */
  retryAccountDeletion(playerSigned: string): Promise<{
    /** Stores account deleted. */
    accountDeleted: true;
  }>;
  /** Verifies and grants an idempotent signed Jest purchase. */
  grantPurchase(
    purchaseSigned: string,
    playerId: string,
    purchaseToken: string,
  ): Promise<{
    /** Stores granted. */
    granted: boolean;
    /** Stores purchase token. */
    purchaseToken: string;
    /** Stores coins awarded. */
    coinsAwarded: number;
    /** Stores new coins. */
    newCoins: number;
    /** Stores newly unlocked achievement ids. */
    newlyUnlockedAchievementIds?: string[];
  }>;
  /** Verifies signed Jest referral data for the authenticated player. */
  verifyReferrals(referralsSigned: string, playerId: string): Promise<JestReferralVerificationResult>;
  /** Synchronizes signed Jest subscription entitlements for the player. */
  syncSubscriptions(
    subscriptionsSigned: string,
    playerId: string,
  ): Promise<{
    /** Stores verified. */
    verified: boolean;
    /** Stores active skus. */
    activeSkus: string[];
    /** Stores blocked skus. */
    blockedSkus?: string[];
  }>;
}

/** Explicitly distinguishes usable identity credentials from a permanently deleted account. */
export type JestIdentityExchangeResult =
  | {
      /** Stores status. */
      status: "success"; /** Stores custom token. */
      /** Stores custom token. */
      customToken: string; /** Stores uid. */
      /** Stores uid. */
      uid: string;
    }
  | {
      /** Stores status. */
      status: "account-deleted";
    };

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
  /** Maximum time allowed for a backend request before it is aborted. */
  requestTimeoutMs?: number;
};

/** Default deadline for identity, purchase, referral, and entitlement requests. */
export const JEST_BACKEND_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Resolves and validates a Jest backend URL before any signed identity or
 * purchase payload is transmitted.
 */
export function resolveSecureBackendUrl(baseUrl: string, options: JestBackendClientOptions = {}): string {
  /** Provides trimmed base url behavior. */
  const trimmedBaseUrl = baseUrl.trim();
  if (trimmedBaseUrl.startsWith("/")) {
    if (trimmedBaseUrl.startsWith("//")) throw new Error("Jest backend URL must not be protocol-relative.");
    return trimmedBaseUrl;
  }

  /** Parses d url. */
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedBaseUrl);
  } catch {
    throw new Error("Jest backend URL must be an HTTPS URL or a root-relative path.");
  }

  if (parsedUrl.protocol === "https:") return parsedUrl.toString();

  /** Indicates whether is loopback. */
  const isLoopback =
    parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "[::1]";
  if (options.allowInsecureLoopback && parsedUrl.protocol === "http:" && isLoopback) return parsedUrl.toString();

  throw new Error("Jest backend URL must use HTTPS.");
}

/** HTTPS-only client for the server-authoritative Jest trust boundary. */
export class JestBackendClient implements JestBackendPort {
  /** Stores base url. */
  private readonly baseUrl: string;
  /** Stores the per-request deadline. */
  private readonly requestTimeoutMs: number;

  /** Creates a jest backend client instance. */
  constructor(baseUrl: string, options: JestBackendClientOptions = {}) {
    this.baseUrl = resolveSecureBackendUrl(baseUrl, options);
    /** Requests timeout ms. */
    const requestTimeoutMs = options.requestTimeoutMs ?? JEST_BACKEND_REQUEST_TIMEOUT_MS;
    if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
      throw new Error("Jest backend request timeout must be a positive number.");
    }
    this.requestTimeoutMs = requestTimeoutMs;
  }

  /** Provides post behavior. */
  private async post<T>(
    path: string,
    body: unknown,
    mapHttpError?: (response: Response) => Promise<
      | {
          /** Stores handled. */
          handled: true; /** Stores value. */
          /** Stores value. */
          value: T;
        }
      | {
          /** Stores handled. */
          handled: false;
        }
    >,
  ): Promise<T> {
    /** Provides controller behavior. */
    const controller = new AbortController();
    /** Provides timeout behavior. */
    let timeout: ReturnType<typeof setTimeout> | undefined;
    /** Provides timeout message behavior. */
    const timeoutMessage = `Jest backend ${path} timed out.`;
    /** Provides request behavior. */
    const request = async (): Promise<T> => {
      /** Provides response behavior. */
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/${path}`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        /** Maps ped. */
        const mapped = await mapHttpError?.(response);
        if (mapped?.handled) return mapped.value;
        throw new Error(`Jest backend ${path} failed (${response.status})`);
      }
      return response.json() as Promise<T>;
    };
    return Promise.race([
      request(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(timeoutMessage));
          controller.abort();
        }, this.requestTimeoutMs);
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
  }

  /** Provides exchange identity behavior. */
  async exchangeIdentity(playerSigned: string): Promise<JestIdentityExchangeResult> {
    /** Provides result behavior. */
    const result = await this.post<
      | {
          /** Stores custom token. */
          customToken: string; /** Stores uid. */
          /** Stores uid. */
          uid: string;
        }
      | {
          /** Stores status. */
          status: "account-deleted";
        }
    >("exchangeJestIdentity", {playerSigned}, async (response) => {
      if (response.status !== 409) return {handled: false};
      try {
        /** Provides error body behavior. */
        const errorBody = (await response.json()) as {
          /** Stores error. */
          error?: unknown;
        };
        if (errorBody.error === "account-deleted") {
          return {handled: true, value: {status: "account-deleted"}};
        }
      } catch {
        // Preserve the generic status-only transport failure for malformed responses.
      }
      return {handled: false};
    });
    return "status" in result ? result : {status: "success", ...result};
  }
  /** Provides idempotent signed account-deletion recovery without creating Firebase identity. */
  retryAccountDeletion(playerSigned: string): Promise<{
    /** Stores account deleted. */
    accountDeleted: true;
  }> {
    return this.post<{
      /** Stores account deleted. */
      accountDeleted: true;
    }>("retryJestAccountDeletion", {playerSigned});
  }
  /** Provides grant purchase behavior. */
  grantPurchase(purchaseSigned: string, playerId: string, purchaseToken: string) {
    return this.post<{
      /** Stores granted. */
      granted: boolean;
      /** Stores purchase token. */
      purchaseToken: string;
      /** Stores coins awarded. */
      coinsAwarded: number;
      /** Stores new coins. */
      newCoins: number;
      /** Stores newly unlocked achievement ids. */
      newlyUnlockedAchievementIds?: string[];
    }>("grantJestPurchase", {purchaseSigned, playerId, purchaseToken});
  }
  /** Provides verify referrals behavior. */
  verifyReferrals(referralsSigned: string, playerId: string) {
    return this.post<JestReferralVerificationResult>("verifyJestReferrals", {referralsSigned, playerId});
  }
  /** Provides sync subscriptions behavior. */
  syncSubscriptions(subscriptionsSigned: string, playerId: string) {
    return this.post<{
      /** Stores verified. */
      verified: boolean; /** Stores active skus. */
      /** Stores active skus. */
      activeSkus: string[]; /** Stores blocked skus. */
      /** Stores blocked skus. */
      blockedSkus?: string[];
    }>("syncJestSubscriptions", {subscriptionsSigned, playerId});
  }
}
