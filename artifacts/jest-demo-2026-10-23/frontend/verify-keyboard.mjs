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
const artifact = process.env.MOBILE_JEST_ARTIFACT ?? path.join(root, "artifacts/jest-e2e-2026-10-22/jest-artifact-journal");
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
async function open(viewport = {width: 320, height: 568}, holdJournal = false, sdkOnlyStartup = false) {
  const context = await browser.newContext({viewport, hasTouch: true});
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);
  const errors = [];
  const external = [];
  let releaseJournal;
  let journalRequests = 0;
  const journalGate = new Promise(resolve => {releaseJournal = resolve;});
  page.on("pageerror", error => errors.push({kind: "page", message: error.message}));
  page.on("console", message => {if (message.type() === "error") errors.push({kind: "console", message: message.text()});});
  await context.route("**/*", async route => {
    if (new URL(route.request().url()).origin === origin) {
      if (holdJournal && /\/journalWriter-[^/]+\.js$/.test(new URL(route.request().url()).pathname)) {
        journalRequests += 1;
        await journalGate;
      }
      return route.continue();
    }
    if (!route.request().url().startsWith("https://cdn.jest.com/")) external.push(route.request().url());
    return route.fulfill({status: 200, contentType: "application/javascript", body: ""});
  });
  await page.addInitScript(({ids, sdkOnlyStartup}) => {
    window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
    if (sdkOnlyStartup) {
      window.__startupJournalWrites = [];
      window.__startupHadJournal = Object.keys(localStorage).some(key => key.startsWith("riddleQuest:pendingPlay:v1:"));
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key.startsWith("riddleQuest:pendingPlay:v1:"))
          window.__startupJournalWrites.push(JSON.parse(value).draft);
        return setItem.call(this, key, value);
      };
      if (!localStorage.getItem("riddleQuest:mockJestPlayerData")) localStorage.setItem("riddleQuest:mockJestPlayerData", JSON.stringify({
        schemaVersion: 1, updatedAt: 1000, activeGame: {
          schemaVersion: 1, savedAt: 1000, riddleId: "classic-fake-1", gameMode: "classic",
          sessionToken: "00000000-0000-4000-8000-000000000001", currentLetters: ["P", "I", "A", "", ""],
          activeSlotIndex: 3, hintRevealedIndices: [0], guesses: [],
          engineSnapshot: {guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false},
          awaitingContinue: false, letterStates: {p: "green"},
        },
      }));
      const dispatch = window.dispatchEvent.bind(window);
      window.dispatchEvent = event => {
        const message = event instanceof CustomEvent ? event.detail : undefined;
        if (event.type === "riddle-quest:host-to-game" && message?.type === "host:riddleLoaded" &&
          message.payload?.riddle?.riddleId === "classic-fake-1") {
          return dispatch(new CustomEvent(event.type, {detail: {...message, payload: {...message.payload,
            riddle: {...message.payload.riddle, revealedHints: [{index: 0, letter: "P"}]}}}}));
        }
        return dispatch(event);
      };
    }
    window.__mobileCommands = [];
    window.addEventListener("riddle-quest:game-to-host", event => {
      if (event instanceof CustomEvent) window.__mobileCommands.push({type: event.detail?.type, payload: event.detail?.payload});
    });
    for (const id of ids) localStorage.setItem(`riddleQuest:tooltipSeen:${id}:jest-guest`, "seen");
    localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v4:jest-guest", "seen");
    localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:v3:jest-guest", "seen");
    sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
  }, {ids: tooltipIds, sdkOnlyStartup});
  activePage = page;
  activeRun = {context, page, errors, external, releaseJournal, journalRequests: () => journalRequests};
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
  browser = await chromium.launch({headless:true});
  for (const method of ["keyboard.type", "same-task-keydown", "microtask-keydown", "keydown-up-sequence"]) {
    await check(method + " retains every burst letter", async () => {
      const run = await open({width:402,height:682});
      const {page} = run;
      const draft = page.locator(".guess-board .guess-row").first();
      await page.waitForFunction(() => !document.querySelector("main.game-app")?.inert);
      await expect(page.locator(".keyboard button").first()).toBeEnabled();
      await page.evaluate(() => {
        window.__inputEvents = [];
        for (const kind of ["keydown","keyup","beforeinput","input"]) window.addEventListener(kind, event => {
          window.__inputEvents.push({kind,key:event.key,data:event.data,inputType:event.inputType,prevented:event.defaultPrevented,composing:event.isComposing,target:event.target?.tagName,at:performance.now()});
        });
      });
      const observations = [];
      for (let lap=0;lap<6;lap++) {
        await draft.locator("button").first().click();
        if (method === "keyboard.type") await page.keyboard.type("STA", {delay:0});
        else if (method === "keydown-up-sequence") {
          for (const letter of "STA") {await page.keyboard.down(letter);await page.keyboard.up(letter);}
        } else await page.evaluate(async method => {
          for (const key of "STA") {
            document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key,bubbles:true,cancelable:true}));
            document.activeElement.dispatchEvent(new KeyboardEvent("keyup",{key,bubbles:true,cancelable:true}));
            if (method === "microtask-keydown") await Promise.resolve();
          }
        }, method);
        await expect(draft).toHaveText("STA");
        observations.push({lap,draft:await draft.innerText(),events:await page.evaluate(()=>window.__inputEvents.splice(0))});
        for (let i=0;i<3;i++) await page.locator(".keyboard").getByRole("button",{name:"Backspace",exact:true}).click();
        await expect(draft).toHaveText("");
      }
      clean(run);
      return {observations};
    });
  }
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
  const after=await manifest(artifact);
  evidence.artifactUnchanged=JSON.stringify(originalManifest)===JSON.stringify(after);
  evidence.finishedAt=new Date().toISOString();
  await writeFile(path.join(output,"keyboard-results.json"),JSON.stringify(evidence,null,2)+"\n");
}
if(evidence.failures.length) process.exitCode=1;
