import {spawnSync} from "node:child_process";
import {chmodSync, mkdirSync, readFileSync, rmSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  createFacebookArtifactRecord,
  facebookArtifactSha256,
  writePrivateFacebookJson,
} from "./facebook-release-artifact.mjs";

import {assertFacebookHandoffsSettled, withFacebookReleaseLock} from "./facebook-release-state.mjs";

const packageDirectory = fileURLToPath(new URL("../../../../packages/web-game/", import.meta.url));
const repositoryDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
const buildDirectory = path.join(packageDirectory, "../../builds/facebook");
const archivePath = path.join(packageDirectory, "build-facebook.zip");
const receiptDirectory = path.join(packageDirectory, ".facebook-upload-receipts");
const receiptPath = path.join(receiptDirectory, "gated-artifact.json");
mkdirSync(receiptDirectory, {recursive: true, mode: 0o700});

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {cwd: options.cwd ?? repositoryDirectory, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: options.capture ? "pipe" : "inherit"});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
  return result.stdout?.trim() ?? "";
};

await withFacebookReleaseLock(receiptDirectory, async () => {
  await assertFacebookHandoffsSettled(receiptDirectory);
  run(process.execPath, [path.join(repositoryDirectory, "platforms/web/facebook/scripts/audit-facebook-secret-boundary.mjs")]);
  run(process.execPath, [path.join(repositoryDirectory, "platforms/web/facebook/scripts/audit-facebook-artifact.mjs"), buildDirectory]);
  rmSync(archivePath, {force: true});
  run("/usr/bin/zip", ["-qrX", archivePath, "."], {cwd: buildDirectory});
  chmodSync(archivePath, 0o444);
  const entries = run("/usr/bin/unzip", ["-Z1", archivePath], {capture: true}).split("\n").filter(Boolean);
  if (!entries.includes("index.html") || entries.some((entry) =>
    entry.startsWith("/") || /^[a-z]:/iu.test(entry) || entry.split(/[\\/]/u).includes(".."))) {
    throw new Error("Facebook archive does not have a safe root index.html");
  }
  const contents = readFileSync(archivePath);
  if (contents.byteLength > 200 * 1024 * 1024) throw new Error("Facebook ZIP exceeds 200 MB");
  const sourceCommit = run("/usr/bin/git", ["rev-parse", "HEAD"], {capture: true});
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) throw new Error("Unable to bind Facebook artifact to Git HEAD");
  const sourceDirty = Boolean(run("/usr/bin/git", ["status", "--porcelain=v1", "--untracked-files=all"], {capture: true}));
  const sha256 = facebookArtifactSha256(contents);
  await writePrivateFacebookJson(receiptPath, createFacebookArtifactRecord({
    archiveBytes: contents.byteLength,
    archiveEntries: entries.length,
    archivePath,
    archiveSha256: sha256,
    sourceCommit,
    sourceDirty,
  }));
  console.log(`Gated Facebook ZIP: ${contents.byteLength} bytes, ${entries.length} entries, sha256 ${sha256}`);
  console.log(`Source: ${sourceCommit}${sourceDirty ? " (dirty; upload blocked)" : " (clean)"}`);
  console.log(`Receipt: ${receiptPath}`);
  console.log("Preflight stopped before any Meta network transmission.");
});
