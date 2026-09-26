#!/usr/bin/env node
"use strict";

const {spawnSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const [target, ...targetArgs] = process.argv.slice(2);
if (!target) throw new Error("Provide a script path to run with the Firebase Functions Node runtime.");

const absoluteTarget = path.resolve(target);
const functionsNodeVersion = fs.readFileSync(path.resolve(__dirname, "..", ".nvmrc"), "utf8").trim();
if (!/^22\.\d+\.\d+$/.test(functionsNodeVersion)) {
  throw new Error(`Firebase Functions .nvmrc must pin a Node 22 release; received ${functionsNodeVersion}.`);
}
const usesPinnedNode = process.versions.node === functionsNodeVersion;
const configuredNode = process.env.RIDDLE_QUEST_FUNCTIONS_NODE_BINARY;
if (configuredNode && !path.isAbsolute(configuredNode)) {
  throw new Error("RIDDLE_QUEST_FUNCTIONS_NODE_BINARY must be an absolute path.");
}
if (configuredNode) {
  const version = spawnSync(configuredNode, ["--version"], {encoding: "utf8"});
  if (version.error || version.status !== 0 || version.stdout.trim() !== `v${functionsNodeVersion}`) {
    throw new Error(`Configured Firebase Functions Node binary must be v${functionsNodeVersion}.`);
  }
}
const command = usesPinnedNode ? process.execPath : configuredNode ?? "pnpm";
const args = usesPinnedNode || configuredNode
  ? [absoluteTarget, ...targetArgs]
  : ["dlx", `node@${functionsNodeVersion}`, absoluteTarget, ...targetArgs];
const result = spawnSync(command, args, {stdio: "inherit", env: process.env});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
