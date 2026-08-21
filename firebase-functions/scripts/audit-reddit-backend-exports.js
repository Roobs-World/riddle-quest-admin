#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {readExportNames} = require("./audit-facebook-backend-exports");

const EXPECTED_REDDIT_EXPORTS = Object.freeze([
  "exchangeRedditIdentity",
  "deleteRedditAccount",
  "redditStorage",
  "redditGameplay",
]);

function auditRedditBackendExports(source) {
  const names = readExportNames(source);
  const failures = EXPECTED_REDDIT_EXPORTS
    .filter((name) => !names.includes(name))
    .map((name) => `Missing Reddit backend export: ${name}`);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) failures.push(`Duplicate Functions exports: ${[...new Set(duplicates)].join(", ")}`);
  return failures;
}

if (require.main === module) {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/index.ts"), "utf8");
  const failures = auditRedditBackendExports(source);
  if (failures.length > 0) throw new Error(`Reddit backend export audit failed:\n- ${failures.join("\n- ")}`);
  console.log(`Reddit backend export audit passed: ${EXPECTED_REDDIT_EXPORTS.length} entry points are exported.`);
}

module.exports = {EXPECTED_REDDIT_EXPORTS, auditRedditBackendExports};
