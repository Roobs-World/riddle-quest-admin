import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("the isolated runner installs and pins the Codex CLI", async () => {
  const source = await readFile(new URL("../worker/repair.mjs", import.meta.url), "utf8");
  assert.match(source, /"npx", \["--yes", "@openai\/codex@\d+\.\d+\.\d+"/u);
  assert.doesNotMatch(source, /run\("codex"/u);
});
