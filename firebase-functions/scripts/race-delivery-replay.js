#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Operator scripts load the compiled CommonJS Functions backend. */
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {replayRaceDelivery} = require("../lib/race/raceDeliveryRecovery");

const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

async function main() {
  const projectId = option("--project");
  const collection = option("--collection");
  const eventId = option("--event");
  const apply = args.includes("--apply");
  if (!projectId || !["raceSettlementOutbox", "racePerformanceOutbox"].includes(collection) || !eventId) {
    throw new Error("Required: --project PROJECT --collection raceSettlementOutbox|racePerformanceOutbox --event EVENT. Dry-run is the default.");
  }
  if (apply && option("--confirm-project") !== projectId) throw new Error("Applying requires --confirm-project matching --project.");
  initializeApp({projectId});
  const delivered = await replayRaceDelivery(getFirestore(), collection, eventId, Date.now(), {dryRun: !apply});
  process.stdout.write(`${JSON.stringify({projectId, collection, eventId, dryRun: !apply, validated: true, delivered})}\n`);
}

main().catch(error => {
  // Source/receipt validators return answer-free messages. Do not print storage payloads or stack traces.
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
