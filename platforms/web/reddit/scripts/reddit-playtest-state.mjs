import {closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync} from "node:fs";
import path from "node:path";
import {assertRedditBuildStateMigrated} from "./reddit-release-artifact.mjs";

const PREFIXES = ["playtest-attempt-", "playtest-outcome-", "playtest-resolution-"];
const TERMINAL = new Set(["accepted", "confirmed-absent"]);

/** Validates an explicit private prerelease without allowing path syntax or automatic bumps. */
export function validateRedditPlaytestVersion(version) {
  if (typeof version !== "string" || version.length > 80 ||
    !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.[1-9]\d*$/u.test(version) ||
    !version.split(".").every((part) => Number.isSafeInteger(Number(part)))) {
    throw new Error("Supply one explicit prerelease version: pnpm --filter @riddle-quest/reddit-app playtest:upload <major.minor.patch.prerelease>");
  }
  return version;
}

const recordPath = (directory, prefix, version) => path.join(directory, `${prefix}${version}.json`);
const timestamp = () => new Date().toISOString();

/** Creates immutable private evidence before transmission or after a confirmed result. */
function writeRecord(file, record) {
  const handle = openSync(file, "wx", 0o400);
  try {
    writeFileSync(handle, `${JSON.stringify(record, null, 2)}\n`);
    fsyncSync(handle);
  } finally { closeSync(handle); }
}

/** Rejects corrupt, orphaned or non-regular journal records without discarding them. */
function readRecords(directory) {
  const records = new Map();
  for (const name of readdirSync(directory).sort()) {
    const prefix = PREFIXES.find((value) => name.startsWith(value));
    if (!prefix) continue;
    const version = name.slice(prefix.length, -5);
    const file = path.join(directory, name);
    const metadata = lstatSync(file);
    if (!name.endsWith(".json") || !metadata.isFile() || metadata.nlink !== 1) {
      throw new Error("Invalid Reddit playtest journal entry; inspect retained evidence");
    }
    validateRedditPlaytestVersion(version);
    const record = JSON.parse(readFileSync(file, "utf8"));
    const field = prefix === PREFIXES[0] ? "startedAt" : "finishedAt";
    const expectedKeys = prefix === PREFIXES[0]
      ? ["schemaVersion", "provider", "intent", "version", field]
      : ["schemaVersion", "provider", "intent", "version", field, "status"];
    if (!record || Object.keys(record).length !== expectedKeys.length ||
      expectedKeys.some((key) => !Object.hasOwn(record, key)) ||
      record.schemaVersion !== 1 || record.provider !== "reddit" ||
      record.intent !== "private-bootstrap" || record.version !== version ||
      typeof record[field] !== "string" || !Number.isFinite(Date.parse(record[field])) ||
      new Date(record[field]).toISOString() !== record[field] ||
      (prefix === PREFIXES[1] && !new Set(["accepted", "ambiguous"]).has(record.status)) ||
      (prefix === PREFIXES[2] && !TERMINAL.has(record.status))) {
      throw new Error("Invalid Reddit playtest journal record; inspect retained evidence");
    }
    const row = records.get(version) ?? {};
    row[prefix] = record;
    records.set(version, row);
  }
  for (const row of records.values()) {
    if (!row[PREFIXES[0]] || (row[PREFIXES[1]]?.status === "accepted" && row[PREFIXES[2]])) {
      throw new Error("Orphaned or conflicting Reddit playtest evidence; inspect retained records");
    }
  }
  return records;
}

/** Serializes journal inspection, validation and the entire provider transmission. */
function withPlaytestLock(directory, operation) {
  assertRedditBuildStateMigrated(directory);
  mkdirSync(directory, {recursive: true, mode: 0o700});
  if (!lstatSync(directory).isDirectory()) throw new Error("Invalid Reddit playtest receipt directory");
  const lockPath = path.join(directory, "playtest.lock");
  let handle;
  try { handle = openSync(lockPath, "wx", 0o600); } catch (error) {
    if (error.code === "EEXIST") throw new Error("Reddit playtest operation locked; inspect the recorded process before recovery");
    throw error;
  }
  try {
    writeFileSync(handle, `${JSON.stringify({pid: process.pid, startedAt: timestamp()})}\n`);
    fsyncSync(handle);
    return operation();
  } finally {
    closeSync(handle);
    unlinkSync(lockPath);
  }
}

/** Keeps uncertain attempts across invocations and prevents a new version from bypassing them. */
export function runRedditPlaytestAttempt({directory, version, validate, transmit}) {
  validateRedditPlaytestVersion(version);
  return withPlaytestLock(directory, () => {
    const records = readRecords(directory);
    for (const [attemptVersion, row] of records) {
      const status = row[PREFIXES[2]]?.status ?? row[PREFIXES[1]]?.status;
      if (!TERMINAL.has(status)) {
        throw new Error(`Unresolved Reddit playtest ${attemptVersion}; inspect that exact version and record its outcome before another upload`);
      }
    }
    if (records.has(version)) throw new Error(`Reddit playtest ${version} already attempted; select an unused version`);
    validate();
    const base = {schemaVersion: 1, provider: "reddit", intent: "private-bootstrap", version};
    writeRecord(recordPath(directory, PREFIXES[0], version), {...base, startedAt: timestamp()});
    try { transmit(); } catch (error) {
      writeRecord(recordPath(directory, PREFIXES[1], version), {...base, finishedAt: timestamp(), status: "ambiguous"});
      throw error;
    }
    writeRecord(recordPath(directory, PREFIXES[1], version), {...base, finishedAt: timestamp(), status: "accepted"});
  });
}

/** Records an operator-inspected remote result, preserving the original uncertain attempt. */
export function resolveRedditPlaytest({directory, version, status, confirmVersion}) {
  validateRedditPlaytestVersion(version);
  if (!TERMINAL.has(status) || confirmVersion !== version) {
    throw new Error("Resolution requires accepted or confirmed-absent and matching --confirm-version after inspecting the exact provider version");
  }
  return withPlaytestLock(directory, () => {
    const row = readRecords(directory).get(version);
    if (!row || row[PREFIXES[2]] || row[PREFIXES[1]]?.status === "accepted") {
      throw new Error("Reddit playtest resolution requires one unresolved retained attempt");
    }
    const record = {schemaVersion: 1, provider: "reddit", intent: "private-bootstrap", version,
      finishedAt: timestamp(), status};
    writeRecord(recordPath(directory, PREFIXES[2], version), record);
    return record;
  });
}
