import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));

test("release builds keep audited content and separate provider artifacts", () => {
  assert.match(root.scripts["verify:all-targets"], /pnpm build:all-targets/u);
  for (const target of ["youtube", "netflix", "yahoo"]) {
    assert.match(root.scripts["build:all-targets"], new RegExp(`pnpm build:${target}(?: &&|$)`, "u"));
    assert.match(root.scripts[`build:${target}`], /check:youtube-content:release/u);
  }
  for (const target of ["facebook", "reddit:client"]) {
    assert.match(root.scripts["build:web"], new RegExp(`pnpm build:${target}(?: &&|$)`, "u"));
  }
  assert.doesNotMatch(root.scripts["build:facebook"], /build:(?:web|all-targets|reddit|youtube|netflix|yahoo|gamesnacks)(?:\s|$)/u);
});

test("Facebook readiness stays manual and checks both client and authoritative server", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/production-readiness.yml", import.meta.url), "utf8");
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /confirm_runner_usage:/u);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule):/mu);
  assert.match(workflow, /inputs.confirm_runner_usage/u);
  assert.match(workflow, /pnpm check:types:shared/u);
  assert.match(workflow, /pnpm build:facebook/u);
  assert.match(workflow, /node-version-file: firebase-functions\/\.nvmrc/u);
  assert.match(workflow, /pnpm --dir firebase-functions check:types/u);
  assert.match(workflow, /pnpm --dir firebase-functions build/u);
  assert.match(workflow, /needs: \[workspace-node24, functions-node22\]/u);
  assert.match(workflow, /run: node platforms\/web\/facebook\/scripts\/prepare-facebook-draft\.mjs/u);
  assert.doesNotMatch(workflow, /reddit-app build|test:youtube-content|check:youtube-progress/u);
});
