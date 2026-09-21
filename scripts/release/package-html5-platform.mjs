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
  telegram: Object.freeze({artifact: "build-telegram-review.zip", boundary: "BotFather bot/game creation, signed identity, Telegram Stars fulfillment and launch-link configuration remain manual."}),
  y8: Object.freeze({artifact: "build-y8-review.zip", boundary: "Y8 account setup, studio review, SDK approval, upload and publication remain manual."}),
  playgama: Object.freeze({artifact: "build-playgama-review.zip", boundary: "Playgama contracting, Bridge integration, distribution choices, moderation and publication remain manual."}),
  amazon: Object.freeze({artifact: "build-amazon-webapp-review.zip", boundary: "Amazon developer enrollment, Fire compatibility testing, IAP setup, listing and certification remain manual."}),
  jiogames: Object.freeze({artifact: "build-jiogames-review.zip", boundary: "JioGames account approval, HTML5 SDK access, ads/IAP integration, QA and publication remain manual."}),
  famobi: Object.freeze({artifact: "build-famobi-pitch.zip", boundary: "Famobi contract screening, studio approval, source handling, SDK integration, QA and publication remain manual."}),
  gamepush: Object.freeze({artifact: "build-gamepush-review.zip", boundary: "GamePush contracting, destination selection, SDK integration, moderation and syndication remain manual."}),
  softgames: Object.freeze({artifact: "build-softgames-pitch.zip", boundary: "SOFTGAMES outreach, non-exclusive contract review, SDK integration and publication remain manual."}),
  wgplayground: Object.freeze({artifact: "build-wgplayground-review.zip", boundary: "WGPlayground agreement review, account setup, SDK integration, upload and publication remain manual."}),
  miniplay: Object.freeze({artifact: "build-miniplay-review.zip", boundary: "Miniplay account setup, support request, API credentials, integration review and production launch remain manual."}),
  kizi: Object.freeze({artifact: "build-kizi-pitch.zip", boundary: "Kizi developer outreach, non-exclusive commercial review, SDK integration and publication remain manual."}),
  huawei: Object.freeze({artifact: "build-huawei-quick-game-review.zip", boundary: "Huawei UK developer onboarding, agreement review, service approvals, RPK integration and AppGallery review remain manual."}),
  gameflare: Object.freeze({artifact: "build-gameflare-review.zip", boundary: "GameFlare account setup, contract review, upload, payout configuration and production approval remain manual."}),
  shockwave: Object.freeze({artifact: "build-shockwave-review.zip", boundary: "Shockwave registration, agreement review, official SDK access, integration, QA and publication remain manual."}),
  airconsole: Object.freeze({artifact: "build-airconsole-review.zip", boundary: "AirConsole game creation, controller design, SDK integration, upload, review and approval remain manual."}),
  world: Object.freeze({artifact: "build-world-mini-app-review.zip", boundary: "World Developer Portal setup, commercial review, MiniKit integration, listing review and release remain manual."}),
  farcaster: Object.freeze({artifact: "build-farcaster-mini-app-review.zip", boundary: "Farcaster domain selection, manifest signing, SDK integration, launch publication and discovery remain manual."}),
  pi: Object.freeze({artifact: "build-pi-apps-review.zip", boundary: "Pi account, KYC, terms review, app creation, SDK integration, listing review and approval remain manual."}),
  minipay: Object.freeze({artifact: "build-minipay-mini-app-review.zip", boundary: "MiniPay terms review, commerce decision, hosted integration, listing submission and approval remain manual."}),
  zoom: Object.freeze({artifact: "build-zoom-app-review.zip", boundary: "Zoom app creation, agreement review, SDK integration, security evidence, Marketplace review and publication remain manual."}),
  "pwa-directory": Object.freeze({artifact: "build-pwa-directory-review.zip", boundary: "PWA installability review, metadata submission, directory review and listing approval remain manual."}),
  miro: Object.freeze({artifact: "build-miro-marketplace-review.zip", boundary: "Miro app creation, collaborative-flow design, SDK integration, beta adoption, Marketplace review and publication remain manual."}),
  greenhouse: Object.freeze({artifact: "build-greenhouse-review.zip", boundary: "Greenhouse educational positioning, CSP/offline adaptation, creator onboarding, upload, review and publication remain manual."}),
  ozogames: Object.freeze({artifact: "build-ozogames-review.zip", boundary: "OzoGames email submission, publisher agreement, monetization review and publication remain manual."}),
  slowden: Object.freeze({artifact: "build-slowden-review.zip", boundary: "SlowDen form submission, terms confirmation, editorial review and listing approval remain manual."}),
  noadsgames: Object.freeze({artifact: "build-noadsgames-review.zip", boundary: "NoAdsGames API submission and mandatory human review remain manual; the artifact must remain ad-free."}),
});

export function listHtml5DistributionDefinitions() {
  return Object.entries(definitions).map(([target, definition]) => ({target, ...definition}));
}

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
