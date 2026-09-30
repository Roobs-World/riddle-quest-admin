#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Operator command uses compiled Functions contracts. */
"use strict";

/** Explicit bounded inputs prevent accidental unbounded or mixed-source reads. */
function parseOptions(args) {
  const allowed = new Set(["--input", "--project", "--from-ms", "--to-ms", "--limit", "--mode"]);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!allowed.has(args[index]) || values[args[index]] !== undefined || !args[index + 1] || args[index + 1].startsWith("--")) throw Error("Invalid or duplicate calibration option.");
    values[args[index]] = args[index + 1];
  }
  const mode = values["--mode"] ?? "outcomes";
  if (!["outcomes", "compare"].includes(mode)) throw Error("Mode must be outcomes or compare.");
  if (Boolean(values["--input"]) === Boolean(values["--project"])) throw Error("Specify exactly one of --input FILE or --project PROJECT.");
  if (values["--input"]) {
    if (["--from-ms", "--to-ms", "--limit"].some(key => values[key] !== undefined)) throw Error("Live query options cannot accompany offline input.");
    return {mode, input: values["--input"]};
  }
  const fromMs = Number(values["--from-ms"]);
  const toMs = Number(values["--to-ms"]);
  const limit = Number(values["--limit"] ?? 500);
  if (mode !== "outcomes" || !Number.isSafeInteger(fromMs) || fromMs < 0 || !Number.isSafeInteger(toMs) || toMs <= fromMs ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw Error("Live outcomes require --from-ms START --to-ms END and --limit 1..500.");
  return {mode, projectId: values["--project"], fromMs, toMs, limit};
}

/** Only aggregate output is printed; this command has no production mutation path. */
async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  const {summarizeRaceMatches, compareRacePolicies, raceMatchMeasurement} = require("../lib/race/raceMatchCalibration");
  let report;
  if (options.input) {
    const {readFile, stat} = require("node:fs/promises");
    if ((await stat(options.input)).size > 32 * 1024 * 1024) throw Error("Calibration input exceeds 32 MiB.");
    const input = JSON.parse(await readFile(options.input, "utf8"));
    if (options.mode === "compare") report = compareRacePolicies(input);
    else {
      if (!input || input.schemaVersion !== 1 || !Array.isArray(input.measurements) || input.measurements.length > 10000 ||
        Object.keys(input).some(key => !["schemaVersion", "asOfMs", "measurements"].includes(key))) throw Error("Invalid outcome input envelope.");
      report = summarizeRaceMatches(input.measurements, input.asOfMs);
    }
  } else {
    const {initializeApp} = require("firebase-admin/app");
    const {getFirestore} = require("firebase-admin/firestore");
    initializeApp({projectId: options.projectId});
    const page = await getFirestore().collection("raceMatchOffers").where("createdAtMs", ">=", options.fromMs)
      .where("createdAtMs", "<", options.toMs).orderBy("createdAtMs").limit(options.limit + 1).get();
    const measurements = [];
    let invalidRecords = 0;
    for (const document of page.docs.slice(0, options.limit)) {
      try {measurements.push(raceMatchMeasurement(document.data()));}
      catch {invalidRecords++;}
    }
    report = {source: {projectId: options.projectId, fromMs: options.fromMs, toMs: options.toMs, recordsRead: page.size,
      capped: page.size > options.limit, invalidRecords, limitations: ["Oldest bounded creation-time page; not a population estimate.",
        "Missing creation timestamps are not indexed; TTL removal and absent legacy metadata can bias this sample.",
        "Selection duration excludes the final transaction commit and response delivery; read attempts are not billed index scans."]},
    ...summarizeRaceMatches(measurements, Date.now())};
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report;
}

module.exports = {parseOptions, main};
if (require.main === module) main().catch(() => {
  // Validation messages may contain source values. Never emit payloads, identities or stack traces.
  process.stderr.write("Calibration failed: check validated inputs, compiled backend and read access.\n");
  process.exitCode = 1;
});
