import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";
import {developmentSourceDigest} from "../../../scripts/release/development-source-digest.mjs";

const portal = fileURLToPath(new URL("..", import.meta.url));
const repository = path.resolve(portal, "../..");
const sourceDigest = await developmentSourceDigest(repository);
const cacheKey = createHash("sha256").update(repository).update(sourceDigest).digest("hex");
const cache = path.join(tmpdir(), `riddle-quest-retained-race-${cacheKey}`);
const directory = path.join(cache, "dist");
const receiptFile = path.join(cache, "receipt.json");
const inventoryKey = createHash("sha256").update(directory).digest("hex");
const inventoryFile = path.join(repository, "artifacts/target-dependencies/custom", inventoryKey, "jest.json");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

async function verifyInventory() {
  const bytes = await readFile(inventoryFile);
  const inventory = JSON.parse(bytes);
  if (inventory.target !== "jest" || inventory.outputDirectory !== directory ||
      !inventory.modules.includes("packages/portal/scripts/fixtures/RetainedRaceHarness.tsx"))
    throw new Error("Retained race test artifact has no matching isolated dependency inventory");
  for (const file of inventory.files) {
    const relative = path.relative(directory, path.resolve(directory, file.file));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative) ||
        sha(await readFile(path.join(directory, relative))) !== file.sha256)
      throw new Error("Retained race test artifact bytes differ from their inventory");
  }
  return sha(bytes);
}
let receipt;
try {
  const prior = JSON.parse(await readFile(receiptFile, "utf8"));
  if (prior.sourceDigest === sourceDigest && prior.directory === directory &&
      prior.inventorySha256 === await verifyInventory()) receipt = prior;
} catch (error) {
  if (error.code !== "ENOENT") process.stderr.write(`Retained test artifact will be rebuilt: ${error.message}\n`);
}
if (!receipt) {
  await mkdir(cache, {recursive: true});
  const result = await promisify(execFile)("pnpm", ["exec", "vite", "build", "--config", "scripts/retained-race-test.vite.config.ts", "--mode", "jest"], {
    cwd: portal, maxBuffer: 32 * 1024 * 1024, timeout: 180_000,
    env: {...process.env, DEBUG: "", NODE_ENV: "production", VITE_JEST_RUNTIME: "1", SENTRY_UPLOAD_SOURCEMAPS: "0", RETAINED_RACE_BUILD_DIR: directory},
  });
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (await developmentSourceDigest(repository) !== sourceDigest) throw new Error("Source changed during retained artifact build");
  receipt = {sourceDigest, directory, inventoryFile, inventorySha256: await verifyInventory()};
  await writeFile(receiptFile, JSON.stringify(receipt, null, 2) + "\n");
}
console.log(JSON.stringify(receipt));
