"use strict";

const fs = require("node:fs");
const path = require("node:path");

const functionsRoot = path.resolve(__dirname, "../..");
const maximumFiles = 20;
const excludedDirectories = new Set([
  "node_modules", "lib", ".build-source", "coverage", "artifacts",
  ".firebase", ".emulator-data", ".cache", "__tests__", "__mocks__",
  "__snapshots__", "__fixtures__", "test", "tests",
]);
const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const generatedFile = /(?:\.log|\.tsbuildinfo|\.log\.\d+)$/u;
const violations = [];
let directories = 0;
let largest = 0;

/** Counts direct project files while leaving test and generated trees outside the limit. */
function inspect(directory) {
  const entries = fs.readdirSync(directory, {withFileTypes: true});
  const files = entries.filter(entry => !entry.isDirectory() && !testFile.test(entry.name) && !generatedFile.test(entry.name));
  directories += 1;
  largest = Math.max(largest, files.length);
  if (files.length > maximumFiles) {
    violations.push(`${path.relative(functionsRoot, directory) || "."}: ${files.length} direct files`);
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !excludedDirectories.has(entry.name)) inspect(path.join(directory, entry.name));
  }
}

inspect(functionsRoot);
if (violations.length) throw new Error(`Functions folders must contain at most ${maximumFiles} non-test files:\n${violations.join("\n")}`);
console.log(`Functions directory layout passed: ${directories} folders, largest ${largest} direct non-test files, limit ${maximumFiles}.`);
