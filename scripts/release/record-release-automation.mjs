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
    {platform: "All configured targets", status: "Passed", trigger, revision: sha, completedAt,
      evidence: runId === "local" ? "Local release automation run" : `GitHub Actions run ${runId}`},
    {platform: "itch.io", status: process.env.ITCH_BUTLER_CONFIGURED === "true" ? "Publish stage configured" : "Waiting for credentials",
      trigger, revision: sha, completedAt, evidence: "Official Butler stage runs after the shared release artifact succeeds"},
    {platform: "CrazyGames", status: "Manual upload handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-crazygames-basic.zip and its SHA-256 manifest are retained in the workflow artifact"},
    {platform: "Newgrounds", status: "Manual upload handoff ready", trigger, revision: sha, completedAt,
      evidence: "build-newgrounds.zip and its SHA-256 manifest are retained in the workflow artifact"},
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
