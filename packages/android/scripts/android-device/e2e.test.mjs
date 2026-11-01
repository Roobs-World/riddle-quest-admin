/**
 * End-to-end scenarios for the Android app on a connected device or emulator,
 * driven purely through adb. Each scenario starts from cleared app data.
 *
 * Run: ANDROID_HOME=~/Android/Sdk pnpm --filter @qwordly/android test:e2e:device
 * Env: RIDDLE_QUEST_APK (release APK path), ANDROID_SERIAL (device), RIDDLE_QUEST_SKIP_INSTALL=1.
 * Evidence lands in artifacts/android-e2e/<scenario>/.
 */
import assert from "node:assert/strict";
import {join} from "node:path";
import {before, describe, it} from "node:test";
import {createDriver, defaultApk, readBundledAnswers, repositoryRoot} from "./driver.mjs";

const evidenceRoot = join(repositoryRoot, "artifacts/android-e2e");
const serial = process.env.ANDROID_SERIAL;
const answers = readBundledAnswers();
/** Base attempts before the continue offer, mirroring the shared economy. */
const BASE_ATTEMPTS = 5;
/** Coin economy mirrored from the shared package. */
const STARTING_COINS = 300;
const HINT_COST = 25;
const SKIP_COST = 100;

/** Creates a driver whose evidence goes to one scenario folder. */
const scenario = (name) => createDriver({serial, evidenceDirectory: join(evidenceRoot, name)});

before(() => {
  const driver = scenario("setup");
  assert.ok(driver.devices().length > 0, "No adb device is connected. Start an emulator or attach a device with USB debugging.");
  if (process.env.RIDDLE_QUEST_SKIP_INSTALL !== "1") driver.install(process.env.RIDDLE_QUEST_APK ?? defaultApk);
});

/** Clears data, launches, and waits for the fresh menu. */
const freshMenu = async (driver) => {
  driver.stop();
  driver.clearData();
  driver.launch();
  await driver.waitForId("menu-heading");
  assert.equal(await driver.readCoins(), STARTING_COINS);
};
/** Submits wrong guesses until the attempt limit offers a continue. */
const exhaustAttempts = async (driver, length) => {
  for (let attempt = 0; attempt < BASE_ATTEMPTS; attempt += 1) {
    await driver.typeAnswer("z".repeat(length));
    await driver.tapId("submit");
    await driver.waitForId(`guess-row-${attempt}`);
  }
};

describe("Android app on device", () => {
  it("solves the first Classic riddle and keeps the reward across a cold relaunch", async () => {
    const driver = scenario("classic-solve-and-persist");
    await freshMenu(driver);
    await driver.waitForId("guidance-banner");
    driver.capture("menu");
    await driver.tapId("start-classic");
    await driver.waitForId("riddle-text");
    await driver.waitForId("latin-keyboard");
    driver.capture("riddle");
    await driver.typeAnswer(answers.classic[0]);
    driver.capture("typed");
    await driver.tapId("submit");
    assert.equal(await driver.readText("result-heading"), "Solved!");
    await driver.waitFor("new achievements heading", (node) => node.text === "New achievements");
    await driver.waitFor("first win badge", (node) => node.label === "Wins: 1");
    driver.capture("result");
    const rewarded = await driver.readCoins();
    assert.ok(rewarded > STARTING_COINS, `expected a reward above ${STARTING_COINS}, saw ${rewarded}`);
    await driver.tapId("continue-to-menu");
    await driver.waitForId("menu-heading");
    driver.stop();
    driver.launch();
    await driver.waitForId("menu-heading");
    assert.equal(await driver.readCoins(), rewarded);
    assert.match(await driver.readText("start-classic"), /2\/\d+$/u);
    await driver.tapId("show-progress");
    await driver.waitForId("progress-heading");
    await driver.waitFor("wins cell", (node) => node.label === "Wins: 1");
    driver.capture("progress");
    await driver.tapId("back");
    await driver.waitForId("menu-heading");
  });

  it("charges for hints and skips, reaches the attempt limit, and offers continue or finish", async () => {
    const driver = scenario("hint-skip-attempt-limit");
    await freshMenu(driver);
    await driver.tapId("guidance-banner-action");
    await driver.waitForAbsence("guidance banner", driver.byId("guidance-banner"));
    await driver.tapId("start-classic");
    await driver.waitForId("riddle-text");
    await driver.tapId("hint");
    await driver.waitFor("hint charge", (node) => node.label === `Coins: ${STARTING_COINS - HINT_COST}`);
    driver.capture("hinted");
    await driver.tapId("skip");
    assert.equal(await driver.readText("result-heading"), "Skipped");
    driver.capture("skipped");
    await driver.tapId("continue-to-menu");
    await driver.waitForId("menu-heading");
    assert.equal(await driver.readCoins(), STARTING_COINS - HINT_COST - SKIP_COST);
    await driver.tapId("start-classic");
    await driver.waitForId("riddle-text");
    await exhaustAttempts(driver, answers.classic[1].length);
    await driver.waitForId("buy-continue");
    driver.capture("attempt-limit");
    assert.ok(driver.isEnabled(await driver.waitForId("buy-continue")), "continue should be affordable");
    await driver.tapId("finish-run");
    assert.equal(await driver.readText("result-heading"), "Not solved");
    driver.capture("loss");
    await driver.tapId("continue-to-menu");
    await driver.waitForId("menu-heading");
    assert.equal(await driver.readCoins(), STARTING_COINS - HINT_COST - SKIP_COST);
  });

  it("buys a continue after the attempt limit and can still solve", async () => {
    const driver = scenario("continue-and-solve");
    await freshMenu(driver);
    await driver.tapId("start-classic");
    await driver.waitForId("riddle-text");
    await exhaustAttempts(driver, answers.classic[0].length);
    await driver.tapId("buy-continue");
    await driver.waitForId("submit");
    assert.equal(await driver.readCoins(), STARTING_COINS - 50);
    await driver.typeAnswer(answers.classic[0]);
    await driver.tapId("submit");
    assert.equal(await driver.readText("result-heading"), "Solved!");
    assert.match(await driver.readText("result-attempts"), new RegExp(`${BASE_ATTEMPTS + 1}$`, "u"));
    driver.capture("solved-after-continue");
  });

  it("solves today's Daily once, closes the card, and persists accessibility preferences", async () => {
    const driver = scenario("daily-and-preferences");
    await freshMenu(driver);
    await driver.tapId("start-daily");
    await driver.waitForId("riddle-text");
    assert.equal(driver.dumpUi().some(driver.byId("skip")), false, "daily has no skip");
    await driver.typeAnswer(answers.daily);
    await driver.tapId("submit");
    assert.equal(await driver.readText("result-heading"), "Solved!");
    driver.capture("daily-solved");
    await driver.tapId("continue-to-menu");
    const dailyCard = await driver.waitForId("start-daily");
    assert.equal(driver.isEnabled(dailyCard), false, "daily card closes after completion");
    assert.match(dailyCard.label, /Daily complete$/u);
    await driver.tapId("show-progress");
    await driver.waitFor("streak cell", (node) => node.label === "Streak: 1");
    await driver.tapId("preference-reduced-motion");
    await driver.waitFor("reduced motion on", (node) => node.id === "preference-reduced-motion" && node.checked === "true");
    driver.capture("preferences");
    driver.stop();
    driver.launch();
    await driver.waitForId("menu-heading");
    assert.equal(driver.isEnabled(await driver.waitForId("start-daily")), false);
    await driver.tapId("show-progress");
    await driver.waitFor("reduced motion persisted", (node) => node.id === "preference-reduced-motion" && node.checked === "true");
  });

  it("keeps the riddle, keys and actions reachable in landscape", async () => {
    const driver = scenario("landscape");
    try {
      await freshMenu(driver);
      await driver.tapId("start-classic");
      await driver.waitForId("riddle-text");
      driver.rotate(1);
      await driver.waitFor("landscape layout", (node) => node.id === "riddle-text" && node.center.x > 600);
      driver.capture("landscape-riddle");
      await driver.typeAnswer(answers.classic[0]);
      const submit = await driver.findScrolling("submit");
      assert.ok(driver.isEnabled(submit), "submit enabled after typing in landscape");
      driver.tap(submit);
      assert.equal(await driver.readText("result-heading"), "Solved!");
      driver.capture("landscape-result");
      driver.rotate(0);
      await driver.waitFor("portrait layout", (node) => node.id === "result-heading" && node.center.x < 600);
      await driver.tapId("continue-to-menu");
      await driver.waitForId("menu-heading");
    } finally {
      driver.resetRotation();
    }
  });

  it("disables paid actions once the wallet is empty and re-enables them after a win", async () => {
    const driver = scenario("empty-wallet");
    await freshMenu(driver);
    for (let skip = 0; skip < STARTING_COINS / SKIP_COST; skip += 1) {
      await driver.tapId("start-classic");
      await driver.waitForId("riddle-text");
      await driver.tapId("skip");
      assert.equal(await driver.readText("result-heading"), "Skipped");
      await driver.tapId("continue-to-menu");
      await driver.waitForId("menu-heading");
    }
    assert.equal(await driver.readCoins(), 0);
    await driver.tapId("start-classic");
    await driver.waitForId("riddle-text");
    assert.equal(driver.isEnabled(await driver.waitForId("hint")), false, "hint unaffordable");
    assert.equal(driver.isEnabled(await driver.waitForId("skip")), false, "skip unaffordable");
    driver.capture("empty-wallet");
    const nextIndex = STARTING_COINS / SKIP_COST;
    await driver.typeAnswer(answers.classic[nextIndex]);
    await driver.tapId("submit");
    assert.equal(await driver.readText("result-heading"), "Solved!");
    await driver.tapId("continue-to-menu");
    await driver.waitForId("menu-heading");
    assert.ok((await driver.readCoins()) >= HINT_COST, "a win refills enough for a hint");
    await driver.tapId("start-classic");
    assert.equal(driver.isEnabled(await driver.waitForId("hint")), true);
  });

  it("restores an interrupted puzzle with its scored guesses after backgrounding and a process kill", async () => {
    const driver = scenario("interrupted-puzzle");
    await freshMenu(driver);
    await driver.tapId("start-classic");
    await driver.waitForId("riddle-text");
    await driver.typeAnswer("z".repeat(answers.classic[0].length));
    await driver.tapId("submit");
    await driver.waitForId("guess-row-0");
    driver.home();
    await driver.waitForAbsence("app in foreground", driver.byId("riddle-text"));
    driver.launch();
    await driver.waitForId("guess-row-0");
    driver.stop();
    driver.launch();
    await driver.waitForId("riddle-text");
    await driver.waitForId("guess-row-0");
    driver.capture("restored");
    await driver.typeAnswer(answers.classic[0]);
    await driver.tapId("submit");
    assert.equal(await driver.readText("result-heading"), "Solved!");
    assert.match(await driver.readText("result-attempts"), /2$/u);
  });
});
