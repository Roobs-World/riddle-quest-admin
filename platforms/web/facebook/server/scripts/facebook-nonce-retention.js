#!/usr/bin/env node
"use strict";

const functionsRequire = require("../../../../../firebase-functions/scripts/runtime/functions-dependencies.js");

const {initializeApp} = functionsRequire("firebase-admin/app");
const {getFirestore, FieldPath} = functionsRequire("firebase-admin/firestore");
const {prepareFacebookIdentityNonceRetention} = require("../../../../../firebase-functions/lib/platforms/web/facebook/server/facebookIdentityNonce.js");

/** Rejects unknown/duplicate/positional options before credentials or database access. */
const args = process.argv.slice(2);
/** Parsed operator settings; dry run is the default. */
const options = new Map();
/** Every non-switch option requires one explicit value. */
const values = ["--project", "--confirm-project", "--after", "--page-size"];
/** Malformed input never initializes an SDK client. */
let valid = true;
for (let index = 0; index < args.length; index++) {
  /** This exact flag selects one setting and must occur once. */
  const key = args[index];
  if (options.has(key) || key !== "--apply" && !values.includes(key)) {valid = false; break;}
  if (key === "--apply") options.set(key, true);
  else {
    /** Missing values cannot be confused with the next option. */
    const value = args[++index];
    if (!value || value.startsWith("--")) {valid = false; break;}
    options.set(key, value);
  }
}
/** Never infer a production project from a credential file or current Firebase alias. */
const projectId = options.get("--project");
/** Mutation requires both an explicit switch and the same project confirmation. */
const apply = options.get("--apply") === true;
/** Cursor contains only the opaque nonce hash, never player data. */
const after = options.get("--after");
/** One page cannot exceed 100 independent row transactions. */
const pageSize = Number(options.get("--page-size") ?? 100);

if (!valid || typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
  apply && options.get("--confirm-project") !== projectId ||
  !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || after && !/^[0-9a-f]{64}$/.test(after)) {
  process.stderr.write("Use --project PROJECT [--page-size 1..100] [--after NONCE_HASH]. Writes require --apply --confirm-project PROJECT.\n");
  process.exitCode = 1;
} else {
  void (async () => {
    /** Uses only the explicitly selected project and existing emulator/credential configuration. */
    const db = getFirestore(initializeApp({projectId}));
    /** Bound query touches only temporary Facebook challenges, not provider identity/economy records. */
    let query = db.collection("facebookIdentityNonces").orderBy(FieldPath.documentId()).limit(pageSize + 1);
    if (after) query = query.startAfter(after);
    /** One lookahead row determines whether another bounded page is needed. */
    const snapshot = await query.get();
    /** Operational output is aggregate-only with no record contents or raw diagnostics. */
    const totals = {mode: apply ? "apply" : "dry-run", scanned: 0, ready: 0, alreadyReady: 0, missing: 0, invalid: 0};
    for (const row of snapshot.docs.slice(0, pageSize)) {
      totals.scanned++;
      try {
        /** The transaction re-reads live consumption/deletion state instead of writing page snapshots. */
        const outcome = await prepareFacebookIdentityNonceRetention(db, row.id, apply);
        if (outcome === "ready") totals.ready++;
        else if (outcome === "already-ready") totals.alreadyReady++;
        else if (outcome === "missing") totals.missing++;
        else throw new Error("invalid-facebook-nonce-retention-outcome");
      } catch {totals.invalid++;}
    }
    process.stdout.write(`${JSON.stringify({...totals, complete: snapshot.size <= pageSize && totals.invalid === 0,
      ...(snapshot.size > pageSize && /^[0-9a-f]{64}$/.test(snapshot.docs[pageSize - 1].id)
        ? {nextNonceCursor: snapshot.docs[pageSize - 1].id} : {})})}\n`);
    if (totals.invalid) process.exitCode = 1;
  })().catch(() => {
    process.stderr.write("Facebook nonce retention page failed; no provider diagnostics were logged.\n");
    process.exitCode = 1;
  });
}
