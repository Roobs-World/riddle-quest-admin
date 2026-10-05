import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
const portal = JSON.parse(await readFile(new URL("../../packages/portal/package.json", import.meta.url), "utf8"));
const functions = JSON.parse(await readFile(new URL("../../firebase-functions/package.json", import.meta.url), "utf8"));

test("production verification uses the canonical release E2E gate without downgrading content to a fixture", () => {
  const command = root.scripts["verify:production"];
  assert.match(command, /&& pnpm test:e2e &&/u);
  assert.doesNotMatch(command, /build:youtube:fixture|test:.*:playwright/u);
  assert.match(portal.scripts["test:e2e:local"], /pnpm verify:all-targets/u);
  assert.match(portal.scripts["verify:all-targets"], /pnpm build:all-targets/u);
  for (const target of ["youtube", "netflix", "yahoo"]) {
    assert.match(portal.scripts["build:all-targets"], new RegExp(`pnpm build:${target}(?: &&|$)`, "u"));
    assert.match(portal.scripts[`build:${target}`], /check:youtube-content:release/u);
  }
  for (const target of ["jest", "facebook", "reddit"]) {
    assert.match(portal.scripts["build:web"], new RegExp(`pnpm build:${target}(?: &&|$)`, "u"));
  }
  assert.match(portal.scripts["verify:all-targets"], /test:standalone:playwright/u);
});

test("backend production coverage retains the unit thresholds and includes the emulator paths", async () => {
  assert.match(functions.scripts["test:coverage"], /firebase emulators:exec --project demo-/u);
  assert.match(functions.scripts["test:coverage"], /--only firestore,storage,database/u);
  const {default: config} = await import("../../firebase-functions/jest.production-coverage.config.js");
  const {default: base} = await import("../../firebase-functions/jest.config.js");
  assert.deepEqual(config.coverageThreshold, base.coverageThreshold);
  assert.ok(config.testMatch.includes("**/__tests__/**/*.test.ts"));
  assert.ok(!config.testMatch.some(pattern => pattern.includes("!**/__tests__/**/*.it.test.ts")));
  const workflow = await readFile(new URL("../../.github/workflows/production-readiness.yml", import.meta.url), "utf8");
  const workspace = workflow.split("  functions-node22:")[0];
  assert.match(workspace, /actions\/setup-java@.*[\s\S]*java-version: "21"[\s\S]*pnpm test:coverage/u);
});
