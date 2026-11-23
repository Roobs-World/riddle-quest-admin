import assert from "node:assert/strict";
import test from "node:test";
import {auditFacebookCommerceActivation} from "./audit-facebook-commerce-activation.mjs";

const inactiveBootstrap = "available: { commerce: false, ads: false }; capabilities: {overlay};";

test("accepts an unauthenticated bootstrap without commerce", () => {
  assert.deepEqual(auditFacebookCommerceActivation({
    runtimeSources: [{name: "entry.ts", source: "initializeCorePlay()"}],
    bootstrapSource: inactiveBootstrap,
  }), []);
});

test("rejects commerce outside the Facebook adapter or before authentication", () => {
  const failures = auditFacebookCommerceActivation({
    runtimeSources: [
      {name: "entry.ts", source: "new FacebookCommerceCapability(payments, grant)"},
      {name: "client.ts", source: "call('verifyFacebookSignedPurchase')"},
    ],
    bootstrapSource: "available: {commerce: true}",
  });
  assert.ok(failures.some((failure) => failure.includes("entry.ts")));
  assert.ok(failures.some((failure) => failure.includes("client.ts")));
  assert.ok(failures.some((failure) => failure.includes("availability false")));
  assert.ok(failures.some((failure) => failure.includes("authority is missing")));
});

test("rejects direct capability exposure even when availability remains false", () => {
  const failures = auditFacebookCommerceActivation({
    runtimeSources: [],
    bootstrapSource: "available: {commerce: false,}; capabilities: {commerce: adapter}",
  });
  assert.deepEqual(failures, ["Facebook bootstrap must not expose commerce before authentication."]);
});

test("requires receipt and webhook authority for the Facebook adapter", () => {
  const input = {
    runtimeSources: [{name: "packages/portal/src/facebook/FacebookCommerceSession.ts", source: "new FacebookCommerceCapability(payments, grant)"}],
    bootstrapSource: inactiveBootstrap,
  };
  assert.equal(auditFacebookCommerceActivation(input).length, 5);
  assert.deepEqual(auditFacebookCommerceActivation({...input, serverSources: [
    "verifyFacebookSignedPurchase grantVerifiedFacebookPurchase FACEBOOK_PAYMENTS_WEBHOOK_ENABLED timingSafeEqual facebookPaymentTokens",
  ]}), []);
});
