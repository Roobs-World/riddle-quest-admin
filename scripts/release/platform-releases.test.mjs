import assert from "node:assert/strict";
import {spawn, spawnSync} from "node:child_process";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {fileURLToPath} from "node:url";
import path from "node:path";
import test from "node:test";
import {
  formatPlatformReleasePlan,
  getPlatformReleasePlan,
  listPlatformReleasePlans,
  runPlatformRelease,
} from "./platform-releases.mjs";

/** Identifies the post-adapter browser gameplay gate in recorded invocations. */
const isEndToEndGate = ({args}) => args[0] === "scripts/release/verify-packaged-games.mjs" || args.at(-1) === "test:reddit:playwright";

test("dry runs describe a target without invoking its adapter", async () => {
  const lines = [];
  let invoked = false;
  const result = await runPlatformRelease("jest", {
    dryRun: true,
    commandRunner: async () => { invoked = true; },
    log: (line) => lines.push(line),
  });
  assert.equal(invoked, false);
  assert.deepEqual(result, {target: "jest", status: "planned", boundary: "remote-active-on-ready"});
  assert.match(lines.join("\n"), /no build, upload, package, or publish action/u);
});

test("the canonical Jest adapter refuses ambient overrides of its fixed activation policy", async () => {
  for (const environment of [
    {JEST_UPLOAD_IS_ACTIVE: "true", JEST_CONFIRM_ACTIVATION: "game-id"},
    {JEST_UPLOAD_IS_ACTIVE: "false"},
    {JEST_CONFIRM_ACTIVATION: "game-id"},
  ]) {
    let invoked = false;
    await assert.rejects(runPlatformRelease("jest", {
      environment,
      commandRunner: async () => { invoked = true; },
      log: () => {},
    }), /activation-without-publication contract/u);
    assert.equal(invoked, false);
  }
});

test("the CLI rejects extra stages and supports a read-only plan", () => {
  const cli = fileURLToPath(new URL("./run-platform-release.mjs", import.meta.url));
  const environment = {...process.env};
  delete environment.NODE_TEST_CONTEXT;
  const plan = spawnSync(process.execPath, [cli, "jest", "--dry-run"], {encoding: "utf8", env: environment});
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /remote-active-on-ready/u);
  assert.match(plan.stdout, /no build, upload, package, or publish action/u);

  const rejected = spawnSync(process.execPath, [cli, "reddit", "publish"], {encoding: "utf8", env: environment});
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Unsupported release arguments: publish/u);
});

test("formatted plans always disclose command, effect, handoff, and runbook", () => {
  const text = formatPlatformReleasePlan(getPlatformReleasePlan("jest"));
  for (const label of ["Boundary:", "Action:", "External effect:", "Command:", "Handoff:", "Runbook:"]) {
    assert.match(text, new RegExp(label, "u"));
  }
  assert.doesNotMatch(text, /release:jest:timestamped/u);
});

test("the process adapter forwards termination and awaits child teardown", {timeout: 5_000}, async (context) => {
  if (process.platform === "win32") return;
  const directory = await mkdtemp(path.join(tmpdir(), "rq-release-signal-"));
  context.after(() => rm(directory, {recursive: true, force: true}));
  const markerPath = path.join(directory, "child-terminated");
  const moduleUrl = new URL("./platform-releases.mjs", import.meta.url).href;
  const childSource = [
    "const fs = require('node:fs');",
    "process.on('SIGTERM', () => {",
    "  fs.writeFileSync(process.env.RELEASE_SIGNAL_MARKER, 'terminated');",
    "  setTimeout(() => process.exit(0), 20);",
    "});",
    "console.log('release-child-ready');",
    "setInterval(() => {}, 1000);",
  ].join("\n");
  const runnerSource = [
    `import {runReleaseCommand} from ${JSON.stringify(moduleUrl)};`,
    "try {",
    `  await runReleaseCommand({executable: process.execPath, args: ["--eval", ${JSON.stringify(childSource)}], environment: {...process.env, RELEASE_SIGNAL_MARKER: ${JSON.stringify(markerPath)}}});`,
    "} catch (error) {",
    "  process.exitCode = error.exitCode ?? 1;",
    "}",
  ].join("\n");
  const environment = {...process.env};
  delete environment.NODE_TEST_CONTEXT;
  const runner = spawn(process.execPath, ["--input-type=module", "--eval", runnerSource], {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const result = await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let signalled = false;
    const timeout = setTimeout(() => {
      runner.kill("SIGKILL");
      reject(new Error(`release runner did not stop after SIGTERM; stdout=${stdout} stderr=${stderr}`));
    }, 3_000);
    runner.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!signalled && stdout.includes("release-child-ready")) {
        signalled = true;
        runner.kill("SIGTERM");
      }
    });
    runner.stderr.on("data", (chunk) => { stderr += chunk; });
    runner.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    runner.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({code, signal, stdout, stderr, signalled});
    });
  });
  assert.equal(result.signalled, true, result.stderr);
  assert.deepEqual({code: result.code, signal: result.signal}, {code: 143, signal: null});
  assert.equal(await readFile(markerPath, "utf8"), "terminated");
});
