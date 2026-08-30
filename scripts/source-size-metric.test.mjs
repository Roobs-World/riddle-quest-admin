import assert from "node:assert/strict";
import test from "node:test";

import {measureSourceSize} from "./source-size-metric.mjs";

test("measures equivalent TypeScript identically across formatting", () => {
  const compact = "const answer = {first: 1, second: 2};";
  const expanded = `const answer = {
    first: 1,
    second: 2,
  };`;

  assert.equal(measureSourceSize(compact, ".ts"), measureSourceSize(expanded, ".ts"));
});

test("excludes standalone single-line and multiline TSDoc", () => {
  const implementation = "const answer = 42;";
  const documented = `/** Stores the answer. */
/**
 * Explains why the answer is useful.
 */
${implementation}`;

  assert.equal(measureSourceSize(documented, ".ts"), measureSourceSize(implementation, ".ts"));
});

test("retains implementation following a multiline TSDoc closing delimiter", () => {
  const implementation = "const answer = 42;";
  const documented = `/**
 * Stores the answer.
 */ ${implementation}`;

  assert.equal(measureSourceSize(documented, ".ts"), measureSourceSize(implementation, ".ts"));
});

test("keeps physical line counts for non-TypeScript source", () => {
  assert.equal(measureSourceSize("a {}\nb {}", ".css"), 2);
});
