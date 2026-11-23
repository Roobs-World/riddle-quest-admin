#!/usr/bin/env node
"use strict";

const functionsRequire = require("../../../../../firebase-functions/scripts/runtime/functions-dependencies.js");

const {initializeApp} = functionsRequire("firebase-admin/app");
const {getFirestore, FieldPath} = functionsRequire("firebase-admin/firestore");
const {prepareFacebookReferralTokenRetention} = require("../../../../../firebase-functions/lib/platforms/web/facebook/server/facebookReferralRetention.js");

/** Explicit operator options; no mutation occurs without both apply and project confirmation. */
const args = process.argv.slice(2);
/** Reads one bounded command-line option. */
const option = name => {
  /** Position of the requested operator option. */
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
/** Application project is never inferred from a credentials file. */
const projectId = option("--project");
/** Dry-run is the default, including when Firebase credentials are already present. */
const apply = args.includes("--apply");
/** Page cursor is only a domain-separated opaque token hash. */
const after = option("--after");
/** Keeps the maintenance page within a fixed storage/read budget. */
const pageSize = Number(option("--page-size") || 100);

if (!projectId || apply && option("--confirm-project") !== projectId ||
  !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || after && !/^[0-9a-f]{64}$/.test(after)) {
  process.stderr.write("Use --project PROJECT [--page-size 1..100] [--after TOKEN_HASH]. Writes require --apply --confirm-project PROJECT.\n");
  process.exitCode = 1;
} else {
  void (async () => {
    /** SDK client uses the explicit project and any existing emulator/credential configuration. */
    const db = getFirestore(initializeApp({projectId}));
    /** Queries only temporary Facebook rows, never another platform's economy. */
    let query = db.collection("facebookReferralTokens").orderBy(FieldPath.documentId()).limit(pageSize + 1);
    if (after) query = query.startAfter(after);
    /** The extra row proves whether a further bounded page is required. */
    const snapshot = await query.get();
    /** Aggregate output deliberately excludes provider identities and raw tokens. */
    const totals = {mode: apply ? "apply" : "dry-run", scanned: 0, ready: 0, alreadyReady: 0, missing: 0, tooManyBindings: 0, invalid: 0, bindingUpdates: 0};
    for (const row of snapshot.docs.slice(0, pageSize)) {
      totals.scanned++;
      try {
        /** Each token/backfill is transactionally isolated from concurrently bound invitations. */
        const result = await prepareFacebookReferralTokenRetention(db, row.id, apply);
        totals.bindingUpdates += result.bindingUpdates;
        if (result.status === "ready") totals.ready++;
        else if (result.status === "already-ready") totals.alreadyReady++;
        else if (result.status === "missing") totals.missing++;
        else totals.tooManyBindings++;
      } catch {
        totals.invalid++;
      }
    }
    process.stdout.write(`${JSON.stringify({...totals, complete: snapshot.size <= pageSize && totals.invalid === 0 && totals.tooManyBindings === 0,
      ...(snapshot.size > pageSize && /^[0-9a-f]{64}$/.test(snapshot.docs[pageSize - 1].id)
        ? {nextTokenCursor: snapshot.docs[pageSize - 1].id} : {})})}\n`);
    if (totals.invalid || totals.tooManyBindings) process.exitCode = 1;
  })().catch(() => {
    process.stderr.write("Facebook referral retention page failed; no provider diagnostics were logged.\n");
    process.exitCode = 1;
  });
}
