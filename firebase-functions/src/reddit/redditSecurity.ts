import {createHash, createHmac, timingSafeEqual} from "node:crypto";

/** Defines the max assertion bytes value. */
const MAX_ASSERTION_BYTES = 4_096;
/** Defines the max payload bytes value. */
const MAX_PAYLOAD_BYTES = 64 * 1_024;
/** Defines the max identifier bytes value. */
const MAX_IDENTIFIER_BYTES = 256;
/** Defines the max operation bytes value. */
const MAX_OPERATION_BYTES = 80;
/** Renders the nonce interface. */
const NONCE = /^[A-Za-z0-9_-]{32,128}$/u;
/** Renders the identifier interface. */
const IDENTIFIER = /^[A-Za-z0-9_:-]{1,256}$/u;
/** Renders the operation interface. */
const OPERATION = /^[a-z][a-z0-9_.-]{0,79}$/u;
/** Defines the max reddit account generation value. */
export const MAX_REDDIT_ACCOUNT_GENERATION = 1_000_000;

/** Describes reddit gateway assertion. */
export type RedditGatewayAssertion = Readonly<{
  version: 1;
  appName: string;
  installationId: string;
  subredditId: string;
  postId: string;
  userId: string;
  operation: string;
  issuedAtMs: number;
  nonce: string;
  payloadHash: string;
}>;

/** Describes verify reddit gateway assertion options. */
export type VerifyRedditGatewayAssertionOptions = Readonly<{
  gatewaySecret: string;
  expectedAppName: string;
  expectedOperation: string;
  nowMs?: number;
  maxAgeMs?: number;
  expectedPayload?: unknown;
  consumeNonce?: (assertion: RedditGatewayAssertion) => boolean | Promise<boolean>;
}>;

/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Provides valid identifier behavior. */
const validIdentifier = (value: unknown): value is string =>
  typeof value === "string" && Buffer.byteLength(value, "utf8") <= MAX_IDENTIFIER_BYTES && IDENTIFIER.test(value);

/** Produces the one canonical byte representation signed by the Devvit gateway. */
export function canonicalRedditGatewayAssertion(assertion: RedditGatewayAssertion): string {
  return JSON.stringify([
    assertion.version,
    assertion.appName,
    assertion.installationId,
    assertion.subredditId,
    assertion.postId,
    assertion.userId,
    assertion.operation,
    assertion.issuedAtMs,
    assertion.nonce,
    assertion.payloadHash,
  ]);
}

/** Hashes the exact JSON payload transported beside a signed gateway assertion. */
export function hashRedditGatewayPayload(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > MAX_PAYLOAD_BYTES) {
    throw new Error("invalid-reddit-gateway-payload");
  }
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

/** Verifies a trusted Devvit-server assertion and atomically consumes its nonce when configured. */
export async function verifyRedditGatewayAssertion(
  body: unknown,
  signature: string,
  options: VerifyRedditGatewayAssertionOptions,
): Promise<RedditGatewayAssertion> {
  if (!isRecord(body) || Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_ASSERTION_BYTES) {
    throw new Error("invalid-reddit-gateway-assertion");
  }
  const fields = ["version", "appName", "installationId", "subredditId", "postId", "userId", "operation", "issuedAtMs", "nonce", "payloadHash"];
  if (Object.keys(body).length !== fields.length || fields.some((field) => !(field in body))) {
    throw new Error("invalid-reddit-gateway-assertion");
  }
  if (
    body.version !== 1 ||
    !validIdentifier(body.appName) ||
    !validIdentifier(body.installationId) ||
    !validIdentifier(body.subredditId) ||
    !validIdentifier(body.postId) ||
    !validIdentifier(body.userId) ||
    typeof body.operation !== "string" ||
    Buffer.byteLength(body.operation, "utf8") > MAX_OPERATION_BYTES ||
    !OPERATION.test(body.operation) ||
    !Number.isSafeInteger(body.issuedAtMs) ||
    (body.issuedAtMs as number) < 0 ||
    typeof body.nonce !== "string" ||
    !NONCE.test(body.nonce) ||
    typeof body.payloadHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(body.payloadHash)
  ) throw new Error("invalid-reddit-gateway-assertion");
  const assertion = body as RedditGatewayAssertion;
  if (assertion.appName !== options.expectedAppName) throw new Error("reddit-gateway-app-mismatch");
  if (assertion.operation !== options.expectedOperation) throw new Error("reddit-gateway-operation-mismatch");
  if (assertion.payloadHash !== hashRedditGatewayPayload(options.expectedPayload ?? {})) {
    throw new Error("reddit-gateway-payload-mismatch");
  }
  if (Buffer.byteLength(options.gatewaySecret, "utf8") < 32) throw new Error("invalid-reddit-gateway-secret");
  if (!/^[A-Za-z0-9_-]{43}$/u.test(signature)) throw new Error("invalid-reddit-gateway-signature");
  const expected = createHmac("sha256", options.gatewaySecret)
    .update("riddle-quest-reddit-gateway-v1\0", "utf8")
    .update(canonicalRedditGatewayAssertion(assertion), "utf8")
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("invalid-reddit-gateway-signature");
  }
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? 60_000;
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1) {
    throw new Error("invalid-reddit-gateway-time");
  }
  if (assertion.issuedAtMs > nowMs + 5_000 || nowMs - assertion.issuedAtMs > maxAgeMs) {
    throw new Error("stale-reddit-gateway-assertion");
  }
  if (options.consumeNonce && !await options.consumeNonce(assertion)) throw new Error("reddit-gateway-replay");
  return assertion;
}

/** Derives a stable provider-scoped Firebase UID using an independent versioned key. */
export function redditFirebaseUid(userId: string, uidSecretBase64: string, accountGeneration = 1): string {
  if (!validIdentifier(userId)) throw new Error("invalid-reddit-user-id");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(uidSecretBase64)) {
    throw new Error("invalid-reddit-uid-secret");
  }
  const secret = Buffer.from(uidSecretBase64, "base64");
  if (secret.length < 32 || secret.toString("base64") !== uidSecretBase64) throw new Error("invalid-reddit-uid-secret");
  if (!Number.isSafeInteger(accountGeneration) || accountGeneration < 1 || accountGeneration > MAX_REDDIT_ACCOUNT_GENERATION) {
    throw new Error("invalid-reddit-account-generation");
  }
  const digest = createHmac("sha256", secret)
    .update("riddle-quest-reddit-uid-v1\0", "utf8")
    .update(String(accountGeneration), "utf8")
    .update("\0", "utf8")
    .update(userId, "utf8")
    .digest("hex")
    .slice(0, 40);
  return `reddit_${digest}`;
}

/** Indicates whether is reddit firebase uid. */
export const isRedditFirebaseUid = (value: string): boolean => /^reddit_[0-9a-f]{40}$/u.test(value);
