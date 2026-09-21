#!/usr/bin/env node
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {access, readFile} from "node:fs/promises";
import path from "node:path";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import {listHtml5DistributionDefinitions} from "./package-html5-platform.mjs";
import {listPlatformReleasePlans} from "./platform-releases.mjs";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../..", import.meta.url));
const snapshot = JSON.parse(await readFile(path.join(repository, "docs/reports/platform-release-readiness/src/data.json"), "utf8"));
const plans = listPlatformReleasePlans();
const dashboardNames = new Map([
  ["crazygames", "CrazyGames"], ["coolmath", "Coolmath Games"], ["armor", "Armor Games"],
  ["htmlgames", "HTMLGames.com"], ["lagged", "Lagged"], ["telegram", "Telegram"],
  ["microsoft-pwa", "Microsoft Store PWA"], ["y8", "Y8"], ["amazon", "Amazon Appstore Web App"],
  ["jiogames", "JioGames HTML5"], ["gamepush", "GamePush Distribution"], ["softgames", "SOFTGAMES"],
  ["wgplayground", "WGPlayground"], ["huawei", "Huawei Quick Game"], ["gameflare", "GameFlare Distribution"],
  ["world", "World App Mini Apps"], ["farcaster", "Farcaster Mini Apps"], ["pi", "Pi Apps Platform"],
  ["minipay", "MiniPay Mini Apps"], ["zoom", "Zoom App Marketplace"], ["pwa-directory", "PWA Directory"],
  ["miro", "Miro Marketplace"], ["greenhouse", "Greenhouse Games"], ["ozogames", "OzoGames"],
  ["slowden", "SlowDen"], ["noadsgames", "NoAdsGames"], ["gamesnacks", "Google GameSnacks"],
]);

const expectedName = (plan) => dashboardNames.get(plan.target) ?? plan.title.replace(/ (Basic Launch|pitch|review)$/u, "");
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
await verifyZip("build-microsoft-pwa.zip", "microsoft-pwa");
for (const directory of ["dist-jest", "dist-facebook", "dist-netflix", "dist-yahoo"]) {
  await requireFile(`packages/portal/${directory}/index.html`);
}
await requireFile("packages/reddit-app/dist/client/game.html");
await requireFile("packages/reddit-app/dist/server/index.cjs");

for (const query of ["platform_status", "monetization_readiness", "release_automation"]) {
  const names = new Set(snapshot.queries[query].rows.map(({platform}) => platform));
  const missing = plans.map(expectedName).filter((name) => !names.has(name));
  if (missing.length) throw new Error(`${query} is missing: ${missing.join(", ")}`);
}
const todoNames = new Set(snapshot.queries.manual_action_checklist.rows.map(({platform}) => platform));
const missingTodos = plans.map(expectedName).filter((name) => !todoNames.has(name));
if (missingTodos.length) throw new Error(`manual_action_checklist is missing: ${missingTodos.join(", ")}`);

console.log(`Release-target E2E passed for ${plans.length} targets: ${definitions.length + 3} immutable ZIPs, 4 browser builds, and the Reddit client/server package; dashboard status, monetization, automation receipts, and TODOs are complete.`);
