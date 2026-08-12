#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

const functionsRoot = path.resolve(__dirname, "..");
const requiredNodeVersion = fs.readFileSync(path.join(functionsRoot, ".nvmrc"), "utf8").trim();

if (process.versions.node !== requiredNodeVersion) {
  throw new Error(`Firebase Functions verification requires Node ${requiredNodeVersion}; received ${process.version}.`);
}

function packageBinary(packageName, relativePath) {
  const packageJson = require.resolve(`${packageName}/package.json`, {paths: [functionsRoot]});
  return path.join(path.dirname(packageJson), relativePath);
}

function run(label, binary, args, options = {}) {
  console.log(`[Node ${process.version}] ${label}`);
  const result = spawnSync(
    process.execPath,
    [...(options.nodeArgs ?? []), binary, ...args],
    {
      cwd: functionsRoot,
      env: {...process.env, ...(options.env ?? {})},
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("TypeScript", packageBinary("@typescript/native", "bin/tsc"), ["-p", "tsconfig.json", "--noEmit"]);
run("ESLint", packageBinary("eslint", "bin/eslint.js"), ["--ext", ".js,.ts", "src"]);
run(
  "Jest unit suite",
  packageBinary("jest", "bin/jest.js"),
  ["--config", "jest.config.js", "--runInBand"],
  {
    nodeArgs: ["--experimental-vm-modules"],
    env: {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8099", NODE_ENV: "test"},
  },
);

console.log(`Firebase Functions Node 22 compatibility verification passed on ${process.version}.`);
