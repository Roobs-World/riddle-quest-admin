#!/usr/bin/env node
"use strict";

const {access, readFile, rename, writeFile} = require("node:fs/promises");
const {createHash} = require("node:crypto");
const {constants} = require("node:fs");
const path = require("node:path");
const {authorRaceContent} = require("../../lib/firebase-functions/src/race/content/raceContentAuthoring.js");
const {RaceContentImportFileSchema} = require("../../lib/firebase-functions/src/race/content/raceContentImport.js");
const {RIDDLE_GENERATION_MODEL} = require("../../lib/firebase-functions/src/riddles/openaiService.js");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing value for ${name}.`);
  return args[index + 1];
};

void (async () => {
  const output = option("--output");
  if (!output) throw new Error("Provide --output <new-bank.json>; this command never imports content.");
  const outputPath = path.resolve(output);
  await access(path.dirname(outputPath), constants.W_OK);
  let outputExists = true;
  try {
    await access(outputPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    outputExists = false;
  }
  if (outputExists) throw new Error("Output already exists; choose a new bank path before authoring.");
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY securely before authoring.");
  const source = option("--source");
  const existing = source ? RaceContentImportFileSchema.parse(JSON.parse(await readFile(path.resolve(source), "utf8"))).riddles : [];
  const sourceHash = createHash("sha256").update(JSON.stringify(existing)).digest("hex");
  const checkpointPath = `${outputPath}.checkpoint.json`;
  let completed = [];
  try {
    const saved = JSON.parse(await readFile(checkpointPath, "utf8"));
    if (saved.version !== 1 || saved.model !== RIDDLE_GENERATION_MODEL || saved.sourceHash !== sourceHash || !Array.isArray(saved.riddles)) {
      throw new Error("Checkpoint contract changed; choose a new output path.");
    }
    completed = saved.riddles;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const bank = await authorRaceContent(existing, (completed, total) => {
    process.stdout.write(`Reviewed ${completed}/${total} multiplayer questions.\n`);
  }, {
    completed,
    async save(riddles) {
      const temporary = `${checkpointPath}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify({version: 1, model: RIDDLE_GENERATION_MODEL, sourceHash, riddles}), {mode: 0o600});
      await rename(temporary, checkpointPath);
    },
  });
  await writeFile(outputPath, `${JSON.stringify(bank, null, 2)}\n`, {flag: "wx", mode: 0o600});
  process.stdout.write("Validated bank saved. Use race:content:import to preview a rollout.\n");
})().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Race authoring failed."}\n`);
  process.exitCode = 1;
});
