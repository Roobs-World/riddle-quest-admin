import {createHash, createHmac, randomBytes} from "node:crypto";

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

export const canonicalRedditGatewayAssertion = (assertion: RedditGatewayAssertion): string => JSON.stringify([
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

export const hashRedditGatewayPayload = (payload: unknown): string => {
  const serialized = JSON.stringify(payload);
  if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > 64 * 1_024) throw new Error("reddit-gateway-payload-invalid");
  return createHash("sha256").update(serialized, "utf8").digest("hex");
};

export function createSignedGatewayAssertion(
  input: Omit<RedditGatewayAssertion, "version" | "issuedAtMs" | "nonce" | "payloadHash">,
  secret: string,
  payload: unknown = {},
) {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("reddit-gateway-secret-missing");
  const assertion: RedditGatewayAssertion = {
    version: 1,
    ...input,
    issuedAtMs: Date.now(),
    nonce: randomBytes(32).toString("base64url"),
    payloadHash: hashRedditGatewayPayload(payload),
  };
  const signature = createHmac("sha256", secret)
    .update("riddle-quest-reddit-gateway-v1\0", "utf8")
    .update(canonicalRedditGatewayAssertion(assertion), "utf8")
    .digest("base64url");
  return {assertion, signature, payload};
}
