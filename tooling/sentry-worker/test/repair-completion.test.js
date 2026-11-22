import assert from "node:assert/strict";
import test from "node:test";
import {validateRepairPayload} from "../worker/repair-payload.mjs";
import {completeRepair} from "../worker/github-repair.mjs";

const change = {path: "firebase-functions/src/shared/example.ts", mode: "100644", content: Buffer.from("export const fixed = true;\n").toString("base64")};
test("bounded repair payload rejects automation changes, traversal, deletions, binary data and excessive work", () => {
  assert.equal(validateRepairPayload({changes: [change]}).changes.length, 1);
  for (const invalid of [{...change, path: ".github/workflows/check.yml"}, {...change, path: "packages/core/src/../../AGENTS.md"}, {...change, path: "packages/core/src/AGENTS.md"}, {...change, path: "firebase-functions/src/CLAUDE.md"}, {...change, deleted: true}, {...change, mode: "120000"}, {...change, content: "/w=="}, {...change, content: Buffer.alloc(128_001).toString("base64")}]) assert.throws(() => validateRepairPayload({changes: [invalid]}));
  assert.throws(() => validateRepairPayload({changes: Array.from({length: 13}, (_, index) => ({...change, path: `packages/core/src/file${index}.ts`}))}));
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
