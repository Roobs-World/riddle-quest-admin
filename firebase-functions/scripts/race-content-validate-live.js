#!/usr/bin/env node
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {RACE_CATEGORY_IDS} = require("../lib/src/races/contracts");
const {validateRacePool} = require("../lib/firebase-functions/src/race/raceContentValidation.js");

const args = process.argv.slice(2);
const projectIndex = args.indexOf("--project");
const projectId =
  (projectIndex >= 0 ? args[projectIndex + 1] : undefined) ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT;

if (!projectId) {
  process.stderr.write("Provide --project or set GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT.\n");
  process.exitCode = 1;
} else {
  const app = initializeApp({projectId});
  const db = getFirestore(app);
  db.collection("localizedRiddles/en/riddles")
    .where("raceEligible", "==", true)
    .get()
    .then((snapshot) => {
      const records = snapshot.docs.map((document) => ({
        locale: "en",
        documentPath: document.ref.path,
        data: document.data(),
      }));
      const categories = RACE_CATEGORY_IDS.map((categoryId) => validateRacePool(records, {locale: "en", categoryId}));
      const valid = categories.every((category) => category.valid);
      process.stdout.write(`${JSON.stringify({valid, projectId, locale: "en", categories}, null, 2)}\n`);
      if (!valid) process.exitCode = 1;
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
}
