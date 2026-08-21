#!/usr/bin/env node
import {readdir, readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {FIXTURE_TYPES, validateRedditContractFixture} from "./reddit-contract-fixture.mjs";

export async function validateRedditContractFixtureDirectory(directory) {
  let entries;
  try { entries = (await readdir(directory, {withFileTypes: true})).filter((entry) => entry.isFile() && entry.name.endsWith(".json")); }
  catch { throw new Error("reddit-contract-fixtures-missing"); }
  const seenTypes = new Set();
  const seenSources = new Set();
  for (const entry of entries) {
    let fixture;
    try { fixture = JSON.parse(await readFile(path.join(directory, entry.name), "utf8")); }
    catch { throw new Error(`invalid-reddit-contract-fixture-json:${entry.name}`); }
    validateRedditContractFixture(fixture);
    if (seenSources.has(fixture.sourceSha256)) throw new Error("duplicate-reddit-contract-source");
    seenSources.add(fixture.sourceSha256);
    seenTypes.add(fixture.type);
  }
  const missing = [...FIXTURE_TYPES].filter((type) => !seenTypes.has(type));
  if (missing.length) throw new Error(`missing-reddit-contract-fixtures:${missing.join(",")}`);
  return {files: entries.length, types: seenTypes.size};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(process.argv[2] ?? "docs/evidence/reddit-contracts");
  const result = await validateRedditContractFixtureDirectory(directory);
  console.log(`Reddit contract fixtures passed: ${result.files} files covering ${result.types} required types`);
}
