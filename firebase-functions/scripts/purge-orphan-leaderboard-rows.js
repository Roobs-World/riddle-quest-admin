#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {FieldPath, getFirestore} = require("firebase-admin/firestore");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const projectId = option("--project") || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const confirmedProject = option("--confirm-project");
const pageSize = Number(option("--page-size") || 200);
const maxDocuments = Number(option("--max-documents") || 10_000);
const apply = args.includes("--apply");

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

/** Returns a nonempty string or undefined without normalizing identity values. */
const stringValue = (value) => typeof value === "string" && value.length > 0 ? value : undefined;

/** Audits canonical ownership and optionally purges/backfills one bounded page. */
async function processPage(db, snapshot, shouldApply) {
  const users = snapshot.docs.length > 0
    ? await db.getAll(...snapshot.docs.map((document) => db.collection("users").doc(document.id)))
    : [];
  const deletes = [];
  const backfills = [];
  let orphaned = 0;
  let noncanonical = 0;
  snapshot.docs.forEach((document, index) => {
    const data = document.data();
    if (!users[index]?.exists) {
      orphaned += 1;
      deletes.push(document.ref);
      return;
    }
    const storedUserId = stringValue(data.userId);
    const storedSubject = stringValue(data.subjectUserId);
    if (storedUserId !== document.id || (data.subjectUserId !== undefined && storedSubject !== document.id)) {
      noncanonical += 1;
      deletes.push(document.ref);
      return;
    }
    if (storedSubject === undefined) backfills.push(document.ref);
  });
  if (shouldApply && deletes.length + backfills.length > 0) {
    const batch = db.batch();
    deletes.forEach((ref) => batch.delete(ref));
    // update() deliberately fails if deletion removed the row after the audit
    // read. A merge-set could otherwise recreate an orphaned identity record.
    backfills.forEach((ref) => batch.update(ref, {subjectUserId: ref.id}));
    await batch.commit();
  }
  return {
    orphaned,
    noncanonical,
    subjectBackfills: backfills.length,
    deleted: shouldApply ? deletes.length : 0,
    updated: shouldApply ? backfills.length : 0,
  };
}

if (!projectId) fail("Provide --project or set GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT.");
else if (apply && confirmedProject !== projectId) fail(`Applying requires --confirm-project ${projectId}.`);
else if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 400) {
  fail("--page-size must be an integer from 1 to 400.");
} else if (!Number.isInteger(maxDocuments) || maxDocuments < 1 || maxDocuments > 1_000_000) {
  fail("--max-documents must be an integer from 1 to 1000000.");
} else {
  void (async () => {
    const app = initializeApp({projectId});
    const db = getFirestore(app);
    let cursor;
    let scanned = 0;
    let complete = false;
    const totals = {orphaned: 0, noncanonical: 0, subjectBackfills: 0, deleted: 0, updated: 0};
    while (scanned < maxDocuments) {
      const limit = Math.min(pageSize, maxDocuments - scanned);
      let query = db.collection("leaderboard").orderBy(FieldPath.documentId()).limit(limit);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      if (snapshot.empty) {
        complete = true;
        break;
      }
      const page = await processPage(db, snapshot, apply);
      Object.keys(totals).forEach((key) => { totals[key] += page[key]; });
      scanned += snapshot.docs.length;
      cursor = snapshot.docs.at(-1);
      if (snapshot.docs.length < limit) {
        complete = true;
        break;
      }
    }
    process.stdout.write(`${JSON.stringify({
      mode: apply ? "apply" : "preview",
      projectId,
      pageSize,
      maxDocuments,
      scanned,
      complete,
      ...totals,
    }, null, 2)}\n`);
    if (!complete) fail("The bounded audit did not reach the end; rerun with a larger --max-documents after review.");
  })().catch((error) => fail(error instanceof Error ? error.stack || error.message : String(error)));
}
