import assert from "node:assert/strict";
import test from "node:test";
import {mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync, symlinkSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import path from "node:path";
import {uploadRedditPlaytest} from "./upload-reddit-playtest.mjs";
import {resolveRedditPlaytestArgs} from "./resolve-reddit-playtest.mjs";

const fixture = (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "rq-reddit-playtest-"));
  context.after(() => rmSync(directory, {recursive: true, force: true}));
  return directory;
};

const outcome = (directory, prefix, version) => JSON.parse(readFileSync(path.join(directory, `${prefix}-${version}.json`), "utf8"));

test("playtest uploads reject missing, stable, malformed, and extra version arguments before running commands", () => {
  for (const args of [[], ["0.0.2"], ["latest"], ["0.0.1.0"], ["0.0.1.01"], ["0.0.1.21", "--public"], ["0.0.1.9007199254740992"]]) {
    assert.throws(() => uploadRedditPlaytest(args, () => assert.fail("must not invoke Devvit")), /explicit prerelease version/u);
  }
});

test("a private upload retains uncertainty and blocks later versions before running commands", (context) => {
  const directory = fixture(context);
  const calls = [];
  const run = (command, args) => {
    calls.push([command, args]);
    return {status: calls.length === 1 ? 0 : 2};
  };
  assert.throws(() => uploadRedditPlaytest(["0.0.1.21"], run, directory), /inspect.*before retrying/u);
  assert.deepEqual(calls, [
    ["pnpm", ["build:package"]],
    ["pnpm", ["exec", "devvit", "upload", "--version", "0.0.1.21"]],
  ]);
  assert.equal(outcome(directory, "playtest-outcome", "0.0.1.21").status, "ambiguous");
  for (const version of ["0.0.1.21", "0.0.1.22"]) {
    assert.throws(() => uploadRedditPlaytest([version], () => assert.fail("must not build or transmit"), directory), /Unresolved.*0\.0\.1\.21/u);
  }
  assert.ok(!readdirSync(directory).includes("playtest.lock"));
});

test("a failed package check leaves no attempted upload and can be corrected", (context) => {
  const directory = fixture(context);
  let count = 0;
  assert.throws(() => uploadRedditPlaytest(["0.0.1.22"], () => {
    count += 1;
    return {status: 1};
  }, directory), /package validation failed/u);
  assert.equal(count, 1);
  assert.deepEqual(readdirSync(directory), []);
  uploadRedditPlaytest(["0.0.1.22"], () => ({status: 0}), directory);
  assert.equal(outcome(directory, "playtest-outcome", "0.0.1.22").status, "accepted");
});

test("accepted versions are immutable and explicit resolution preserves original failure evidence", (context) => {
  const directory = fixture(context);
  const run = (_command, args) => ({status: args[0] === "build:package" ? 0 : 1});
  assert.throws(() => uploadRedditPlaytest(["0.0.1.24"], run, directory), /inspect/u);
  const before = readFileSync(path.join(directory, "playtest-outcome-0.0.1.24.json"), "utf8");
  for (const args of [[], ["0.0.1.24", "confirmed-absent"], ["0.0.1.24", "retry", "--confirm-version", "0.0.1.24"],
    ["0.0.1.24", "accepted", "--confirm-version", "0.0.1.25"]]) {
    assert.throws(() => resolveRedditPlaytestArgs(args, directory), /Usage|matching --confirm-version/u);
  }
  resolveRedditPlaytestArgs(["0.0.1.24", "confirmed-absent", "--confirm-version", "0.0.1.24"], directory);
  assert.equal(readFileSync(path.join(directory, "playtest-outcome-0.0.1.24.json"), "utf8"), before);
  assert.throws(() => resolveRedditPlaytestArgs(["0.0.1.24", "accepted", "--confirm-version", "0.0.1.24"], directory), /unresolved/u);
  assert.throws(() => uploadRedditPlaytest(["0.0.1.24"], () => assert.fail("used version"), directory), /already attempted/u);
  uploadRedditPlaytest(["0.0.1.25"], () => ({status: 0}), directory);
  assert.throws(() => uploadRedditPlaytest(["0.0.1.25"], () => assert.fail("used version"), directory), /already attempted/u);
  assert.throws(() => resolveRedditPlaytestArgs(["0.0.1.25", "confirmed-absent", "--confirm-version", "0.0.1.25"], directory), /unresolved/u);
});

test("separate processes cannot validate or transmit while another playtest owns the lock", (context) => {
  const directory = fixture(context);
  const uploader = new URL("./upload-reddit-playtest.mjs", import.meta.url).href;
  uploadRedditPlaytest(["0.0.1.30"], (_command, args) => {
    if (args[0] === "build:package") {
      const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
        import {uploadRedditPlaytest} from ${JSON.stringify(uploader)};
        try { uploadRedditPlaytest(['0.0.1.31'],()=>{process.exit(8)},${JSON.stringify(directory)}); process.exit(9); }
        catch(error) { if(!error.message.includes('locked'))process.exit(10); }
      `], {encoding: "utf8"});
      assert.equal(child.status, 0, child.stderr);
    }
    return {status: 0};
  }, directory);
  assert.deepEqual(readdirSync(directory).sort(), ["playtest-attempt-0.0.1.30.json", "playtest-outcome-0.0.1.30.json"]);
});

test("process interruption preserves the lock and orphan attempt until explicit recovery", (context) => {
  const directory = fixture(context);
  const uploader = new URL("./upload-reddit-playtest.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import {uploadRedditPlaytest} from ${JSON.stringify(uploader)};
    uploadRedditPlaytest(['0.0.1.40'],(_command,args)=>{if(args[0]==='exec')process.exit(19);return {status:0}},${JSON.stringify(directory)});
  `], {encoding: "utf8"});
  assert.equal(child.status, 19, child.stderr);
  const attempt = readFileSync(path.join(directory, "playtest-attempt-0.0.1.40.json"), "utf8");
  assert.equal(outcome(directory, "playtest-attempt", "0.0.1.40").intent, "private-bootstrap");
  assert.throws(() => uploadRedditPlaytest(["0.0.1.41"], () => assert.fail("locked"), directory), /locked/u);
  // The child is authoritatively terminal; simulate the operator's stale-lock removal.
  unlinkSync(path.join(directory, "playtest.lock"));
  assert.throws(() => uploadRedditPlaytest(["0.0.1.41"], () => assert.fail("unresolved"), directory), /Unresolved/u);
  resolveRedditPlaytestArgs(["0.0.1.40", "accepted", "--confirm-version", "0.0.1.40"], directory);
  assert.equal(readFileSync(path.join(directory, "playtest-attempt-0.0.1.40.json"), "utf8"), attempt);
  uploadRedditPlaytest(["0.0.1.41"], () => ({status: 0}), directory);
});

test("corrupt and orphaned journal evidence fails closed before validation", (context) => {
  const directory = fixture(context);
  const file = path.join(directory, "playtest-outcome-0.0.1.50.json");
  const record = {schemaVersion: 1, provider: "reddit", intent: "private-bootstrap", version: "0.0.1.50",
    finishedAt: new Date().toISOString(), status: "accepted"};
  for (const content of ["broken json", JSON.stringify({...record, bypass: true}), JSON.stringify(record)]) {
    writeFileSync(file, content);
    assert.throws(() => uploadRedditPlaytest(["0.0.1.51"], () => assert.fail("invalid evidence"), directory));
  }
  unlinkSync(file);
  symlinkSync(path.join(directory, "missing.json"), file);
  assert.throws(() => uploadRedditPlaytest(["0.0.1.51"], () => assert.fail("symlink"), directory), /journal entry/u);
});
