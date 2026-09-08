import assert from "node:assert/strict";
import test from "node:test";
import {auditCiSecurity, auditWorkflowSource} from "./ci-security.mjs";

const pinnedCheckout = "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0";

const safeWorkflow = (extra = "") => `name: Checks
on:
  push:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: ${pinnedCheckout}
        with:
          persist-credentials: false
      - run: pnpm install --frozen-lockfile
${extra}`;

test("committed workflows satisfy the CI security contract", () => {
  assert.ok(auditCiSecurity() >= 2);
});

test("rejects mutable actions, privileged triggers, and persisted checkout credentials", () => {
  const source = safeWorkflow()
    .replace(pinnedCheckout, "actions/checkout@v7")
    .replace("persist-credentials: false", "persist-credentials: true")
    .replace("  push:", "  pull_request_target:");
  const failures = auditWorkflowSource("unsafe.yml", source).join("\n");
  assert.match(failures, /pull_request_target/u);
  assert.match(failures, /full commit SHA/u);
  assert.match(failures, /disable persisted Git credentials/u);
});

test("rejects workflows without least privilege, timeouts, or lockfile enforcement", () => {
  const source = safeWorkflow()
    .replace("permissions:\n  contents: read\n", "permissions: write-all\n")
    .replace("    timeout-minutes: 10\n", "")
    .replace(" --frozen-lockfile", "");
  const failures = auditWorkflowSource("unsafe.yml", source).join("\n");
  assert.match(failures, /contents: read/u);
  assert.match(failures, /finite timeout/u);
  assert.match(failures, /committed lockfile/u);
});

test("requires manual, branch-scoped, protected, non-cancelling deployments", () => {
  const source = safeWorkflow().replace("name: Checks", "name: Deploy Example");
  const failures = auditWorkflowSource("deploy.yml", source).join("\n");
  assert.match(failures, /protected production environment/u);
  assert.match(failures, /explicit branch/u);
  assert.match(failures, /must not cancel/u);
  assert.match(failures, /manual-only/u);
});
