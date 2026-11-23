"use strict";

const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");
const {mkdtemp, mkdir, readFile, rm, stat, writeFile} = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {SUPPORTED_LOCALES, sha256, stableJson} = require("./content/lib/youtube-content-pack.js");
const {resumePreparedCommit} = require("./content/youtube-content-author.js");

const functionsRoot = path.resolve(__dirname, "..");
const authorScript = path.join(functionsRoot, "scripts/content/youtube-content-author.js");

test("recovers an interrupted multi-file publication from exact staged hashes without a key or model call", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "riddle-quest-youtube-author-"));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const sourcePath = path.join(directory, "youtube-source.json");
  const orderPath = path.join(directory, "youtube-order.json");
  const translationsDirectory = path.join(directory, "translations");
  const authoringDirectory = path.join(directory, "authoring");
  const preparedDirectory = path.join(authoringDirectory, "youtube-content-author.prepared");
  const journalPath = path.join(authoringDirectory, "youtube-content-author.commit.json");
  const checkpointPath = path.join(authoringDirectory, "youtube-content-author.checkpoint.json");
  await mkdir(preparedDirectory, {recursive: true});
  await mkdir(translationsDirectory, {recursive: true});

  const targets = Object.fromEntries([
    ...SUPPORTED_LOCALES.filter((locale) => locale !== "en").map((locale) => [
      `translation:${locale}`,
      path.join(translationsDirectory, `youtube-${locale}-automated-translation-v1.json`),
    ]),
    ["order", orderPath],
    ["source", sourcePath],
  ]);
  const entries = [];
  for (const [index, [key, target]] of Object.entries(targets).entries()) {
    const raw = stableJson({key, target: path.basename(target), revision: 42});
    const stagedFile = `${String(index).padStart(2, "0")}-${key.replace(":", "-")}.json`;
    await writeFile(path.join(preparedDirectory, stagedFile), raw);
    entries.push({key, stagedFile, sha256: sha256(raw)});
    if (index < 3) {
      await mkdir(path.dirname(target), {recursive: true});
      await writeFile(target, raw);
    }
  }
  await writeFile(checkpointPath, "{\"partial\":true}\n");
  await writeFile(journalPath, stableJson({
    schemaVersion: 1,
    targetConfigurationSha256: sha256(stableJson(targets)),
    entries,
  }));

  const {OPENAI_API_KEY: _removedKey, ...environment} = process.env;
  const run = spawnSync(process.execPath, [
    authorScript,
    "--source", sourcePath,
    "--order", orderPath,
    "--translations-dir", translationsDirectory,
    "--checkpoint-dir", authoringDirectory,
  ], {cwd: functionsRoot, env: environment, encoding: "utf8"});
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Recovered and completed the prepared YouTube content commit/u);
  for (const entry of entries) {
    assert.equal(sha256(await readFile(targets[entry.key], "utf8")), entry.sha256);
  }
  await assert.rejects(stat(journalPath), {code: "ENOENT"});
  await assert.rejects(stat(preparedDirectory), {code: "ENOENT"});
  await assert.rejects(stat(checkpointPath), {code: "ENOENT"});
});

test("replays cleanup after a crash and deletes the recovery journal last", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "riddle-quest-youtube-cleanup-"));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const preparedPath = path.join(directory, "prepared");
  const journalPath = path.join(directory, "commit.json");
  const checkpointFile = path.join(directory, "checkpoint.json");
  const targets = {
    "translation:es": path.join(directory, "youtube-es.json"),
    order: path.join(directory, "order.json"),
    source: path.join(directory, "source.json"),
  };
  await mkdir(preparedPath, {recursive: true});
  const entries = [];
  for (const [index, [key, target]] of Object.entries(targets).entries()) {
    const raw = stableJson({key, revision: 7});
    const stagedFile = `${index}-${key.replace(":", "-")}.json`;
    await writeFile(path.join(preparedPath, stagedFile), raw);
    entries.push({key, stagedFile, sha256: sha256(raw)});
    assert.equal(await stat(target).catch((error) => error.code), "ENOENT");
  }
  await writeFile(checkpointFile, "{\"partial\":true}\n");
  await writeFile(journalPath, stableJson({
    schemaVersion: 1,
    targetConfigurationSha256: sha256(stableJson(targets)),
    entries,
  }));

  await assert.rejects(resumePreparedCommit({
    targets,
    journalPath,
    preparedPath,
    checkpointFile,
    afterPreparedCleanup: async () => {
      throw new Error("simulated-cleanup-crash");
    },
  }), /simulated-cleanup-crash/u);
  await stat(journalPath);
  await stat(checkpointFile);
  await assert.rejects(stat(preparedPath), {code: "ENOENT"});
  for (const entry of entries) {
    assert.equal(sha256(await readFile(targets[entry.key], "utf8")), entry.sha256);
  }

  assert.equal(await resumePreparedCommit({targets, journalPath, preparedPath, checkpointFile}), true);
  await assert.rejects(stat(journalPath), {code: "ENOENT"});
  await assert.rejects(stat(checkpointFile), {code: "ENOENT"});
  await assert.rejects(stat(preparedPath), {code: "ENOENT"});
});
