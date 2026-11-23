import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const redditPackage = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const rootPackage = JSON.parse(await readFile(new URL("../../../../package.json", import.meta.url), "utf8"));
const productionWorkflow = await readFile(
  new URL("../../../../.github/workflows/production-readiness.yml", import.meta.url),
  "utf8",
);

test("the trusted Reddit server builds Core before resolving its generated package exports", () => {
  assert.match(redditPackage.scripts["prebuild:server"], /@riddle-quest\/core build/u);
});

test("workspace build and verification assemble the trusted Reddit package from the isolated client", () => {
  for (const script of [rootPackage.scripts.build, rootPackage.scripts["build:web"], rootPackage.scripts["verify:all-targets"]]) {
    assert.match(script, /@riddle-quest\/reddit-app build:package:from-client/u);
  }
  assert.match(productionWorkflow, /@riddle-quest\/reddit-app build:package:from-client/u);
  assert.doesNotMatch(redditPackage.scripts["build:package:from-client"], /build:client/u);
});

test("the Reddit server build replaces its target directory instead of retaining stale release files", async () => {
  const {default: config} = await import("../vite.config.ts");
  assert.equal(config.build?.outDir, "dist/server");
  assert.equal(config.build?.emptyOutDir, true);
});
