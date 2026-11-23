#!/usr/bin/env node
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {RACE_SUPPORTED_LOCALES} = require("../../lib/src/races/contracts/index");
const {createRaceContentDryRun} = require("../../lib/firebase-functions/src/race/content/raceContentMigration.js");

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) {
  process.stderr.write("Set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT before running the dry-run report.\n");
  process.exitCode = 1;
} else {
  const app = initializeApp({projectId});
  const db = getFirestore(app);

  Promise.all(
    RACE_SUPPORTED_LOCALES.map(async (locale) => {
      const snapshot = await db.collection(`localizedRiddles/${locale}/riddles`).get();
      return snapshot.docs.map((document) => ({
        locale,
        documentPath: document.ref.path,
        data: document.data(),
      }));
    }),
  )
    .then((recordsByLocale) => createRaceContentDryRun(recordsByLocale.flat()))
    .then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
}
