import {DEFAULT_RACE_MATCH_POLICY} from "../../race/matchmaking/raceMatchPolicy";
import {emptyRaceMatchProfile} from "../../race/matchmaking/raceMatchPerformance";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

/** Child commands exercise the actual compiled operator tool, not mocked argument parsing. */
const execute = promisify(execFile);
/** Demo database only; no production credentials or endpoints are used. */
const projectId = "demo-riddle-quest-multiplayer";
/** Valid synthetic receipt includes private fields that must never appear in report output. */
const row = {provider: "reddit", locale: "en", categoryId: "history", createdAtMs: 100, expiresAtMs: 500,
  userId: "private-player", riddles: [{answer: "private-answer"}]};
/** Canonical receipt storage for bounded source-query tests. */
let db: FirebaseFirestore.Firestore;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error("calibration-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId});
  db = getFirestore();
});
beforeEach(async () => {await db.recursiveDelete(db.collection("raceMatchOffers"));});

it("reads a bounded oldest page, flags truncation, suppresses source payloads and performs no writes", async () => {
  for (let index = 0; index < 3; index++) await db.doc(`raceMatchOffers/receipt-${index}`).set({...row, createdAtMs: 100 + index});
  await db.doc("raceMatchOffers/corrupt").set({...row, createdAtMs: 103, questionOverlap: 2});
  /** Source remains unchanged by reporting. */
  const before = (await db.collection("raceMatchOffers").get()).docs.map(document => document.data());
  /** One sentinel beyond the two-record limit detects truncation without a full collection count. */
  const capped = await execute(process.execPath, [resolve("scripts/races/race-match-calibration.js"), "--project", projectId,
    "--from-ms", "0", "--to-ms", "1000", "--limit", "2"]);
  expect(JSON.parse(capped.stdout)).toMatchObject({source: {recordsRead: 3, capped: true, invalidRecords: 0}, cohorts: [{offers: 2}]});
  /** Full small window exposes invalid source rows separately from valid outcome denominators. */
  const complete = await execute(process.execPath, [resolve("scripts/races/race-match-calibration.js"), "--project", projectId,
    "--from-ms", "0", "--to-ms", "1000", "--limit", "5"]);
  expect(JSON.parse(complete.stdout)).toMatchObject({source: {recordsRead: 4, capped: false, invalidRecords: 1}, cohorts: [{offers: 3}]});
  expect(complete.stdout).not.toMatch(/private-player|private-answer/);
  expect((await db.collection("raceMatchOffers").get()).docs.map(document => document.data())).toEqual(before);
});
it("runs strict offline outcome inputs and suppresses validation payloads on failure", async () => {
  /** Temporary operator input is removed even after child-command failure. */
  const directory = await mkdtemp(join(tmpdir(), "race-calibration-"));
  /** Offline envelope carries only explicitly allowlisted measurements. */
  const path = join(directory, "input.json");
  try {
    await writeFile(path, JSON.stringify({schemaVersion: 1, asOfMs: 1000, measurements: [{provider: "reddit", locale: "en", categoryId: "history", createdAtMs: 100, expiresAtMs: 500}]}));
    /** Compiled report runs without initializing a production database. */
    const valid = await execute(process.execPath, [resolve("scripts/races/race-match-calibration.js"), "--input", path]);
    expect(JSON.parse(valid.stdout)).toMatchObject({cohorts: [{offers: 1, maturedOffers: 1, accepted: 0}]});
    await writeFile(path, JSON.stringify({schemaVersion: 1, asOfMs: 1000, measurements: [row]}));
    await expect(execute(process.execPath, [resolve("scripts/races/race-match-calibration.js"), "--input", path])).rejects.toMatchObject({
      stderr: "Calibration failed: check validated inputs, compiled backend and read access.\n", stdout: "",
    });
  } finally {await rm(directory, {recursive: true, force: true});}
});

it("compares observed experiment arms across categories through the compiled report", async () => {
  /** Input and output remain local and contain no player, allocation salt or answers. */
  const directory = await mkdtemp(join(tmpdir(), "race-experiment-report-"));
  try {
    /** Identical allocation identity pools categories while preserving independent arms. */
    const assignment = {id: "freshness", revision: 1, allocationHash: "a".repeat(64)};
    /** All offers have matured at the report clock; terminal measurements are explicit. */
    const base = {provider: "reddit", locale: "en", categoryId: "history", createdAtMs: 100, expiresAtMs: 500,
      matchPolicyHash: DEFAULT_RACE_MATCH_POLICY.hash, matchPolicyRevision: DEFAULT_RACE_MATCH_POLICY.policy.revision};
    /** One accepted control offer and one unaccepted control offer give a one-half acceptance rate. */
    const measurements = [
      {...base, matchExperiment: {...assignment, arm: "control"}, acceptedAtMs: 200, startsAtMs: 250,
        terminalAtMs: 300, terminalStatus: "completed", correctCount: 10, finishedTen: true, actualPerformanceMs: 1000},
      {...base, categoryId: "science", matchExperiment: {...assignment, arm: "control"}},
      {...base, matchExperiment: {...assignment, arm: "variant"}, acceptedAtMs: 200, startsAtMs: 250,
        terminalAtMs: 300, terminalStatus: "abandoned", correctCount: 2, finishedTen: false},
    ];
    /** The actual command consumes the compiled backend rather than a source-only helper. */
    const path = join(directory, "input.json");
    await writeFile(path, JSON.stringify({schemaVersion: 1, asOfMs: 1000, measurements}));
    /** Parsed command output must retain pooled arm denominators without source payloads. */
    const result = await execute(process.execPath, [resolve("scripts/races/race-match-calibration.js"), "--input", path]);
    expect(JSON.parse(result.stdout)).toMatchObject({experimentComparisons: [{
      id: "freshness", revision: 1, assignmentUnit: "authenticated-player", observationUnit: "offer", observedArmsOnly: true,
      arms: [{arm: "control", offers: 2, maturedOffers: 2, accepted: 1, acceptanceRate: 0.5, completionRateAmongTerminal: 1},
        {arm: "variant", offers: 1, accepted: 1, acceptanceRate: 1, completionRateAmongTerminal: 0}],
    }]});
    expect((await db.collection("raceMatchOffers").get()).empty).toBe(true);
    expect(result.stdout).not.toMatch(/private-player|private-answer|"salt"|"userId"/);
  } finally {await rm(directory, {recursive: true, force: true});}
});

it("executes offline policy comparison without reporting unplayed outcome claims", async () => {
  /** Comparison remains local and creates no database configuration. */
  const directory = await mkdtemp(join(tmpdir(), "race-policy-compare-"));
  try {
    /** Strict input is answer-free and explicitly attests its eligible sampled pool. */
    const path = join(directory, "input.json");
    await writeFile(path, JSON.stringify({schemaVersion: 1, baselinePolicy: DEFAULT_RACE_MATCH_POLICY.policy, proposedPolicy: DEFAULT_RACE_MATCH_POLICY.policy,
      samples: [{viewer: "opaque-viewer", requestId: "sample", locale: "en", nowMs: 1000, canonicalEligibilityValidated: true, profile: emptyRaceMatchProfile(),
        candidates: [{id: "recording", creatorId: "opaque-rival", categoryId: "history", performanceMs: 120000, canonicalRiddleIds: ["opaque-riddle"]}]}]}));
    /** Output exposes aggregate policy attribution only. */
    const result = await execute(process.execPath, [resolve("scripts/races/race-match-calibration.js"), "--input", path, "--mode", "compare"]);
    expect(JSON.parse(result.stdout)).toMatchObject({mode: "sampled-pool-counterfactual", samples: 1, changedSelections: 0,
      policies: [{selected: 1}, {selected: 1}]});
    expect(result.stdout).not.toMatch(/opaque-viewer|opaque-rival|opaque-riddle/);
  } finally {await rm(directory, {recursive: true, force: true});}
});
