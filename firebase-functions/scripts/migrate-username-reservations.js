#!/usr/bin/env node
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {FieldPath, getFirestore} = require("firebase-admin/firestore");
const {
  MAX_USERNAME_MIGRATION_PAGE_SIZE,
  migrateUsernameReservationPage,
} = require("../lib/profile/usernameReservationMigration.js");
const {
  createUsernameReservationFields,
  usernameReservationMigrationRef,
  USERNAME_RESERVATIONS_COLLECTION,
} = require("../lib/profile/usernameReservations.js");
const {UsernameSchema} = require("@riddle-quest/core/validation/requestSchemas");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const projectId = option("--project") || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const confirmedProject = option("--confirm-project");
const pageSize = Number(option("--page-size") || 100);
const apply = args.includes("--apply");

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

if (!projectId) fail("Provide --project or set GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT.");
else if (apply && confirmedProject !== projectId) fail(`Applying requires --confirm-project ${projectId}.`);
else if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_USERNAME_MIGRATION_PAGE_SIZE) {
  fail(`--page-size must be an integer from 1 to ${MAX_USERNAME_MIGRATION_PAGE_SIZE}.`);
} else {
  void (async () => {
    const app = initializeApp({projectId});
    const db = getFirestore(app);
    if (apply) {
      const result = await migrateUsernameReservationPage(db, pageSize);
      process.stdout.write(`${JSON.stringify({mode: "apply", projectId, ...result}, null, 2)}\n`);
      return;
    }

    const stateSnapshot = await usernameReservationMigrationRef(db).get();
    const state = stateSnapshot.data();
    let query = db.collection("users").orderBy(FieldPath.documentId()).limit(pageSize);
    if (typeof state?.lastUserId === "string") query = query.startAfter(state.lastUserId);
    const users = await query.get();
    const candidates = users.docs.map((document) => {
      const parsed = UsernameSchema.safeParse(document.data().username);
      return parsed.success
        ? {id: document.id, username: parsed.data, ...createUsernameReservationFields(parsed.data)}
        : {id: document.id, invalid: true};
    });
    const valid = candidates.filter((candidate) => !candidate.invalid);
    const reservations = valid.length > 0
      ? await db.getAll(...valid.map((candidate) =>
        db.collection(USERNAME_RESERVATIONS_COLLECTION).doc(candidate.usernameReservationId)))
      : [];
    const collisions = valid.flatMap((candidate, index) => {
      const owner = reservations[index].data()?.userId;
      return reservations[index].exists && owner !== candidate.id
        ? [{id: candidate.id, owner, username: candidate.username}]
        : [];
    });
    const withinPageOwners = new Map();
    for (const candidate of valid) {
      const owner = withinPageOwners.get(candidate.usernameReservationId);
      if (owner && owner !== candidate.id) collisions.push({id: candidate.id, owner, username: candidate.username});
      else withinPageOwners.set(candidate.usernameReservationId, candidate.id);
    }
    process.stdout.write(`${JSON.stringify({
      mode: "preview",
      projectId,
      complete: state?.complete === true,
      cursor: state?.lastUserId,
      pageSize,
      candidates: candidates.length,
      invalidUserIds: candidates.filter((candidate) => candidate.invalid).map((candidate) => candidate.id),
      collisions,
      nextUserId: users.docs.at(-1)?.id,
    }, null, 2)}\n`);
  })().catch((error) => fail(error instanceof Error ? error.stack || error.message : String(error)));
}
