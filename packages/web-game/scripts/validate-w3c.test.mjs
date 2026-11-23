import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import test from "node:test";

const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const checkerVersion = createRequire(new URL("../package.json", import.meta.url))("vnu-jar/package.json").version;
const script = fileURLToPath(new URL("./validate-w3c.mjs", import.meta.url));
const check = (html, env = process.env) => {
  const directory = mkdtempSync(path.join(tmpdir(), "rq-html-check-"));
  try {
    const file = path.join(directory, "index.html");
    writeFileSync(file, html);
    return spawnSync(process.execPath, [script, file], {cwd: packageDirectory, encoding: "utf8", env});
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
};

test("pinned Nu accepts a conforming document without a remote service", () => {
  const result = check('<!doctype html><html lang="en"><head><title>Game</title></head><body><main>Game</main></body></html>');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`zero findings \\(pinned Nu ${checkerVersion.replaceAll(".", "\\.")}\\b`));
});

test("a JVM options banner does not break the diagnostic report", () => {
  const result = check('<!doctype html><html lang="en"><head><title>Game</title></head><body><main>Game</main></body></html>',
    {...process.env, JAVA_TOOL_OPTIONS: "-Dfile.encoding=UTF-8"});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /zero findings/);
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

test("a finding in a later target blocks the entire batch and identifies the document", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "rq-html-batch-"));
  try {
    const valid = path.join(directory, "valid.html");
    const invalid = path.join(directory, "invalid.html");
    writeFileSync(valid, '<!doctype html><html lang="en"><head><title>Game</title></head><body><main>Game</main></body></html>');
    writeFileSync(invalid, '<!doctype html><html lang="en"><head><title>Game</title></head><body><div aria-label="Coins">1</div></body></html>');
    const result = spawnSync(process.execPath, [script, valid, invalid], {cwd: packageDirectory, encoding: "utf8"});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid\.html/);
    assert.match(result.stderr, /aria-label/);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test("the default gate requires all six artifacts in the repository builds folder", () => {
  const repository = mkdtempSync(path.join(tmpdir(), "rq-html-targets-"));
  try {
    const portal = path.join(repository, "packages/web-game");
    mkdirSync(portal, {recursive: true});
    writeFileSync(path.join(portal, "package.json"), "{}");
    symlinkSync(path.join(packageDirectory, "node_modules"), path.join(portal, "node_modules"), "dir");
    for (const target of ["jest", "facebook", "reddit", "youtube", "netflix", "yahoo"]) {
      const directory = path.join(repository, "builds", target);
      mkdirSync(directory, {recursive: true});
      writeFileSync(path.join(directory, "index.html"), '<!doctype html><html lang="en"><head><title>Game</title></head><body><main>Game</main></body></html>');
      if (target === "reddit") writeFileSync(path.join(directory, "reddit-inline.html"), '<!doctype html><html lang="en"><head><title>Game</title></head><body><main>Play</main></body></html>');
    }
    const run = () => spawnSync(process.execPath, [script], {cwd: portal, encoding: "utf8"});
    const success = run();
    assert.equal(success.status, 0, success.stderr);
    assert.match(success.stdout, /builds\/yahoo\/index\.html/);
    assert.match(success.stdout, /builds\/reddit\/reddit-inline\.html/);
    rmSync(path.join(repository, "builds/yahoo/index.html"));
    assert.notEqual(run().status, 0, "A missing candidate artifact must block the full gate");
  } finally {
    rmSync(repository, {recursive: true, force: true});
  }
});
