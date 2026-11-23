"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {parseOptions} = require("./races/race-match-calibration");

test("requires one explicit source and validates mode before any backend access", () => {
  for (const args of [[], ["--input", "a", "--project", "p"], ["--input", "a", "--mode", "apply"], ["--apply", "yes"],
    ["--input", "a", "--input", "b"], ["--input"], ["--input", "a", "--limit", "2"]]) assert.throws(() => parseOptions(args));
  assert.deepEqual(parseOptions(["--input", "sample.json", "--mode", "compare"]), {mode: "compare", input: "sample.json"});
});
test("live reads require a bounded interval and never allow comparisons or writes", () => {
  const args = ["--project", "demo", "--from-ms", "0", "--to-ms", "100"];
  assert.deepEqual(parseOptions(args), {mode: "outcomes", projectId: "demo", fromMs: 0, toMs: 100, limit: 500});
  for (const suffix of [["--limit", "501"], ["--limit", "0"], ["--limit", "1.5"], ["--mode", "compare"]]) assert.throws(() => parseOptions([...args, ...suffix]));
  for (const bad of [["--project", "demo"], ["--project", "demo", "--from-ms", "100", "--to-ms", "1"],
    ["--project", "demo", "--from-ms", "-1", "--to-ms", "10"]]) assert.throws(() => parseOptions(bad));
});
