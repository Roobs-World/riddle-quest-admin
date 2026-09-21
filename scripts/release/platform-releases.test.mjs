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
  runAllPlatformReleases,
  runPlatformRelease,
} from "./platform-releases.mjs";

const expectedCommands = new Map([
  ["jest", ["--filter", "@qwordly/portal", "release:jest:timestamped"]],
  ["facebook", ["--filter", "@qwordly/portal", "release:facebook"]],
  ["youtube", ["--filter", "@qwordly/portal", "preflight:youtube-upload"]],
  ["reddit", ["--filter", "@qwordly/reddit-app", "release:candidate"]],
  ["netflix", ["build:netflix"]],
  ["yahoo", ["build:yahoo"]],
  ["gamesnacks", ["build:gamesnacks"]],
  ["itch", ["scripts/release/package-html5-platform.mjs", "itch"]],
  ["crazygames", ["scripts/release/package-html5-platform.mjs", "crazygames"]],
  ["newgrounds", ["scripts/release/package-html5-platform.mjs", "newgrounds"]],
  ["gamejolt", ["scripts/release/package-html5-platform.mjs", "gamejolt"]],
  ["coolmath", ["scripts/release/package-html5-platform.mjs", "coolmath"]],
  ["armor", ["scripts/release/package-html5-platform.mjs", "armor"]],
  ["gamepix", ["scripts/release/package-html5-platform.mjs", "gamepix"]],
  ["addictinggames", ["scripts/release/package-html5-platform.mjs", "addictinggames"]],
  ["htmlgames", ["scripts/release/package-html5-platform.mjs", "htmlgames"]],
  ["playkovo", ["scripts/release/package-html5-platform.mjs", "playkovo"]],
  ["kongregate", ["scripts/release/package-html5-platform.mjs", "kongregate"]],
  ["lagged", ["scripts/release/package-html5-platform.mjs", "lagged"]],
  ["gamedistribution", ["scripts/release/package-html5-platform.mjs", "gamedistribution"]],
  ["gamemonetize", ["scripts/release/package-html5-platform.mjs", "gamemonetize"]],
  ["yandex", ["scripts/release/package-html5-platform.mjs", "yandex"]],
  ["telegram", ["scripts/release/package-html5-platform.mjs", "telegram"]],
  ["microsoft-pwa", ["scripts/release/package-microsoft-pwa.mjs"]],
  ["y8", ["scripts/release/package-html5-platform.mjs", "y8"]],
  ["playgama", ["scripts/release/package-html5-platform.mjs", "playgama"]],
  ["amazon", ["scripts/release/package-html5-platform.mjs", "amazon"]],
  ["jiogames", ["scripts/release/package-html5-platform.mjs", "jiogames"]],
  ["famobi", ["scripts/release/package-html5-platform.mjs", "famobi"]],
  ["gamepush", ["scripts/release/package-html5-platform.mjs", "gamepush"]],
  ["softgames", ["scripts/release/package-html5-platform.mjs", "softgames"]],
  ["wgplayground", ["scripts/release/package-html5-platform.mjs", "wgplayground"]],
  ["miniplay", ["scripts/release/package-html5-platform.mjs", "miniplay"]],
  ["kizi", ["scripts/release/package-html5-platform.mjs", "kizi"]],
  ["huawei", ["scripts/release/package-html5-platform.mjs", "huawei"]],
  ["gameflare", ["scripts/release/package-html5-platform.mjs", "gameflare"]],
  ["shockwave", ["scripts/release/package-html5-platform.mjs", "shockwave"]],
  ["airconsole", ["scripts/release/package-html5-platform.mjs", "airconsole"]],
  ["world", ["scripts/release/package-html5-platform.mjs", "world"]],
  ["farcaster", ["scripts/release/package-html5-platform.mjs", "farcaster"]],
  ["pi", ["scripts/release/package-html5-platform.mjs", "pi"]],
  ["minipay", ["scripts/release/package-html5-platform.mjs", "minipay"]],
]);
const expectedRunbooks = new Map([
  ["jest", "docs/jest-html5-operations.md"],
  ["facebook", "docs/facebook-instant-games-operations.md"],
  ["youtube", "docs/youtube-playables-operations.md"],
  ["reddit", "docs/reddit-games-operations.md"],
  ["netflix", "docs/netflix-yahoo-candidate-builds.md"],
  ["yahoo", "docs/netflix-yahoo-candidate-builds.md"],
  ["gamesnacks", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["itch", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["crazygames", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["newgrounds", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["gamejolt", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["coolmath", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["armor", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["gamepix", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["addictinggames", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["htmlgames", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["playkovo", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["kongregate", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["lagged", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["gamedistribution", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["gamemonetize", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["yandex", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["telegram", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["microsoft-pwa", "docs/research/html5-publishing-platforms-2026-09-20.md"],
  ["y8", "docs/research/additional-html5-release-targets-2026-09-21.md"],
  ["playgama", "docs/research/additional-html5-release-targets-2026-09-21.md"],
  ["amazon", "docs/research/additional-html5-release-targets-2026-09-21.md"],
  ["jiogames", "docs/research/additional-html5-release-targets-2026-09-21.md"],
  ["famobi", "docs/research/further-html5-release-targets-2026-09-21.md"],
  ["gamepush", "docs/research/further-html5-release-targets-2026-09-21.md"],
  ["softgames", "docs/research/further-html5-release-targets-2026-09-21.md"],
  ["wgplayground", "docs/research/further-html5-release-targets-2026-09-21.md"],
  ["miniplay", "docs/research/additional-release-targets-round-3-2026-09-21.md"],
  ["kizi", "docs/research/additional-release-targets-round-3-2026-09-21.md"],
  ["huawei", "docs/research/additional-release-targets-round-3-2026-09-21.md"],
  ["gameflare", "docs/research/additional-release-targets-round-4-2026-09-21.md"],
  ["shockwave", "docs/research/additional-release-targets-round-4-2026-09-21.md"],
  ["airconsole", "docs/research/additional-release-targets-round-5-2026-09-21.md"],
  ["world", "docs/research/additional-release-targets-round-5-2026-09-21.md"],
  ["farcaster", "docs/research/additional-release-targets-round-5-2026-09-21.md"],
  ["pi", "docs/research/additional-release-targets-round-6-2026-09-21.md"],
  ["minipay", "docs/research/additional-release-targets-round-6-2026-09-21.md"],
]);

test("the public interface exposes one isolated canonical command per release target", () => {
  const plans = listPlatformReleasePlans();
  assert.deepEqual(plans.map(({target}) => target), ["jest", "facebook", "youtube", "reddit", "netflix", "yahoo", "gamesnacks", "itch", "crazygames", "newgrounds", "gamejolt", "coolmath", "armor", "gamepix", "addictinggames", "htmlgames", "playkovo", "kongregate", "lagged", "gamedistribution", "gamemonetize", "yandex", "telegram", "microsoft-pwa", "y8", "playgama", "amazon", "jiogames", "famobi", "gamepush", "softgames", "wgplayground", "miniplay", "kizi", "huawei", "gameflare", "shockwave", "airconsole", "world", "farcaster", "pi", "minipay"]);
  for (const plan of plans) {
    assert.equal(plan.publicCommand, `pnpm release:${plan.target}`);
    assert.equal("command" in plan, false);
    assert.equal(plan.runbook, expectedRunbooks.get(plan.target));
  }
  assert.equal(plans.some(({target}) => target === "all"), false);
});

test("the root package exposes target releases and one combined release command", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  for (const target of ["jest", "facebook", "youtube", "reddit", "netflix", "yahoo", "gamesnacks", "itch", "crazygames", "newgrounds", "gamejolt", "coolmath", "armor", "gamepix", "addictinggames", "htmlgames", "playkovo", "kongregate", "lagged", "gamedistribution", "gamemonetize", "yandex", "telegram", "microsoft-pwa", "y8", "playgama", "amazon", "jiogames", "famobi", "gamepush", "softgames", "wgplayground", "miniplay", "kizi", "huawei", "gameflare", "shockwave", "airconsole", "world", "farcaster", "pi", "minipay"]) {
    assert.equal(
      packageJson.scripts[`release:${target}`],
      `node scripts/release/run-platform-release.mjs ${target}`,
    );
  }
  assert.equal(packageJson.scripts["release:all"], "node scripts/release/run-platform-release.mjs all");
  assert.equal(packageJson.scripts["preflight:all-platforms"], "pnpm verify:all-targets && pnpm release:plan");
  assert.match(packageJson.scripts["verify:all-targets"], /^pnpm check:security\b/u);
});

test("target plans preserve distinct external effects", () => {
  assert.equal(getPlatformReleasePlan("jest").boundary, "remote-active-on-ready");
  assert.match(getPlatformReleasePlan("jest").externalEffect, /activates the exact build automatically/u);
  assert.equal(getPlatformReleasePlan("facebook").boundary, "local-immutable-handoff");
  assert.match(getPlatformReleasePlan("facebook").externalEffect, /^None;/u);
  assert.equal(getPlatformReleasePlan("youtube").boundary, "local-manual-handoff");
  assert.match(getPlatformReleasePlan("youtube").externalEffect, /^None;/u);
  assert.equal(getPlatformReleasePlan("reddit").boundary, "local-immutable-handoff");
  assert.match(getPlatformReleasePlan("reddit").externalEffect, /^None;/u);
  assert.equal(getPlatformReleasePlan("netflix").boundary, "local-validated-artifact");
  assert.equal(getPlatformReleasePlan("yahoo").boundary, "local-validated-artifact");
  assert.equal(getPlatformReleasePlan("gamesnacks").boundary, "local-immutable-handoff");
  assert.equal(getPlatformReleasePlan("itch").boundary, "local-immutable-handoff");
  assert.equal(getPlatformReleasePlan("crazygames").boundary, "local-manual-handoff");
  assert.equal(getPlatformReleasePlan("newgrounds").boundary, "local-manual-handoff");
  assert.throws(() => getPlatformReleasePlan("all"), /Unknown release target/u);
});

test("the combined release verifies once before running every adapter", async () => {
  const invocations = [];
  const results = await runAllPlatformReleases({
    commandRunner: async (command) => invocations.push(command),
    environment: {},
    log: () => {},
  });
  assert.deepEqual(invocations[0].args, ["verify:all-targets"]);
  assert.deepEqual(invocations.slice(1).map(({args}) => args), [
    expectedCommands.get("jest"),
    expectedCommands.get("facebook"),
    expectedCommands.get("youtube"),
    expectedCommands.get("reddit"),
    expectedCommands.get("netflix"),
    expectedCommands.get("yahoo"),
    expectedCommands.get("gamesnacks"),
    expectedCommands.get("itch"),
    expectedCommands.get("crazygames"),
    expectedCommands.get("newgrounds"),
    expectedCommands.get("gamejolt"),
    expectedCommands.get("coolmath"),
    expectedCommands.get("armor"),
    expectedCommands.get("gamepix"),
    expectedCommands.get("addictinggames"),
    expectedCommands.get("htmlgames"),
    expectedCommands.get("playkovo"),
    expectedCommands.get("kongregate"),
    expectedCommands.get("lagged"),
    expectedCommands.get("gamedistribution"),
    expectedCommands.get("gamemonetize"),
    expectedCommands.get("yandex"),
    expectedCommands.get("telegram"),
    expectedCommands.get("microsoft-pwa"),
    expectedCommands.get("y8"),
    expectedCommands.get("playgama"),
    expectedCommands.get("amazon"),
    expectedCommands.get("jiogames"),
    expectedCommands.get("famobi"),
    expectedCommands.get("gamepush"),
    expectedCommands.get("softgames"),
    expectedCommands.get("wgplayground"),
    expectedCommands.get("miniplay"),
    expectedCommands.get("kizi"),
    expectedCommands.get("huawei"),
    expectedCommands.get("gameflare"),
    expectedCommands.get("shockwave"),
    expectedCommands.get("airconsole"),
    expectedCommands.get("world"),
    expectedCommands.get("farcaster"),
    expectedCommands.get("pi"),
    expectedCommands.get("minipay"),
  ]);
  assert.deepEqual(results.map(({target}) => target), ["jest", "facebook", "youtube", "reddit", "netflix", "yahoo", "gamesnacks", "itch", "crazygames", "newgrounds", "gamejolt", "coolmath", "armor", "gamepix", "addictinggames", "htmlgames", "playkovo", "kongregate", "lagged", "gamedistribution", "gamemonetize", "yandex", "telegram", "microsoft-pwa", "y8", "playgama", "amazon", "jiogames", "famobi", "gamepush", "softgames", "wgplayground", "miniplay", "kizi", "huawei", "gameflare", "shockwave", "airconsole", "world", "farcaster", "pi", "minipay"]);
});

test("the Facebook adapter performs only the local preflight and immutable handoff", async () => {
  const portalPackage = JSON.parse(await readFile(
    new URL("../../packages/portal/package.json", import.meta.url),
    "utf8",
  ));
  assert.equal(
    portalPackage.scripts["release:facebook"],
    "pnpm preflight:facebook-upload && pnpm facebook:draft begin",
  );
  assert.equal(
    portalPackage.scripts["preflight:facebook-upload"],
    "pnpm build:facebook && node scripts/prepare-facebook-draft.mjs",
  );
  assert.equal(portalPackage.scripts["facebook:draft"], "node scripts/facebook-draft-evidence.mjs");

  const invocations = [];
  const result = await runPlatformRelease("facebook", {
    commandRunner: async (command) => invocations.push(command),
    log: () => {},
  });
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0].executable, "pnpm");
  assert.deepEqual(invocations[0].args, expectedCommands.get("facebook"));
  assert.deepEqual(result, {
    target: "facebook",
    status: "handoff-ready",
    boundary: "local-immutable-handoff",
  });
  assert.match(getPlatformReleasePlan("facebook").externalEffect, /^None;/u);
});

test("dry runs describe a target without invoking its adapter", async () => {
  const lines = [];
  let invoked = false;
  const result = await runPlatformRelease("youtube", {
    dryRun: true,
    commandRunner: async () => { invoked = true; },
    log: (line) => lines.push(line),
  });
  assert.equal(invoked, false);
  assert.deepEqual(result, {target: "youtube", status: "planned", boundary: "local-manual-handoff"});
  assert.match(lines.join("\n"), /no build, upload, package, or publish action/u);
});

test("execution delegates exactly once and reports the platform handoff", async () => {
  const invocations = [];
  const lines = [];
  const result = await runPlatformRelease("reddit", {
    commandRunner: async (command) => invocations.push(command),
    log: (line) => lines.push(line),
  });
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0].executable, "pnpm");
  assert.deepEqual(invocations[0].args, expectedCommands.get("reddit"));
  assert.equal(result.status, "handoff-ready");
  assert.match(lines.join("\n"), /immutable Reddit handoff|Release handoff ready/u);
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
    }), /fixed automatic-activation contract/u);
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
