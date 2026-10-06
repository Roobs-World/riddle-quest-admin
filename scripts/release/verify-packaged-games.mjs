#!/usr/bin/env node
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {createHash} from "node:crypto";
import {mkdtemp, readFile, rm, mkdir, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {listHtml5DistributionDefinitions} from "./package-html5-platform.mjs";
import {chromium, serveArtifact, verifySoloArtifact} from "./browser-artifact-support.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const execute = promisify(execFile);
const allTargets = [...listHtml5DistributionDefinitions(),
  {target: "gamesnacks", artifact: "build-gamesnacks.zip", gamesnacks: true},
  {target: "netflix", directory: "builds/netflix"},
  {target: "yahoo", directory: "builds/yahoo"}];
// `--target <name>` gates one release handoff on its own packaged gameplay.
const targetFlag = process.argv.indexOf("--target");
const only = targetFlag === -1 ? undefined : process.argv[targetFlag + 1];
const targets = only ? allTargets.filter(({target}) => target === only) : allTargets;
if (only && targets.length === 0) {
  console.error(`No packaged browser flow is defined for ${JSON.stringify(only)}`);
  process.exit(1);
}
const browser = await chromium.launch({headless: true});
const results = [];
try {
  for (const target of targets) {
    const temporary = await mkdtemp(path.join(tmpdir(), "riddle-artifact-e2e-"));
    let server;
    try {
      let sha256;
      if (target.artifact) {
        const archive = path.join(root, target.artifact);
        const bytes = await readFile(archive);
        sha256 = createHash("sha256").update(bytes).digest("hex");
        const manifest = JSON.parse(await readFile(`${archive}.manifest.json`, "utf8"));
        if (manifest.sha256 !== sha256) throw new Error("Artifact digest mismatch");
        await execute("unzip", ["-q", archive, "-d", temporary]);
      }
      server = await serveArtifact(target.directory ? path.join(root, target.directory) : temporary);
      const checks = await verifySoloArtifact(browser, server.url, target);
      results.push({target: target.target, artifact: target.artifact, sha256, status: "passed", ...checks});
      console.log(`PASS ${target.target}: solve, reward, reload${target.offline ? ", offline" : ""}`);
    } catch (error) {
      results.push({target: target.target, status: "failed", error: error.message});
      console.error(`FAIL ${target.target}: ${error.message}`);
    } finally { await server?.close(); await rm(temporary, {recursive: true, force: true}); }
  }
} finally { await browser.close(); }
await mkdir(path.join(root, "artifacts/release-e2e"), {recursive: true});
// A single-target gate keeps its own evidence so it never truncates the all-target report.
await writeFile(path.join(root, `artifacts/release-e2e/packaged-games${only ? `-${only}` : ""}.json`), JSON.stringify({verifiedAt: new Date().toISOString(), scope: "Actual packaged gameplay; provider publication is not implied", results}, null, 2) + "\n");
console.log(`${results.filter(row => row.status === "passed").length}/${targets.length} packaged browser flows passed.`);
if (results.some(row => row.status === "failed")) process.exitCode = 1;
