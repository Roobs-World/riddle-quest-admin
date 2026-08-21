import assert from "node:assert/strict";
import test from "node:test";
import {auditFacebookCommerceActivation} from "./audit-facebook-commerce-activation.mjs";

const inactiveBootstrap = "available: { commerce: false, ads: false }; capabilities: {overlay};";

test("accepts staged commerce that is unavailable and unexposed", () => {
  assert.deepEqual(auditFacebookCommerceActivation({
    runtimeSources: [{name: "entry.ts", source: "initializeCorePlay()"}],
    bootstrapSource: inactiveBootstrap,
  }), []);
});

test("rejects runtime imports, verifier endpoints, or enabled availability", () => {
  const failures = auditFacebookCommerceActivation({
    runtimeSources: [
      {name: "entry.ts", source: "new FacebookCommerceCapability(payments, grant)"},
      {name: "client.ts", source: "call('verifyFacebookSignedPurchase')"},
    ],
    bootstrapSource: "available: {commerce: true}",
  });
  assert.equal(failures.length, 3);
});

test("rejects direct capability exposure even when availability remains false", () => {
  const failures = auditFacebookCommerceActivation({
    runtimeSources: [],
    bootstrapSource: "available: {commerce: false,}; capabilities: {commerce: adapter}",
  });
  assert.deepEqual(failures, ["Facebook bootstrap must not expose the staged commerce capability."]);
});
