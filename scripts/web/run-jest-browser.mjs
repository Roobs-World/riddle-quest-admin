import {spawnSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const packageDirectory = fileURLToPath(new URL("../../", import.meta.url));
// Audited shared/Jest leaves. New leaves require an explicit target-scope review.
const sharedCommands = new Set(`
test:online-status-commit:browser
test:offline-keyboard-boundary:browser
test:race-navigation-focus:browser
test:race-tab-order:browser
test:race-keyboard-boundary:browser
test:race:live:browser
test:live-confirmation-retirement:browser
test:live-wait-retirement:browser
test:live-retired-leave-recovery:browser
test:live-same-account-retirement:browser
test:live-provider-retirement:browser
test:live-poll-retirement:browser
test:live-signal-failures:browser
test:live-signal-watchdog:browser
test:live-choice-commit:browser
test:live-invite-commit:browser
test:live-panel-commit:browser
test:live-callback-lifetime:browser
test:live-reconnect-input:browser
test:live-question-input:browser
test:live-clock:browser
test:live-countdown-clock:browser
test:race-ime-dialog:browser
test:single-player:recovery:browser
test:gameplay-receipts:browser
test:completion-effects:browser
test:completion-container-work:browser
test:completion-outcome-commit:browser
test:race:safety:browser
test:race:direct-invite:browser
test:race:native-invite:browser
test:race:inbox:browser
test:race:preview:browser
test:game-ready:browser
test:game-ready-commit:browser
test:resize-setup-retirement:browser
test:game-bridge-errors:browser
test:game-bridge-retirement:browser
test:host-bridge:browser
test:host-bridge-commit:browser
test:host-bridge-retirement:browser
test:bridge-dispatch:browser
test:bridge-recovery:browser
test:optional-surfaces:browser
test:solar-animation:browser
test:solar-resources:browser
test:live-decoration:browser
test:solar-initialization:browser
test:solar-layout:browser
test:answer-keyboard-commit:browser
test:game-audio-commit:browser
test:keyboard-lifetime:browser
test:native-editor-callbacks:browser
test:race-action-focus:browser
test:checkpoint-commit:browser
test:checkpoint-work:browser
test:storage-queue:browser
test:jest-state-queue:browser
test:save-recovery:browser
test:centered-tooltip-work:browser
test:guidance-locale-work:browser
test:avatar-preparation-ownership:browser
test:avatar-preparation-cancellation:browser
test:session-assembly-retention:browser
test:classic-question-preparation:browser
test:buffered-terminal-recovery:browser
test:buffered-rollback-recovery:browser
test:cold-draft-recovery:browser
test:authority-loss-recovery:browser
test:save-notice:browser
test:short-viewport:browser
test:viewport-fit-reflow:browser
test:solar-sizing:browser
test:deferred-restoration:browser
test:context-recovery:browser
test:profile-dismiss-focus:browser
test:profile-confirmation-keyboard:browser
test:modal-scroll-retention:browser
test:modal-editor-focus:browser
test:modal-outside-tab:browser
test:modal-keyboard-boundary:browser
test:modal-keyboard-admission:browser
test:modal-close-commit:browser
test:interactive-recovery:browser
test:question-load-ordering:browser
test:repeated-question-delivery:browser
test:live-poll-scheduling:browser
test:live-recovery-wakeups:browser
test:riddle-recovery-coalescing:browser
test:host-riddle-commit-retirement:browser
test:checkpoint-writer-recovery:browser
test:pending-play-scope-retirement:browser
test:pending-play-lifetime:browser
test:live-history-provider:browser
test:live-destination-capability:browser
test:live-rematch-owner:browser
test:host-recovery-suspension:browser
test:host-retired-warmups:browser
test:host-deferred-warmups:browser
test:host-deferred-riddle:browser
test:race-options-commit:browser
test:live-safety-focus:browser
test:turkish-answer-input:browser
test:live-hint-keyboard:browser
test:turkish-authoritative-feedback:browser
test:turkish-virtual-keys:browser
test:hint-position-recovery:browser
test:hint-letter-recovery:browser
test:guess-result-recovery:browser
test:live-hint-cursor:browser
test:solo-hint-intent:browser
test:pagehide-checkpoint:browser
test:journal-write-work:browser
`.trim().split(/\s+/u));
const excludedCommands = new Set([
  "test:provider-save-recovery:browser",
  "test:reddit-delivery:browser",
  "test:reddit-guest-durability:browser",
  "test:guidance-storage-recovery:browser",
  "test:reddit-guest-rounds:browser",
  "test:playable-ime-boundary:browser",
  "test:playable-input-admission:browser",
  "test:playable-text-capacity:browser",
  "test:playable-action-focus:browser",
  "test:playable-unchanged-input:browser"
]);
// Restrict mixed-provider runtime loops while retaining all Jest/shared cases.
const mixedCommands = {
  "test:live-immediate-submit:browser": "PORTAL_BROWSER_SCOPE=jest LIVE_IMMEDIATE_TARGETS=live",
  "test:race-profile-refresh-null:browser": "PORTAL_BROWSER_SCOPE=jest",
  "test:live-render-work:browser": "PORTAL_BROWSER_SCOPE=jest LIVE_RENDER_TARGETS=solo,race",
  "test:stable-request-initialization:browser": "PORTAL_BROWSER_SCOPE=jest STABLE_REQUEST_TARGETS=solo,race",
  "test:static-keyboard-work:browser": "PORTAL_BROWSER_SCOPE=jest STATIC_KEYBOARD_TARGETS=solo,race",
  "test:native-navigation-tail:browser": "PORTAL_BROWSER_SCOPE=jest NATIVE_NAVIGATION_TARGETS=live",
  "test:native-composition-delivery:browser": "PORTAL_BROWSER_SCOPE=jest COMPOSITION_DELIVERY_TARGETS=live",
  "test:native-composition-retirement:browser": "PORTAL_BROWSER_SCOPE=jest NATIVE_RETIRE_TARGETS=live",
  "test:bounded-grapheme-input:browser": "PORTAL_BROWSER_SCOPE=jest BOUNDED_GRAPHEME_TARGETS=live",
  "test:native-cancelled-keys:browser": "PORTAL_BROWSER_SCOPE=jest NATIVE_CANCELLED_TARGETS=live",
  "test:rapid-answer-edits:browser": "PORTAL_BROWSER_SCOPE=jest RAPID_ANSWER_TARGETS=live",
  "test:authority-terminal-recovery:browser": "PORTAL_BROWSER_SCOPE=jest",
  "test:terminal-journal-recovery:browser": "PORTAL_BROWSER_SCOPE=jest"
};

/** Validates an optional one-based round-robin shard without silently omitting work. */
export function parseBrowserShard(value) {
  if (value === undefined) return null;
  const match = /^([1-9]\d*)\/([1-9]\d*)$/u.exec(value);
  if (!match) throw new Error("Browser shard must be N/M with 1 <= N <= M.");
  const index = Number(match[1]), total = Number(match[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) || index > total)
    throw new Error("Browser shard must be N/M with 1 <= N <= M.");
  return {index, total};
}

/** Derives the scoped plan from the existing ordered all-target game-browser interface. */
export function createJestBrowserPlan(script, shardValue) {
  if (typeof script !== "string" || !script.trim()) throw new Error("The game-browser script is missing.");
  const source = script.split(/\s*&&\s*/u).map(command => command.trim());
  if (!source[0].startsWith("PORTAL_BROWSER_TESTS=1 jest "))
    throw new Error("The game-browser script must retain its initial browser Jest command.");
  const commands = [source[0]], excluded = [], seen = new Set();
  for (const command of source.slice(1)) {
    const leaf = /^pnpm (test:[A-Za-z0-9:_-]+)$/u.exec(command);
    if (!leaf) throw new Error(`Unsupported game-browser command: ${command}`);
    if (seen.has(leaf[1])) throw new Error(`Duplicate game-browser command: ${leaf[1]}`);
    seen.add(leaf[1]);
    if (excludedCommands.has(leaf[1])) excluded.push(command);
    else if (Object.hasOwn(mixedCommands, leaf[1])) commands.push(`${mixedCommands[leaf[1]]} ${command}`);
    else if (sharedCommands.has(leaf[1])) commands.push(command);
    else throw new Error(`Unaudited game-browser command: ${leaf[1]}`);
  }
  const shard = parseBrowserShard(shardValue);
  return {
    profile: "jest",
    sourceCommandCount: source.length,
    eligibleCommandCount: commands.length,
    shard,
    excludedCommands: excluded,
    commands: shard ? commands.filter((_command, index) => index % shard.total === shard.index - 1) : commands,
  };
}

/** Stops on the first failing command while preserving each original shell command. */
export function runBrowserCommands(commands, spawn = spawnSync) {
  for (const command of commands) {
    console.log(`Jest browser check: ${command}`);
    const result = spawn(command, {cwd: packageDirectory, env: process.env, shell: true, stdio: "inherit"});
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

/** Reads the existing command graph and optionally prints it without executing tests. */
async function main() {
  const arguments_ = process.argv.slice(2);
  let dryRun = false, shard = process.env.JEST_BROWSER_SHARD || undefined;
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    if (argument === "--dry-run") dryRun = true;
    else if (argument === "--shard" && arguments_[index + 1] !== undefined) shard = arguments_[++index];
    else throw new Error(`Unknown or incomplete browser runner option: ${argument}`);
  }
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const plan = createJestBrowserPlan(manifest.scripts["test:game-browser:playwright"], shard);
  if (dryRun) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  else process.exitCode = runBrowserCommands(plan.commands);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {console.error(error.message); process.exitCode = 1;});
}
