import assert from "node:assert/strict";
import {readFile, readdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

/** Measurement outputs stay outside every canonical provider artifact. */
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const portal = path.join(repository, "packages/portal");
const {build} = await import(path.join(portal, "node_modules/vite/dist/node/index.js"));
const {createWebTargetViteConfig} = await import(path.join(portal, "webTargetViteConfig.ts"));
const snapshots = [];
/** Enumerates actual emitted bytes rather than relying on the bundler's rounded report. */
async function files(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const relative = path.join(prefix, entry.name);
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(file, relative));
    else result.push({relative, file, bytes: (await stat(file)).size});
  }
  return result;
}
for (const enabled of [false, true]) {
  const output = `/tmp/riddle-quest-shader-packaging-${enabled ? "compact" : "baseline"}`;
  const config = createWebTargetViteConfig({command: "build", mode: "jest",
    environment: {...process.env, JEST_BUILD_OUT_DIR: output}});
  if (!enabled) config.plugins = config.plugins.filter(plugin => plugin?.name !== "riddle-quest-jest-shader-indentation");
  await build({...config, root: portal, mode: "jest", configFile: false, logLevel: "error"});
  const emitted = await files(output);
  snapshots.push({output, enabled, bytes: emitted.reduce((sum, file) => sum + file.bytes, 0), files: emitted});
}
for (const file of snapshots[0].files.filter(file => /\.(?:png|webp|svg|woff2|webm|txt|css)$/.test(file.relative))) {
  const counterpart = snapshots[1].files.find(candidate => candidate.relative === file.relative);
  assert.ok(counterpart, file.relative);
  assert.deepEqual(await readFile(counterpart.file), await readFile(file.file), file.relative);
}
const summary = {baseline: {output: snapshots[0].output, bytes: snapshots[0].bytes, files: snapshots[0].files.length},
  compact: {output: snapshots[1].output, bytes: snapshots[1].bytes, files: snapshots[1].files.length},
  savedBytes: snapshots[0].bytes - snapshots[1].bytes, requiredSavings: 7239,
  belowReleaseBudget: snapshots[1].bytes <= 4.5 * 1024 * 1024,
  unchangedBinaryAssetsStylesAndLicenses: true};
await writeFile(new URL("./shader-packaging-results.json", import.meta.url), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
assert.ok(summary.savedBytes >= summary.requiredSavings);
assert.equal(summary.belowReleaseBudget, true);
