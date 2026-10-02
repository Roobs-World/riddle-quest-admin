import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const script = fileURLToPath(new URL("./validate-w3c.mjs", import.meta.url));
const check = html => {
  const directory = mkdtempSync(path.join(tmpdir(), "rq-html-check-"));
  try {
    const file = path.join(directory, "index.html");
    writeFileSync(file, html);
    return spawnSync(process.execPath, [script, file], {cwd: packageDirectory, encoding: "utf8"});
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
};

test("pinned Nu accepts a conforming document without a remote service", () => {
  const result = check('<!doctype html><html lang="en"><head><title>Game</title></head><body><main>Game</main></body></html>');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /zero findings \(pinned Nu 26\.9\.30/);
});

test("HTML errors remain a blocking release finding", () => {
  const result = check('<!doctype html><html lang="en"><head></head><body><img src="a.png"></body></html>');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /W3C HTML validation reported/);
});

test("warnings also block even when the checker exits successfully", () => {
  const result = check('<!doctype html><html><head><title>Game</title></head><body><main>Game</main></body></html>');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /W3C HTML validation reported/);
});
