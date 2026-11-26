import {assertSecureBrowserOrigin, resolveSecureHttpUrl} from "../../../../src/platform/browser/secureTransport";
import type {z} from "zod";

/** Operations exposed by the authoritative Jest backend to the browser client. */
export interface JestBackendPort {
  /** Exchanges a signed Jest player assertion for a Firebase custom token. */
  exchangeIdentity(playerSigned: string, freshStart?: boolean, deletedUid?: string): Promise<JestIdentityExchangeResult>;
  /** Idempotently retries deletion from a fresh signed Jest assertion without minting auth. */
  retryAccountDeletion(playerSigned: string, deletedUid?: string): Promise<{
    /** Stores account deleted. */
    accountDeleted: true;
    deletedUid?: string;
    activeAccountUid?: string;
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
    /** Premium coins granted by this sync, when a monthly grant was due. */
    premiumCoinsAwarded?: number;
    /** Coin balance after this sync. */
    newCoins?: number;
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
      accountGeneration?: number;
      freshAccount?: boolean;
    }
  | {
      /** Stores status. */
      status: "account-deleted";
      deletedUid?: string;
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

/** Bounds signed HTTP requests while allowing a cold backend to start under the loading heartbeat. */
export const JEST_BACKEND_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Resolves and validates a Jest backend URL before any signed identity or
 * purchase payload is transmitted.
 */
export function resolveSecureBackendUrl(baseUrl: string, options: JestBackendClientOptions = {}): string {
  const trimmedBaseUrl = baseUrl.trim();
  if (trimmedBaseUrl.startsWith("//")) throw new Error("Jest backend URL must not be protocol-relative.");
  try {
    return resolveSecureHttpUrl(trimmedBaseUrl, options);
  } catch {
    throw new Error("Jest backend URL must use HTTPS.");
  }
}

/** HTTPS-only client for the server-authoritative Jest trust boundary. */
export class JestBackendClient implements JestBackendPort {
  private accountUid: string | undefined;
  /** Stores base url. */
  private readonly baseUrl: string;
  private readonly allowInsecureLoopback: boolean;
  /** Stores the per-request deadline. */
  private readonly requestTimeoutMs: number;

  /** Creates a jest backend client instance. */
  constructor(baseUrl: string, options: JestBackendClientOptions = {}) {
    this.baseUrl = resolveSecureBackendUrl(baseUrl, options);
    this.allowInsecureLoopback = options.allowInsecureLoopback === true;
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
    schemaPromise: Promise<z.ZodType<T>>,
    mapHttpError?: (response: Response, body: unknown) => Promise<
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
    /** A retry shares the original deadline rather than starting another request budget. */
    const deadline = Date.now() + this.requestTimeoutMs;
    /** Provides timeout behavior. */
    let timeout: ReturnType<typeof setTimeout> | undefined;
    /** Provides timeout message behavior. */
    const timeoutMessage = `Jest backend ${path} timed out.`;
    /** Provides request behavior. */
    const request = async (): Promise<T> => {
      /** Provides response behavior. */
      const transportOptions = {allowInsecureLoopback: this.allowInsecureLoopback};
      assertSecureBrowserOrigin(transportOptions);
      const url = new URL(resolveSecureHttpUrl(`${this.baseUrl.replace(/\/$/, "")}/${path}`, transportOptions),
        globalThis.location.origin).href;
      const [{createPayloadRequestId, protectPayload, readProtectedPayload}, schema] = await Promise.all([
        import("../../../../src/platform/transport/payloadProtection"),
        schemaPromise,
      ]);
      const context = {operation: path, requestId: createPayloadRequestId()};
      const envelope = await protectPayload(body, {...context, direction: "request"});
      /** Serialize before the transport catch so programming failures are never retried. */
      const requestOptions = {
        method: "POST",
        redirect: "error",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(envelope),
        signal: controller.signal,
      } satisfies RequestInit;
      /** Only a rejected native fetch may retry subscription reconciliation once. */
      let response: Response;
      try {
        response = await fetch(url, requestOptions);
      } catch (error) {
        if (path !== "syncJestSubscriptions" || !(error instanceof TypeError) || controller.signal.aborted ||
          Date.now() >= deadline) throw error;
        response = await fetch(url, requestOptions);
      }
      const payload = await readProtectedPayload(await response.json(), {...context, direction: "response"});
      if (!response.ok) {
        /** Maps ped. */
        const mapped = await mapHttpError?.(response, payload);
        if (mapped?.handled) return mapped.value;
        throw new Error(`Jest backend ${path} failed (${response.status})`);
      }
      return schema.parse(payload);
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
  async exchangeIdentity(playerSigned: string, freshStart = false, deletedUid?: string): Promise<JestIdentityExchangeResult> {
    /** Provides result behavior. */
    const result = await this.post<
      | {
          /** Stores custom token. */
          customToken: string; /** Stores uid. */
          /** Stores uid. */
          uid: string;
          accountGeneration?: number;
          freshAccount?: boolean;
        }
      | {
          /** Stores status. */
          status: "account-deleted";
          deletedUid?: string;
        }
    >("exchangeJestIdentity", {playerSigned, ...(freshStart && deletedUid ? {freshStart: true, deletedUid} : {})}, import("./backendResponses").then(module => module.identityResponse), async (response, errorBody) => {
      if (response.status !== 409) return {handled: false};
      const {deletedErrorResponse} = await import("./backendResponses");
      const deleted = deletedErrorResponse.safeParse(errorBody);
      if (deleted.success)
        return {handled: true, value: {status: "account-deleted", deletedUid: deleted.data.deletedUid}};
      return {handled: false};
    });
    this.accountUid = "status" in result ? undefined : result.uid;
    return "status" in result ? result : {status: "success", ...result};
  }
  /** Provides idempotent signed account-deletion recovery without creating Firebase identity. */
  retryAccountDeletion(playerSigned: string, deletedUid?: string): Promise<{
    /** Stores account deleted. */
    accountDeleted: true;
    deletedUid?: string;
    activeAccountUid?: string;
  }> {
    return this.post<{
      /** Stores account deleted. */
      accountDeleted: true;
      deletedUid?: string;
      activeAccountUid?: string;
    }>("retryJestAccountDeletion", {playerSigned, ...(deletedUid ? {deletedUid} : {})}, import("./backendResponses").then(module => module.deletedResponse));
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
    }>("grantJestPurchase", {purchaseSigned, playerId, purchaseToken, accountUid: this.accountUid}, import("./backendResponses").then(module => module.purchaseResponse));
  }
  /** Provides verify referrals behavior. */
  verifyReferrals(referralsSigned: string, playerId: string) {
    return this.post<JestReferralVerificationResult>("verifyJestReferrals", {referralsSigned, playerId, accountUid: this.accountUid},
      import("./backendResponses").then(module => module.referralResponse));
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
      /** Premium coins granted by this sync, when a monthly grant was due. */
      premiumCoinsAwarded?: number;
      /** Coin balance after this sync. */
      newCoins?: number;
    }>("syncJestSubscriptions", {subscriptionsSigned, playerId, accountUid: this.accountUid}, import("./backendResponses").then(module => module.subscriptionResponse));
  }
}
