import {lstat, mkdir, open, readdir, readFile, rmdir, unlink} from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {getWebBuildPaths, releaseRegistry, webBuildFacts} from "../release/release-registry.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
if (args.length > 1 || args.length === 1 && args[0] !== "--apply") throw new Error("Usage: pnpm migrate:game-builds [--apply]");
const apply = args[0] === "--apply";
const exists = async value => {try {await lstat(value);return true;} catch (error) {if (error.code === "ENOENT") return false;throw error;}};
const moves = [];
const moveWithoutReplacement = promisify(execFile);
const add = async (source, destination) => {
  const from = path.resolve(root, source);
  const to = path.resolve(root, destination);
  if (!await exists(from)) return;
  if (await exists(to)) throw new Error(`Both build locations exist; reconcile without overwriting: ${source} and ${destination}`);
  if (moves.some(move => move.to === to)) throw new Error(`Multiple legacy build locations need reconciliation: ${destination}`);
  moves.push({source, destination, from, to});
};

async function verifyReceipts(directory, provider) {
  if (!await exists(directory)) return;
  const names = await readdir(directory);
  if (names.some(name => name.endsWith(".lock") || name.endsWith("-lock"))) throw new Error(`Release state is locked: ${provider}`);
  for (const name of names.filter(name => name.endsWith(".json"))) {
    const record = JSON.parse(await readFile(path.join(directory, name), "utf8"));
    if (provider === "jest" && /(?:upload-attempt|unresolved-upload)/u.test(name) && record.state !== "accepted") {
      throw new Error("Reconcile the Jest upload before relocating its release state");
    }
    if (provider === "reddit" && /^upload-/u.test(name) && !["accepted", "reconciled-absent"].includes(record.status)) {
      throw new Error("Reconcile the Reddit upload before relocating its release state");
    }
    if (provider === "reddit" && /^playtest-attempt-/u.test(name)) {
      const suffix = name.slice("playtest-attempt-".length);
      const terminal = [];
      for (const prefix of ["playtest-outcome-", "playtest-resolution-"]) {
        try {terminal.push(JSON.parse(await readFile(path.join(directory, `${prefix}${suffix}`), "utf8")));} catch (error) {if (error.code !== "ENOENT") throw error;}
      }
      if (!terminal.some(item => ["accepted", "confirmed-absent"].includes(item.status ?? item.state ?? item.outcome))) {
        throw new Error("Reconcile the Reddit playtest before relocating its release state");
      }
    }
  }
}

for (const [target, facts] of Object.entries(webBuildFacts)) await add(`builds/${target}`, facts.outputDirectory);
for (const target of Object.keys(webBuildFacts)) await add(`dist-${target}`, `${getWebBuildPaths(target).buildDirectory}/legacy/dist-${target}`);
const artifacts = new Map([
  ["build.zip", "jest"], ["build-youtube.zip", "youtube"],
  ["build-youtube.manifest.json", "youtube"], ["build-youtube.test-report.json", "youtube"],
  ["build-gamesnacks.zip", "gamesnacks"], ["build-gamesnacks.zip.manifest.json", "gamesnacks"],
  ["build-html5.zip", "netflix"], ["build-html5.zip.source.json", "netflix"], ["build-html5.sha256", "netflix"],
]);
for (const definition of releaseRegistry.filter(item => item.artifact)) {
  artifacts.set(definition.artifact, definition.target);
  artifacts.set(`${definition.artifact}.manifest.json`, definition.target);
}
for (const [filename, target] of artifacts) await add(filename, `${getWebBuildPaths(target).buildDirectory}/${filename}`);
for (const [source, target, name] of [
  [".jest-upload-receipts", "jest", ".jest-upload-receipts"],
  ["platforms/web/jest/.jest-upload-receipts", "jest", ".jest-upload-receipts"],
  [".jest-release-workspaces", "jest", ".jest-release-workspaces"],
  ["platforms/web/reddit/.reddit-release-receipts", "reddit", ".reddit-release-receipts"],
]) {
  if (name.includes("receipts") && !name.includes("setup")) await verifyReceipts(path.join(root, source), target);
  await add(source, `${getWebBuildPaths(target).buildDirectory}/${name}`);
}
await add("platforms/web/reddit/dist", `${getWebBuildPaths("reddit").buildDirectory}/devvit`);
await add("platforms/web/reddit/build-reddit.zip", `${getWebBuildPaths("reddit").buildDirectory}/build-reddit.zip`);
if (await exists(path.join(root, "builds"))) {
  for (const name of await readdir(path.join(root, "builds"))) {
    const match = /^([a-z]+)-[a-f0-9]+\.zip$/u.exec(name);
    if (match && webBuildFacts[match[1]]) await add(`builds/${name}`, `${getWebBuildPaths(match[1]).buildDirectory}/legacy/${name}`);
  }
}
const inventoryDirectory = path.join(root, "artifacts/target-dependencies");
if (await exists(inventoryDirectory)) {
  for (const target of Object.keys(webBuildFacts)) await add(`artifacts/target-dependencies/${target}.json`, `${getWebBuildPaths(target).buildDirectory}/evidence/target-dependencies.json`);
  async function customInventories(directory) {
    if (!await exists(directory)) return;
    for (const entry of await readdir(directory, {withFileTypes:true})) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await customInventories(filename);
      else if (entry.isFile() && entry.name.endsWith(".json") && webBuildFacts[entry.name.slice(0, -5)]) {
        const target = entry.name.slice(0, -5);
        await add(path.relative(root, filename), `${getWebBuildPaths(target).buildDirectory}/evidence/legacy-target-dependencies/${path.relative(inventoryDirectory, filename)}`);
      }
    }
  }
  await customInventories(path.join(inventoryDirectory, "custom"));
}

console.log(JSON.stringify({apply, moves:moves.map(({source,destination}) => ({source,destination}))}, null, 2));
if (apply && moves.length) {
  const lockPath = path.join(root, ".game-build-migration.lock");
  const lock = await open(lockPath, "wx", 0o600);
  try {
    for (const move of moves) {
      await mkdir(path.dirname(move.to), {recursive:true});
      if (await exists(move.to)) throw new Error(`Build destination appeared during migration: ${move.destination}`);
      await moveWithoutReplacement("/usr/bin/mv", ["--update=none-fail", "--no-copy", "--no-target-directory", "--", move.from, move.to]);
    }
    for (const directory of [inventoryDirectory, path.join(root, "builds")]) {
      try {await rmdir(directory);} catch (error) {if (!["ENOTEMPTY", "ENOENT"].includes(error.code)) throw error;}
    }
  } finally {await lock.close();await unlink(lockPath);}
  console.log(`Moved ${moves.length} game build paths without replacing file contents.`);
}
