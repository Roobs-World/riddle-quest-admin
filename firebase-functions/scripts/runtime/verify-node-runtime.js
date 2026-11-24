#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

const functionsRoot = path.resolve(__dirname, "../..");
const requiredNodeVersion = fs.readFileSync(path.join(functionsRoot, ".nvmrc"), "utf8").trim();

if (process.versions.node !== requiredNodeVersion) {
  throw new Error(`Firebase Functions verification requires Node ${requiredNodeVersion}; received ${process.version}.`);
}

function packageBinary(packageName, relativePath) {
  const packageJson = require.resolve(`${packageName}/package.json`, {paths: [functionsRoot]});
  return path.join(path.dirname(packageJson), relativePath);
}

function run(label, binary, args) {
  console.log(`[Node ${process.version}] ${label}`);
  const result = spawnSync(
    process.execPath,
    [binary, ...args],
    {
      cwd: functionsRoot,
      env: process.env,
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("TypeScript", packageBinary("@typescript/native", "bin/tsc"), ["-p", "tsconfig.json", "--noEmit"]);
run("ESLint", path.join(functionsRoot, "scripts/build/lint-source.js"), []);
console.log(`Firebase Functions Node 22 compatibility verification passed on ${process.version}.`);
