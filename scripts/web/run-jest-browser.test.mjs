import assert from "node:assert/strict";
import {execFileSync, spawnSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {createJestBrowserPlan, parseBrowserShard, runBrowserCommands} from "./run-jest-browser.mjs";

const portal = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const root = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const source = portal.scripts["test:game-browser:playwright"];
const excluded = ["pnpm test:provider-save-recovery:browser", "pnpm test:reddit-delivery:browser", "pnpm test:playable-ime-boundary:browser", "pnpm test:playable-input-admission:browser", "pnpm test:playable-text-capacity:browser", "pnpm test:playable-action-focus:browser", "pnpm test:playable-unchanged-input:browser", "pnpm test:reddit-guest-durability:browser", "pnpm test:guidance-storage-recovery:browser", "pnpm test:reddit-guest-rounds:browser"];
const mixed = {
  "pnpm test:live-immediate-submit:browser": "PORTAL_BROWSER_SCOPE=jest LIVE_IMMEDIATE_TARGETS=live",
  "pnpm test:race-profile-refresh-null:browser": "PORTAL_BROWSER_SCOPE=jest",
  "pnpm test:live-render-work:browser": "PORTAL_BROWSER_SCOPE=jest LIVE_RENDER_TARGETS=solo,race",
  "pnpm test:stable-request-initialization:browser": "PORTAL_BROWSER_SCOPE=jest STABLE_REQUEST_TARGETS=solo,race",
  "pnpm test:static-keyboard-work:browser": "PORTAL_BROWSER_SCOPE=jest STATIC_KEYBOARD_TARGETS=solo,race",
  "pnpm test:native-navigation-tail:browser": "PORTAL_BROWSER_SCOPE=jest NATIVE_NAVIGATION_TARGETS=live",
  "pnpm test:native-composition-delivery:browser": "PORTAL_BROWSER_SCOPE=jest COMPOSITION_DELIVERY_TARGETS=live",
  "pnpm test:native-composition-retirement:browser": "PORTAL_BROWSER_SCOPE=jest NATIVE_RETIRE_TARGETS=live",
  "pnpm test:bounded-grapheme-input:browser": "PORTAL_BROWSER_SCOPE=jest BOUNDED_GRAPHEME_TARGETS=live",
  "pnpm test:native-cancelled-keys:browser": "PORTAL_BROWSER_SCOPE=jest NATIVE_CANCELLED_TARGETS=live",
  "pnpm test:rapid-answer-edits:browser": "PORTAL_BROWSER_SCOPE=jest RAPID_ANSWER_TARGETS=live",
  "pnpm test:authority-terminal-recovery:browser": "PORTAL_BROWSER_SCOPE=jest",
  "pnpm test:terminal-journal-recovery:browser": "PORTAL_BROWSER_SCOPE=jest"
};
const runner = fileURLToPath(new URL("./run-jest-browser.mjs", import.meta.url));

test("scoped planning excludes audited parked runtimes and scopes every retained mixed harness in order", () => {
  const commands = source.split(/\s*&&\s*/u);
  const plan = createJestBrowserPlan(source);
  assert.equal(plan.sourceCommandCount, 149);
  assert.equal(plan.eligibleCommandCount, 140);
  assert.equal(plan.shard, null);
  assert.deepEqual(plan.excludedCommands, excluded);
  assert.equal(plan.commands[0], commands[0]);
  assert.deepEqual(plan.commands, commands.filter(command => !excluded.includes(command)).map(command => Object.hasOwn(mixed, command) ? `${mixed[command]} ${command}` : command));
});

test("every mixed leaf receives its exact audited selector before invoking the unchanged package script", () => {
  const plan = createJestBrowserPlan(source);
  assert.equal(Object.keys(mixed).length, 14);
  assert.equal(plan.commands.filter(command => command.startsWith("PORTAL_BROWSER_SCOPE=")).length, 14);
  for (const [command, prefix] of Object.entries(mixed)) {
    assert(plan.commands.includes(`${prefix} ${command}`), command);
    assert(!plan.commands.includes(command), command);
  }
});

test("explicit scope classification retains shared native-editor work and rejects unaudited leaves", () => {
  const first = source.split(/\s*&&\s*/u)[0];
  const shared = "pnpm test:native-editor-callbacks:browser";
  const provider = "pnpm test:provider-save-recovery:browser";
  assert.deepEqual(createJestBrowserPlan([first, shared, provider, ...excluded].join(" && ")).commands,
    [first, shared, `PORTAL_BROWSER_SCOPE=jest ${provider}`]);
  for (const target of ["reddit", "youtube", "netflix", "yahoo", "gamesnacks", "unknown-provider"])
    assert.throws(() => createJestBrowserPlan(`${first} && pnpm test:${target}:browser`), /Unaudited/u);
  assert.throws(() => createJestBrowserPlan(`${first} && pnpm test:new-shared:browser`), /Unaudited/u);
  assert.throws(() => createJestBrowserPlan(`${first} && ${shared} && ${shared}`), /Duplicate/u);
});

test("four round-robin shards are disjoint and their ordered union covers every eligible command exactly once", () => {
  const all = createJestBrowserPlan(source).commands;
  const shards = Array.from({length: 4}, (_unused, index) => createJestBrowserPlan(source, `${index + 1}/4`).commands);
  for (let shard = 0; shard < shards.length; shard++)
    assert.deepEqual(shards[shard], all.filter((_command, index) => index % 4 === shard));
  const union = shards.flat();
  assert.equal(union.length, 140);
  assert.equal(new Set(union).size, 140);
  assert.deepEqual([...union].sort(), [...all].sort());
  assert.deepEqual(createJestBrowserPlan(source, "1/1").commands, all);
});

test("malformed shard and command definitions fail before execution", () => {
  for (const invalid of ["", "0/4", "1/0", "5/4", "-1/4", "1.5/4", "01/4", "1/2/3", "1/99999999999999999999"])
    assert.throws(() => parseBrowserShard(invalid), /Browser shard/u);
  assert.throws(() => createJestBrowserPlan(undefined), /missing/u);
  assert.throws(() => createJestBrowserPlan("pnpm test:shared"), /initial browser Jest/u);
  assert.throws(() => createJestBrowserPlan("PORTAL_BROWSER_TESTS=1 jest x && echo unexpected"), /Unsupported/u);
});

test("CLI dry run is deterministic, honors the shard environment and permits an explicit override", () => {
  const env = {...process.env, JEST_BROWSER_SHARD: "2/4"};
  const run = arguments_ => JSON.parse(execFileSync(process.execPath, [runner, "--dry-run", ...arguments_], {env, encoding: "utf8"}));
  assert.deepEqual(run([]), createJestBrowserPlan(source, "2/4"));
  assert.deepEqual(run([]), run([]));
  assert.deepEqual(run(["--shard", "3/4"]), createJestBrowserPlan(source, "3/4"));
  for (const arguments_ of [["--shard"], ["--shard", "0/4"], ["--unexpected"]])
    assert.notEqual(spawnSync(process.execPath, [runner, "--dry-run", ...arguments_], {env, encoding: "utf8"}).status, 0);
});

test("execution preserves commands and fails closed before later checks after a child failure", () => {
  const commands = createJestBrowserPlan(source).commands.slice(0, 3), observed = [];
  assert.equal(runBrowserCommands(commands, (command, options) => {
    observed.push(command); assert.equal(options.shell, true); return {status: observed.length === 2 ? 7 : 0};
  }), 7);
  assert.deepEqual(observed, commands.slice(0, 2));
  assert.equal(runBrowserCommands([], () => {throw new Error("unexpected execution");}), 0);
  assert.equal(runBrowserCommands(["signal"], () => ({status: null})), 1);
  assert.throws(() => runBrowserCommands(["spawn failure"], () => ({error: new Error("spawn failed")})), /spawn failed/u);
});

test("selected browser harnesses import extracted game session modules from current hosted source", () => {
  const harnesses = [
    "verify-single-player-recovery-browser.mjs",
    "verify-completion-outcome-commit-browser.mjs",
    "verify-game-bridge-retirement-browser.mjs",
    "verify-game-audio-commit-browser.mjs",
    "verify-checkpoint-commit-browser.mjs",
    "verify-guidance-locale-work-browser.mjs",
    "verify-avatar-preparation-ownership-browser.mjs",
    "verify-avatar-preparation-cancellation-browser.mjs",
    "verify-buffered-terminal-recovery-browser.mjs",
    "verify-cold-draft-recovery-browser.mjs",
    "verify-authority-loss-recovery-browser.mjs",
    "verify-profile-dismiss-focus-browser.mjs",
    "verify-profile-confirmation-keyboard-browser.mjs",
    "verify-modal-scroll-retention-browser.mjs",
    "verify-modal-editor-focus-browser.mjs",
    "verify-modal-outside-tab-browser.mjs",
    "verify-modal-keyboard-boundary-browser.mjs",
    "verify-modal-keyboard-admission-browser.mjs",
    "verify-modal-close-commit-browser.mjs",
    "verify-checkpoint-writer-recovery-browser.mjs",
    "verify-pending-play-scope-retirement-browser.mjs",
    "verify-pending-play-lifetime-browser.mjs",
    "verify-journal-write-work-browser.mjs"
];
  const legacy = /(["'])src\/play\/(?:gameSession|GameSessionCheckpoints|pendingGuessJournal|pendingPlayJournalDiagnostics)\.ts\1/u;
  const current = /(["'])(src\/gameplay\/session\/(?:journal\/|persistence\/)?(?:gameSession|GameSessionCheckpoints|pendingGuessJournal|pendingPlayJournalDiagnostics)\.ts)\1/gu;
  assert.equal(harnesses.length, 23);
  for (const harness of harnesses) {
    const source = readFileSync(new URL(harness, import.meta.url), "utf8");
    assert.doesNotMatch(source, legacy, harness);
    const imports = [...source.matchAll(current)];
    assert(imports.length > 0, `${harness} must exercise current hosted source`);
    for (const [, , path] of imports)
      assert(existsSync(new URL(path, new URL("../../", import.meta.url))), `${harness}: ${path}`);
  }
});

test("the new profile preserves the default all-target public interfaces", () => {
  assert.equal(root.scripts["test:e2e"], "pnpm check:e2e-coverage && pnpm --dir firebase-functions test:race:rules && pnpm test:e2e:local");
  assert.equal(portal.scripts["test:e2e:local"], "pnpm verify:all-targets && PORTAL_USE_EXISTING_BUILD=1 pnpm test:mobile-soak");
  assert.equal(portal.scripts["test:jest-local:playwright"], "pnpm test:game-browser:playwright && pnpm test:jest-auth:playwright && pnpm test:jest-purchase-recovery:browser && pnpm test:retained-race:playwright");
  assert.match(root.scripts["test:coverage"], /@riddle-quest\/android test:coverage/u);
  assert.match(root.scripts["check:types"], /@riddle-quest\/android check:types/u);
  assert.match(root.scripts.build, /@riddle-quest\/reddit-app build:package:from-client/u);
  assert.match(portal.scripts["verify:all-targets"], /test:reddit:playwright.*test:youtube:playwright.*test:standalone:playwright/u);
  assert.equal(createJestBrowserPlan(source).sourceCommandCount, 149);
});
