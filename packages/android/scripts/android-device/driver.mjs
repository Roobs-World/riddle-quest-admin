/**
 * Thin adb driver for exercising the installed Riddle Quest Android app on a
 * device or emulator: install, launch, stop, UIAutomator hierarchy reads,
 * taps by `testID` (exposed as `resource-id`), and screenshot evidence.
 *
 * Only the Android SDK's adb is required; no instrumentation is built into the app.
 */
import {execFileSync, spawnSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

/** Android package of the app under test. */
export const applicationId = "com.roobsworld.riddlequest";
/** Android package directory. */
export const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** Monorepo root. */
export const repositoryRoot = resolve(packageDirectory, "../..");
/** Release APK produced by `assembleRelease`. */
export const defaultApk = join(packageDirectory, "android/app/build/outputs/apk/release/app-release.apk");
/** Bundled content pack shared with the web Playable targets. */
const contentPath = join(repositoryRoot, "packages/portal/src/playable/generated/youtube-content-v1.json");

const adbExecutable = process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, "platform-tools/adb") : "adb";
const decode = (value) =>
  value.replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&");

/** Waits for a number of milliseconds. */
export const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

/** Reads the bundled English content and resolves today's answers for typing on the Latin keys. */
export const readBundledAnswers = (now = new Date()) => {
  const content = JSON.parse(readFileSync(contentPath, "utf8"));
  const english = content.packs.en;
  const day = now.toISOString().slice(0, 10);
  const segment = [...content.dailySchedule.segments].reverse().find(({startsOn}) => startsOn <= day);
  if (!segment) throw new Error(`No daily riddle is scheduled for ${day}`);
  const days = Math.floor((Date.parse(`${day}T00:00:00.000Z`) - Date.parse(`${segment.startsOn}T00:00:00.000Z`)) / 86_400_000);
  const dailyId = segment.canonicalIds[days % segment.canonicalIds.length];
  const classic = content.classicOrder.map((id) => english[id].answer);
  return {classic, classicIds: content.classicOrder, daily: english[dailyId].answer, dailyId, classicCount: content.classicOrder.length};
};

/** Creates a driver bound to one device and one evidence directory. */
export const createDriver = ({serial, evidenceDirectory}) => {
  mkdirSync(evidenceDirectory, {recursive: true});
  const deviceArguments = serial ? ["-s", serial] : [];
  let step = 0;
  const adb = (...parts) =>
    execFileSync(adbExecutable, [...deviceArguments, ...parts], {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});

  /** Lists devices adb reports as ready. */
  const devices = () => adb("devices").split("\n").slice(1).filter((line) => line.trim().endsWith("device")).map((line) => line.split("\t")[0]);

  /** Installs the APK, replacing an incompatible or newer local installation on the verification device. */
  const install = (apkPath = defaultApk) => {
    if (!existsSync(apkPath)) throw new Error(`APK not found: ${apkPath}. Build it with pnpm --filter @riddle-quest/android build:release first.`);
    const installArguments = [...deviceArguments, "install", "-r", "-t", apkPath];
    let result = spawnSync(adbExecutable, installArguments, {encoding: "utf8"});
    if (result.status !== 0 && /INSTALL_FAILED_(?:VERSION_DOWNGRADE|UPDATE_INCOMPATIBLE)/u.test(`${result.stdout}${result.stderr}`)) {
      adb("uninstall", applicationId);
      result = spawnSync(adbExecutable, installArguments, {encoding: "utf8"});
    }
    if (result.status !== 0) throw new Error(`adb install failed: ${result.stdout}${result.stderr}`);
  };
  const launch = () => adb("shell", "am", "start", "-W", "-n", `${applicationId}/.MainActivity`);
  const stop = () => adb("shell", "am", "force-stop", applicationId);
  const clearData = () => adb("shell", "pm", "clear", applicationId);
  /** Sends the app to the background with the Home key. */
  const home = () => adb("shell", "input", "keyevent", "KEYCODE_HOME");
  /** Forces portrait (0) or landscape (1) orientation; auto-rotation is disabled while forced. */
  const rotate = (orientation) => {
    adb("shell", "settings", "put", "system", "accelerometer_rotation", "0");
    adb("shell", "settings", "put", "system", "user_rotation", String(orientation));
  };
  /** Restores automatic rotation in portrait. */
  const resetRotation = () => {
    adb("shell", "settings", "put", "system", "user_rotation", "0");
    adb("shell", "settings", "put", "system", "accelerometer_rotation", "1");
  };

  /** Saves a PNG screenshot as numbered evidence. */
  const capture = (name) => {
    step += 1;
    const file = join(evidenceDirectory, `${String(step).padStart(2, "0")}-${name}.png`);
    writeFileSync(file, execFileSync(adbExecutable, [...deviceArguments, "exec-out", "screencap", "-p"], {maxBuffer: 64 * 1024 * 1024}));
    return file;
  };

  /** Parses the UIAutomator hierarchy into flat nodes with tap centers. */
  const dumpUi = () => {
    const xml = adb("exec-out", "uiautomator", "dump", "/dev/tty").replace(/UI hierchary dumped to: \/dev\/tty\s*$/u, "");
    writeFileSync(join(evidenceDirectory, "last-ui.xml"), xml);
    const nodes = [];
    for (const match of xml.matchAll(/<node ([^>]*)\/?>/gu)) {
      const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/gu)].map(([, key, value]) => [key, decode(value)]));
      const bounds = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/u.exec(attributes.bounds ?? "");
      if (!bounds) continue;
      const [, left, top, right, bottom] = bounds.map(Number);
      nodes.push({...attributes, id: attributes["resource-id"], label: attributes["content-desc"], center: {x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2)}});
    }
    return nodes;
  };
  const tap = (node) => adb("shell", "input", "tap", String(node.center.x), String(node.center.y));
  /** Dismisses system dialogs an emulator keyboard may raise over the app; returns whether one was dismissed. */
  const dismissSystemDialogs = (nodes) => {
    const dismiss = nodes.find((node) =>
      node.id === "com.android.permissioncontroller:id/permission_deny_button" ||
      (node.id === "android:id/button3" && node.text === "Cancel") ||
      (node.id === "android:id/button2" && /^(?:Cancel|No thanks)$/u.test(node.text ?? "")));
    if (!dismiss) return false;
    tap(dismiss);
    return true;
  };
  const summarize = (nodes) => nodes.filter((node) => node.text || node.label).map((node) => `${node.id || "-"} | ${node.text || node.label}`).join("\n");

  /** Polls the hierarchy until a node matches, returning it, or throws with the visible nodes. */
  const waitFor = async (description, predicate, timeoutMilliseconds = 30_000) => {
    const deadline = Date.now() + timeoutMilliseconds;
    let nodes = [];
    while (Date.now() < deadline) {
      try {
        nodes = dumpUi();
        if (dismissSystemDialogs(nodes)) continue;
        const node = nodes.find(predicate);
        if (node) return node;
      } catch {
        // The dump can race with a transition; retry.
      }
      await sleep(600);
    }
    throw new Error(`Timed out waiting for ${description}. Visible nodes:\n${summarize(nodes)}`);
  };
  /** Polls until no node matches. */
  const waitForAbsence = async (description, predicate, timeoutMilliseconds = 15_000) => {
    const deadline = Date.now() + timeoutMilliseconds;
    while (Date.now() < deadline) {
      try {
        const nodes = dumpUi();
        if (dismissSystemDialogs(nodes)) continue;
        if (!nodes.some(predicate)) return;
      } catch {
        // Retry after a transition.
      }
      await sleep(600);
    }
    throw new Error(`Timed out waiting for ${description} to disappear`);
  };
  const byId = (id) => (node) => node.id === id;
  const waitForId = (id, timeout) => waitFor(`node ${id}`, byId(id), timeout);
  /** Scrolls the screen by one swipe; `direction` 1 reveals content below, -1 above. */
  const swipe = (nodes, direction) => {
    const root = nodes.find((node) => node.center) ?? {center: {x: 540, y: 1200}};
    const width = root.center.x * 2;
    const height = root.center.y * 2;
    const from = direction > 0 ? Math.round(height * 0.7) : Math.round(height * 0.3);
    const to = direction > 0 ? Math.round(height * 0.3) : Math.round(height * 0.7);
    adb("shell", "input", "swipe", String(Math.round(width / 2)), String(from), String(Math.round(width / 2)), String(to), "300");
  };
  /** Waits for a node, scrolling the screen when it is not on screen; every screen is a scroll view. */
  const findScrolling = async (id, timeoutMilliseconds = 30_000) => {
    const deadline = Date.now() + timeoutMilliseconds;
    let direction = 1;
    let misses = 0;
    let nodes = [];
    while (Date.now() < deadline) {
      try {
        nodes = dumpUi();
        if (dismissSystemDialogs(nodes)) continue;
        const node = nodes.find(byId(id));
        if (node) return node;
        misses += 1;
        if (misses >= 2) {
          swipe(nodes, direction);
          if (misses % 6 === 0) direction = -direction;
        }
      } catch {
        // Retry after a transition.
      }
      await sleep(600);
    }
    throw new Error(`Timed out waiting for node ${id} (with scrolling). Visible nodes:\n${summarize(nodes)}`);
  };
  /** Taps a node by identifier once it is visible, scrolling to it when needed. */
  const tapId = async (id) => {
    tap(await findScrolling(id));
  };
  /** Taps `id` whenever it is visible until `targetId` appears; survives a screen that changes under the first tap and a target that is already shown. */
  const tapIdUntil = async (id, targetId, timeoutMilliseconds = 60_000) => {
    const deadline = Date.now() + timeoutMilliseconds;
    let nodes = [];
    while (Date.now() < deadline) {
      try {
        nodes = dumpUi();
        if (dismissSystemDialogs(nodes)) continue;
        if (nodes.some(byId(targetId))) return;
        const node = nodes.find(byId(id));
        if (node) {
          tap(node);
          await sleep(1200);
          continue;
        }
      } catch {
        // Retry after a transition.
      }
      await sleep(600);
    }
    throw new Error(`Timed out waiting for ${targetId} after tapping ${id}. Visible nodes:\n${summarize(nodes)}`);
  };
  /** Reads a node's text or label by identifier. */
  const readText = async (id) => {
    const node = await waitForId(id);
    return node.text || node.label || "";
  };
  /** Reads the coin balance from the status header. */
  const readCoins = async () => {
    const node = await waitFor("coin balance", (candidate) => /^Coins: \d+$/u.test(candidate.label ?? ""));
    return Number(/\d+/u.exec(node.label)[0]);
  };
  /** Taps an answer on the on-screen Latin keys. */
  const typeAnswer = async (answer) => {
    if (!/^[a-z]+$/u.test(answer)) throw new Error(`Answer "${answer}" cannot be typed with the Latin shortcut keys`);
    for (const letter of answer.toUpperCase()) await tapId(`key-${letter}`);
  };
  /** Whether a node reports the enabled state. */
  const isEnabled = (node) => node.enabled === "true";

  return {adb, devices, install, launch, stop, clearData, home, rotate, resetRotation, capture, dumpUi, waitFor, waitForAbsence, waitForId, findScrolling, byId, tap, tapId, tapIdUntil, readText, readCoins, typeAnswer, isEnabled};
};
