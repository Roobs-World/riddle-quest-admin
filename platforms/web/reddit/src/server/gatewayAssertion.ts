import {createHash, createHmac, randomBytes} from "node:crypto";

/** Describes reddit gateway assertion. */
export type RedditGatewayAssertion = Readonly<{
  /** Stores version. */
  version: 1;
  /** Stores app name. */
  appName: string;
  /** Stores installation id. */
  installationId: string;
  /** Stores subreddit id. */
  subredditId: string;
  /** Stores post id. */
  postId: string;
  /** Stores user id. */
  userId: string;
  /** Stores operation. */
  operation: string;
  /** Stores issued at ms. */
  issuedAtMs: number;
  /** Stores nonce. */
  nonce: string;
  /** Stores payload hash. */
  payloadHash: string;
}>;

/** Provides canonical reddit gateway assertion behavior. */
export const canonicalRedditGatewayAssertion = (assertion: RedditGatewayAssertion): string =>
  JSON.stringify([
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

/** Provides hash reddit gateway payload behavior. */
export const hashRedditGatewayPayload = (payload: unknown): string => {
  /** Serializes d. */
  const serialized = JSON.stringify(payload);
  if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > 64 * 1_024)
    throw new Error("reddit-gateway-payload-invalid");
  return createHash("sha256").update(serialized, "utf8").digest("hex");
};

/** Creates signed gateway assertion. */
export function createSignedGatewayAssertion(
  input: Omit<RedditGatewayAssertion, "version" | "issuedAtMs" | "nonce" | "payloadHash">,
  secret: string,
  payload: unknown = {},
) {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("reddit-gateway-secret-missing");
  /** Asserts ion. */
  const assertion: RedditGatewayAssertion = {
    version: 1,
    ...input,
    issuedAtMs: Date.now(),
    nonce: randomBytes(32).toString("base64url"),
    payloadHash: hashRedditGatewayPayload(payload),
  };
  /** Provides signature behavior. */
  const signature = createHmac("sha256", secret)
    .update("riddle-quest-reddit-gateway-v1\0", "utf8")
    .update(canonicalRedditGatewayAssertion(assertion), "utf8")
    .digest("base64url");
  return {assertion, signature, payload};
}
