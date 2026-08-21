import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import test from "node:test";
import {canonicalRedditGatewayAssertion, type RedditGatewayAssertion} from "./gatewayAssertion.ts";

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

test("matches the Firebase verifier canonical signature fixture byte-for-byte", () => {
  const canonical = canonicalRedditGatewayAssertion(assertion);
  assert.equal(canonical, '[1,"riddle-quest","riddle-quest:t5_subreddit","t5_subreddit","t3_post","t2_reddit-user","identity.exchange",1750000000000,"nonce_0123456789abcdefghijklmnop","44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"]');
  const signature = createHmac("sha256", "reddit-gateway-test-secret-0123456789abcdef")
    .update("riddle-quest-reddit-gateway-v1\0")
    .update(canonical)
    .digest("base64url");
  assert.equal(signature, "dRS7luBbW9_uPsQnTADBJpbg9PUmxh98KrOM9ZDx5IA");
});
