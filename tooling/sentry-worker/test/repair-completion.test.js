import assert from "node:assert/strict";
import test from "node:test";
import {validateRepairPayload} from "../worker/repair-payload.mjs";
import {completeRepair} from "../worker/github-repair.mjs";

const change = {path: "firebase-functions/src/shared/example.ts", mode: "100644", content: Buffer.from("export const fixed = true;\n").toString("base64")};
test("repairs accept source and tests only in the shared source folders covered by production readiness", () => {
  for (const path of [
    "src/core/game/fixed.ts",
    "src/core/test/game.test.ts",
    "src/core/tests/game.test.ts",
    "src/solo/solo.ts",
    "src/solo/test/solo.test.ts",
    "src/solo/tests/solo.test.ts",
    "src/hosted/account.ts",
    "src/hosted/test/account.test.ts",
    "src/hosted/tests/account.test.ts",
    "src/web/play/fixed.ts",
    "src/web/test/shared-ui.test.ts",
    "src/web/tests/shared-ui.test.ts",
    "platforms/web/jest/src/fixed.ts",
    "platforms/web/jest/server/fixed.ts",
    "platforms/web/jest/scripts/audit-jest-artifact.mjs",
    "platforms/web/facebook/src/fixed.ts",
    "platforms/web/facebook/server/fixed.ts",
    "platforms/web/facebook/scripts/audit-facebook-artifact.mjs",
    "firebase-functions/src/solo/fixed.ts",
  ]) {
    assert.deepEqual(validateRepairPayload({changes: [{...change, path}]}), {
      changes: [{...change, path}], summary: "Automated repair prepared for review.",
    });
  }
});
test("repairs reject parked targets, unknown folders and source-prefix lookalikes", () => {
  for (const path of [
    "platforms/native/android/src/auth/fixed.ts",
    "platforms/native/android/server/account.ts",
    "platforms/web/reddit/src/server/fixed.ts",
    "platforms/web/reddit/server/fixed.ts",
    "platforms/web/youtube/src/sdk.ts",
    "platforms/web/netflix/src/main.tsx",
    "platforms/web/yahoo/server/fixed.ts",
    "platforms/web/gamesnacks/src/main.tsx",
    "platforms/web/jest-extra/src/fixed.ts",
    "platforms/web/facebook-other/scripts/fixed.mjs",
    "platforms/web/jest/package.json",
    "platforms/web/jest/server/package.json",
    "platforms/web/facebook/server/package.json",
    "platforms/web/facebook/vite.config.ts",
    "packages/portal/src/jest/fixed.ts",
    "packages/unknown/src/fixed.ts",
    "src/core-extra/src/fixed.ts",
    "src/web-other/tests/fixed.test.ts",
    "package.json",
    "firebase-functions/test/fixed.test.ts",
  ]) {
    assert.throws(() => validateRepairPayload({changes: [{...change, path}]}), {message: "unsupported_repair_path"}, path);
  }
});
test("bounded repair payload rejects automation changes, traversal, deletions, binary data and excessive work", () => {
  assert.equal(validateRepairPayload({changes: [change]}).changes.length, 1);
  for (const invalid of [{...change, path: ".github/workflows/check.yml"}, {...change, path: "src/core/../../AGENTS.md"}, {...change, path: "src/core/AGENTS.md"}, {...change, path: "firebase-functions/src/CLAUDE.md"}, {...change, deleted: true}, {...change, mode: "120000"}, {...change, content: "/w=="}, {...change, content: Buffer.alloc(128_001).toString("base64")}]) assert.throws(() => validateRepairPayload({changes: [invalid]}));
  assert.throws(() => validateRepairPayload({changes: Array.from({length: 13}, (_, index) => ({...change, path: `src/core/file${index}.ts`}))}));
});
test("a mixed repair containing a parked target is rejected before any GitHub authority or write request", async () => {
  const requests = [];
  await assert.rejects(completeRepair(
    {issueId: "123", branch: "branch", claimSha: "claim", base: "main"},
    {changes: [change, {...change, path: "platforms/native/android/src/auth/fixed.ts"}]},
    "server-only",
    async () => {requests.push("authority"); return {allowed: true};},
    async () => {requests.push("github"); throw new Error("must not contact GitHub");},
  ), {message: "unsupported_repair_path"});
  assert.deepEqual(requests, []);
});
test("the service creates the bounded PR from a claim only after both authoritative checks pass", async () => {
  const context = {issueId: "123", branch: "codex/sentry-123", claimSha: "claim", base: "main"};
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
  assert.equal(JSON.parse(requests[6].options.body).base, "main");
});
test("authority changes during completion leave branch and PR untouched", async () => {
  const requests = [];
  const replies = [{object: {sha: "claim"}}, {tree: {sha: "base-tree"}}, {sha: "blob"}, {sha: "tree"}, {sha: "commit"}];
  let checks = 0;
  const result = await completeRepair({issueId: "123", branch: "branch", claimSha: "claim", base: "main"}, {changes: [change]}, "server-only", async () => ++checks === 1 ? {allowed: true} : {allowed: false, reason: "deployment_changed"}, async (url, options) => {requests.push({url, method: options.method}); return Response.json(replies.shift());});
  assert.equal(result.reason, "deployment_changed");
  assert.ok(requests.every((item) => item.method !== "PATCH" && !item.url.endsWith("/pulls")));
});
