#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Emulator worker loads the compiled backend. */
"use strict";
const PROJECT = "demo-riddle-quest-match";
const LATENCY_TARGET_MS = {dense: 1500, sparse: 1500, exclusions: 5000, empty: 1500, capped: 10000, freshness: 3000};
const SCENARIOS = ["dense", "sparse", "exclusions", "empty", "capped", "freshness"];

/** Fixture writes are restricted to a dedicated demo database on a loopback emulator. */
function validateOptions(args, environment = process.env) {
  if (!/^(127\.0\.0\.1|localhost):[1-9][0-9]{1,4}$/.test(environment.FIRESTORE_EMULATOR_HOST ?? "") || environment.GCLOUD_PROJECT !== PROJECT)
    throw Error("Benchmark requires the loopback Firestore emulator and dedicated demo project.");
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!["--iterations", "--scenario"].includes(args[index]) || values[args[index]] !== undefined || !args[index + 1]) throw Error("Invalid benchmark option.");
    values[args[index]] = args[index + 1];
  }
  const iterations = Number(values["--iterations"] ?? 5);
  const scenario = values["--scenario"] ?? "all";
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 20 || ![...SCENARIOS, "all"].includes(scenario)) throw Error("Iterations must be 1..20 and scenario must be supported.");
  return {iterations, scenarios: scenario === "all" ? SCENARIOS : [scenario]};
}
/** Nearest-rank quantiles remain inspectable for small local samples. */
function distribution(values) {
  if (!values.length) return {count: 0, p50: null, p95: null, max: null};
  const sorted = [...values].sort((a, b) => a - b);
  return {count: values.length, p50: sorted[Math.ceil(sorted.length * 0.5) - 1], p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: sorted.at(-1)};
}
/** Successful work must select a seeded eligible recording and preserve its exact replay receipt. */
function validMatchedResult(response, records, scenario, previous) {
  if (!response || response.status !== "matched" || !/^[a-f0-9]{64}$/.test(response.offerId ?? "")) return false;
  const selected = records.find(record => record.challengeId === response.challenge?.challengeId);
  if (!selected || response.challenge.locale !== selected.locale || response.challenge.categoryId !== selected.categoryId) return false;
  if (["exclusions", "freshness"].includes(scenario) && selected.challengeId !== "healthy") return false;
  return previous === undefined || JSON.stringify(response) === JSON.stringify(previous);
}
/** Captured production telemetry accompanies actual elapsed lookup time, rather than mocked storage latency. */
async function main(args = process.argv.slice(2)) {
  const options = validateOptions(args);
  const {initializeApp} = require("firebase-admin/app");
  const {getFirestore, Timestamp} = require("firebase-admin/firestore");
  initializeApp({projectId: PROJECT});
  const db = getFirestore();
  const {findRecordedRaceMatch} = require("../../lib/firebase-functions/src/race/matchmaking/raceMatchmaking");
  const {projectRaceMatchCandidate} = require("../../lib/firebase-functions/src/race/matchmaking/raceMatchCandidates");
  const {parseChallengeRecord} = require("../../lib/firebase-functions/src/race/raceSetupService");
  const {raceDeckContentVersion} = require("../../lib/firebase-functions/src/race/runs/raceDeckSnapshot");
  const {emptyRaceMatchProfile, recordRaceExposure} = require("../../lib/firebase-functions/src/race/matchmaking/raceMatchPerformance");
  const {DEFAULT_RACE_MATCH_POLICY} = require("../../lib/firebase-functions/src/race/matchmaking/raceMatchPolicy");
  const logger = require("firebase-functions").logger;
  const player = `jest_${"a".repeat(40)}`;
  const rival = `jest_${"b".repeat(40)}`;
  const freshRival = `jest_${"c".repeat(40)}`;
  const nowMs = Date.now();
  const collections = ["raceChallenges", "raceMatchCandidates", "raceMatchOffers", "raceAttempts", "users", "jestAccountDeletionTombstones", "raceInviteLobbies"];
  const clear = async () => {await Promise.all(collections.map(name => db.recursiveDelete(db.collection(name)))); await db.doc("raceConfig/matchPolicy").delete();};
  const fixture = (id, creatorId = rival, duration = 120000) => {
    const riddles = Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `${id}-q-${position}`, text: "Benchmark clue", answer: "test", position}));
    return {challengeId: id, creatorId, creatorRunId: `run-${id}`, creatorSnapshot: {displayName: "Synthetic rival"},
      categoryId: "history", locale: "en", deckId: `deck-${id}`, canonicalRiddleIds: riddles.map(row => row.canonicalRiddleId), riddles,
      targetCorrect: 10, creatorWallFinishMs: duration, creatorHintPenaltyMs: 0, creatorSkipPenaltyMs: 0,
      creatorTotalPenaltyMs: 0, creatorAdjustedFinishMs: duration, ghostEvents: [], snapshotVersion: 1,
      rules: {version: "race10_v1", targetCorrect: 10, deckSize: 15, maxGuessesPerRiddle: 5, hintPenaltyMs: 15000, skipPenaltyMs: 45000, maxAdjustedTimeMs: 300000},
      scope: "public", contentVersion: raceDeckContentVersion(riddles), status: "active", createdAtMs: nowMs - 1000,
      expiresAtMs: nowMs + 3600000, expiresAt: Timestamp.fromMillis(nowMs + 3600000)};
  };
  let telemetry;
  let eventCount = 0;
  const originals = {info: logger.info, warn: logger.warn};
  logger.info = logger.warn = (message, data) => {if (["Race matchmaking lookup", "Race matchmaking failure"].includes(message)) {telemetry = data; eventCount++;}};
  const results = [];
  try {
    for (const scenario of options.scenarios) {
      await clear();
      const batch = db.batch();
      const count = scenario === "empty" ? 0 : scenario === "sparse" ? 1 : scenario === "exclusions" ? 100 : 220;
      const records = Array.from({length: count}, (_, index) => fixture(`recording-${index}`));
      if (["exclusions", "freshness"].includes(scenario)) records.push(fixture("healthy", freshRival, scenario === "freshness" ? 200000 : 120000));
      for (const record of records) {
        batch.set(db.doc(`raceChallenges/${record.challengeId}`), record);
        batch.set(db.doc(`raceMatchCandidates/${record.challengeId}`), projectRaceMatchCandidate(parseChallengeRecord(record)));
      }
      await batch.commit();
      if (["exclusions", "capped"].includes(scenario)) await db.doc(`users/${player}/blockedRivals/${rival}`).set({blocked: true});
      if (scenario === "freshness") await db.doc(`users/${player}/raceMatchProfiles/en`).set(recordRaceExposure(emptyRaceMatchProfile(), player, [], rival));
      const samples = [];
      for (let index = 0; index < options.iterations; index++) {
        const input = {locale: "en", categoryId: "history", requestId: `benchmark-${scenario}-${index}`};
        let originalResponse;
        for (const phase of ["new", "replay"]) {
          if (phase === "replay" && samples.at(-1)?.status !== "matched") break;
          telemetry = undefined;
          eventCount = 0;
          const started = performance.now();
          let status;
          let failureReason;
          let resultCorrect = true;
          try {
            const response = await findRecordedRaceMatch(player, input, {db, nowMs});
            status = response.status;
            if (status === "matched") resultCorrect = validMatchedResult(response, records, scenario, originalResponse);
            if (phase === "new") originalResponse = response;
          }
          catch (error) {status = "failure"; failureReason = error.details?.matchmaking?.reason ?? "unclassified";}
          if (!telemetry) throw Error("Lookup telemetry was not captured.");
          samples.push({phase, status, failureReason, resultCorrect, eventCount, elapsedMs: performance.now() - started, ...telemetry});
        }
      }
      for (const phase of ["new", "replay"]) {
        const rows = samples.filter(row => row.phase === phase);
        if (!rows.length) continue;
        const latency = distribution(rows.map(row => row.elapsedMs));
        const expected = scenario === "empty" ? "empty" : scenario === "capped" ? "failure" : "matched";
        const checks = {correctRecordingAndReplay: rows.every(row => row.resultCorrect), policyAttribution: rows.every(row => row.status !== "matched" || row.policyHash === DEFAULT_RACE_MATCH_POLICY.hash && row.policyRevision === DEFAULT_RACE_MATCH_POLICY.policy.revision), oneTerminalEvent: rows.every(row => row.eventCount === 1), expectedOutcome: rows.every(row => row.status === expected && (scenario !== "capped" || row.failureReason === "search-budget-exceeded")),
          canonicalReadBound: rows.every(row => row.documentReadAttempts <= 1000), candidateReadBound: rows.every(row => row.candidateDocumentsRead <= 200),
          transactionBound: rows.every(row => row.transactionAttempts <= 200), replayReadBound: phase !== "replay" || rows.every(row => row.documentReadAttempts <= 10),
          localLatencyTarget: latency.p95 <= LATENCY_TARGET_MS[scenario]};
        results.push({scenario, phase, fixtureRecordings: records.length, blockedRecordings: ["exclusions", "capped"].includes(scenario) ? count : 0, observations: rows.length, localP95LatencyTargetMs: LATENCY_TARGET_MS[scenario], checks,
          statuses: Object.fromEntries(["matched", "empty", "failure"].map(status => [status, rows.filter(row => row.status === status).length])),
          failures: Object.fromEntries([...new Set(rows.flatMap(row => row.failureReason ? [row.failureReason] : []))].map(reason => [reason, rows.filter(row => row.failureReason === reason).length])),
          elapsedMs: latency, candidateDocuments: distribution(rows.map(row => row.candidateDocumentsRead)),
          candidateQueries: distribution(rows.map(row => row.candidateQueries)), documentReadAttempts: distribution(rows.map(row => row.documentReadAttempts)),
          transactionAttempts: distribution(rows.map(row => row.transactionAttempts)),
          transactionDocumentReadBatches: distribution(rows.map(row => row.documentReadBatches)),
          transactionDocumentCacheHits: distribution(rows.map(row => row.documentReadCacheHits)),
          rejectionCounts: Object.fromEntries([...new Set(rows.flatMap(row => Object.keys(row.rejected ?? {})))].map(reason =>
            [reason, distribution(rows.map(row => row.rejected?.[reason] ?? 0))]))});
      }
    }
  } finally {logger.info = originals.info; logger.warn = originals.warn; await clear(); await db.terminate();}
  const report = {schemaVersion: 1, measurementVersion: 2, environment: "loopback-firestore-emulator", projectId: PROJECT, nodeVersion: process.version,
    passed: results.every(row => Object.values(row.checks).every(Boolean)), policyHash: DEFAULT_RACE_MATCH_POLICY.hash, policyRevision: DEFAULT_RACE_MATCH_POLICY.policy.revision, iterations: options.iterations,
    limitations: ["Synthetic warm process; no cloud cold starts, client transport or real network latency.", "Application read attempts and query counts are not billed index scans. Emulator results do not establish production SLO compliance."], results};
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
  return report;
}
module.exports = {validateOptions, distribution, validMatchedResult, main};
if (require.main === module) main().catch(() => {process.stderr.write("Benchmark failed: check demo emulator, options and compiled backend.\n"); process.exitCode = 1;});
