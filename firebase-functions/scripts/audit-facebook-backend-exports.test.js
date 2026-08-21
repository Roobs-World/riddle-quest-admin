"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  EXPECTED_FACEBOOK_EXPORTS,
  auditFacebookBackendExports,
  readExportNames,
} = require("./audit-facebook-backend-exports");

const exportBlock = (names) => `export {\n  ${names.join(",\n  ")},\n};`;

test("accepts the complete Facebook Functions surface", () => {
  assert.deepEqual(auditFacebookBackendExports(exportBlock(EXPECTED_FACEBOOK_EXPORTS)), []);
});

test("rejects every omitted callable or trigger", () => {
  for (const omitted of EXPECTED_FACEBOOK_EXPORTS) {
    const failures = auditFacebookBackendExports(exportBlock(
      EXPECTED_FACEBOOK_EXPORTS.filter((name) => name !== omitted),
    ));
    assert.deepEqual(failures, [`Missing Facebook backend export: ${omitted}`]);
  }
});

test("rejects duplicate exports and understands aliases", () => {
  const duplicate = exportBlock([...EXPECTED_FACEBOOK_EXPORTS, EXPECTED_FACEBOOK_EXPORTS[0]]);
  assert.match(auditFacebookBackendExports(duplicate).at(-1), /Duplicate Functions exports/);
  assert.deepEqual(readExportNames("export { internalName as publicName };"), ["publicName"]);
});

test("accepts the repository entry point", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/index.ts"), "utf8");
  assert.deepEqual(auditFacebookBackendExports(source), []);
});
