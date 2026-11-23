#!/usr/bin/env node
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {createHash} = require("node:crypto");
const {mkdir, writeFile} = require("node:fs/promises");
const path = require("node:path");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const options = (name) => args.flatMap((value, index) => (value === name && args[index + 1] ? [args[index + 1]] : []));
const has = (name) => args.includes(name);
const projectId = option("--project") || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const apply = has("--apply");
const confirmedProject = option("--confirm-project");

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};
const hashPlayerId = (playerId) => createHash("sha256").update(`riddle-quest-race-cohort-v1:${playerId}`).digest("hex");

if (!projectId) fail("Provide --project or set GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT.");
else if (apply && confirmedProject !== projectId) fail(`Applying requires --confirm-project ${projectId}.`);
else {
  void (async () => {
    const enabledInput = option("--enabled");
    if (enabledInput !== undefined && !["true", "false"].includes(enabledInput)) {
      throw new Error("--enabled must be true or false.");
    }
    const percentageInput = option("--percentage");
    const percentage = percentageInput === undefined ? undefined : Number(percentageInput);
    if (percentage !== undefined && (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)) {
      throw new Error("--percentage must be between 0 and 100.");
    }

    const app = initializeApp({projectId});
    const db = getFirestore(app);
    const reference = db.doc("raceConfig/rollout");
    const snapshot = await reference.get();
    const current = snapshot.exists ? snapshot.data() : {enabled: false, percentage: 0, allowlistHashes: []};
    const addedHashes = options("--allow-player-id").map(hashPlayerId);
    const removedHashes = new Set(options("--remove-player-id").map(hashPlayerId));
    const allowlistHashes = [...new Set([...(current.allowlistHashes ?? []), ...addedHashes])].filter(
      (hash) => !removedHashes.has(hash),
    );
    if (allowlistHashes.length > 500) throw new Error("The rollout allowlist is limited to 500 players.");
    const next = {
      enabled: enabledInput === undefined ? Boolean(current.enabled) : enabledInput === "true",
      percentage: percentage ?? Number(current.percentage ?? 0),
      allowlistHashes,
    };
    const preview = {
      projectId,
      mode: apply ? "apply" : "preview",
      previous: {
        enabled: Boolean(current.enabled),
        percentage: Number(current.percentage ?? 0),
        allowlistCount: (current.allowlistHashes ?? []).length,
      },
      next: {enabled: next.enabled, percentage: next.percentage, allowlistCount: next.allowlistHashes.length},
    };
    process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
    if (!apply) return;

    const backupDirectory = path.resolve(option("--backup-dir") || "artifacts/race-rollout-backups");
    await mkdir(backupDirectory, {recursive: true});
    const backupPath = path.join(
      backupDirectory,
      `race-rollout-${projectId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(
      backupPath,
      `${JSON.stringify({projectId, createdAt: new Date().toISOString(), existed: snapshot.exists, data: current}, null, 2)}\n`,
      {flag: "wx"},
    );
    await reference.set(next);
    process.stdout.write(`${JSON.stringify({applied: true, backupPath}, null, 2)}\n`);
  })().catch((error) => fail(error instanceof Error ? error.stack || error.message : String(error)));
}
