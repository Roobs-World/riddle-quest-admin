import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
const functions = JSON.parse(await readFile(new URL("../../firebase-functions/package.json", import.meta.url), "utf8"));

test("production verification builds only the Jest frontend and preserves backend preparation", () => {
  assert.match(root.scripts["build"], /pnpm prepare:functions && pnpm build:jest && pnpm --dir firebase-functions build/u);
  assert.equal(root.scripts["build:web"], "pnpm build:jest");
  assert.doesNotMatch(root.scripts["verify:production"], /build:(?:youtube|reddit|netflix|yahoo|gamesnacks)|@riddle-quest\/android/u);
});

test("backend production coverage retains the unit thresholds and includes the emulator paths", async () => {
  assert.match(functions.scripts["test:coverage"], /node scripts\/verification\/run-isolated-emulators\.js emulators:exec --project demo-/u);
  assert.match(functions.scripts["test:coverage"], /--only firestore,storage,database/u);
  const {default: config} = await import("../../firebase-functions/config/testing/jest.production-coverage.config.js");
  const {default: base} = await import("../../firebase-functions/config/testing/jest.config.js");
  assert.deepEqual(config.coverageThreshold, base.coverageThreshold);
  assert.ok(config.testMatch.includes("**/__tests__/**/*.test.ts"));
  assert.ok(!config.testMatch.some(pattern => pattern.includes("!**/__tests__/**/*.it.test.ts")));
  const workflow = await readFile(new URL("../../.github/workflows/production-readiness.yml", import.meta.url), "utf8");
  const workspace = workflow.split("  functions-node22:")[0];
  const backend = workflow.split("  functions-node22:")[1].split("  browser-and-rules:")[0];
  assert.match(workspace, /pnpm test:coverage:jest/u);
  assert.match(backend, /node-version-file: firebase-functions\/\.nvmrc/u);
  assert.match(backend, /pnpm --dir firebase-functions check:types/u);
  assert.match(backend, /actions\/setup-java@.*[\s\S]*java-version: "21"[\s\S]*pnpm --dir firebase-functions test:coverage/u);
});

test("Jest readiness builds the sole frontend while preserving backend checks", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/production-readiness.yml", import.meta.url), "utf8");
  for (const command of ["pnpm check:types:jest", "pnpm build:jest", "pnpm --dir firebase-functions check:types"]) assert.ok(workflow.includes(command));
  assert.doesNotMatch(workflow, /build:(?:youtube|reddit|netflix|yahoo|gamesnacks)|@riddle-quest\/android/u);
  assert.match(workflow, /needs: \[workspace-node24, functions-node22\]/u);
});
