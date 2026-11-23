import assert from "node:assert/strict";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {FIXTURE_TYPES, createRedditContractFixture} from "./reddit-contract-fixture.mjs";
import {validateRedditContractFixtureDirectory} from "./validate-reddit-contract-fixtures.mjs";

test("requires sanitized provenance-bound fixtures for every hosted contract", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "reddit-contracts-"));
  try {
    await assert.rejects(validateRedditContractFixtureDirectory(directory), /missing-reddit-contract-fixtures/u);
    let index = 0;
    for (const type of FIXTURE_TYPES) {
      const fixture = createRedditContractFixture({type, capturedAt: "2026-08-20T20:00:00.000Z",
        sourceSha256: (++index).toString(16).padStart(64, "0"), payload: {kind: type}});
      await writeFile(path.join(directory, `${type}.json`), JSON.stringify(fixture));
    }
    assert.deepEqual(await validateRedditContractFixtureDirectory(directory), {files: 6, types: 6});
  } finally { await rm(directory, {recursive: true, force: true}); }
});
