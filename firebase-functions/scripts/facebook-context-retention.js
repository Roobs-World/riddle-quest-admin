#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {purgeExpiredFacebookContextPage} = require("../lib/race/facebookContextRetention.js");

/** Writes require explicit project confirmation; the default is read-only. */
const args = process.argv.slice(2);
/** Accepted value-bearing flags; clocks and provider identities may never be supplied. */
const valueFlags = new Set(["--project", "--confirm-project", "--limit"]);
/** Duplicate, unknown and missing options fail before SDK initialization. */
const options = new Map();
/** Records invalid operator input without printing it. */
let valid = true;
for (let index = 0; index < args.length; index++) {
  /** Current option token. */
  const name = args[index];
  if (options.has(name) || name !== "--apply" && !valueFlags.has(name)) {valid = false; break;}
  if (name === "--apply") options.set(name, true);
  else {
    /** Exactly one nonempty argument must follow a value-bearing flag. */
    const value = args[++index];
    if (!value || value.startsWith("--")) {valid = false; break;}
    options.set(name, value);
  }
}
/** Never infer the production target from ambient credentials. */
const projectId = options.get("--project");
/** The operator must explicitly request writes. */
const apply = options.has("--apply");
/** Fixed per-page storage/write budget. */
const limit = Number(options.get("--limit") || 20);
if (!valid || !projectId || apply && options.get("--confirm-project") !== projectId || !Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
  process.stderr.write("Use --project PROJECT [--limit 1..20]. Writes require --apply --confirm-project PROJECT.\n");
  process.exitCode = 1;
} else {
  void (async () => {
    /** Uses only the explicit project and current server clock, never a caller-supplied future cutoff. */
    const db = getFirestore(initializeApp({projectId}));
    /** Helper returns counts only; context IDs and member/run identities are never printed. */
    const result = await purgeExpiredFacebookContextPage(db, Date.now(), apply, limit);
    process.stdout.write(`${JSON.stringify({mode: apply ? "apply" : "dry-run", ...result})}\n`);
    if (result.invalid > 0) process.exitCode = 1;
  })().catch(() => {
    process.stderr.write("Facebook context retention page failed; no provider diagnostics were logged.\n");
    process.exitCode = 1;
  });
}
