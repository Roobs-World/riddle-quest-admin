import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";
import {builtFunctionCapacityFailures} from "./audit-function-capacity.mjs";

const require = createRequire(new URL("../firebase-functions/package.json", import.meta.url));
const {RESET_VALUE} = require("firebase-functions/v2/options");
const {onCall} = require("firebase-functions/v2/https");
const deployed = require("./lib/firebase-functions/src/index.js");

test("actual built functions keep zero warm instances and omit unspecified maximums", () => {
  const endpoints = Object.values(deployed).filter(handler => handler.__endpoint);
  assert.ok(endpoints.length > 0, "compiled deployable functions are required");
  assert.deepEqual(builtFunctionCapacityFailures(deployed), []);
  for (const handler of endpoints) {
    const endpoint = JSON.parse(JSON.stringify(handler.__endpoint));
    assert.equal(endpoint.minInstances, 0);
    assert.equal(Object.hasOwn(endpoint, "maxInstances"), false);
  }
});

test("capacity audit rejects the SDK reset sentinel and its serialized null", () => {
  assert.ok(RESET_VALUE);
  for (const maxInstances of [RESET_VALUE, null]) {
    assert.deepEqual(builtFunctionCapacityFailures({priorDefault: {__endpoint: {minInstances: 0, maxInstances}}}),
      ["priorDefault: built function resets externally managed maximum instances."]);
  }
  for (const minInstances of [undefined, RESET_VALUE, null, 1]) {
    assert.deepEqual(builtFunctionCapacityFailures({warm: {__endpoint: {minInstances}}}),
      ["warm: built function must explicitly set zero warm instances."]);
  }
});

test("explicit SDK capacity and timeout options still override external preservation", () => {
  const handler = onCall({preserveExternalChanges: true, minInstances: 0, maxInstances: 20, timeoutSeconds: 60}, async () => undefined);
  const endpoint = JSON.parse(JSON.stringify(handler.__endpoint));
  assert.equal(endpoint.minInstances, 0);
  assert.equal(endpoint.maxInstances, 20);
  assert.equal(endpoint.timeoutSeconds, 60);
  assert.deepEqual(builtFunctionCapacityFailures({explicit: handler}), []);
});
