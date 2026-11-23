import {cp, mkdtemp, mkdir, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createRedditArtifactRecord, createRedditHandoff, redditArtifactSha256, verifyGatedRedditArtifact, writePrivateRedditJson} from "./reddit-release-artifact.mjs";

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = path.resolve(packageDirectory, "../../..");
const receipts = path.join(packageDirectory, ".reddit-release-receipts");
const archivePath = path.join(packageDirectory, "build-reddit.zip");
const receiptPath = path.join(receipts, "gated-artifact.json");
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {cwd: options.cwd ?? repository, encoding: "utf8", stdio: options.capture ? "pipe" : "inherit"});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`);
  return (result.stdout ?? "").trim();
};

const sourceCommit = run("git", ["rev-parse", "HEAD"], {capture: true});
const assertSourceUnchanged = () => {
  const currentCommit = run("git", ["rev-parse", "HEAD"], {capture: true});
  const sourceDirty = run("git", ["status", "--porcelain", "--untracked-files=normal"], {capture: true}).length > 0;
  if (sourceDirty || currentCommit !== sourceCommit) {
    throw new Error("Reddit release gating requires the same clean source commit throughout the build");
  }
  return sourceDirty;
};
const sourceDirty = assertSourceUnchanged();

run("pnpm", ["build:package"], {cwd: packageDirectory});
assertSourceUnchanged();
const staging = await mkdtemp(path.join(tmpdir(), "riddle-quest-reddit-package-"));
try {
  await Promise.all([
    cp(path.join(packageDirectory, "dist"), path.join(staging, "dist"), {recursive: true, dereference: false}),
    cp(path.join(packageDirectory, "devvit.json"), path.join(staging, "devvit.json")),
    cp(path.join(packageDirectory, "products.json"), path.join(staging, "products.json")),
    cp(path.join(packageDirectory, "README.md"), path.join(staging, "README.md")),
    cp(path.join(packageDirectory, "third-party-licenses.reddit.txt"), path.join(staging, "third-party-licenses.reddit.txt")),
  ]);
  await rm(archivePath, {force: true});
  run("/usr/bin/zip", ["-qrX", archivePath, "."], {cwd: staging});
} finally {
  await rm(staging, {recursive: true, force: true});
}

const contents = await readFile(archivePath);
const entries = run("/usr/bin/unzip", ["-Z1", archivePath], {capture: true}).split("\n").filter(Boolean);
if (!entries.includes("devvit.json") || !entries.includes("products.json") || !entries.includes("dist/server/index.cjs") || !entries.includes("dist/client/splash.html") || !entries.includes("dist/client/game.html")) {
  throw new Error("Reddit archive is missing required package entries");
}
await mkdir(receipts, {recursive: true, mode: 0o700});
const archiveSha256 = redditArtifactSha256(contents);
await writePrivateRedditJson(receiptPath, createRedditArtifactRecord({archivePath, archiveBytes: contents.byteLength, archiveEntries: entries.length, archiveSha256, sourceCommit, sourceDirty}));
await verifyGatedRedditArtifact({archivePath, receiptPath, sourceCommit, sourceDirty});
const handoffPath = await createRedditHandoff(receipts, archiveSha256, contents);
assertSourceUnchanged();
console.log(`Gated Reddit package: ${contents.byteLength} bytes, ${entries.length} entries, sha256 ${archiveSha256}`);
console.log(`Immutable handoff: ${handoffPath}`);
console.log(`Receipt: ${receiptPath}`);
