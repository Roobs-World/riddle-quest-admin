/** Describes facebook identity credentials. */
export type FacebookIdentityCredentials = {
  /** Stores custom token. */
  customToken: string;
  /** Stores app check token. */
  appCheckToken: string;
  /** Stores app check expires in ms. */
  appCheckExpiresInMs: number;
  /** Stores uid. */
  uid: string;
};

/** Defines the contract for facebook backend port. */
export interface FacebookBackendPort {
  /** Provides issue identity nonce behavior. */
  issueIdentityNonce(): Promise<{nonce: string; expiresAtMs: number}>;
  /** Provides exchange identity behavior. */
  exchangeIdentity(input: {signedPlayer: string; playerId: string; nonce: string}): Promise<FacebookIdentityCredentials>;
}

/** Describes facebook backend client options. */
export type FacebookBackendClientOptions = {
  /** Stores allow insecure loopback. */
  allowInsecureLoopback?: boolean;
  /** Stores request timeout ms. */
  requestTimeoutMs?: number;
};

/** Defines the facebook backend request timeout ms value. */
export const FACEBOOK_BACKEND_REQUEST_TIMEOUT_MS = 15_000;
/** Defines the facebook app check ttl ms value. */
const FACEBOOK_APP_CHECK_TTL_MS = 60 * 60 * 1_000;
/** Renders the token interface. */
const TOKEN = /^[A-Za-z0-9._-]+$/u;
/** Renders the nonce interface. */
const NONCE = /^[A-Za-z0-9_-]{43}$/u;
/** Defines the facebook uid value. */
const FACEBOOK_UID = /^facebook_[0-9a-f]{40}$/u;

/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** Indicates whether has exact keys. */
const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
/** Provides bounded token behavior. */
const boundedToken = (value: unknown): value is string => typeof value === "string" &&
  value.length > 0 && new TextEncoder().encode(value).byteLength <= 16_384 && TOKEN.test(value);

/** Rejects malformed or drifted nonce responses before invoking the Facebook SDK. */
export function parseFacebookIdentityNonceResponse(value: unknown): {nonce: string; expiresAtMs: number} {
  if (!isRecord(value) || !hasExactKeys(value, ["nonce", "expiresAtMs"]) ||
    typeof value.nonce !== "string" || !NONCE.test(value.nonce) ||
    !Number.isSafeInteger(value.expiresAtMs) || (value.expiresAtMs as number) < 1) {
    throw new Error("Invalid Facebook identity nonce response.");
  }
  return {nonce: value.nonce, expiresAtMs: value.expiresAtMs as number};
}

/** Accepts only the exact one-hour, provider-scoped credential response contract. */
export function parseFacebookIdentityCredentials(value: unknown): FacebookIdentityCredentials {
  if (!isRecord(value) || !hasExactKeys(value, [
    "customToken", "appCheckToken", "appCheckExpiresInMs", "uid",
  ]) || !boundedToken(value.customToken) || !boundedToken(value.appCheckToken) ||
    value.appCheckExpiresInMs !== FACEBOOK_APP_CHECK_TTL_MS ||
    typeof value.uid !== "string" || !FACEBOOK_UID.test(value.uid)) {
    throw new Error("Invalid Facebook identity credential response.");
  }
  return {
    customToken: value.customToken,
    appCheckToken: value.appCheckToken,
    appCheckExpiresInMs: value.appCheckExpiresInMs,
    uid: value.uid,
  };
}

/** Resolves facebook backend url. */
export function resolveFacebookBackendUrl(baseUrl: string, options: FacebookBackendClientOptions = {}): string {
  const trimmed = baseUrl.trim();
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) throw new Error("Facebook backend URL must not be protocol-relative.");
    return trimmed;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Facebook backend URL must be HTTPS or root-relative.");
  }
  if (parsed.protocol === "https:") return parsed.toString();
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
  if (options.allowInsecureLoopback && parsed.protocol === "http:" && loopback) return parsed.toString();
  throw new Error("Facebook backend URL must use HTTPS.");
}

/** Provides facebook backend client behavior. */
export class FacebookBackendClient implements FacebookBackendPort {
  /** Stores base url. */
  private readonly baseUrl: string;
  /** Stores request timeout ms. */
  private readonly requestTimeoutMs: number;

  /** Creates a facebook backend client instance. */
  constructor(baseUrl: string, options: FacebookBackendClientOptions = {}) {
    this.baseUrl = resolveFacebookBackendUrl(baseUrl, options);
    this.requestTimeoutMs = options.requestTimeoutMs ?? FACEBOOK_BACKEND_REQUEST_TIMEOUT_MS;
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new Error("Facebook backend timeout must be positive.");
    }
  }

  /** Provides post behavior. */
  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      fetch(`${this.baseUrl.replace(/\/$/, "")}/${path}`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(body),
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Facebook backend ${path} failed (${response.status})`);
        return response.json() as Promise<T>;
      }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Facebook backend ${path} timed out.`));
        }, this.requestTimeoutMs);
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
  }

  /** Provides issue identity nonce behavior. */
  issueIdentityNonce(): Promise<{nonce: string; expiresAtMs: number}> {
    return this.post<unknown>("issueFacebookIdentityNonce", {}).then(parseFacebookIdentityNonceResponse);
  }

  /** Provides exchange identity behavior. */
  exchangeIdentity(input: {signedPlayer: string; playerId: string; nonce: string}): Promise<FacebookIdentityCredentials> {
    return this.post<unknown>("exchangeFacebookIdentity", input).then(parseFacebookIdentityCredentials);
  }
}
