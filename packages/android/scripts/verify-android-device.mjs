#!/usr/bin/env node
/**
 * Drives the installed Riddle Quest Android app through adb and asserts the
 * shared solo flow on a real device or emulator: boot, start Classic, solve the
 * first riddle with the on-screen keys, read the result, return to the menu,
 * then relaunch cold and confirm the rewarded coins persisted.
 *
 * Usage: node scripts/verify-android-device.mjs [apk-path] [--serial <device>]
 * Screenshots and UI dumps land in artifacts/android-device-verification/.
 */
import {execFileSync, spawnSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageDirectory, "../..");
const applicationId = "com.roobsworld.riddlequest";
const defaultApk = join(packageDirectory, "android/app/build/outputs/apk/release/app-release.apk");
const evidenceDirectory = join(repositoryRoot, "artifacts/android-device-verification");
const contentPath = join(repositoryRoot, "packages/portal/src/playable/generated/youtube-content-v1.json");

const args = process.argv.slice(2);
const serialIndex = args.indexOf("--serial");
const serial = serialIndex >= 0 ? args[serialIndex + 1] : undefined;
const apkPath = args.find((argument, index) => !argument.startsWith("--") && index !== serialIndex + 1) ?? defaultApk;
const adbExecutable = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, "platform-tools/adb")
  : "adb";

const adb = (...parts) =>
  execFileSync(adbExecutable, [...(serial ? ["-s", serial] : []), ...parts], {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
const log = (message) => process.stdout.write(`${message}\n`);

mkdirSync(evidenceDirectory, {recursive: true});
let step = 0;
const capture = (name) => {
  step += 1;
  const file = join(evidenceDirectory, `${String(step).padStart(2, "0")}-${name}.png`);
  const png = execFileSync(adbExecutable, [...(serial ? ["-s", serial] : []), "exec-out", "screencap", "-p"], {maxBuffer: 64 * 1024 * 1024});
  writeFileSync(file, png);
  return file;
};

/** Parses the UIAutomator hierarchy into flat nodes with centers for tapping. */
const dumpUi = () => {
  const xml = adb("exec-out", "uiautomator", "dump", "/dev/tty").replace(/UI hierchary dumped to: \/dev\/tty\s*$/u, "");
  writeFileSync(join(evidenceDirectory, `${String(step).padStart(2, "0")}-ui.xml`), xml);
  const nodes = [];
  for (const match of xml.matchAll(/<node ([^>]*)\/?>/gu)) {
    const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/gu)].map(([, key, value]) => [key, decode(value)]));
    const bounds = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/u.exec(attributes.bounds ?? "");
    if (!bounds) continue;
    const [, left, top, right, bottom] = bounds.map(Number);
    nodes.push({...attributes, center: {x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2)}});
  }
  return nodes;
};
const decode = (value) => value.replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&");
const findNode = (nodes, predicate) => nodes.find(predicate);
const byId = (id) => (node) => node["resource-id"] === id;
const byText = (text) => (node) => node.text === text || node["content-desc"] === text || node["content-desc"]?.startsWith(`${text}:`);

/** Polls the hierarchy until a node matches or the timeout elapses. */
const waitForNode = async (description, predicate, timeoutMilliseconds = 30_000) => {
  const deadline = Date.now() + timeoutMilliseconds;
  let nodes = [];
  while (Date.now() < deadline) {
    try {
      nodes = dumpUi();
      const node = findNode(nodes, predicate);
      if (node) return node;
    } catch {
      // The dump can race with a transition; retry.
    }
    await sleep(750);
  }
  const summary = nodes.filter((node) => node.text || node["content-desc"]).map((node) => `${node["resource-id"] || "-"} | ${node.text || node["content-desc"]}`);
  throw new Error(`Timed out waiting for ${description}. Visible nodes:\n${summary.join("\n")}`);
};
const tap = (node) => adb("shell", "input", "tap", String(node.center.x), String(node.center.y));
const tapById = async (id) => tap(await waitForNode(`node ${id}`, byId(id)));

const launch = () => {
  adb("shell", "am", "start", "-W", "-n", `${applicationId}/.MainActivity`);
};
const stop = () => adb("shell", "am", "force-stop", applicationId);
const clearData = () => adb("shell", "pm", "clear", applicationId);

const readCoins = async () => {
  const node = await waitForNode("coin balance", (candidate) => /^Coins: \d+$/u.test(candidate["content-desc"] ?? ""));
  return Number(/\d+/u.exec(node["content-desc"])[0]);
};

const main = async () => {
  const devices = adb("devices").split("\n").slice(1).filter((line) => line.trim().endsWith("device"));
  if (devices.length === 0) throw new Error("No adb device is connected. Start an emulator or attach a device with USB debugging.");
  if (!existsSync(apkPath)) throw new Error(`APK not found: ${apkPath}. Build it with pnpm --filter @qwordly/android build:release first.`);
  const content = JSON.parse(readFileSync(contentPath, "utf8"));
  const firstClassicId = content.classicOrder[0];
  const answer = content.packs.en[firstClassicId].answer;
  if (!/^[a-z]+$/u.test(answer)) throw new Error(`First classic answer is not typeable with the Latin shortcut keys: ${answer}`);

  log(`Installing ${apkPath}`);
  const installArguments = [...(serial ? ["-s", serial] : []), "install", "-r", "-t", apkPath];
  let install = spawnSync(adbExecutable, installArguments, {encoding: "utf8"});
  if (install.status !== 0 && /INSTALL_FAILED_(?:VERSION_DOWNGRADE|UPDATE_INCOMPATIBLE)/u.test(`${install.stdout}${install.stderr}`)) {
    // A verification device may hold a differently signed or newer local build; replace it.
    log("Replacing the existing installation on the verification device");
    adb("uninstall", applicationId);
    install = spawnSync(adbExecutable, installArguments, {encoding: "utf8"});
  }
  if (install.status !== 0) throw new Error(`adb install failed: ${install.stdout}${install.stderr}`);
  clearData();
  launch();
  log("Waiting for the menu after a cold first run");
  await waitForNode("menu heading", byId("menu-heading"));
  const startingCoins = await readCoins();
  capture("menu-first-run");
  if (startingCoins !== 300) throw new Error(`Expected a fresh save with 300 coins, saw ${startingCoins}`);

  log("Starting Classic");
  await tapById("start-classic");
  await waitForNode("riddle text", byId("riddle-text"));
  capture("classic-riddle");

  log(`Typing the first classic answer (${answer.length} letters)`);
  for (const letter of answer.toUpperCase()) await tapById(`key-${letter}`);
  capture("classic-answer-typed");
  await tapById("submit");
  const resultHeading = await waitForNode("result heading", byId("result-heading"));
  capture("classic-result");
  if (resultHeading.text !== "Solved!") throw new Error(`Expected a solved result, saw "${resultHeading.text}"`);
  const rewardedCoins = await readCoins();
  if (rewardedCoins <= startingCoins) throw new Error(`Expected the win to add coins, balance stayed at ${rewardedCoins}`);

  await tapById("continue-to-menu");
  await waitForNode("menu heading", byId("menu-heading"));
  capture("menu-after-win");

  log("Relaunching cold to confirm persistence");
  stop();
  launch();
  await waitForNode("menu heading", byId("menu-heading"));
  const persistedCoins = await readCoins();
  capture("menu-after-relaunch");
  if (persistedCoins !== rewardedCoins) throw new Error(`Expected ${rewardedCoins} coins after relaunch, saw ${persistedCoins}`);
  const classicCard = await waitForNode("classic card", byId("start-classic"));
  if (!classicCard["content-desc"]?.includes("2/")) throw new Error(`Expected Classic to advance to riddle 2, saw "${classicCard["content-desc"]}"`);

  log("Opening progress");
  await tapById("show-progress");
  await waitForNode("progress heading", byId("progress-heading"));
  capture("progress");
  await tapById("back");
  await waitForNode("menu heading", byId("menu-heading"));

  const summary = {
    apk: apkPath,
    device: devices[0].split("\t")[0],
    startingCoins,
    rewardedCoins,
    persistedCoins,
    firstClassicId,
    verifiedAt: new Date().toISOString(),
  };
  writeFileSync(join(evidenceDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  log(`Android device verification passed: ${JSON.stringify(summary)}`);
};

main().catch((error) => {
  try {
    capture("failure");
  } catch {
    // Screenshots are best-effort evidence.
  }
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
