import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createServer} from "node:http";
import {createRequire} from "node:module";
import {readdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

/** This runner serves only the immutable uploaded artifact, with the game's injected mock host. */
const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, "../../..");
const artifact = process.env.MOBILE_JEST_ARTIFACT ?? path.join(root, "artifacts/jest-instructions-modal-2026-10-22/jest-artifact");
const require = createRequire(path.join(root, "packages/portal/package.json"));
const {chromium, expect} = require("@playwright/test");
const evidence = {startedAt: new Date().toISOString(), artifact, scope: "Immutable Jest artifact; injected mock provider; no real provider writes", cases: [], failures: []};
const types = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".webm": "audio/webm", ".woff2": "font/woff2", ".ttf": "font/ttf", ".txt": "text/plain"};
/** Produces a sorted content manifest so any mutation of the exact artifact is detected. */
async function manifest(directory, prefix = "") {
  const rows = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) rows.push(...await manifest(path.join(directory, entry.name), relative));
    else {
      const bytes = await readFile(path.join(directory, entry.name));
      rows.push({file: relative, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex")});
    }
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file));
}
const originalManifest = await manifest(artifact);
evidence.artifactFiles = originalManifest.length;
evidence.artifactBytes = originalManifest.reduce((sum, item) => sum + item.bytes, 0);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = path.join(artifact, pathname === "/" || !path.extname(pathname) ? "index.html" : pathname);
  try {response.writeHead(200, {"Content-Type": types[path.extname(file)] ?? "application/octet-stream"}); response.end(await readFile(file));}
  catch {response.writeHead(404).end();}
});
let browser;
let activePage;
let activeRun;
const tooltipIds = ["submitAnswer", "gameCoins", "gameHint", "gameSkip", "gameMultiplayer", "hintAfterWrongGuess", "achievementEarned", "leaderboardFifthCorrectAnswer", "classicFromDaily", "profileProgression", "profileIdentity", "profileDailyPuzzles", "profileStats", "profileAchievements", "profileRanks", "profileStatistics", "profileLeaderboard", "profileTreasure"];
/** Opens a fresh touch-enabled player and records errors without replacing any game behavior. */
async function open(viewport = {width: 320, height: 568}) {
  const context = await browser.newContext({viewport, hasTouch: true});
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);
  const errors = [];
  const external = [];
  page.on("pageerror", error => errors.push({kind: "page", message: error.message}));
  page.on("console", message => {if (message.type() === "error") errors.push({kind: "console", message: message.text()});});
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    if (!route.request().url().startsWith("https://cdn.jest.com/")) external.push(route.request().url());
    return route.fulfill({status: 200, contentType: "application/javascript", body: ""});
  });
  await page.addInitScript(ids => {
    window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
    window.__mobileCommands = [];
    window.addEventListener("riddle-quest:game-to-host", event => {
      if (event instanceof CustomEvent) window.__mobileCommands.push({type: event.detail?.type, payload: event.detail?.payload});
    });
    for (const id of ids) localStorage.setItem(`riddleQuest:tooltipSeen:${id}:jest-guest`, "seen");
    localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v4:jest-guest", "seen");
    localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:v3:jest-guest", "seen");
    sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
  }, tooltipIds);
  activePage = page;
  activeRun = {context, page, errors, external};
  await page.goto(origin + "/?harness=jest&dailyCompleted=1");
  await onboard(page);
  await expect(page.locator(".riddle-card h1")).toContainText("What has keys");
  return activeRun;
}
/** Completes the visible first-run flow, including after a mock-host reload. */
async function onboard(page) {
  const play = page.getByRole("button", {name: "Let's Play", exact: true});
  await play.waitFor({timeout: 20_000});
  await page.locator(".onboarding-card").first().evaluate(card => Promise.all(card.getAnimations({subtree: true}).map(animation => animation.finished.catch(() => undefined))));
  await play.click();
  await page.locator(".onboarding-card").getByRole("button", {name: /got it/i}).click();
  await page.locator(".onboarding-card").waitFor({state: "hidden"});
  await page.locator(".game-bottom-navigation").waitFor();
}
/** Enters real letters using the game's touch keyboard. */
async function type(page, word) {
  for (const letter of word) await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).tap();
}
/** Taps a visibly enabled control at a verified hit-test point without waiting for decorative transforms to stop. */
async function tapControl(page, selector) {
  const control = page.locator(selector);
  await expect(control).toBeEnabled();
  await expect(control).toBeInViewport();
  const point = await control.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    if (!element.contains(document.elementFromPoint(x, y))) throw new Error("A visible overlay blocks this control");
    return {x, y};
  });
  await page.touchscreen.tap(point.x, point.y);
}
/** Reads the visible wallet, independent of animation state. */
async function balance(page) {return Number((await page.locator("[data-coin-meter] strong").innerText()).replace(/[^\d]/g, ""));}
/** Keeps ordinary browser errors fatal; only deliberate offline resource failures are classified. */
function clean(run, offline = false) {
  assert.deepEqual(run.external, []);
  assert.deepEqual(run.errors.filter(error => !(offline && error.kind === "console" && error.message === "Failed to load resource: net::ERR_INTERNET_DISCONNECTED")), []);
}
/** Runs each independent journey once and preserves the first failing user state. */
async function check(name, body) {
  if (process.env.MOBILE_CASE_FILTER && !name.includes(process.env.MOBILE_CASE_FILTER)) return;
  console.log("Checking " + name);
  try {
    const details = await body();
    evidence.cases.push({name, passed: true, ...details});
    console.log("PASS " + name);
  } catch (error) {
    const slug = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    if (activePage && !activePage.isClosed()) {
      await activePage.screenshot({path: path.join(output, slug + "-failure.png"), fullPage: true}).catch(() => undefined);
      await writeFile(path.join(output, slug + "-failure.json"), JSON.stringify({body: await activePage.locator("body").innerText(), commands: await activePage.evaluate(() => window.__mobileCommands), errors: activeRun?.errors}, null, 2) + "\n");
    }
    evidence.failures.push({name, message: error.stack ?? String(error)});
    console.error("FAIL " + name + ": " + error.message);
  } finally {
    await activeRun?.context.close();
    activePage = undefined;
    activeRun = undefined;
    await writeFile(path.join(output, process.env.MOBILE_RESULT_FILE ?? "results.json"), JSON.stringify(evidence, null, 2) + "\n");
  }
}
await new Promise((resolve, reject) => {server.once("error", reject); server.listen(0, "127.0.0.1", resolve);});
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  browser = await chromium.launch({headless: true});
  await check("touch viewport soak and modal keyboard isolation", async () => {
    const run = await open();
    const {page} = run;
    await type(page, "PI");
    const draft = page.locator(".guess-board .guess-row").first();
    const sizes = [{width: 320, height: 568}, {width: 402, height: 682}, {width: 390, height: 844}, {width: 844, height: 390}];
    const observations = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const size of sizes) {
        await page.setViewportSize(size);
        await expect(draft).toHaveText("PI");
        await expect(page.locator(".submit-action")).toBeInViewport();
        await expect(page.getByRole("button", {name: "Settings", exact: true})).toBeInViewport();
        await page.getByRole("button", {name: "Settings", exact: true}).tap();
        await page.getByRole("button", {name: "Help", exact: false}).tap();
        const help = page.locator(".modal-instructions");
        await expect(help).toBeVisible();
        for (const key of ["t", "Backspace", "ArrowLeft", "ArrowRight"]) await page.keyboard.press(key);
        await expect(draft).toHaveText("PI");
        for (let index = 0; index < 6; index++) {
          await page.keyboard.press(index % 2 ? "Shift+Tab" : "Tab");
          assert.equal(await help.evaluate(element => element.contains(document.activeElement)), true);
        }
        const metrics = await help.evaluate(element => ({width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, client: element.clientHeight, scroll: element.scrollHeight, buttonHeight: element.querySelector(".play-primary").getBoundingClientRect().height}));
        assert.ok(metrics.documentWidth <= size.width + 1);
        assert.ok(metrics.buttonHeight >= 48);
        if (size.height >= 568) assert.ok(metrics.scroll <= metrics.client + 1, JSON.stringify(metrics));
        await help.locator(".play-primary").focus();
        await page.keyboard.press("Enter");
        await expect(help).toHaveCount(0);
        await expect(draft).toHaveText("PI");
        observations.push({cycle, ...metrics});
      }
    }
    await page.setViewportSize({width: 320, height: 568});
    await page.getByRole("button", {name: "Profile", exact: true}).tap();
    const profile = page.locator(".modal-profile");
    await expect(profile).toBeVisible();
    for (const key of ["a", "Backspace", "ArrowRight"]) await page.keyboard.press(key);
    await expect(draft).toHaveText("PI");
    await page.keyboard.press("Escape");
    await expect(profile).toHaveCount(0);
    await page.keyboard.press("a");
    await expect(draft).toHaveText("PIA");
    await page.screenshot({path: path.join(output, "soak-320-final.png")});
    clean(run);
    return {resizeCycles: 3, observations, preservedDraftAfterDialogs: "PI", playableDraftAfterReturn: "PIA"};
  });
  await check("offline Help keyboard return then durable draft reload", async () => {
    const run = await open({width: 402, height: 682});
    const {page, context} = run;
    await type(page, "PI");
    const draft = page.locator(".guess-board .guess-row").first();
    await page.getByRole("button", {name: "Settings", exact: true}).tap();
    await page.getByRole("button", {name: "Help", exact: false}).tap();
    const help = page.locator(".modal-instructions");
    await context.setOffline(true);
    const offline = page.getByRole("alertdialog", {name: "No Internet Connection", exact: true});
    await expect(offline).toBeVisible();
    await expect(offline).toBeFocused();
    for (const key of ["a", "Backspace", "Enter", "Escape", "Tab", "Shift+Tab"]) await page.keyboard.press(key);
    await page.setViewportSize({width: 320, height: 568});
    await expect(offline).toBeFocused();
    await expect(draft).toHaveText("PI");
    await page.screenshot({path: path.join(output, "offline-help-320.png")});
    await context.setOffline(false);
    await expect(offline).toHaveCount(0);
    await expect(help).toBeVisible();
    await help.locator(".play-primary").tap();
    await expect(draft).toHaveText("PI");
    await page.reload();
    await onboard(page);
    await expect(draft).toHaveText("PI");
    await expect(draft.locator(".cell").nth(2)).toHaveAttribute("aria-current", "true");
    await type(page, "ANO");
    await expect(draft).toHaveText("PIANO");
    await tapControl(page, ".submit-action");
    await expect(page.locator(".modal-victory .reward-continue")).toBeEnabled();
    clean(run, true);
    return {draftAfterOfflineAndReload: "PI", cursorAfterReload: 2, resumedAnswer: "PIANO", victoryReachable: true, expectedOfflineResourceErrors: run.errors.length};
  });
  await check("hint lock survives reload then paid Skip loads a playable successor", async () => {
    const run = await open();
    const {page} = run;
    const initial = await balance(page);
    await page.getByRole("button", {name: /^hint$/i}).tap();
    await page.locator(".modal-hint .play-primary").tap();
    await expect(page.locator(".modal-hint")).toHaveCount(0);
    const draft = page.locator(".guess-board .guess-row").first();
    await expect(draft).toHaveText("P");
    await expect.poll(() => balance(page)).toBe(initial - 25);
    await type(page, "IA");
    await expect(draft).toHaveText("PIA");
    await page.reload();
    await onboard(page);
    await expect(draft).toHaveText("PIA");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await expect(draft).toHaveText("P");
    // The injected authority is reconstructed on reload; measure the live wallet rather than treating its reset as a real grant.
    const restoredAuthorityCoins = await balance(page);
    await page.getByRole("button", {name: /^skip$/i}).tap();
    await page.locator(".modal-skip .play-primary").tap();
    await expect(page.locator(".riddle-card h1")).toContainText("face and hands");
    await expect.poll(() => balance(page)).toBe(restoredAuthorityCoins - 100);
    await expect(page.locator(".guess-board .guess-row").first()).toHaveText("");
    await type(page, "CLOCK");
    await tapControl(page, ".submit-action");
    await expect(page.locator(".modal-victory .reward-continue")).toBeEnabled();
    clean(run);
    return {initialCoins: initial, coinsAfterHint: initial - 25, restoredMockAuthorityCoins: restoredAuthorityCoins, coinsAfterSkip: restoredAuthorityCoins - 100, lockedHint: "P", successorAnswer: "CLOCK", fixtureLimit: "Fresh fake authority resets profile wallet/index on reload; settled paid-Skip authority reload is not claimed."};
  });
  await check("exhausted attempts stay blocked during purchase reward and paid sixth wins", async () => {
    const run = await open({width: 402, height: 682});
    const {page} = run;
    const initial = await balance(page);
    for (const letter of "ABCDE") {
      await type(page, letter.repeat(5));
      await tapControl(page, ".submit-action");
      if (letter !== "E") await expect(page.locator(".guess-row .cell.red")).not.toHaveCount(0);
    }
    await expect(page.locator(".modal-continue")).toBeVisible();
    const exhaustedRows = await page.locator(".guess-row").allTextContents();
    assert.deepEqual(exhaustedRows, ["aaaaa", "bbbbb", "ccccc", "ddddd", "eeeee"]);
    await page.getByRole("button", {name: "Open Shop", exact: true}).tap();
    const starter = page.locator(".game-shop-grid article:not(.shop-subscription-card)").first();
    await starter.getByRole("button").tap();
    await expect(page.locator(".fanfare-tabs")).toBeVisible();
    await page.keyboard.type("PIANO");
    await page.keyboard.press("Enter");
    await expect(page.locator(".submit-action")).toBeDisabled();
    assert.deepEqual(await page.locator(".guess-row").allTextContents(), exhaustedRows);
    await page.screenshot({path: path.join(output, "exhausted-purchase-reward.png")});
    await page.locator(".fanfare-tabs").waitFor({state: "hidden", timeout: 15_000});
    await expect.poll(() => balance(page)).toBe(initial + 250);
    if (await page.locator(".modal-shop").count()) await page.locator(".modal-shop .modal-x").tap();
    await expect(page.locator(".modal-continue")).toBeVisible();
    await page.getByRole("button", {name: "Use 50 Coins to Try Again", exact: true}).tap();
    await expect(page.locator(".modal-continue")).toHaveCount(0);
    await expect.poll(() => balance(page)).toBe(initial + 200);
    await type(page, "PIANO");
    await expect(page.locator(".guess-row").first()).toHaveText("PIANO");
    await tapControl(page, ".submit-action");
    await expect(page.locator(".modal-victory .reward-continue")).toBeEnabled();
    assert.equal(await page.evaluate(() => window.__mobileCommands.filter(message => message.type === "game:submitGuess").length), 6);
    await page.locator(".modal-victory .reward-continue").tap();
    await expect(page.locator(".riddle-card h1")).toContainText("face and hands");
    await expect(page.locator(".keyboard").getByRole("button", {name: "C", exact: true})).toBeEnabled();
    clean(run);
    return {initialCoins: initial, purchaseGrant: 250, continueCost: 50, paidGuesses: 6, unchangedExhaustedRowsDuringReward: true, successorPlayable: true};
  });
  if (process.env.MOBILE_CASE_FILTER?.includes("diagnose immediate")) await check("diagnose immediate draft reload without observer delay", async () => {
    const observations = [];
    for (const hinted of [false, true]) for (let attempt = 0; attempt < 3; attempt++) {
      const run = await open();
      const {page} = run;
      if (hinted) {
        await page.getByRole("button", {name: /^hint$/i}).tap();
        await page.locator(".modal-hint .play-primary").tap();
        await expect(page.locator(".modal-hint")).toHaveCount(0);
        await expect.poll(() => balance(page)).toBe(275);
      }
      await type(page, hinted ? "IA" : "PIA");
      await expect(page.locator(".guess-row").first()).toHaveText("PIA");
      await page.reload();
      await onboard(page);
      observations.push({hinted, attempt, letters: await page.locator(".guess-row").first().textContent(), storage: await page.evaluate(() => ({...localStorage}))});
      clean(run);
      await run.context.close();
      activeRun = undefined;
      activePage = undefined;
    }
    await writeFile(path.join(output, "immediate-draft-reload.json"), JSON.stringify(observations, null, 2) + "\n");
    return {observations: observations.map(({hinted, attempt, letters}) => ({hinted, attempt, letters}))};
  });

  if (process.env.MOBILE_CASE_FILTER?.includes("diagnose hint")) await check("diagnose hint reload timing", async () => {
    const observations = [];
    for (const settleMs of [0, 1000]) {
      const run = await open();
      const {page} = run;
      const initialCoins = await balance(page);
      await page.getByRole("button", {name: /^hint$/i}).tap();
      await page.locator(".modal-hint .play-primary").tap();
      await expect(page.locator(".modal-hint")).toHaveCount(0);
      const draft = page.locator(".guess-board .guess-row").first();
      await expect(draft).toHaveText("P");
      await expect.poll(() => balance(page)).toBe(initialCoins - 25);
      if (settleMs) await page.waitForTimeout(settleMs);
      await type(page, "IA");
      await expect(draft).toHaveText("PIA");
      if (settleMs) await page.waitForTimeout(settleMs);
      const before = await page.evaluate(() => ({storage: {...localStorage}, cells: Array.from(document.querySelectorAll(".guess-row:first-child .cell")).map(cell => ({text: cell.textContent, selected: cell.getAttribute("aria-current"), disabled: cell.disabled}))}));
      const coinsBefore = await balance(page);
      await page.reload();
      await onboard(page);
      const after = await page.evaluate(() => ({storage: {...localStorage}, cells: Array.from(document.querySelectorAll(".guess-row:first-child .cell")).map(cell => ({text: cell.textContent, selected: cell.getAttribute("aria-current"), disabled: cell.disabled}))}));
      observations.push({settleMs, coinsBefore, coinsAfter: await balance(page), draftAfter: await draft.innerText(), before, after});
      clean(run);
      await run.context.close();
      activePage = undefined;
      activeRun = undefined;
    }
    await writeFile(path.join(output, "hint-reload-timing.json"), JSON.stringify(observations, null, 2) + "\n");
    return {observations: observations.map(({settleMs, coinsBefore, coinsAfter, draftAfter}) => ({settleMs, coinsBefore, coinsAfter, draftAfter}))};
  });

} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  assert.deepEqual(await manifest(artifact), originalManifest);
  evidence.artifactUnchanged = true;
  evidence.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, process.env.MOBILE_RESULT_FILE ?? "results.json"), JSON.stringify(evidence, null, 2) + "\n");
}
console.log(JSON.stringify({cases: evidence.cases.length, failures: evidence.failures.length, artifactUnchanged: evidence.artifactUnchanged}));
if (evidence.failures.length) process.exitCode = 1;
