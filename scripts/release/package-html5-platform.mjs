#!/usr/bin/env node
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {copyFile, readFile, writeFile} from "node:fs/promises";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import path from "node:path";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../..", import.meta.url));
const definitions = Object.freeze({
  itch: Object.freeze({artifact: "build-itch.zip", boundary: "Initial project creation remains a manual itch.io step; later uploads use Butler."}),
  crazygames: Object.freeze({artifact: "build-crazygames-basic.zip", boundary: "Developer Portal upload and Basic Launch review remain manual."}),
  newgrounds: Object.freeze({artifact: "build-newgrounds.zip", boundary: "Newgrounds project creation and publication remain manual."}),
  gamejolt: Object.freeze({artifact: "build-gamejolt.zip", boundary: "Game Jolt game-page, browser package, release and publication setup remain manual."}),
  coolmath: Object.freeze({artifact: "build-coolmath-pitch.zip", boundary: "Coolmath licensing review remains manual; this neutral archive is for the non-exclusive pitch only."}),
  armor: Object.freeze({artifact: "build-armor-pitch.zip", boundary: "Armor Games licensing outreach and publication remain manual."}),
  gamepix: Object.freeze({artifact: "build-gamepix-review.zip", boundary: "GamePix account creation, upload, distribution choice and review remain manual."}),
  addictinggames: Object.freeze({artifact: "build-addictinggames-review.zip", boundary: "Addicting Games submission and licensing review remain manual."}),
  htmlgames: Object.freeze({artifact: "build-htmlgames-pitch.zip", boundary: "HTMLGames.com contact, commercial review and publication remain manual."}),
  playkovo: Object.freeze({artifact: "build-playkovo-review.zip", boundary: "PlayKovo submission review and publication remain manual."}),
  kongregate: Object.freeze({artifact: "build-kongregate.zip", boundary: "Kongregate developer approval, upload agreement, portal upload and publication remain manual."}),
  lagged: Object.freeze({artifact: "build-lagged-review.zip", boundary: "Lagged developer approval, SDK credentials, integration review and publication remain manual."}),
  gamedistribution: Object.freeze({artifact: "build-gamedistribution-review.zip", boundary: "GameDistribution contracting, game ID issuance, SDK integration, upload and activation remain manual."}),
  gamemonetize: Object.freeze({artifact: "build-gamemonetize-review.zip", boundary: "GameMonetize account setup, GameId issuance, SDK integration, upload and activation remain manual."}),
  yandex: Object.freeze({artifact: "build-yandex-review.zip", boundary: "Yandex developer registration, contract, SDK integration, Console upload and moderation remain manual."}),
});

export function getHtml5DistributionDefinition(target) {
  const definition = definitions[target];
  if (!definition) throw new Error(`Unknown HTML5 distribution target ${JSON.stringify(target)}`);
  return definition;
}

export async function packageHtml5Platform(target, {run = execute} = {}) {
  const definition = getHtml5DistributionDefinition(target);
  await run("pnpm", ["release:html5"], {cwd: repository});
  const source = path.join(repository, "build-html5.zip");
  const artifact = path.join(repository, definition.artifact);
  await copyFile(source, artifact);
  const digest = createHash("sha256").update(await readFile(artifact)).digest("hex");
  const manifest = {
    schemaVersion: 1,
    platform: target,
    artifact: definition.artifact,
    sha256: digest,
    sourceArtifact: "build-html5.zip",
    releaseBoundary: definition.boundary,
  };
  await writeFile(path.join(repository, `${definition.artifact}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Prepared ${target} HTML5 handoff ${definition.artifact} (${digest}).`);
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  packageHtml5Platform(process.argv[2]).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
