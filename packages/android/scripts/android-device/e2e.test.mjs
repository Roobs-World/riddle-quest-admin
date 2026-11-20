/**
 * End-to-end scenarios for the Android app on a connected device or emulator,
 * driven purely through adb. Each scenario starts from cleared app data.
 *
 * Run: ANDROID_HOME=~/Android/Sdk pnpm --filter @riddle-quest/android test:e2e:device
 * Env: RIDDLE_QUEST_APK (release APK path), ANDROID_SERIAL (device), RIDDLE_QUEST_SKIP_INSTALL=1.
 * Evidence lands in artifacts/android-e2e/<scenario>/.
 */
import assert from "node:assert/strict";
import {join} from "node:path";
import {createRequire} from "node:module";
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

/** Clears data, launches hosted-first, and switches to the offline menu; the offline button is available while connecting and once connected. */
const freshMenu = async (driver) => {
  driver.stop();
  driver.clearData();
  driver.launch();
  if (process.env.RIDDLE_QUEST_HOSTED_EMULATOR === "1") await driver.waitForId("screen-hosted-home", 60_000);
  await driver.tapIdUntil("play-offline", "menu-heading");
  assert.equal(await driver.readCoins(), STARTING_COINS);
};
/** Clears data, launches, and waits for the hosted home once the account is confirmed against the emulators. */
const freshHosted = async (driver) => {
  driver.stop();
  driver.clearData();
  driver.launch();
  await driver.waitForId("screen-hosted-home", 60_000);
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
    if (process.env.RIDDLE_QUEST_HOSTED_EMULATOR === "1") await driver.waitForId("screen-hosted-home", 60_000);
    await driver.tapIdUntil("play-offline", "menu-heading");
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
    if (process.env.RIDDLE_QUEST_HOSTED_EMULATOR === "1") await driver.waitForId("screen-hosted-home", 60_000);
    await driver.tapIdUntil("play-offline", "menu-heading");
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
      await driver.tapIdUntil("continue-to-menu", "menu-heading");
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

  it("signs in anonymously and provisions a hosted account against the Firebase emulators", {skip: process.env.RIDDLE_QUEST_HOSTED_EMULATOR !== "1" && "set RIDDLE_QUEST_HOSTED_EMULATOR=1 with the Firebase emulators running"}, async () => {
    const driver = scenario("hosted-account");
    await freshHosted(driver);
    driver.capture("hosted-home");
    await driver.waitFor("server coins on the home", (node) => node.label === `Coins: ${STARTING_COINS}`);
    await driver.tapId("show-account");
    await driver.waitForId("account-ready", 60_000);
    driver.capture("account-ready");
    assert.equal(await driver.readText("account-status"), "Account created.");
    const coins = await driver.waitFor("server coins", (node) => /^Server coins: \d+$/u.test(node.label ?? ""));
    assert.equal(coins.label, "Server coins: 300");
    await driver.tapId("back");
    await driver.waitForId("screen-hosted-home");
    // The offline game stays one tap away and the confirmed account survives the round trip.
    await driver.tapId("play-offline");
    await driver.waitForId("menu-heading");
    driver.capture("offline-menu");
    await driver.tapId("play-online");
    await driver.waitForId("screen-hosted-home");
    driver.stop();
    driver.launch();
    await driver.waitForId("screen-hosted-home", 60_000);
    await driver.tapId("show-account");
    await driver.waitForId("account-ready", 60_000);
    assert.equal(await driver.readText("account-status"), "Account confirmed.");
  });

  it("shows the profile and leaderboard, renames the player, and deletes the account into a fresh one", {skip: process.env.RIDDLE_QUEST_HOSTED_EMULATOR !== "1" && "set RIDDLE_QUEST_HOSTED_EMULATOR=1 with the Firebase emulators running"}, async () => {
    const driver = scenario("hosted-profile");
    await freshHosted(driver);
    await driver.tapId("show-profile");
    await driver.waitForId("profile-summary", 60_000);
    // Lower panels sit below the fold; uiautomator only reports what is on screen.
    await driver.findScrolling("leaderboard-rows", 60_000);
    driver.capture("profile-leaderboard");
    const name = `Rq${Date.now().toString(36).slice(-6)}`;
    driver.tap(await driver.findScrolling("profile-username-input"));
    driver.adb("shell", "input", "text", name);
    driver.adb("shell", "input", "keyevent", "KEYCODE_BACK");
    driver.tap(await driver.findScrolling("profile-username-save"));
    const notice = await driver.findScrolling("profile-username-notice");
    assert.equal(notice.text, "Username updated successfully!");
    await driver.findScrolling("profile-username");
    await driver.waitFor("renamed profile", (node) => node.text === name, 30_000);
    driver.capture("profile-renamed");
    driver.tap(await driver.findScrolling("profile-delete"));
    driver.tap(await driver.findScrolling("profile-delete-confirm-button"));
    await driver.waitForId("screen-hosted-home", 60_000);
    await driver.tapId("show-account");
    await driver.waitForId("account-ready", 60_000);
    driver.capture("profile-deleted-fresh-account");
    assert.equal(await driver.readText("account-status"), "Account created.");
  });

  it("selects a native avatar from Downloads and keeps the server-confirmed image after relaunch", {
    skip: process.env.RIDDLE_QUEST_HOSTED_EMULATOR !== "1" && "set RIDDLE_QUEST_HOSTED_EMULATOR=1 with Auth, Functions, Firestore and Storage emulators running",
  }, async () => {
    /** Picker and profile evidence belong to this single seeded account. */
    const driver = scenario("hosted-avatar");
    await freshHosted(driver);
    // Reuse a deterministic bundled PNG; the picker must decode, crop and encode its actual bytes.
    driver.adb("shell", "mkdir", "-p", "/sdcard/Download");
    driver.adb("push", join(repositoryRoot, "assets/images-web/chest-closed.png"), "/sdcard/Download/riddle-quest-avatar.png");
    driver.adb("shell", "am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", "file:///sdcard/Download/riddle-quest-avatar.png");
    await driver.tapId("show-profile");
    await driver.waitForId("profile-username");
    await driver.tapId("profile-avatar-select");
    await driver.waitFor("system document picker", node => /documentsui/u.test(node.package ?? ""));
    driver.capture("system-avatar-picker");
    /** The permission-free system picker may start in Recent or its previous folder. */
    let selected = driver.dumpUi().find(node => /riddle-quest-avatar(?:\.png)?/u.test(`${node.text ?? ""} ${node.label ?? ""}`));
    if (!selected) {
      driver.tap(await driver.waitFor("picker location menu", node => node.label === "Show roots"));
      driver.tap(await driver.waitFor("Downloads folder", node => node.text === "Downloads"));
      selected = await driver.waitFor("seeded avatar PNG", node => /riddle-quest-avatar(?:\.png)?/u.test(`${node.text ?? ""} ${node.label ?? ""}`));
    }
    driver.tap(selected);
    assert.equal(await driver.readText("profile-avatar-notice"), "Avatar updated successfully!");
    await driver.waitForId("profile-avatar");
    driver.capture("avatar-server-confirmed");
    driver.stop(); driver.launch();
    await driver.waitForId("screen-hosted-home", 60_000);
    await driver.tapId("show-profile");
    await driver.waitForId("profile-avatar");
    driver.capture("avatar-persisted");
  });

  it("opens the Google Play shop from the hosted home and reports the store the device offers", {skip: process.env.RIDDLE_QUEST_HOSTED_EMULATOR !== "1" && "set RIDDLE_QUEST_HOSTED_EMULATOR=1 with the Firebase emulators running"}, async () => {
    const driver = scenario("hosted-shop");
    await freshHosted(driver);
    await driver.tapId("show-shop");
    await driver.waitForId("shop-heading", 30_000);
    driver.capture("shop-open");
    assert.equal(await driver.readText("shop-heading"), "COIN SHOP");
    // The native module always answers: without the Play Store Play Billing is unavailable, and with
    // it a build Play does not know prices no products. Purchases need an internal-testing install.
    const state = await driver.waitFor("shop store state", (node) => ["shop-unavailable", "shop-empty", "shop-load-failed"].includes(node.id), 60_000);
    driver.capture(`shop-${state.id}`);
    await driver.tapId("shop-restore");
    // Restore talks to Play and the backend; with nothing owned it either confirms or reports the store error.
    const notice = await driver.waitFor("restore result", (node) => node.id === "shop-notice", 60_000);
    driver.capture("shop-restore");
    assert.match(notice.text ?? notice.label ?? "", /Purchases restored\.|Purchase failed\. Please try again\./u);
    await driver.tapId("back");
    await driver.waitForId("screen-hosted-home");
  });

  it("plays a server-issued Classic riddle through the shared hosted services against the emulators", {skip: process.env.RIDDLE_QUEST_HOSTED_EMULATOR !== "1" && "set RIDDLE_QUEST_HOSTED_EMULATOR=1 with seeded Firebase emulators running"}, async () => {
    const driver = scenario("hosted-classic");
    await freshHosted(driver);
    await driver.tapId("hosted-play-classic");
    await driver.waitForId("screen-hosted-game", 60_000);
    const riddle = await driver.readText("hosted-riddle-text");
    driver.capture("hosted-classic-riddle");
    await driver.waitFor("server coins", (node) => node.label === `Coins: ${STARTING_COINS}`);
    // The emulator seed issues the bundled pack's playable riddles in order, so index 1 is the first of them.
    const seeded = answers.classic.filter((answer) => /^[a-z]{1,7}$/u.test(answer));
    // Provisional Play: a wrong guess sent while the device is offline is journaled and redelivered on the next launch.
    driver.adb("shell", "svc", "wifi", "disable");
    driver.adb("shell", "svc", "data", "disable");
    try {
      await driver.typeAnswer("z".repeat(seeded[0].length));
      await driver.tapId("hosted-submit");
      await driver.waitForId("hosted-notice", 120_000);
      driver.capture("hosted-offline-guess");
    } finally {
      driver.adb("shell", "svc", "wifi", "enable");
      driver.adb("shell", "svc", "data", "enable");
    }
    driver.stop();
    driver.launch();
    await driver.waitForId("screen-hosted-home", 60_000);
    await driver.tapId("hosted-play-classic");
    await driver.waitForId("screen-hosted-game", 60_000);
    await driver.waitForId("hosted-guess-row-0", 60_000);
    driver.capture("hosted-redelivered-guess");
    // The unsent draft survives a process kill too.
    await driver.typeAnswer(seeded[0].slice(0, 2));
    await driver.waitFor("committed second draft letter", node => node.id === "hosted-slot-1" && (node.label ?? "").endsWith(`2: ${seeded[0][1]}`));
    driver.capture("hosted-draft-before-kill");
    driver.stop();
    driver.launch();
    await driver.waitForId("screen-hosted-home", 60_000);
    await driver.tapId("hosted-play-classic");
    await driver.waitForId("screen-hosted-game", 60_000);
    // Slots render letters in upper case, so read the slot's accessible description rather than its glyph.
    await driver.waitFor("restored first draft letter", (node) => node.id === "hosted-slot-0" && (node.label ?? "").endsWith(`1: ${seeded[0][0]}`));
    await driver.waitFor("restored second draft letter", (node) => node.id === "hosted-slot-1" && (node.label ?? "").endsWith(`2: ${seeded[0][1]}`));
    driver.capture("hosted-restored-draft");
    await driver.typeAnswer(seeded[0].slice(2));
    await driver.tapId("hosted-submit");
    assert.equal(await driver.readText("hosted-result-heading"), "Solved!");
    driver.capture("hosted-classic-solved");
    const earned = await driver.readText("hosted-result-coins");
    assert.match(earned, /Coins earned: [1-9]\d*$/u);
    await driver.tapId("hosted-next");
    await driver.waitForId("screen-hosted-game", 60_000);
    assert.notEqual(await driver.readText("hosted-riddle-text"), riddle, "the next server-issued riddle differs");
    const coins = await driver.waitFor("updated server coins", (node) => /^Coins: \d+$/u.test(node.label ?? "") && node.label !== `Coins: ${STARTING_COINS}`);
    assert.ok(Number(/\d+/u.exec(coins.label)[0]) > STARTING_COINS, "the confirmed balance grew after the win");
    driver.capture("hosted-classic-next");
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
    await driver.tapIdUntil("play-offline", "guess-row-0");
    driver.stop();
    driver.launch();
    if (process.env.RIDDLE_QUEST_HOSTED_EMULATOR === "1") await driver.waitForId("screen-hosted-home", 60_000);
    await driver.tapIdUntil("play-offline", "riddle-text");
    await driver.waitForId("guess-row-0");
    driver.capture("restored");
    await driver.typeAnswer(answers.classic[0]);
    await driver.tapId("submit");
    assert.equal(await driver.readText("result-heading"), "Solved!");
    assert.match(await driver.readText("result-attempts"), /2$/u);
  });
  it("plays a live match, recovers the exact seat and unsent input, and confirms quitting", {
    skip: process.env.RIDDLE_QUEST_HOSTED_EMULATOR !== "1" && "set RIDDLE_QUEST_HOSTED_EMULATOR=1 with seeded Firebase emulators running",
  }, async () => {
    const driver = scenario("hosted-live-race");
    await freshHosted(driver);
    await driver.tapId("show-race");
    await driver.waitForId("race-category-mixed", 60_000);
    await driver.tapId("race-category-mixed");
    await driver.tapId("race-start");
    await driver.waitForId("race-riddle", 60_000);
    driver.capture("live-race-ready");
    const answer = answers.raceByClue[await driver.readText("race-riddle")];
    assert.ok(answer, "every issued race clue comes from the reviewed emulator seed");
    await driver.typeAnswer(answer);
    await driver.tapId("race-submit");
    await driver.waitFor("confirmed first race point", node => node.id === "race-player-score" && node.text === "1/10", 30_000);
    const nextClue = await driver.readText("race-riddle");
    const nextAnswer = answers.raceByClue[nextClue];
    await driver.typeAnswer(nextAnswer.slice(0, 1));
    driver.capture("live-race-draft");
    driver.stop(); driver.launch();
    await driver.waitForId("screen-hosted-home", 60_000);
    await driver.tapId("show-race");
    await driver.waitForId("race-riddle", 60_000);
    assert.equal(await driver.readText("race-riddle"), nextClue, "cold recovery resumes the acknowledged seat's current question");
    await driver.waitFor("restored race draft", node => node.id === "race-slot-0" && (node.label ?? "").endsWith(`1: ${nextAnswer[0]}`));
    driver.capture("live-race-restored");
    await driver.tapId("race-close");
    await driver.waitForId("race-quit-confirm");
    await driver.tapId("race-keep-playing");
    await driver.waitForId("race-riddle");
    await driver.tapId("race-close");
    await driver.tapId("race-quit-confirm");
    await driver.waitForId("screen-hosted-home", 60_000);
  });

  it("accepts a private invitation on a second device and settles one shared race result", {
    skip: (process.env.RIDDLE_QUEST_HOSTED_EMULATOR !== "1" || !process.env.RIDDLE_QUEST_SECOND_SERIAL || !process.env.FIRESTORE_EMULATOR_HOST) &&
      "set hosted/emulator variables and RIDDLE_QUEST_SECOND_SERIAL for two-device verification",
  }, async () => {
    const creator = scenario("two-device-race-creator");
    const recipient = createDriver({serial: process.env.RIDDLE_QUEST_SECOND_SERIAL, evidenceDirectory: join(evidenceRoot, "two-device-race-recipient")});
    if (process.env.RIDDLE_QUEST_SKIP_INSTALL !== "1") recipient.install(process.env.RIDDLE_QUEST_APK ?? defaultApk);
    await freshHosted(creator); await freshHosted(recipient);
    const createdAfter = Date.now();
    await creator.tapId("show-race");
    await creator.waitForId("race-category-mixed", 60_000);
    await creator.tapId("race-category-mixed");
    await creator.tapId("race-create-challenge");
    await creator.waitForId("race-share", 60_000);
    await creator.tapId("race-share");
    await creator.waitFor("Android share sheet", node => /intentresolver|ResolverActivity/u.test(`${node.package ?? ""} ${node.class ?? ""}`), 15_000);
    creator.capture("native-share-sheet");
    creator.adb("shell", "input", "keyevent", "KEYCODE_BACK");
    await creator.waitForId("race-share");
    // The test reads only the local emulator to deliver the same opaque URL as Android's share sheet.
    const requireFromFunctions = createRequire(join(repositoryRoot, "firebase-functions/package.json"));
    const {getApps, initializeApp} = requireFromFunctions("firebase-admin/app");
    const {getFirestore} = requireFromFunctions("firebase-admin/firestore");
    const app = getApps().find(value => value.name === "android-device-race") ?? initializeApp({projectId: "riddle-quest-ec2b2"}, "android-device-race");
    const tickets = await getFirestore(app).collection("liveRaceTickets").where("privateChallenge", "==", true).get();
    const ticket = tickets.docs.filter(value => value.data().createdAtMs >= createdAfter && !value.data().cancelled)
      .sort((left, right) => right.data().createdAtMs - left.data().createdAtMs)[0];
    assert.ok(ticket, "creator has exactly an acknowledged private lobby in the emulator");
    const challengeId = `live_${ticket.id}`;
    recipient.adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", `riddlequest://race?challengeId=${challengeId}`, "com.roobsworld.riddlequest");
    await recipient.waitForId(`race-accept-${challengeId}`, 60_000);
    await recipient.tapId(`race-accept-${challengeId}`);
    await Promise.all([creator.waitForId("race-riddle", 60_000), recipient.waitForId("race-riddle", 60_000)]);
    assert.equal(await creator.readText("race-riddle"), await recipient.readText("race-riddle"), "both native devices receive the same authoritative first question");
    creator.capture("paired"); recipient.capture("paired");
    for (let index = 0; index < 10; index++) {
      const clue = await creator.readText("race-riddle");
      const answer = answers.raceByClue[clue];
      assert.ok(answer, `seeded answer exists for ${clue}`);
      await creator.typeAnswer(answer); await creator.tapId("race-submit");
      if (index < 9) await creator.waitFor("next authoritative point", node => node.id === "race-player-score" && node.text === `${index + 1}/10`, 30_000);
    }
    assert.equal(await creator.readText("race-result-title"), "You win!");
    assert.equal(await recipient.readText("race-result-title"), "Opponent wins");
    assert.equal(await creator.readText("race-reward"), "+50 coins");
    creator.capture("result"); recipient.capture("result");
    await getFirestore(app).terminate();
  });

});
