import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("the isolated runner downloads and pins the Codex executable without npm", async () => {
  const source = await readFile(new URL("../worker/repair.mjs", import.meta.url), "utf8");
  assert.match(source, /codex-\d+\.\d+\.\d+-linux-x64\.tgz/u);
  assert.match(source, /run\(codexExecutable, \["exec"/u);
  assert.match(source, /\["login", "--with-api-key"\]/u);
  assert.match(source, /input: env\.OPENAI_API_KEY/u);
  assert.match(source, /"-C", "\."/u);
  assert.doesNotMatch(source, /CODEX_HOME/u);
  assert.doesNotMatch(source, /run\("npx"/u);
  assert.doesNotMatch(source, /run\("codex"/u);
});
