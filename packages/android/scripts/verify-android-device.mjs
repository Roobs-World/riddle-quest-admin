#!/usr/bin/env node
/**
 * Smoke check for the installed Riddle Quest Android app over adb: boot, start
 * Classic, solve the first riddle with the on-screen keys, read the result,
 * return to the menu, then relaunch cold and confirm the rewarded coins persisted.
 *
 * Usage: node scripts/verify-android-device.mjs [apk-path] [--serial <device>]
 * Screenshots and a summary land in artifacts/android-device-verification/.
 * The fuller scenario suite is `pnpm test:e2e:device`.
 */
import {writeFileSync} from "node:fs";
import {join} from "node:path";
import {createDriver, defaultApk, readBundledAnswers, repositoryRoot} from "./android-device/driver.mjs";

const args = process.argv.slice(2);
const serialIndex = args.indexOf("--serial");
const serial = serialIndex >= 0 ? args[serialIndex + 1] : undefined;
const apkPath = args.find((argument, index) => !argument.startsWith("--") && index !== serialIndex + 1) ?? defaultApk;
const evidenceDirectory = join(repositoryRoot, "artifacts/android-device-verification");
const driver = createDriver({serial, evidenceDirectory});
const log = (message) => process.stdout.write(`${message}\n`);

const main = async () => {
  const devices = driver.devices();
  if (devices.length === 0) throw new Error("No adb device is connected. Start an emulator or attach a device with USB debugging.");
  const {classic, classicIds} = readBundledAnswers();
  log(`Installing ${apkPath}`);
  driver.install(apkPath);
  driver.clearData();
  driver.launch();
  log("Waiting for the menu after a cold first run");
  await driver.waitForId("menu-heading");
  const startingCoins = await driver.readCoins();
  driver.capture("menu-first-run");
  if (startingCoins !== 300) throw new Error(`Expected a fresh save with 300 coins, saw ${startingCoins}`);

  log("Starting Classic");
  await driver.tapId("start-classic");
  await driver.waitForId("riddle-text");
  driver.capture("classic-riddle");
  log(`Typing the first classic answer (${classic[0].length} letters)`);
  await driver.typeAnswer(classic[0]);
  driver.capture("classic-answer-typed");
  await driver.tapId("submit");
  const heading = await driver.readText("result-heading");
  driver.capture("classic-result");
  if (heading !== "Solved!") throw new Error(`Expected a solved result, saw "${heading}"`);
  const rewardedCoins = await driver.readCoins();
  if (rewardedCoins <= startingCoins) throw new Error(`Expected the win to add coins, balance stayed at ${rewardedCoins}`);
  await driver.tapId("continue-to-menu");
  await driver.waitForId("menu-heading");
  driver.capture("menu-after-win");

  log("Relaunching cold to confirm persistence");
  driver.stop();
  driver.launch();
  await driver.waitForId("menu-heading");
  const persistedCoins = await driver.readCoins();
  driver.capture("menu-after-relaunch");
  if (persistedCoins !== rewardedCoins) throw new Error(`Expected ${rewardedCoins} coins after relaunch, saw ${persistedCoins}`);
  const classicCard = await driver.readText("start-classic");
  if (!classicCard.includes("2/")) throw new Error(`Expected Classic to advance to riddle 2, saw "${classicCard}"`);

  log("Opening progress");
  await driver.tapId("show-progress");
  await driver.waitForId("progress-heading");
  driver.capture("progress");
  await driver.tapId("back");
  await driver.waitForId("menu-heading");

  const summary = {apk: apkPath, device: devices[0], startingCoins, rewardedCoins, persistedCoins, firstClassicId: classicIds[0], verifiedAt: new Date().toISOString()};
  writeFileSync(join(evidenceDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  log(`Android device verification passed: ${JSON.stringify(summary)}`);
};

main().catch((error) => {
  try {
    driver.capture("failure");
  } catch {
    // Screenshots are best-effort evidence.
  }
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
