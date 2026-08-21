import assert from "node:assert/strict";
import test from "node:test";
import {normalizeIdentitySessionResult} from "./featureFallback.ts";

test("identity kill switch degrades to guest core play only for the exact disabled response", () => {
  assert.deepEqual(normalizeIdentitySessionResult({
    status: 503, payload: {error: "reddit-feature-disabled:identity"},
  }), {status: 200, payload: {ok: true, authenticated: false, reason: "identity-disabled"}});
  assert.deepEqual(normalizeIdentitySessionResult({
    status: 503, payload: {error: "gateway-not-configured"},
  }), {status: 503, payload: {error: "gateway-not-configured"}});
  assert.deepEqual(normalizeIdentitySessionResult({
    status: 401, payload: {error: "invalid-request"},
  }), {status: 401, payload: {error: "invalid-request"}});
});
