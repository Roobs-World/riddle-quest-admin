#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {FieldPath, FieldValue, Timestamp, getFirestore} = require("firebase-admin/firestore");
const {RACE_CHALLENGE_TTL_MS} = require("@qwordly/core/race");

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
const fallbackName = "Riddle Quest player";

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

/** Audits or updates one bounded, document-ID-paginated query. */
async function processLegacyRecords(db, createQuery, updatesFor, options) {
  let cursor;
  let scanned = 0;
  let unlinked = 0;
  let updated = 0;
  let complete = false;
  while (scanned < options.maxDocuments) {
    const limit = Math.min(options.pageSize, options.maxDocuments - scanned);
    let query = createQuery().orderBy(FieldPath.documentId()).limit(limit);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) {
      complete = true;
      break;
    }
    const updates = snapshot.docs.flatMap((document) => {
      const fields = updatesFor(document.data());
      return fields ? [{ref: document.ref, fields}] : [];
    });
    scanned += snapshot.docs.length;
    unlinked += updates.length;
    if (options.apply && updates.length > 0) {
      const batch = db.batch();
      updates.forEach(({ref, fields}) => batch.update(ref, fields));
      await batch.commit();
      updated += updates.length;
    }
    cursor = snapshot.docs.at(-1);
    if (snapshot.docs.length < limit) {
      complete = true;
      break;
    }
  }
  return {scanned, unlinked, updated, complete};
}

/** Minimizes live-parent receipts and deletes receipts whose race-run parent is gone. */
async function processLegacyRaceRequestReceipts(db, options) {
  let cursor;
  let scanned = 0;
  let orphaned = 0;
  let identityBearing = 0;
  let deleted = 0;
  let updated = 0;
  let complete = false;
  while (scanned < options.maxDocuments) {
    const limit = Math.min(options.pageSize, options.maxDocuments - scanned);
    let query = db.collectionGroup("requests").orderBy(FieldPath.documentId()).limit(limit);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) {
      complete = true;
      break;
    }
    const parentRefs = new Map();
    snapshot.docs.forEach((document) => {
      const parent = document.ref.parent.parent;
      if (parent && parent.parent.id === "raceRuns" && parent.parent.parent === null) {
        parentRefs.set(parent.path, parent);
      }
    });
    const parentSnapshots = parentRefs.size > 0 ? await db.getAll(...parentRefs.values()) : [];
    const parents = new Map(parentSnapshots.map((parent) => [parent.ref.path, parent]));
    const orphanedTargets = [];
    const updateTargets = [];
    snapshot.docs.forEach((document) => {
      const parent = document.ref.parent.parent;
      if (!parent || parent.parent.id !== "raceRuns" || parent.parent.parent !== null) return;
      const parentSnapshot = parents.get(parent.path);
      if (!parentSnapshot?.exists) {
        orphanedTargets.push(document);
        return;
      }
      const response = document.data().response;
      const run = typeof response === "object" && response !== null ? response.run : undefined;
      const responseOpponent = typeof run === "object" && run !== null ? run.opponent : undefined;
      if (typeof responseOpponent === "object" && responseOpponent !== null) updateTargets.push(document);
    });
    scanned += snapshot.docs.length;
    orphaned += orphanedTargets.length;
    identityBearing += updateTargets.length;
    if (options.apply && orphanedTargets.length + updateTargets.length > 0) {
      const batch = db.batch();
      orphanedTargets.forEach((document) => batch.delete(document.ref));
      updateTargets.forEach((document) => batch.update(document.ref, {
        "response.run.opponent.displayName": fallbackName,
        "response.run.opponent.avatarUrl": FieldValue.delete(),
      }));
      await batch.commit();
      deleted += orphanedTargets.length;
      updated += updateTargets.length;
    }
    cursor = snapshot.docs.at(-1);
    if (snapshot.docs.length < limit) {
      complete = true;
      break;
    }
  }
  return {scanned, orphaned, identityBearing, deleted, updated, complete};
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
    const options = {apply, pageSize, maxDocuments};
    const raceInbox = await processLegacyRecords(
      db,
      () => db.collectionGroup("raceInbox"),
      (data) => {
        if (typeof data.opponentUserId === "string" && data.opponentUserId.length > 0) return null;
        const now = Date.now();
        const createdAtMs = typeof data.createdAtMs === "number" && Number.isFinite(data.createdAtMs)
          ? data.createdAtMs
          : now - RACE_CHALLENGE_TTL_MS;
        const expiresAtMs = Math.min(createdAtMs + RACE_CHALLENGE_TTL_MS, now + RACE_CHALLENGE_TTL_MS);
        return {
          opponentDisplayName: fallbackName,
          opponentAvatarUrl: FieldValue.delete(),
          expiresAt: Timestamp.fromMillis(Math.max(0, expiresAtMs)),
        };
      },
      options,
    );
    const raceRuns = await processLegacyRecords(
      db,
      () => db.collection("raceRuns"),
      (data) => {
        const opponent = data.opponent;
        if (typeof opponent !== "object" || opponent === null) return null;
        if (typeof opponent.subjectUserId === "string" && opponent.subjectUserId.length > 0) return null;
        return {
          "opponent.displayName": fallbackName,
          "opponent.avatarUrl": FieldValue.delete(),
        };
      },
      options,
    );
    const raceRequestReceipts = await processLegacyRaceRequestReceipts(db, options);
    const result = {
      mode: apply ? "apply" : "preview",
      projectId,
      pageSize,
      maxDocuments,
      raceInbox,
      raceRuns,
      raceRequestReceipts,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!raceInbox.complete || !raceRuns.complete || !raceRequestReceipts.complete) {
      fail("The bounded audit did not reach the end; rerun with a larger --max-documents after reviewing scope.");
    }
  })().catch((error) => fail(error instanceof Error ? error.stack || error.message : String(error)));
}
