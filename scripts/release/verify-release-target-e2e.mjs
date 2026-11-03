#!/usr/bin/env node
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {access, readFile} from "node:fs/promises";
import path from "node:path";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import {listHtml5DistributionDefinitions} from "./package-html5-platform.mjs";
import {listPlatformReleasePlans} from "./platform-releases.mjs";

import {expectedName} from "./release-target-names.mjs";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../..", import.meta.url));
const plans = listPlatformReleasePlans();
const requireFile = async (relative) => access(path.join(repository, relative));
const verifyZip = async (artifact, expectedPlatform) => {
  await requireFile(artifact);
  await execute("unzip", ["-tq", path.join(repository, artifact)]);
  const manifest = JSON.parse(await readFile(path.join(repository, `${artifact}.manifest.json`), "utf8"));
  if (manifest.artifact !== artifact || manifest.platform !== expectedPlatform) throw new Error(`Invalid manifest for ${expectedPlatform}`);
  const digest = createHash("sha256").update(await readFile(path.join(repository, artifact))).digest("hex");
  if (manifest.sha256 !== digest) throw new Error(`Digest mismatch for ${artifact}`);
};

const verifyYouTubeZip = async () => {
  const artifact = "build-youtube.zip";
  await requireFile(artifact);
  await execute("unzip", ["-tq", path.join(repository, artifact)]);
  const manifest = JSON.parse(await readFile(path.join(repository, "build-youtube.manifest.json"), "utf8"));
  const digest = createHash("sha256").update(await readFile(path.join(repository, artifact))).digest("hex");
  if (manifest.provider !== "youtube-playables" || manifest.archive?.file !== artifact || manifest.archive?.sha256 !== digest) {
    throw new Error("Invalid YouTube release manifest");
  }
};

const definitions = listHtml5DistributionDefinitions();
for (const {target, artifact} of definitions) await verifyZip(artifact, target);
await verifyYouTubeZip();
await verifyZip("build-gamesnacks.zip", "gamesnacks");
for (const directory of ["jest", "facebook", "netflix", "yahoo"]) {
  await requireFile(`builds/${directory}/index.html`);
}
await requireFile("packages/reddit-app/dist/client/game.html");
await requireFile("packages/reddit-app/dist/server/index.cjs");

// Every executable release path carries a canonical monetization policy.
const policy = JSON.parse(await readFile(path.join(repository, "config/platform-monetization.json"), "utf8"));
const policed = new Set(policy.platforms.map(({platform}) => platform));
const unpoliced = plans.map(expectedName).filter((name) => !policed.has(name));
if (unpoliced.length) throw new Error(`Monetization policy is missing: ${unpoliced.join(", ")}`);

console.log(`Release-target integrity passed for ${plans.length} executable release paths: ${definitions.length + 2} immutable ZIPs, 4 browser builds and the Reddit client/server package are valid, and every target has a monetization policy.`);
