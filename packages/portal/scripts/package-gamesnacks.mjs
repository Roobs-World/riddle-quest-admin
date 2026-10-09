#!/usr/bin/env node
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {copyFile, mkdir, readFile, readdir, stat, unlink, writeFile} from "node:fs/promises";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import path from "node:path";

const execute = promisify(execFile);
const portal = fileURLToPath(new URL("..", import.meta.url));
const repository = fileURLToPath(new URL("../../..", import.meta.url));
const output = path.join(portal, "../../builds/gamesnacks");

async function filesBelow(root, directory = root) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(root, candidate));
    else files.push(path.relative(root, candidate).split(path.sep).join("/"));
  }
  return files;
}

await mkdir(path.join(output, "marketing"), {recursive: true});
await copyFile(path.join(repository, "docs/facebook-assets/icon-1024.png"), path.join(output, "marketing/icon.png"));
await copyFile(path.join(repository, "docs/jest-assets/riddle-quest-hero.png"), path.join(output, "marketing/horizontal.png"));
await copyFile(path.join(repository, "docs/visual-parity/current/05-game.png"), path.join(output, "marketing/vertical.png"));

const allFiles = (await filesBelow(output)).filter((file) => file !== "game.json");
let totalBytes = 0;
for (const file of allFiles) {
  if (file !== file.toLowerCase() || /[^a-z0-9._/-]/u.test(file)) throw new Error(`GameSnacks filename is invalid: ${file}`);
  const bytes = (await stat(path.join(output, file))).size;
  totalBytes += bytes;
  if (bytes >= 10 * 1024 * 1024) throw new Error(`GameSnacks file exceeds 10 MiB: ${file}`);
}
if (totalBytes >= 100 * 1024 * 1024) throw new Error("GameSnacks bundle exceeds 100 MiB");
const runtimeFiles = allFiles.filter((file) => !file.startsWith("marketing/"));
const runtimeText = (await Promise.all(runtimeFiles.filter((file) => /\.(?:html|js|css|json)$/u.test(file))
  .map((file) => readFile(path.join(output, file), "utf8")))).join("\n");
if (!runtimeText.includes("GameSnacks")) throw new Error("GameSnacks SDK adapter is absent from the bundle");
for (const [label, pattern] of [
  ["Firebase", /firebaseio\.com|cloudfunctions\.net|\bfirebase(?:app|auth|firestore|functions|storage)\b/iu],
  ["Facebook", /connect\.facebook\.net|\bFBInstant\b/iu],
  ["Reddit", /\bdevvit(?:-internal)?\b/iu],
  ["YouTube", /youtube\.com\/game_api|\bytgame\b/iu],
  ["commerce", /\b(?:purchaseAsync|checkout|IAP)\b/iu],
]) {
  if (pattern.test(runtimeText)) throw new Error(`${label} integration found in GameSnacks bundle`);
}
const manifest = {
  name: "Riddle Quest",
  version: process.env.GITHUB_SHA?.slice(0, 12) || "1.0.0",
  description: "Crack colour clues, solve word riddles and build your daily streak.",
  genres: ["Puzzle", "Trivia", "Word"],
  developer: {name: "Roobs World", logo: [{size: {width: 1024, height: 1024}, src: "marketing/icon.png"}]},
  publisher: {name: "Roobs World"},
  marketingAssets: {
    horizontalBanners: [{size: {width: 1280, height: 720}, src: "marketing/horizontal.png"}],
    verticalBanners: [{size: {width: 540, height: 1170}, src: "marketing/vertical.png"}],
    screenshots: [{size: {width: 540, height: 1170}, src: "marketing/vertical.png"}],
    gameIcons: [{size: {width: 1024, height: 1024}, src: "marketing/icon.png"}],
  },
  privacyPolicyUrl: "https://www.roobsworld.com/privacy",
  aboutUrl: "https://www.roobsworld.com",
  allowOfflineUse: true,
  entrypoint: "index.html",
  files: runtimeFiles,
  orientation: "Any",
  supportsLowEndDevices: false,
};
await writeFile(path.join(output, "game.json"), `${JSON.stringify(manifest, null, 2)}\n`);
// Provider metadata and marketing are added after Vite; bind them to the same
// inventory while proving every previously audited runtime byte is unchanged.
const inventoryPath = path.join(
  process.env.RIDDLE_QUEST_TARGET_DEPENDENCY_EVIDENCE_DIR ?? path.join(repository, "artifacts/target-dependencies"),
  "gamesnacks.json",
);
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
for (const row of inventory.files) {
  const hash = createHash("sha256").update(await readFile(path.join(output, row.file))).digest("hex");
  if (hash !== row.sha256) throw new Error(`Changed audited GameSnacks runtime: ${row.file}`);
}
const metadataFiles = new Set(["game.json", "marketing/icon.png", "marketing/horizontal.png", "marketing/vertical.png"]);
const packagedFiles = (await filesBelow(output)).sort();
for (const file of packagedFiles) {
  if (!inventory.files.some(row => row.file === file) && !metadataFiles.has(file)) throw new Error(`Untracked GameSnacks package file: ${file}`);
}
inventory.files = await Promise.all(packagedFiles.map(async file => ({file,
  sha256: createHash("sha256").update(await readFile(path.join(output, file))).digest("hex")})));
await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
const archivePath = path.join(repository, "build-gamesnacks.zip");
await unlink(archivePath).catch((error) => {
  if (error?.code !== "ENOENT") throw error;
});
await execute("zip", ["-q", "-r", archivePath, "."], {cwd: output});
const archive = await readFile(archivePath);
await writeFile(path.join(repository, "build-gamesnacks.zip.manifest.json"), `${JSON.stringify({
  schemaVersion: 1,
  platform: "gamesnacks",
  artifact: "build-gamesnacks.zip",
  sha256: createHash("sha256").update(archive).digest("hex"),
  releaseBoundary: "GameSnacks licensing and authenticated Developer Console submission remain manual.",
}, null, 2)}\n`);
console.log(`Prepared GameSnacks bundle with ${runtimeFiles.length} runtime files.`);
