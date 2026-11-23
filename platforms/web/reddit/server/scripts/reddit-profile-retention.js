#!/usr/bin/env node
"use strict";

const functionsRequire = require("../../../../../firebase-functions/scripts/functions-dependencies.js");

const {initializeApp} = functionsRequire("firebase-admin/app");
const {getFirestore} = functionsRequire("firebase-admin/firestore");
const {purgeExpiredRedditProfilePage} = require("../../../../../firebase-functions/lib/platforms/web/reddit/server/redditProfileRetention.js");

/** Strict flags cannot nominate a future clock or a provider identity. */
const args = process.argv.slice(2);
/** Only explicit project/confirmation and bounded page size may have values. */
const valueFlags = new Set(["--project", "--confirm-project", "--limit"]);
/** Reject duplicates and unknown input before administrative initialization. */
const options = new Map();
/** Invalid input remains offline. */
let valid = true;
for (let index = 0; index < args.length; index++) {
  /** Current operator option. */
  const name = args[index];
  if (options.has(name) || name !== "--apply" && !valueFlags.has(name)) {valid = false; break;}
  if (name === "--apply") options.set(name, true);
  else {
    /** Missing values and another flag cannot become a project or limit. */
    const value = args[++index];
    if (!value || value.startsWith("--")) {valid = false; break;}
    options.set(name, value);
  }
}
/** Never infer the production project from ambient credentials. */
const projectId = options.get("--project");
/** Only matching explicit project confirmation authorizes a field-removal operation. */
const apply = options.has("--apply");
/** At most fifty cache fields may be affected in a page. */
const limit = Number(options.get("--limit") || 50);
if (!valid || typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
  apply && options.get("--confirm-project") !== projectId || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
  process.stderr.write("Use --project PROJECT [--limit 1..50]. Writes require --apply --confirm-project PROJECT.\n");
  process.exitCode = 1;
} else {
  void (async () => {
    /** The current server clock is the only permitted expiry cutoff. */
    const db = getFirestore(initializeApp({projectId}));
    /** Returned evidence contains aggregate counts only. */
    const result = await purgeExpiredRedditProfilePage(db, Date.now(), apply, limit);
    process.stdout.write(`${JSON.stringify({mode: apply ? "apply" : "dry-run", ...result})}\n`);
    if (result.invalid > 0) process.exitCode = 1;
  })().catch(() => {
    process.stderr.write("Reddit profile retention page failed; no provider diagnostics were logged.\n");
    process.exitCode = 1;
  });
}
