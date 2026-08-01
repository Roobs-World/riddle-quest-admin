#!/usr/bin/env node
"use strict";

const {spawnSync} = require("node:child_process");
const path = require("node:path");

const [target, ...targetArgs] = process.argv.slice(2);
if (!target) throw new Error("Provide a script path to run with the Firebase Functions Node runtime.");

const absoluteTarget = path.resolve(target);
const nodeMajor = Number(process.versions.node.split(".")[0]);
const command = nodeMajor === 22 ? process.execPath : "pnpm";
const args = nodeMajor === 22 ? [absoluteTarget, ...targetArgs] : ["dlx", "node@22", absoluteTarget, ...targetArgs];
const result = spawnSync(command, args, {stdio: "inherit", env: process.env});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
