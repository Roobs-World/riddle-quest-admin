"use strict";

const path = require("node:path");
const {spawnSync} = require("node:child_process");
const {serverRoots} = require("./stage-platform-source.js");

const functionsRoot = path.resolve(__dirname, "../..");
const repositoryRoot = path.resolve(functionsRoot, "..");
const eslint = path.join(path.dirname(require.resolve("eslint/package.json")), "bin/eslint.js");
const result = spawnSync(process.execPath, [
  eslint,
  "--config", path.join(functionsRoot, "eslint.config.cjs"),
  "--ext", ".js,.ts",
  "firebase-functions/src", ...serverRoots,
], {cwd: repositoryRoot, stdio: "inherit", env: process.env});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
