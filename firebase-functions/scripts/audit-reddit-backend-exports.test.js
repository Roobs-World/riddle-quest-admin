"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {EXPECTED_REDDIT_EXPORTS, auditRedditBackendExports} = require("./audit-reddit-backend-exports");

const exportBlock = (names) => `export {\n  ${names.join(",\n  ")},\n};`;

test("accepts the complete Reddit Functions surface", () => {
  assert.deepEqual(auditRedditBackendExports(exportBlock(EXPECTED_REDDIT_EXPORTS)), []);
});

test("rejects every omitted Reddit endpoint", () => {
  for (const omitted of EXPECTED_REDDIT_EXPORTS) {
    assert.deepEqual(
      auditRedditBackendExports(exportBlock(EXPECTED_REDDIT_EXPORTS.filter((name) => name !== omitted))),
      [`Missing Reddit backend export: ${omitted}`],
    );
  }
});

test("accepts the repository entry point", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/index.ts"), "utf8");
  assert.deepEqual(auditRedditBackendExports(source), []);
});
