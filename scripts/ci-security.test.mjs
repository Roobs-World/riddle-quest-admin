import assert from "node:assert/strict";
import test from "node:test";
import {auditCiSecurity, auditWorkflowSource, auditWorkflowCostPolicy} from "./ci-security.mjs";
import {auditSecurityConfiguration, hasPlaintextNetworkReference} from "./audit-security-config.mjs";

const pinnedCheckout = "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0";

const metadataPath = "firebase-functions/src/android/playDeveloperApi.ts";
const metadataSource = `const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";`;
const avatarPath = "firebase-functions/src/profile/avatarUpload.ts";
const avatarSource = 'const emulator = process.env.FUNCTIONS_EMULATOR === "true" ? process.env.FIREBASE_STORAGE_EMULATOR_HOST : undefined;\n' +
  'const origin = emulator ? new URL(`http://${emulator}`).origin : "https://firebasestorage.googleapis.com";';

test("production security audit accepts its bounded metadata and emulator transport exceptions", () => {
  assert.equal(hasPlaintextNetworkReference(metadataPath, metadataSource), false);
  assert.equal(hasPlaintextNetworkReference(avatarPath, avatarSource), false);
  assert.doesNotThrow(auditSecurityConfiguration);
});

test("plaintext exceptions cannot authorize external endpoints or unrelated source files", () => {
  for (const [path, source] of [[metadataPath, metadataSource], [avatarPath, avatarSource]]) {
    assert.equal(hasPlaintextNetworkReference("packages/portal/src/unsafe.ts", source), true);
    for (const url of ["http://api.example.com", "ws://api.example.com/socket", "http://localhost.example.com", "http://127.0.0.1.example.com"]) {
      assert.equal(hasPlaintextNetworkReference(path, `${source}\nfetch("${url}");`), true, url);
    }
  }
  assert.equal(hasPlaintextNetworkReference(metadataPath, metadataSource.replace("metadata.google.internal", "metadata.google.internal.example.com")), true);
  assert.equal(hasPlaintextNetworkReference(avatarPath, avatarSource.replace('process.env.FUNCTIONS_EMULATOR === "true"', "true")), true);
  assert.equal(hasPlaintextNetworkReference(avatarPath, avatarSource.replace('"https://firebasestorage.googleapis.com"', '"http://firebasestorage.googleapis.com"')), true);
});

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

test("runner cost policy rejects automatic triggers and missing manual confirmation", () => {
  const failures = auditWorkflowCostPolicy("checks.yml", safeWorkflow()).join("\n");
  assert.match(failures, /manual-only/u);
  assert.match(failures, /unchecked runner-usage confirmation/u);
  assert.match(failures, /job verify must require/u);
});

test("runner cost policy rejects commit-based concurrency and repeated browser suites", () => {
  const failures = auditWorkflowCostPolicy("production-readiness.yml", `${safeWorkflow()}
concurrency:
  group: checks-\${{ github.sha }}
  cancel-in-progress: true
  matrix:
    shard: [1, 2, 3, 4]
`).join("\n");
  assert.match(failures, /independently of the commit SHA/u);
  assert.match(failures, /without duplicating common suites/u);
});

test("runner cost policy never ignores quoted event or job keys", () => {
  const source = safeWorkflow().replace("  push:", "  workflow_dispatch:\n  'push':") +
    "  'automatic':\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo expensive\n";
  const failures = auditWorkflowCostPolicy("checks.yml", source).join("\n");
  assert.match(failures, /manual-only/u);
  assert.match(failures, /every job is audited/u);
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
  assert.match(failures, /finite positive timeout/u);
  assert.match(failures, /committed lockfile/u);
});

test("rejects additional workflow permissions and a timeout missing from any job", () => {
  const source = safeWorkflow()
    .replace("  contents: read", "  contents: read\n  issues: write")
    .replace("jobs:\n", "jobs:\n  untimed:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: pnpm install --frozen-lockfile\n");
  const failures = auditWorkflowSource("unsafe.yml", source).join("\n");
  assert.match(failures, /limited to contents: read/u);
  assert.match(failures, /job untimed must have a finite positive timeout/u);
});

test("requires manual, branch-scoped, protected, non-cancelling deployments", () => {
  const source = safeWorkflow().replace("name: Checks", "name: Deploy Example");
  const failures = auditWorkflowSource("deploy.yml", source).join("\n");
  assert.match(failures, /protected production environment/u);
  assert.match(failures, /explicit branch/u);
  assert.match(failures, /must not cancel/u);
  assert.match(failures, /manual-only/u);
});
