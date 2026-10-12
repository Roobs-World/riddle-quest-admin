#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const {readFileSync, statSync} = require("node:fs");
const {createHash} = require("node:crypto");
const {isAbsolute} = require("node:path");

/** Parse and validate all scope and write guards before initializing any SDK. */
function parse(args, env) {
  const values = new Set([
    "--project",
    "--database-url",
    "--input",
    "--offset",
    "--limit",
    "--confirm-project",
    "--expect-sha256",
  ]);
  const options = new Map();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (options.has(flag) || (flag !== "--apply" && !values.has(flag))) throw new Error("invalid-options");
    if (flag === "--apply") options.set(flag, true);
    else {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error("invalid-options");
      options.set(flag, value);
    }
  }
  const projectId = options.get("--project"),
    input = options.get("--input"),
    apply = options.has("--apply");
  const databaseURL = options.get("--database-url"),
    limit = Number(options.get("--limit") ?? 20),
    offset = Number(options.get("--offset") ?? 0);
  if (
    !/^[a-z][a-z0-9-]{4,29}$/.test(projectId ?? "") ||
    !input ||
    !isAbsolute(input) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 20 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  )
    throw new Error("invalid-scope");
  const url = new URL(databaseURL);
  const defaultDatabase = `${projectId}-default-rtdb`;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port ||
    url.pathname !== "/" ||
    !(
      url.hostname === `${projectId}.firebaseio.com` ||
      url.hostname === `${defaultDatabase}.firebaseio.com` ||
      (url.hostname.startsWith(`${defaultDatabase}.`) &&
        /^[a-z0-9-]+\.firebasedatabase\.app$/.test(url.hostname.slice(defaultDatabase.length + 1)))
    )
  )
    throw new Error("database-project-mismatch");
  const firestoreHost = env.FIRESTORE_EMULATOR_HOST,
    databaseHost = env.FIREBASE_DATABASE_EMULATOR_HOST;
  if (firestoreHost || databaseHost || projectId.startsWith("demo-")) {
    if (
      !projectId.startsWith("demo-") ||
      !/^127\.0\.0\.1:\d+$/.test(firestoreHost ?? "") ||
      !/^127\.0\.0\.1:\d+$/.test(databaseHost ?? "")
    )
      throw new Error("invalid-emulator-scope");
  }
  if (!statSync(input).isFile() || statSync(input).size > 2_097_152) throw new Error("invalid-input-file");
  const bytes = readFileSync(input),
    inputSha256 = createHash("sha256").update(bytes).digest("hex");
  const expected = options.get("--expect-sha256");
  if (
    (expected && expected !== inputSha256) ||
    (apply && (options.get("--confirm-project") !== projectId || expected !== inputSha256))
  )
    throw new Error("unconfirmed-write-scope");
  const pairs = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(pairs) || pairs.length > 5000 || offset > pairs.length) throw new Error("invalid-input-inventory");
  const seen = new Set();
  for (const pair of pairs) {
    if (
      !pair ||
      typeof pair !== "object" ||
      Object.keys(pair).length !== 2 ||
      typeof pair.viewerUserId !== "string" ||
      typeof pair.targetUserId !== "string" ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(pair.viewerUserId) ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(pair.targetUserId) ||
      pair.viewerUserId === pair.targetUserId
    )
      throw new Error("invalid-input-pair");
    const key = `${pair.viewerUserId}/${pair.targetUserId}`;
    if (seen.has(key)) throw new Error("duplicate-input-pair");
    seen.add(key);
  }
  return {projectId, databaseURL, pairs, apply, offset, limit, inputSha256};
}

/** Runs one bounded page and emits only aggregate, resumable evidence. */
async function main() {
  const scope = parse(process.argv.slice(2), process.env);
  const {initializeApp, deleteApp} = require("firebase-admin/app");
  const {getFirestore} = require("firebase-admin/firestore");
  const {getDatabase} = require("firebase-admin/database");
  const {reconcilePresenceVisibilityPage} = require("../lib/presence/presenceVisibilityReconciliation.js");
  const app = initializeApp({projectId: scope.projectId, databaseURL: scope.databaseURL});
  try {
    const page = scope.pairs.slice(scope.offset, scope.offset + scope.limit);
    const result = await reconcilePresenceVisibilityPage(page, getFirestore(app), getDatabase(app), scope.apply);
    const nextOffset = scope.offset + result.processed;
    process.stdout.write(
      `${JSON.stringify({
        mode: scope.apply ? "apply" : "dry-run",
        node: process.version,
        inputSha256: scope.inputSha256,
        offset: scope.offset,
        nextOffset,
        totalInputPairs: scope.pairs.length,
        ...result,
        pageComplete: !result.busy && !result.invalid && result.processed === page.length,
        reachedInventoryEnd: nextOffset === scope.pairs.length,
        globalCoverageVerified: false,
        oldWritersDrainedVerified: false,
      })}\n`,
    );
    if (result.busy || result.invalid) process.exitCode = 1;
  } finally {
    await deleteApp(app);
  }
}

main().catch(() => {
  process.stderr.write(
    "Presence reconciliation failed. Use explicit --project, matching --database-url and absolute --input; writes also require --apply --confirm-project and the preview --expect-sha256. No private diagnostics were logged.\n",
  );
  process.exitCode = 1;
});
