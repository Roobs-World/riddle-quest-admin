/* eslint-disable @typescript-eslint/no-require-imports -- Node launcher scripts use CommonJS. */
"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {run} = require("./run-isolated-emulators");

test("concurrent launcher children own independent temporary storage and clean successful runs", async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "emulator-isolation-test-"));
  try {
    const cli = path.join(fixture, "child.cjs");
    await fs.writeFile(cli, `const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const own=os.tmpdir();if(own!==process.env.TMP||own!==process.env.TEMP)process.exit(2);
fs.mkdirSync(path.join(own,'firebase/storage/blobs'),{recursive:true});
fs.writeFileSync(path.join(own,'firebase/storage/blobs/shared-name'),process.argv[2]);
fs.writeFileSync(process.argv[3],own);
setTimeout(()=>{if(fs.readFileSync(path.join(own,'firebase/storage/blobs/shared-name'),'utf8')!==process.argv[2])process.exitCode=3;},100);`);
    const outputs = [path.join(fixture, "a"), path.join(fixture, "b")];
    assert.deepEqual(await Promise.all(outputs.map((output, index) => run([String(index), output], cli))), [0, 0]);
    const directories = await Promise.all(outputs.map(output => fs.readFile(output, "utf8")));
    assert.notEqual(directories[0], directories[1]);
    for (const directory of directories) await assert.rejects(fs.stat(directory), {code: "ENOENT"});
  } finally {await fs.rm(fixture, {recursive: true, force: true});}
});
test("failed launchers retain temporary data so surviving emulator workers are not disrupted", async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "emulator-isolation-test-"));
  let directory;
  try {
    const cli = path.join(fixture, "child.cjs"), output = path.join(fixture, "output");
    await fs.writeFile(cli, "require('node:fs').writeFileSync(process.argv[2],require('node:os').tmpdir());process.exitCode=2;");
    assert.equal(await run([output], cli), 2);
    directory = await fs.readFile(output, "utf8");
    assert.ok((await fs.stat(directory)).isDirectory());
  } finally {
    if (directory) await fs.rm(directory, {recursive: true, force: true});
    await fs.rm(fixture, {recursive: true, force: true});
  }
});

test("termination reaches the child and remains a failed invocation even after graceful child exit", async () => {
  const {spawn} = require("node:child_process");
  const {once} = require("node:events");
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "emulator-isolation-test-"));
  let directory, child;
  try {
    const cli = path.join(fixture, "child.cjs"), output = path.join(fixture, "output"), marker = path.join(fixture, "signal");
    await fs.writeFile(cli, `const fs=require('node:fs');fs.writeFileSync(process.argv[2],require('node:os').tmpdir());
process.on('SIGTERM',()=>{fs.writeFileSync(process.argv[3],'forwarded');process.exit(0);});console.log('READY');setInterval(()=>{},1000);`);
    child = spawn(process.execPath, ["-e", `require(${JSON.stringify(require.resolve("./run-isolated-emulators"))}).run(${JSON.stringify([output, marker])},${JSON.stringify(cli)}).then(code=>{process.exitCode=code;})`]);
    const terminal = once(child, "close");
    await new Promise((resolve, reject) => {
      child.stdout.on("data", data => {if (data.toString().includes("READY")) resolve();});
      child.once("error", reject);
      child.once("exit", () => reject(Error("Child exited before readiness")));
    });
    child.kill("SIGTERM");
    assert.equal((await terminal)[0], 143);
    assert.equal(await fs.readFile(marker, "utf8"), "forwarded");
    directory = await fs.readFile(output, "utf8");
    assert.ok((await fs.stat(directory)).isDirectory());
  } finally {
    if (child && child.exitCode === null) child.kill("SIGTERM");
    if (directory) await fs.rm(directory, {recursive: true, force: true});
    await fs.rm(fixture, {recursive: true, force: true});
  }
});
