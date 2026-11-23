/* eslint-disable @typescript-eslint/no-require-imports -- Node launcher scripts use CommonJS. */
"use strict";
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {spawn} = require("node:child_process");

/** Each emulator invocation owns its Storage blobs and hub locator files. */
async function run(args, cliPath = require.resolve("firebase-tools/lib/bin/firebase.js")) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "riddle-quest-emulators-"));
  process.stderr.write(`Emulator temporary directory: ${directory}\n`);
  let child;
  let interrupted;
  const forward = signal => {
    interrupted = signal;
    child?.kill(signal);
  };
  const onInterrupt = () => forward("SIGINT");
  const onTerminate = () => forward("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
  try {
    child = spawn(process.execPath, [cliPath, ...args], {
      stdio: "inherit", env: {...process.env, TMPDIR: directory, TMP: directory, TEMP: directory},
    });
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (status, signal) => resolve(status ?? (signal === "SIGINT" ? 130 : 143)));
    });
    if (code === 0 && !interrupted) await fs.rm(directory, {recursive: true, force: true});
    else process.stderr.write(`Emulator temporary files retained after unsuccessful exit: ${directory}\n`);
    return interrupted ? (interrupted === "SIGINT" ? 130 : 143) : code;
  } catch (error) {
    process.stderr.write(`Emulator temporary files retained after launcher failure: ${directory}\n`);
    throw error;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
  }
}
module.exports = {run};
if (require.main === module) run(process.argv.slice(2)).then(code => {process.exitCode = code;}).catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
