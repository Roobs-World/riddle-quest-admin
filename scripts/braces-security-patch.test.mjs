import assert from "node:assert/strict";
import {readFileSync, realpathSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join, resolve} from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const devvit = realpathSync(join(root, "platforms/web/reddit/node_modules/devvit"));
const cli = createRequire(join(dirname(devvit), "@devvit/cli/package.json"));
const bracesEntry = createRequire(cli.resolve("chokidar")).resolve("braces");

function probe(source) {
  const childEnv = {...process.env};
  delete childEnv.NODE_TEST_CONTEXT;
  const child = spawnSync(process.execPath, ["-e", `
    const assert = require("node:assert/strict");
    const braces = require(${JSON.stringify(bracesEntry)});
    ${source}
  `], {encoding: "utf8", timeout: 2000, env: childEnv});
  assert.notEqual(child.error?.code, "ETIMEDOUT", "Brace processing exceeded safety timeout");
  assert.equal(child.signal, null, "Brace processing was terminated");
  assert.equal(child.status, 0, child.stderr || child.stdout);
}

test("deep brace and parenthesis input fails with a controlled depth error", () => probe(`
  for (const method of ["parse", "compile", "expand", "stringify"]) {
    for (const [open, close] of [["{", "}"], ["(", ")"]]) {
      const input = open.repeat(4000) + "a,b" + close.repeat(4000);
      assert.throws(() => braces[method](input), /exceeds max depth/, method);
    }
  }
`));

test("100 levels remain valid, 101 are rejected, and callers cannot relax the cap", () => probe(`
  for (const method of ["parse", "compile", "expand", "stringify"]) {
    for (const [open, close] of [["{", "}"], ["(", ")"]]) {
      const atLimit = open.repeat(100) + "a,b" + close.repeat(100);
      const tooDeep = open.repeat(101) + "a,b" + close.repeat(101);
      assert.doesNotThrow(() => braces[method](atLimit));
      for (const maxDepth of [undefined, 10000, Infinity, NaN]) {
        assert.throws(() => braces[method](tooDeep, {maxDepth}), /exceeds max depth/);
      }
      assert.throws(() => braces[method](open.repeat(2)+"a,b"+close.repeat(2), {maxDepth: 1.5}), /exceeds max depth/);
    }
  }
`));

test("caller-supplied ASTs cannot bypass depth protection", () => probe(`
  for (const method of ["compile", "expand", "stringify"]) {
    const ast = {type: "root", nodes: []};
    let parent = ast;
    for (let depth = 0; depth < 101; depth++) {
      const child = {type: "brace", nodes: [], commas: 1, parent};
      parent.nodes.push(child); parent = child;
    }
    parent.nodes.push({type: "text", value: "a"});
    assert.throws(() => braces[method](ast), /exceeds max depth/, method);
  }
`));

test("cyclic AST parent chains terminate", () => probe(`
  const ast = {type: "paren", nodes: [{type: "text", value: "a"}]};
  ast.parent = ast;
  assert.throws(() => braces.expand(ast), /parent chain contains a cycle/);
`));

test("ordinary glob compilation, ranges and escaping retain their behavior", () => probe(`
  assert.equal(braces.compile("{src,lib}/**/*.{ts,js}"), "(src|lib)/**/*.(ts|js)");
  assert.deepEqual(braces.expand("file-{01..03}.txt"), ["file-01.txt", "file-02.txt", "file-03.txt"]);
  assert.equal(braces.stringify("{a,b}", {escapeInvalid: true}), "{a,b}");
  assert.deepEqual(braces(["{a,b}", "{b,c}"], {expand: true, nodupes: true}), ["a", "b", "c"]);
`));

test("the audit exception is bound to the installed backport and required gate", () => {
  const config = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  const patch = readFileSync(join(root, "config/security-patches/braces@3.0.3.patch"), "utf8");
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.match(config, /braces@3\.0\.3: patches\/braces@3\.0\.3\.patch/u);
  assert.match(config, /GHSA-vfj7-8cjw-p6xm/u);
  assert.match(realpathSync(bracesEntry), /braces@3\.0\.3_patch_hash=/u);
  for (const file of ["parse", "compile", "expand", "stringify", "constants"])
    assert.match(patch, new RegExp(`diff --git a/lib/${file}\\.js`));
  assert.match(manifest.scripts["verify:production"], /^pnpm check:braces-security && pnpm audit/u);
});
