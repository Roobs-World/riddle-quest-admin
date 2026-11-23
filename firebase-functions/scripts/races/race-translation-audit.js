#!/usr/bin/env node
"use strict";

const {createHash} = require("node:crypto");
const {readFile, readdir} = require("node:fs/promises");
const path = require("node:path");
const {RACE_SUPPORTED_LOCALES} = require("../../lib/src/races/contracts/index");
const {createRaceTranslationMatrixPlan} = require("../../lib/firebase-functions/src/race/content/raceTranslationValidation.js");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const sourcePath = path.resolve(option("--source") || "content/race-en-reviewed-v2.json");
const inputDirectory = path.resolve(option("--input-dir") || "content/race-translations");
const locales = RACE_SUPPORTED_LOCALES.filter((locale) => locale !== "en");
const expectedNames = locales.map((locale) => `race-${locale}-automated-translation-v1.json`);
const translationNamePattern = /^race-([a-z]{2})-automated-translation-v1\.json$/u;

void (async () => {
  const directoryNames = await readdir(inputDirectory);
  const unexpected = directoryNames.filter((name) => translationNamePattern.test(name) && !expectedNames.includes(name));
  if (unexpected.length > 0) throw new Error(`unexpected-translation-bundles:${unexpected.sort().join(",")}`);
  const [sourceRaw, ...bundleRaw] = await Promise.all([
    readFile(sourcePath, "utf8"),
    ...expectedNames.map((name) => readFile(path.join(inputDirectory, name), "utf8")),
  ]);
  const source = JSON.parse(sourceRaw);
  const bundles = bundleRaw.map((raw) => JSON.parse(raw));
  const plan = createRaceTranslationMatrixPlan(bundles, source);
  const manifest = {
    schemaVersion: 1,
    provenance: "automated_translation_v1",
    source: {
      path: sourcePath,
      sha256: createHash("sha256").update(sourceRaw).digest("hex"),
    },
    inputDirectory,
    locales: plan.locales,
    totalRiddles: plan.totalRiddles,
    bundles: expectedNames.map((name, index) => ({
      file: name,
      locale: locales[index],
      riddles: Array.isArray(bundles[index]?.riddles) ? bundles[index].riddles.length : null,
      sha256: createHash("sha256").update(bundleRaw[index]).digest("hex"),
    })),
    valid: plan.valid,
    issues: plan.issues,
  };
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  if (!plan.valid) process.exitCode = 1;
})().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
