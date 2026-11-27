#!/usr/bin/env node
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {access, readFile} from "node:fs/promises";
import path from "node:path";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import {listHtml5DistributionDefinitions} from "./package-html5-platform.mjs";
import {listPlatformReleasePlans} from "./platform-releases.mjs";
import {getWebBuildPaths} from "./release-registry.mjs";

import {expectedName} from "./release-target-names.mjs";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../..", import.meta.url));
const plans = listPlatformReleasePlans();
const requireFile = async (relative) => access(path.join(repository, relative));
const verifyZip = async (artifact, expectedPlatform) => {
  const archive = path.join(getWebBuildPaths(expectedPlatform).buildDirectory, artifact);
  await requireFile(archive);
  await execute("unzip", ["-tq", path.join(repository, archive)]);
  const manifest = JSON.parse(await readFile(path.join(repository, `${archive}.manifest.json`), "utf8"));
  if (manifest.artifact !== artifact || manifest.platform !== expectedPlatform) throw new Error(`Invalid manifest for ${expectedPlatform}`);
  const digest = createHash("sha256").update(await readFile(path.join(repository, archive))).digest("hex");
  if (manifest.sha256 !== digest) throw new Error(`Digest mismatch for ${artifact}`);
};

const verifyYouTubeZip = async () => {
  const artifact = "build-youtube.zip";
  const directory = getWebBuildPaths("youtube").buildDirectory;
  const archive = path.join(directory, artifact);
  await requireFile(archive);
  await execute("unzip", ["-tq", path.join(repository, archive)]);
  const manifest = JSON.parse(await readFile(path.join(repository, directory, "build-youtube.manifest.json"), "utf8"));
  const digest = createHash("sha256").update(await readFile(path.join(repository, archive))).digest("hex");
  if (manifest.provider !== "youtube-playables" || manifest.archive?.file !== artifact || manifest.archive?.sha256 !== digest) {
    throw new Error("Invalid YouTube release manifest");
  }
};

const definitions = listHtml5DistributionDefinitions();
for (const {target, artifact} of definitions) await verifyZip(artifact, target);
await verifyYouTubeZip();
await verifyZip("build-gamesnacks.zip", "gamesnacks");
for (const directory of ["facebook", "netflix", "yahoo"]) {
  await requireFile(path.join(getWebBuildPaths(directory).outputDirectory, "index.html"));
}
await requireFile(path.join(getWebBuildPaths("reddit").buildDirectory, "devvit/client/game.html"));
await requireFile(path.join(getWebBuildPaths("reddit").buildDirectory, "devvit/server/index.cjs"));

// Every executable release path carries a canonical monetization policy.
const policy = JSON.parse(await readFile(path.join(repository, "config/platform-monetization.json"), "utf8"));
const policed = new Set(policy.platforms.map(({platform}) => platform));
const unpoliced = plans.map(expectedName).filter((name) => !policed.has(name));
if (unpoliced.length) throw new Error(`Monetization policy is missing: ${unpoliced.join(", ")}`);

console.log(`Release-target integrity passed for ${plans.length} executable release paths: ${definitions.length + 2} immutable ZIPs, 4 browser builds and the Reddit client/server package are valid, and every target has a monetization policy.`);
