#!/usr/bin/env node
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {migrateRaceArchitecturePage} = require("../lib/firebase-functions/src/race/raceArchitectureMigration");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

async function main() {
  const projectId = option("--project");
  const collection = option("--collection");
  const apply = args.includes("--apply");
  if (!projectId || !["challenges", "runs"].includes(collection)) {
    throw new Error("Required: --project PROJECT --collection challenges|runs. Dry-run is the default.");
  }
  if (apply && option("--confirm-project") !== projectId) {
    throw new Error("Applying requires --confirm-project matching --project.");
  }
  initializeApp({projectId});
  const report = await migrateRaceArchitecturePage(getFirestore(), {
    collection, afterId: option("--after"), limit: Number(option("--limit") ?? 100), dryRun: !apply,
  });
  process.stdout.write(`${JSON.stringify({projectId, collection, dryRun: !apply, ...report}, null, 2)}\n`);
}

main().catch((error) => {process.stderr.write(`${error.message}\n`); process.exitCode = 1;});
