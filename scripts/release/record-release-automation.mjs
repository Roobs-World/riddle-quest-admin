#!/usr/bin/env node
import {readFile, rename, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const repository = fileURLToPath(new URL("../..", import.meta.url));
const snapshotPath = path.join(repository, "docs/reports/platform-release-readiness/src/data.json");
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const completedAt = new Date().toISOString();
const sha = (process.env.GITHUB_SHA || "local").slice(0, 12);
const runId = process.env.GITHUB_RUN_ID || "local";
const trigger = process.env.GITHUB_EVENT_NAME || "local";

snapshot.generatedAt = completedAt;
snapshot.queries.release_automation = {
  rows: [
    {platform: "All configured targets", status: "Packaging passed", trigger, revision: sha, completedAt,
      evidence: runId === "local" ? "Local release automation run" : `GitHub Actions run ${runId}`},
    {platform: "Jest", status: process.env.JEST_PUBLISH_CONFIGURED === "true" ? "Publish stage configured" : "Waiting for credentials",
      trigger, revision: sha, completedAt, evidence: "Automatic publish requires JEST_GAME_UPLOAD_TOKEN in the jest-production environment"},
    {platform: "Reddit", status: process.env.REDDIT_CONTRACTS_CONFIGURED === "true" ? "Immutable handoff ready" : "Waiting for evidence",
      trigger, revision: sha, completedAt, evidence: "Promotion requires six sanitized production contract fixtures"},
    {platform: "itch.io", status: process.env.ITCH_BUTLER_CONFIGURED === "true" ? "Publish stage configured" : "Waiting for credentials",
      trigger, revision: sha, completedAt, evidence: "Official Butler stage runs after the shared release artifact succeeds"},
    {platform: "CrazyGames", status: "Manual upload handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-crazygames-basic.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Newgrounds", status: "Manual upload handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-newgrounds.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Game Jolt", status: "Manual upload handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-gamejolt.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Coolmath Games", status: "Licensing pitch handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-coolmath-pitch.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Armor Games", status: "Licensing pitch handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-armor-pitch.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "GamePix", status: "Manual review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-gamepix-review.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Addicting Games", status: "Manual review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-addictinggames-review.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "HTMLGames.com", status: "Licensing pitch handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-htmlgames-pitch.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "PlayKovo", status: "Manual review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-playkovo-review.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Kongregate", status: "Manual upload handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-kongregate.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Lagged", status: "Developer review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-lagged-review.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Google GameSnacks", status: "SDK bundle ready; licensing required", trigger, revision: sha, completedAt,
      evidence: "build-gamesnacks.zip includes the isolated lifecycle, audio, storage SDK adapter and game.json metadata"},
    {platform: "GameDistribution", status: "Contract review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-gamedistribution-review.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "GameMonetize", status: "SDK review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-gamemonetize-review.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Yandex Games", status: "Contract review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-yandex-review.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Telegram", status: "Integration review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-telegram-review.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Microsoft Store PWA", status: "Installable PWA handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-microsoft-pwa.zip includes the web manifest, app icon and service worker and is retained with its SHA-256 manifest"},
    {platform: "Y8", status: "Manual review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-y8-review.zip and its SHA-256 manifest are retained without external monetization"},
    {platform: "Playgama", status: "Contract review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-playgama-review.zip and its SHA-256 manifest are retained before Bridge integration"},
    {platform: "Amazon Appstore Web App", status: "Fire compatibility handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-amazon-webapp-review.zip and its SHA-256 manifest are retained for Fire Web App testing"},
    {platform: "JioGames HTML5", status: "Partner review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-jiogames-review.zip and its SHA-256 manifest are retained pending partner SDK access"},
    {platform: "Famobi", status: "Contract pitch handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-famobi-pitch.zip and its SHA-256 manifest are retained pending compatible terms"},
    {platform: "GamePush Distribution", status: "Distribution review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-gamepush-review.zip and its SHA-256 manifest are retained before destination and SDK approval"},
    {platform: "SOFTGAMES", status: "Publishing pitch handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-softgames-pitch.zip and its SHA-256 manifest are retained pending a non-exclusive offer"},
    {platform: "WGPlayground", status: "Agreement review handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-wgplayground-review.zip and its SHA-256 manifest are retained before SDK integration"},
  ],
  source: {
    label: "All-platform release workflow receipt",
    tables: [".github/workflows/release-all-platforms.yml", "scripts/release/record-release-automation.mjs"],
    filters: ["Passed records the repository verification and release adapters; provider review completion remains separately reported."],
    metricDefinitions: [{label: "Automation status", definition: "The result emitted by the immutable all-platform workflow for one exact repository revision.", componentIds: ["release-automation"]}],
  },
};

const temporary = `${snapshotPath}.${process.pid}.tmp`;
await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, {flag: "wx"});
await rename(temporary, snapshotPath);
console.log(`Recorded release automation receipt for ${sha}.`);
