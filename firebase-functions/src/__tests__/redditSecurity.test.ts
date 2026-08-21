import {createHmac} from "node:crypto";
import {
  canonicalRedditGatewayAssertion,
  isRedditFirebaseUid,
  redditFirebaseUid,
  type RedditGatewayAssertion,
  verifyRedditGatewayAssertion,
} from "../reddit/redditSecurity";

const gatewaySecret = "reddit-gateway-test-secret-0123456789abcdef";
const uidSecret = Buffer.alloc(32, 7).toString("base64");
const assertion: RedditGatewayAssertion = {
  version: 1,
  appName: "riddle-quest",
  installationId: "riddle-quest:t5_subreddit",
  subredditId: "t5_subreddit",
  postId: "t3_post",
  userId: "t2_reddit-user",
  operation: "identity.exchange",
  issuedAtMs: 1_750_000_000_000,
  nonce: "nonce_0123456789abcdefghijklmnop",
  payloadHash: "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
};
const sign = (value: RedditGatewayAssertion) => createHmac("sha256", gatewaySecret)
  .update("riddle-quest-reddit-gateway-v1\0")
  .update(canonicalRedditGatewayAssertion(value))
  .digest("base64url");
const verify = (value: unknown = assertion, signature = sign(assertion), overrides = {}) => verifyRedditGatewayAssertion(
  value,
  signature,
  {gatewaySecret, expectedAppName: assertion.appName, expectedOperation: assertion.operation, nowMs: assertion.issuedAtMs, ...overrides},
);

describe("Reddit gateway security", () => {
  it("keeps the cross-runtime canonical signature fixture byte-exact", () => {
    expect(canonicalRedditGatewayAssertion(assertion)).toBe('[1,"riddle-quest","riddle-quest:t5_subreddit","t5_subreddit","t3_post","t2_reddit-user","identity.exchange",1750000000000,"nonce_0123456789abcdefghijklmnop","44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"]');
    expect(sign(assertion)).toBe("dRS7luBbW9_uPsQnTADBJpbg9PUmxh98KrOM9ZDx5IA");
  });

  it("accepts an exact fresh signed assertion", async () => {
    await expect(verify()).resolves.toEqual(assertion);
  });

  it.each([
    ["app", {...assertion, appName: "other-app"}, "reddit-gateway-app-mismatch"],
    ["operation", {...assertion, operation: "economy.grant"}, "reddit-gateway-operation-mismatch"],
    ["user", {...assertion, userId: "t2_attacker"}, "invalid-reddit-gateway-signature"],
    ["nonce", {...assertion, nonce: "nonce_0123456789abcdefghijklmnox"}, "invalid-reddit-gateway-signature"],
  ])("rejects a %s mismatch", async (_label, value, message) => {
    await expect(verify(value)).rejects.toThrow(message);
  });

  it("rejects malformed, extra, stale, future, and invalid signature assertions", async () => {
    await expect(verify({...assertion, extra: true})).rejects.toThrow("invalid-reddit-gateway-assertion");
    await expect(verify({...assertion, nonce: "short"}, "x".repeat(43))).rejects.toThrow("invalid-reddit-gateway-assertion");
    await expect(verify(assertion, "x".repeat(43))).rejects.toThrow("invalid-reddit-gateway-signature");
    await expect(verify(assertion, sign(assertion), {nowMs: assertion.issuedAtMs + 60_001})).rejects
      .toThrow("stale-reddit-gateway-assertion");
    await expect(verify(assertion, sign(assertion), {nowMs: assertion.issuedAtMs - 5_001})).rejects
      .toThrow("stale-reddit-gateway-assertion");
  });

  it("binds the exact operation payload", async () => {
    await expect(verify(assertion, sign(assertion), {expectedPayload: {locale: "en"}}))
      .rejects.toThrow("reddit-gateway-payload-mismatch");
  });

  it("consumes each assertion nonce once", async () => {
    const consumed = new Set<string>();
    const consumeNonce = (value: RedditGatewayAssertion) => !consumed.has(value.nonce) && Boolean(consumed.add(value.nonce));
    await expect(verify(assertion, sign(assertion), {consumeNonce})).resolves.toEqual(assertion);
    await expect(verify(assertion, sign(assertion), {consumeNonce})).rejects.toThrow("reddit-gateway-replay");
  });
});

describe("Reddit UID derivation", () => {
  it("is deterministic, provider-scoped, and generation-scoped", () => {
    const first = redditFirebaseUid(assertion.userId, uidSecret);
    expect(first).toBe("reddit_189b24dfa7fdaa95ab3337d72ce73253a3679a04");
    expect(redditFirebaseUid(assertion.userId, uidSecret)).toBe(first);
    expect(redditFirebaseUid(assertion.userId, uidSecret, 2)).not.toBe(first);
    expect(isRedditFirebaseUid(first)).toBe(true);
  });

  it.each(["", "bad user", "x".repeat(257)])("rejects invalid user IDs", (userId) => {
    expect(() => redditFirebaseUid(userId, uidSecret)).toThrow("invalid-reddit-user-id");
  });

  it("rejects weak secrets and invalid generations", () => {
    expect(() => redditFirebaseUid(assertion.userId, Buffer.alloc(8).toString("base64"))).toThrow("invalid-reddit-uid-secret");
    expect(() => redditFirebaseUid(assertion.userId, uidSecret, 0)).toThrow("invalid-reddit-account-generation");
  });
});
