/* eslint-disable @typescript-eslint/no-require-imports -- Rebuilds isolated compiled benchmark inputs. */
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {createHash} = require("node:crypto");
const {spawnSync} = require("node:child_process");
const repository = path.resolve(__dirname, "../..");
const functions = path.join(repository, "firebase-functions");
const evidence = path.join(repository, "artifacts/performance-current-20261019/backend");

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "rq-live-race-variants-"));
  const originalConfig = JSON.parse(await fs.readFile(path.join(functions, "tsconfig.json"), "utf8"));
  const sourceHashes = new Map((await fs.readFile(path.join(evidence, "baseline-hashes.txt"), "utf8")).trim().split("\n")
    .map(line => {const [hash, file] = line.split("  "); return [path.basename(file), hash];}));
  const manifest = {directory: temporary, nodeVersion: process.version, variants: {}};
  for (const side of ["baseline", "candidate"]) {
    const directory = path.join(temporary, side);
    await fs.cp(path.join(functions, "src"), path.join(directory, "src"), {recursive: true});
    await fs.symlink(path.join(functions, "node_modules"), path.join(directory, "node_modules"), "dir");
    if (side === "baseline") for (const filename of ["raceLiveQueue.ts", "raceLiveService.ts"]) {
      const source = await fs.readFile(path.join(evidence, "baseline-source", `${filename}.before`));
      if (createHash("sha256").update(source).digest("hex") !== sourceHashes.get(filename)) throw Error(`Baseline snapshot mismatch: ${filename}`);
      await fs.writeFile(path.join(directory, "src/race", filename), source);
    }
    const compilerOptions = {...originalConfig.compilerOptions,
      paths: Object.fromEntries(Object.entries(originalConfig.compilerOptions.paths).map(([key, paths]) =>
        [key, paths.map(target => path.resolve(functions, target))]))};
    await fs.writeFile(path.join(directory, "tsconfig.json"), JSON.stringify({...originalConfig, compilerOptions}));
    const compiled = spawnSync(path.join(functions, "node_modules/.bin/tsc"), ["-p", path.join(directory, "tsconfig.json")],
      {cwd: directory, encoding: "utf8"});
    if (compiled.status !== 0) throw Error(`Isolated ${side} compilation failed: ${compiled.stdout}\n${compiled.stderr}`);
    const hashes = {};
    for (const filename of ["raceLiveQueue.js", "raceLiveService.js"]) hashes[filename] =
      createHash("sha256").update(await fs.readFile(path.join(directory, "lib/race", filename))).digest("hex");
    manifest.variants[side] = {lib: path.join(directory, "lib"), hashes};
  }
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}
main().catch(error => {process.stderr.write(`${error.stack}\n`); process.exitCode = 1;});
