#!/usr/bin/env node
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {readFile, mkdir, writeFile} = require("node:fs/promises");
const path = require("node:path");
const {createRaceContentImportPlan} = require("../../lib/firebase-functions/src/race/content/raceContentImport.js");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const has = (name) => args.includes(name);
const inputPath = option("--input");
const projectId = option("--project") || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const apply = has("--apply");
const replaceExisting = has("--replace-existing");
const confirmedProject = option("--confirm-project");

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

if (!inputPath) fail("Provide --input <reviewed-content.json>.");
else if (!projectId) fail("Provide --project or set GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT.");
else if (apply && confirmedProject !== projectId) {
  fail(`Applying requires --confirm-project ${projectId}.`);
} else {
  void (async () => {
    const input = JSON.parse(await readFile(path.resolve(inputPath), "utf8"));
    const plan = createRaceContentImportPlan(input);
    if (!plan.valid) {
      process.stdout.write(
        `${JSON.stringify({valid: false, categoryCounts: plan.categoryCounts, issues: plan.issues}, null, 2)}\n`,
      );
      throw new Error("Content validation failed; no writes were attempted.");
    }

    const app = initializeApp({projectId});
    const db = getFirestore(app);
    const currentSnapshot = await db.collection("localizedRiddles/en/riddles").where("raceEligible", "==", true).get();
    const targetPaths = new Set(plan.records.map((record) => record.documentPath));
    const existingEligible = currentSnapshot.docs.map((document) => ({path: document.ref.path, data: document.data()}));
    const retiring = existingEligible.filter((record) => !targetPaths.has(record.path));
    const targetSnapshots = await Promise.all(plan.records.map((record) => db.doc(record.documentPath).get()));
    const collisions = targetSnapshots
      .filter(
        (snapshot, index) =>
          snapshot.exists && snapshot.data()?.canonicalRiddleId !== plan.records[index].data.canonicalRiddleId,
      )
      .map((snapshot) => snapshot.ref.path);
    if (collisions.length > 0)
      throw new Error(`Refusing to overwrite deterministic path collisions: ${collisions.join(", ")}`);

    const preview = {
      valid: true,
      projectId,
      locale: plan.locale,
      totalRiddles: plan.totalRiddles,
      categoryCounts: plan.categoryCounts,
      targetWrites: plan.records.length,
      existingEligible: existingEligible.length,
      retiring: retiring.map((record) => record.path),
      mode: apply ? "apply" : "preview",
    };
    process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
    if (!apply) return;
    if (retiring.length > 0 && !replaceExisting) {
      throw new Error(
        "Existing eligible records must be retired; review the preview and rerun with --replace-existing.",
      );
    }

    const backupDirectory = path.resolve(option("--backup-dir") || "artifacts/race-content-backups");
    await mkdir(backupDirectory, {recursive: true});
    const backupPath = path.join(
      backupDirectory,
      `race-content-${projectId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(
      backupPath,
      `${JSON.stringify(
        {
          projectId,
          createdAt: new Date().toISOString(),
          targeted: targetSnapshots.map((snapshot) => ({
            path: snapshot.ref.path,
            existed: snapshot.exists,
            data: snapshot.exists ? snapshot.data() : null,
          })),
          retired: retiring,
        },
        null,
        2,
      )}\n`,
      {flag: "wx"},
    );

    const writes = [
      ...plan.records.map((record) => ({path: record.documentPath, data: record.data})),
      ...retiring.map((record) => ({path: record.path, data: {raceEligible: false}})),
    ];
    for (let offset = 0; offset < writes.length; offset += 400) {
      const batch = db.batch();
      for (const write of writes.slice(offset, offset + 400)) batch.set(db.doc(write.path), write.data, {merge: true});
      await batch.commit();
    }
    process.stdout.write(`${JSON.stringify({applied: true, backupPath, writes: writes.length}, null, 2)}\n`);
  })().catch((error) => fail(error instanceof Error ? error.stack || error.message : String(error)));
}
