import assert from "node:assert/strict";
import {createServer} from "node:http";
import {createRequire} from "node:module";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, "../../../..");
const artifact = process.env.FOCUSED_JEST_ARTIFACT ?? path.join(root, "artifacts/jest-route-verification-2026-10-22/browser/jest-artifact");
const require = createRequire(path.join(root, "packages/portal/package.json"));
const {chromium, expect} = require("@playwright/test");
const evidence = {artifact, cases: [], failures: []};
const types = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".webm": "audio/webm",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8"};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = path.join(artifact, pathname === "/" || !path.extname(pathname) ? "index.html" : pathname);
  try {
    response.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
let browser;
const save = () => writeFile(path.join(output, process.env.FOCUSED_RESULT_FILE ?? "results.json"), JSON.stringify(evidence, null, 2) + "\n");
const tooltipIds = ["submitAnswer", "gameCoins", "gameHint", "gameSkip", "gameMultiplayer", "hintAfterWrongGuess",
  "achievementEarned", "leaderboardFifthCorrectAnswer", "classicFromDaily", "profileProgression", "profileIdentity",
  "profileDailyPuzzles", "profileStats", "profileAchievements", "profileRanks", "profileStatistics", "profileLeaderboard", "profileTreasure"];

async function openPage(query = "?harness=jest&dailyCompleted=1", viewport = {width: 390, height: 844}) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors = [];
  const externalRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {if (message.type() === "error") errors.push(message.text());});
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    if (!route.request().url().startsWith("https://cdn.jest.com/")) externalRequests.push(route.request().url());
    return route.fulfill({status: 200, contentType: "application/javascript", body: ""});
  });
  await page.addInitScript(ids => {
    window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
    window.__routeCommands = [];
    window.addEventListener("riddle-quest:game-to-host", event => {
      if (event instanceof CustomEvent && event.detail?.type) window.__routeCommands.push(event.detail.type);
    });
    for (const id of ids) localStorage.setItem(`riddleQuest:tooltipSeen:${id}:jest-guest`, "seen");
    localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v4:jest-guest", "seen");
    localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:v3:jest-guest", "seen");
    sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
  }, tooltipIds);
  await page.goto(origin + "/" + query);
  return {context, page, errors, externalRequests};
}

async function onboard(page) {
  const play = page.getByRole("button", {name: "Let's Play", exact: true});
  await play.waitFor({timeout: 20_000});
  await page.locator(".onboarding-card").first().evaluate(card =>
    Promise.all(card.getAnimations({subtree: true}).map(animation => animation.finished.catch(() => undefined))));
  await play.click();
  await page.locator(".onboarding-card").getByRole("button", {name: /got it/i}).click();
  await page.locator(".onboarding-card").waitFor({state: "hidden"});
  await page.locator(".game-bottom-navigation").waitFor();
}

async function check(name, body) {
  if (process.env.FOCUSED_CASE_FILTER && !name.includes(process.env.FOCUSED_CASE_FILTER)) return;
  console.log("Checking " + name);
  try {
    const details = await body();
    evidence.cases.push({name, passed: true, ...details});
    console.log("PASS " + name);
  } catch (error) {
    evidence.failures.push({name, message: error.stack ?? String(error)});
    console.error("FAIL " + name + ": " + error.message);
  }
  await save();
}

await new Promise((resolve, reject) => {server.once("error", reject); server.listen(0, "127.0.0.1", resolve);});
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  browser = await chromium.launch({headless: true});
  await check("all locale settings and Arabic RTL", async () => {
    const {context, page, errors, externalRequests} = await openPage();
    const selections = [];
    try {
      await onboard(page);
      await page.getByRole("button", {name: "Settings", exact: true}).click();
      const options = await page.locator(".modal-settings select option").evaluateAll(elements =>
        elements.map(option => ({code: option.value, label: option.textContent})));
      assert.equal(options.length, 16);
      for (const {code, label} of options) {
        const catalog = JSON.parse(await readFile(path.join(root, "src/locales", code, "settings.json"), "utf8"));
        await page.locator(".modal-settings select").selectOption(code);
        await expect(page.locator("html")).toHaveAttribute("lang", code);
        await expect(page.locator("html")).toHaveAttribute("dir", code === "ar" ? "rtl" : "ltr");
        await expect(page.locator(".modal-settings h2")).toHaveText(catalog.Settings.TITLE);
        await expect(page.locator(".modal-settings select")).toHaveValue(code);
        const text = await page.locator(".modal-settings").innerText();
        assert.equal(text.includes("Settings.SOUND_TOGGLE"), false);
        assert.equal(text.includes("Settings.LANGUAGE_LABEL"), false);
        await page.locator(".modal-settings .modal-x").click();
        await expect(page.locator(".modal-settings")).toHaveCount(0);
        await page.locator(".game-bottom-navigation button").first().click();
        await expect(page.locator(".modal-settings h2")).toHaveText(catalog.Settings.TITLE);
        if (["en", "ar", "ja", "hi"].includes(code)) await page.screenshot({path: path.join(output, `settings-${code}-390.png`)});
        selections.push({code, label, heading: catalog.Settings.TITLE, direction: code === "ar" ? "rtl" : "ltr"});
      }
      await page.locator(".modal-settings select").selectOption("en");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      assert.deepEqual(errors, []);
      assert.deepEqual(externalRequests, []);
      return {selections};
    } finally {await context.close();}
  });

  for (const surface of ["game", "settings", "multiplayer"]) {
    await check("offline return preserves " + surface + " and draft", async () => {
      const {context, page, errors, externalRequests} = await openPage(surface === "multiplayer"
        ? "?harness=race&dailyCompleted=1" : "?harness=jest&dailyCompleted=1");
      try {
        await onboard(page);
        await expect(page.locator(".keyboard").getByRole("button", {name: "P", exact: true})).toBeEnabled();
        await page.locator(".keyboard").getByRole("button", {name: "P", exact: true}).click();
        await page.locator(".keyboard").getByRole("button", {name: "I", exact: true}).click();
        const draft = page.locator(".game-content .guess-board .guess-row").first();
        await expect(draft).toHaveText("PI");
        if (surface === "settings") await page.getByRole("button", {name: "Settings", exact: true}).click();
        if (surface === "multiplayer") {
          await page.getByRole("button", {name: "Multiplayer", exact: true}).click();
          await page.locator(".race-screen").waitFor();
        }
        const before = await page.evaluate(() => window.__routeCommands.length);
        await context.setOffline(true);
        const offline = page.getByRole("alertdialog", {name: "No Internet Connection", exact: true});
        await expect(offline).toBeVisible();
        await expect(offline).toBeFocused();
        for (const key of ["t", "Backspace", "Enter", "Escape", "Tab", "Shift+Tab"]) await page.keyboard.press(key);
        await expect(offline).toBeFocused();
        await expect(draft).toHaveText("PI");
        const commands = await page.evaluate(index => window.__routeCommands.slice(index), before);
        assert.deepEqual(commands.filter(command => ["game:submitGuess", "game:spendCoins", "game:skipRiddle", "game:completeGame", "game:purchase"].includes(command)), []);
        await page.screenshot({path: path.join(output, `offline-${surface}-390.png`)});
        await context.setOffline(false);
        await expect(offline).toHaveCount(0);
        if (surface === "settings") {
          await expect(page.getByRole("dialog", {name: "Settings", exact: true})).toBeVisible();
          await page.locator(".modal-settings .modal-x").click();
        }
        if (surface === "multiplayer") {
          await expect(page.locator(".race-screen")).toBeVisible();
          await page.locator(".race-screen").getByRole("button", {name: "Close Race to 10", exact: true}).click();
        }
        await page.keyboard.press("a");
        await expect(draft).toHaveText("PIA");
        assert.deepEqual(errors.filter(error => error !== "Failed to load resource: net::ERR_INTERNET_DISCONNECTED"), []);
        assert.deepEqual(externalRequests, []);
        return {draftBefore: "PI", draftAfterReturn: "PIA", protectedCommandsWhileOffline: 0,
          expectedOfflineResourceErrors: errors.filter(error => error === "Failed to load resource: net::ERR_INTERNET_DISCONNECTED").length};
      } finally {await context.close();}
    });
  }

  await check("Third-Party Licenses UI link loads bundled notices", async () => {
    const {context, page, errors, externalRequests} = await openPage();
    try {
      await onboard(page);
      await page.getByRole("button", {name: "Settings", exact: true}).click();
      await page.getByRole("button", {name: "About", exact: false}).click();
      const responsePromise = page.waitForResponse(response => response.url().endsWith("/third-party-licenses.txt"));
      await page.getByRole("link", {name: "Third-Party Licenses", exact: true}).click();
      const response = await responsePromise;
      assert.equal(response.status(), 200);
      const text = await response.text();
      assert.match(text, /Riddle Quest Third-Party Software Notices/);
      assert.match(text, /react@/);
      assert.match(text, /MIT/);
      await expect(page.locator("body")).toContainText("Riddle Quest Third-Party Software Notices");
      await page.screenshot({path: path.join(output, "third-party-licenses.png")});
      assert.deepEqual(errors, []);
      assert.deepEqual(externalRequests, []);
      return {status: response.status(), contentType: response.headers()["content-type"], bytes: Buffer.byteLength(text)};
    } finally {await context.close();}
  });

  await check("unavailable Daily retains Settings and Help recovery after offline return", async () => {
    const {context, page, errors, externalRequests} = await openPage("?harness=jest&dailyUnavailable=1");
    try {
      await expect(page.getByRole("status").filter({hasText: "No daily challenge available at the moment."})).toBeVisible();
      assert.equal(await page.locator(".riddle-card h1").count(), 0);
      await page.getByRole("button", {name: "Settings", exact: true}).click();
      await expect(page.getByRole("dialog", {name: "Settings", exact: true})).toBeVisible();
      await context.setOffline(true);
      await expect(page.getByRole("alertdialog", {name: "No Internet Connection", exact: true})).toBeVisible();
      await context.setOffline(false);
      await expect(page.locator(".offline-backdrop")).toHaveCount(0);
      await expect(page.getByRole("dialog", {name: "Settings", exact: true})).toBeVisible();
      await page.getByRole("button", {name: "Help", exact: false}).click();
      await expect(page.locator(".modal-instructions")).toBeVisible();
      await page.locator(".modal-instructions .play-primary").click();
      await expect(page.getByRole("status").filter({hasText: "No daily challenge available at the moment."})).toBeVisible();
      assert.equal(await page.locator(".riddle-card h1").count(), 0);
      await page.screenshot({path: path.join(output, "daily-unavailable-recovery.png")});
      assert.deepEqual(errors.filter(error => error !== "Failed to load resource: net::ERR_INTERNET_DISCONNECTED"), []);
      assert.deepEqual(externalRequests, []);
      return {unavailableDailyNeverBecameClassic: true, settingsAndHelpReachable: true,
        expectedOfflineResourceErrors: errors.filter(error => error === "Failed to load resource: net::ERR_INTERNET_DISCONNECTED").length};
    } finally {await context.close();}
  });

  await check("guest account deletion is unavailable while registration remains offered", async () => {
    const {context, page, errors, externalRequests} = await openPage();
    try {
      await onboard(page);
      await page.getByRole("button", {name: "Profile", exact: true}).click();
      await expect(page.getByRole("dialog", {name: "Profile", exact: true})).toBeVisible();
      await expect(page.getByRole("button", {name: "Register or Log In", exact: true})).toBeVisible();
      await expect(page.getByRole("button", {name: "Delete Account", exact: true})).toHaveCount(0);
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      assert.equal(await page.evaluate(() => window.__routeCommands.includes("game:deleteAccount")), false);
      await page.screenshot({path: path.join(output, "guest-profile-deletion-unavailable.png")});
      assert.deepEqual(errors, []);
      assert.deepEqual(externalRequests, []);
      return {registrationOffered: true, unsupportedDeletionHidden: true};
    } finally {await context.close();}
  });

  await check("mock account deletion cancels safely then reaches deleted-account screen", async () => {
    const {context, page, errors, externalRequests} = await openPage("?harness=jest&dailyCompleted=1&registered=1");
    try {
      await onboard(page);
      await page.getByRole("button", {name: "Profile", exact: true}).click();
      await page.getByRole("button", {name: "Delete Account", exact: true}).click();
      const confirmation = page.getByRole("alertdialog", {name: "Delete account?", exact: true});
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button", {name: "Cancel", exact: true}).click();
      await expect(confirmation).toHaveCount(0);
      assert.equal(await page.evaluate(() => window.__routeCommands.includes("game:deleteAccount")), false);
      await page.getByRole("button", {name: "Delete Account", exact: true}).click();
      await confirmation.getByRole("button", {name: "Delete Account", exact: true}).click();
      await expect(page.getByRole("heading", {name: "Account deleted", exact: true})).toBeVisible({timeout: 20_000});
      await expect(page.getByText("Your account has been deleted.", {exact: true})).toBeVisible();
      await page.screenshot({path: path.join(output, "mock-account-deleted.png")});
      assert.deepEqual(errors, []);
      assert.deepEqual(externalRequests, []);
      return {injectedMockOnly: true, cancelledBeforeDeletionCommand: true, terminalScreenReached: true};
    } catch (error) {
      await page.screenshot({path: path.join(output, "mock-account-deletion-failure.png")});
      await writeFile(path.join(output, "mock-account-deletion-diagnostic.json"), JSON.stringify({
        text: await page.locator("body").innerText(), commands: await page.evaluate(() => window.__routeCommands), errors, externalRequests,
      }, null, 2) + "\n");
      throw error;
    } finally {await context.close();}
  });
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await save();
}
assert.deepEqual(evidence.failures, []);
console.log(`All ${evidence.cases.length} complementary artifact checks passed.`);
