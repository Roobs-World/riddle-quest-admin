#!/usr/bin/env node
import {mkdir, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {chromium, verifySoloArtifact} from "./browser-artifact-support.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const targets = [
  {target: "yahoo", url: "https://yahoo.roobsworld.com/"},
];
const browser = await chromium.launch({headless: true});
const results = [];
try {
  for (const target of targets) {
    try {
      const checks = await verifySoloArtifact(browser, target.url, target);
      results.push({...target, status: "passed", ...checks});
      console.log(`PASS live ${target.target}: ${target.url}`);
    } catch (error) {
      results.push({...target, status: "failed", error: error.message});
      console.error(`FAIL live ${target.target}: ${error.message}`);
    }
  }
} finally { await browser.close(); }
await mkdir(path.join(root, "artifacts/release-e2e"), {recursive: true});
await writeFile(path.join(root, "artifacts/release-e2e/live-web-games.json"), JSON.stringify({verifiedAt: new Date().toISOString(), results}, null, 2) + "\n");
if (results.some(row => row.status === "failed")) process.exitCode = 1;
