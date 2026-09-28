#!/usr/bin/env node
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {mkdir, readFile, writeFile} = require("node:fs/promises");
const path = require("node:path");
const {
  assertRaceTranslationAtomicWriteCount,
  assertRaceTranslationImportSnapshotStable,
  createRaceTranslationImportPlan,
} = require("../lib/race/raceTranslationImport.js");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const has = (name) => args.includes(name);
const inputPath = option("--input");
const sourcePath = option("--source") || "content/race-en-reviewed-v2.json";
const projectId = option("--project") || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const apply = has("--apply");
const replaceExisting = has("--replace-existing");
const confirmedProject = option("--confirm-project");

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

const snapshotVersion = (snapshot) => ({
  path: snapshot.ref.path,
  version: snapshot.exists
    ? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`
    : null,
});

if (!inputPath) fail("Provide --input <race-LOCALE-automated-translation-v1.json>.");
else if (!projectId) fail("Provide --project or set GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT.");
else if (apply && confirmedProject !== projectId) fail(`Applying requires --confirm-project ${projectId}.`);
else {
  void (async () => {
    const resolvedInputPath = path.resolve(inputPath);
    const [input, source] = await Promise.all([
      readFile(resolvedInputPath, "utf8").then(JSON.parse),
      readFile(path.resolve(sourcePath), "utf8").then(JSON.parse),
    ]);
    const plan = createRaceTranslationImportPlan(input, source, resolvedInputPath);
    if (!plan.valid) {
      process.stdout.write(`${JSON.stringify({valid: false, locale: plan.locale, issues: plan.issues}, null, 2)}\n`);
      throw new Error("Translation validation failed; no writes were attempted.");
    }

    const app = initializeApp({projectId});
    const db = getFirestore(app);
    const collectionPath = `localizedRiddles/${plan.locale}/riddles`;
    const currentSnapshot = await db.collection(collectionPath).where("raceEligible", "==", true).get();
    const targetPaths = new Set(plan.records.map(({documentPath}) => documentPath));
    const existingEligible = currentSnapshot.docs.map((document) => ({path: document.ref.path, data: document.data()}));
    const retiring = existingEligible.filter(({path: existingPath}) => !targetPaths.has(existingPath));
    const targetSnapshots = await Promise.all(plan.records.map(({documentPath}) => db.doc(documentPath).get()));
    const collisions = targetSnapshots.flatMap((snapshot, index) =>
      snapshot.exists && snapshot.data()?.canonicalRiddleId !== plan.records[index].data.canonicalRiddleId
        ? [snapshot.ref.path] : []);
    if (collisions.length > 0) throw new Error(`Refusing deterministic path collisions: ${collisions.join(", ")}`);

    const writes = assertRaceTranslationAtomicWriteCount(plan.records.length, retiring.length);
    process.stdout.write(`${JSON.stringify({
      valid: true,
      projectId,
      locale: plan.locale,
      categoryCounts: plan.categoryCounts,
      targetWrites: plan.records.length,
      existingEligible: existingEligible.length,
      retiring: retiring.map(({path: retiringPath}) => retiringPath),
      atomicWrites: writes,
      mode: apply ? "apply" : "preview",
    }, null, 2)}\n`);
    if (!apply) return;
    if (retiring.length > 0 && !replaceExisting) {
      throw new Error("Existing eligible records must be retired; review preview and rerun with --replace-existing.");
    }

    const backupDirectory = path.resolve(option("--backup-dir") || "artifacts/race-content-backups");
    await mkdir(backupDirectory, {recursive: true});
    const backupPath = path.join(backupDirectory,
      `race-translation-${plan.locale}-${projectId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(backupPath, `${JSON.stringify({
      projectId,
      locale: plan.locale,
      createdAt: new Date().toISOString(),
      targeted: targetSnapshots.map((snapshot) => ({
        path: snapshot.ref.path,
        existed: snapshot.exists,
        data: snapshot.exists ? snapshot.data() : null,
      })),
      retired: retiring,
    }, null, 2)}\n`, {flag: "wx", mode: 0o600});

    const expectedTargets = targetSnapshots.map(snapshotVersion);
    const expectedEligible = currentSnapshot.docs.map(snapshotVersion);
    await db.runTransaction(async (transaction) => {
      const [transactionEligible, transactionTargets] = await Promise.all([
        transaction.get(db.collection(collectionPath).where("raceEligible", "==", true)),
        Promise.all(plan.records.map(({documentPath}) => transaction.get(db.doc(documentPath)))),
      ]);
      assertRaceTranslationImportSnapshotStable(expectedTargets, transactionTargets.map(snapshotVersion), "targets");
      assertRaceTranslationImportSnapshotStable(expectedEligible, transactionEligible.docs.map(snapshotVersion), "eligible");
      for (const record of plan.records) transaction.set(db.doc(record.documentPath), record.data, {merge: false});
      for (const record of retiring) transaction.set(db.doc(record.path), {raceEligible: false}, {merge: true});
    });
    process.stdout.write(`${JSON.stringify({applied: true, locale: plan.locale, backupPath, writes}, null, 2)}\n`);
  })().catch((error) => fail(error instanceof Error ? error.stack || error.message : String(error)));
}
