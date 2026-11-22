import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import test from "node:test";

test("the real Sandbox SDK loads when the deployed runtime disables require of ESM", () => {
  const child = spawnSync(process.execPath, ["--no-experimental-require-module", "--input-type=module", "-e", `
    const {Sandbox} = await import('@vercel/sandbox');
    console.log(JSON.stringify({create: typeof Sandbox.create, writeFiles: typeof Sandbox.prototype.writeFiles, runCommand: typeof Sandbox.prototype.runCommand}));
  `], {cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 15_000});
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  assert.deepEqual(JSON.parse(child.stdout), {create: "function", writeFiles: "function", runCommand: "function"});
});
