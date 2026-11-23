import assert from "node:assert/strict";
import test from "node:test";
import {validateRepairPayload} from "../worker/repair-payload.mjs";
import {completeRepair} from "../worker/github-repair.mjs";

const change = {path: "firebase-functions/src/shared/example.ts", mode: "100644", content: Buffer.from("export const fixed = true;\n").toString("base64")};
test("repairs accept source and tests only in the shared and web packages covered by production readiness", () => {
  for (const path of [
    "packages/core/src/game/fixed.ts",
    "packages/core/test/game.test.ts",
    "packages/core/tests/game.test.ts",
    "packages/solo/src/solo.ts",
    "packages/solo/test/solo.test.ts",
    "packages/solo/tests/solo.test.ts",
    "packages/hosted/src/account.ts",
    "packages/hosted/test/account.test.ts",
    "packages/hosted/tests/account.test.ts",
    "packages/portal/src/jest/fixed.ts",
    "packages/portal/test/facebook.test.ts",
    "packages/portal/tests/facebook.test.ts",
    "firebase-functions/src/solo/fixed.ts",
  ]) {
    assert.deepEqual(validateRepairPayload({changes: [{...change, path}]}), {
      changes: [{...change, path}], summary: "Automated repair prepared for review.",
    });
  }
});
test("repairs reject parked targets, unknown packages and package-prefix lookalikes", () => {
  for (const path of [
    "packages/android/src/auth/fixed.ts",
    "packages/android/test/account.test.ts",
    "packages/android/tests/account.test.ts",
    "packages/reddit-app/src/server/fixed.ts",
    "packages/reddit-app/test/account.test.ts",
    "packages/reddit-app/tests/account.test.ts",
    "packages/unknown/src/fixed.ts",
    "packages/core-extra/src/fixed.ts",
    "packages/portal-other/tests/fixed.test.ts",
    "packages/hosted/package.json",
    "firebase-functions/test/fixed.test.ts",
  ]) {
    assert.throws(() => validateRepairPayload({changes: [{...change, path}]}), {message: "unsupported_repair_path"}, path);
  }
});
test("bounded repair payload rejects automation changes, traversal, deletions, binary data and excessive work", () => {
  assert.equal(validateRepairPayload({changes: [change]}).changes.length, 1);
  for (const invalid of [{...change, path: ".github/workflows/check.yml"}, {...change, path: "packages/core/src/../../AGENTS.md"}, {...change, path: "packages/core/src/AGENTS.md"}, {...change, path: "firebase-functions/src/CLAUDE.md"}, {...change, deleted: true}, {...change, mode: "120000"}, {...change, content: "/w=="}, {...change, content: Buffer.alloc(128_001).toString("base64")}]) assert.throws(() => validateRepairPayload({changes: [invalid]}));
  assert.throws(() => validateRepairPayload({changes: Array.from({length: 13}, (_, index) => ({...change, path: `packages/core/src/file${index}.ts`}))}));
});
test("a mixed repair containing a parked target is rejected before any GitHub authority or write request", async () => {
  const requests = [];
  await assert.rejects(completeRepair(
    {issueId: "123", branch: "branch", claimSha: "claim", base: "jest"},
    {changes: [change, {...change, path: "packages/android/src/auth/fixed.ts"}]},
    "server-only",
    async () => {requests.push("authority"); return {allowed: true};},
    async () => {requests.push("github"); throw new Error("must not contact GitHub");},
  ), {message: "unsupported_repair_path"});
  assert.deepEqual(requests, []);
});
test("the service creates the bounded PR from a claim only after both authoritative checks pass", async () => {
  const context = {issueId: "123", branch: "codex/sentry-123", claimSha: "claim", base: "jest"};
  const requests = [];
  const replies = [{object: {sha: "claim"}}, {tree: {sha: "base-tree"}}, {sha: "blob"}, {sha: "tree"}, {sha: "commit"}, {}, {number: 99}];
  let checks = 0;
  const result = await completeRepair(context, {changes: [change], ticket: "signed", summary: "Fixed"}, "server-only", async () => {checks += 1; return {allowed: true};}, async (url, options) => {
    requests.push({url, options});
    return Response.json(replies.shift());
  });
  assert.equal(checks, 2);
  assert.equal(result.pullRequest, 99);
  assert.deepEqual(JSON.parse(requests[4].options.body).parents, ["claim"]);
  assert.equal(JSON.parse(requests[5].options.body).force, false);
  assert.equal(JSON.parse(requests[6].options.body).base, "jest");
});
test("authority changes during completion leave branch and PR untouched", async () => {
  const requests = [];
  const replies = [{object: {sha: "claim"}}, {tree: {sha: "base-tree"}}, {sha: "blob"}, {sha: "tree"}, {sha: "commit"}];
  let checks = 0;
  const result = await completeRepair({issueId: "123", branch: "branch", claimSha: "claim", base: "jest"}, {changes: [change]}, "server-only", async () => ++checks === 1 ? {allowed: true} : {allowed: false, reason: "deployment_changed"}, async (url, options) => {requests.push({url, method: options.method}); return Response.json(replies.shift());});
  assert.equal(result.reason, "deployment_changed");
  assert.ok(requests.every((item) => item.method !== "PATCH" && !item.url.endsWith("/pulls")));
});
