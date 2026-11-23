import {createServer} from "node:http";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "@playwright/test";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const distRoot = path.join(packageRoot, "builds/jest");
const mime = {".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".webm": "audio/webm", ".woff2": "font/woff2", ".png": "image/png"};
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const filename = path.join(distRoot, url.pathname === "/" ? "index.html" : url.pathname);
  try {
    const body = await readFile(filename);
    response.writeHead(200, {"content-type": mime[path.extname(filename)] ?? "application/octet-stream"});
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({headless: true});
const observations = {};
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844},
    isMobile: true, deviceScaleFactor: 2, hasTouch: true});
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", {rate: 4});
  await page.addInitScript(() => {
    Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
    Object.defineProperty(navigator, "hardwareConcurrency", {configurable: true, value: 4});
    Object.defineProperty(navigator, "deviceMemory", {configurable: true, value: 4});
    for (const key of [
      "riddleQuest:onboarding:jest-guest",
      "riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest",
      "riddleQuest:tooltipSequenceSeen:profileTour:jest-guest",
    ]) localStorage.setItem(key, "seen");
    sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
  });
  const started = Date.now();
  await page.goto(`http://127.0.0.1:${port}/?harness=jest`);
  await page.locator(".keyboard button:not([disabled])").first().waitFor({timeout: 15_000});
  observations.gameplay = {coldDataReadyMs: Date.now() - started};
  const measure = async (name, trigger, ready, repetitions = 8) => {
    const samples = [];
    for (let i = 0; i < repetitions; i++) {
      const elapsed = await page.evaluate(({trigger, ready}) => new Promise((resolve, reject) => {
        const button = document.querySelector(trigger);
        if (!(button instanceof HTMLElement)) return reject(new Error(`Missing trigger: ${trigger}`));
        const startedAt = performance.now();
        button.click();
        const check = () => {
          if (document.querySelector(ready)) return resolve(performance.now() - startedAt);
          if (performance.now() - startedAt > 5_000) return reject(new Error(`Missing ready state: ${ready}`));
          requestAnimationFrame(check);
        };
        check();
      }), {trigger, ready});
      samples.push(Number(elapsed.toFixed(1)));
      if (name === "race") await page.locator(".race-close").click();
      else await page.keyboard.press("Escape");
      await page.locator(ready).waitFor({state: "detached"});
    }
    const warm = samples.slice(1).sort((a, b) => a - b);
    observations[name] = {coldOpenMs: samples[0], warmOpenMs: warm,
      warmP95Ms: warm[Math.ceil(warm.length * .95) - 1]};
  };
  await measure("profile", '.game-bottom-navigation button[aria-label="Profile"]', ".modal-profile");
  await measure("settings", '.game-bottom-navigation button[aria-label="Settings"]', ".modal-settings");
  await measure("shop", ".game-header .coin-pill", ".modal-shop");
  await measure("race", ".multiplayer-navigation-action", ".race-category-grid");
  await measure("hint", '[data-tooltip="gameHint"]', ".modal-hint");
  await measure("skip", '[data-tooltip="gameSkip"]', ".modal-skip");
  const measureNested = async (name, parent, child) => {
    const samples = [];
    for (let i = 0; i < 8; i++) {
      await page.locator(parent.trigger).click();
      await page.locator(parent.ready).waitFor();
      const duration = await page.evaluate(({trigger, triggerText, ready}) => new Promise((resolve, reject) => {
        const button = triggerText
          ? [...document.querySelectorAll(trigger)].find(element => element.textContent?.toLowerCase().includes(triggerText))
          : document.querySelector(trigger);
        if (!(button instanceof HTMLElement)) return reject(new Error(`Missing nested trigger: ${trigger}`));
        const start = performance.now();
        button.click();
        const check = () => {
          if (document.querySelector(ready)) return resolve(performance.now() - start);
          if (performance.now() - start > 5_000) return reject(new Error(`Missing nested state: ${ready}`));
          requestAnimationFrame(check);
        };
        check();
      }), {trigger: child.trigger, triggerText: child.triggerText, ready: child.ready});
      samples.push(Number(duration.toFixed(1)));
      await page.keyboard.press("Escape");
      await page.locator(child.ready).waitFor({state: "detached"});
    }
    const warm = samples.slice(1).sort((a,b) => a-b);
    observations[name] = {coldOpenMs: samples[0], warmP95Ms: warm[Math.ceil(warm.length*.95)-1]};
  };
  const profileParent = {trigger: '.game-bottom-navigation button[aria-label="Profile"]', ready: ".modal-profile"};
  const settingsParent = {trigger: '.game-bottom-navigation button[aria-label="Settings"]', ready: ".modal-settings"};
  for (const [name, trigger] of Object.entries({statistics: '[data-tooltip="profileStatistics"]',
    achievements: '[data-tooltip="profileAchievements"]',
    treasure: '[data-tooltip="profileTreasure"]'}))
    await measureNested(name, profileParent, {trigger, ready: `.modal-${name}`});
  await measureNested("ranks", profileParent,
    {trigger: ".modal-profile button", triggerText: "ranks", ready: ".modal-ranks"});
  for (const [name, label] of Object.entries({instructions: "help", credits: "credits", about: "about"}))
    await measureNested(name, settingsParent,
      {trigger: ".modal-settings .settings-row", triggerText: label, ready: `.modal-${name}`});
  const leaderboard = [];
  for (let i = 0; i < 8; i++) {
    await page.locator('.game-bottom-navigation button[aria-label="Profile"]').click();
    await page.locator(".modal-profile").waitFor();
    const opened = await page.getByRole("button", {name: /^leaderboard$/i}).evaluate(button => {
      const time = performance.now();
      button.click();
      return time;
    });
    await page.locator(".modal-leaderboard").waitFor();
    const visible = await page.evaluate(time => performance.now() - time, opened);
    const cachedRowsVisible = await page.locator(".leaderboard-list li").count();
    await page.waitForFunction(() =>
      document.querySelector(".leaderboard-list")?.getAttribute("aria-busy") === "false");
    const ready = await page.evaluate(time => performance.now() - time, opened);
    leaderboard.push({openMs: Number(visible.toFixed(1)), cachedRowsVisible,
      refreshReadyMs: Number(ready.toFixed(1))});
    await page.keyboard.press("Escape");
  }
  const warm = leaderboard.slice(1);
  observations.leaderboard = {cold: leaderboard[0], warm,
    warmOpenP95Ms: warm.map(x => x.openMs).sort((a,b) => a-b)[Math.ceil(warm.length*.95)-1],
    warmRefreshP95Ms: warm.map(x => x.refreshReadyMs).sort((a,b) => a-b)[Math.ceil(warm.length*.95)-1]};
  const feedbackSamples = [];
  const transitionSamples = [];
  for (let trial = 0; trial < 5; trial++) {
    const trialContext = await browser.newContext({viewport: {width: 390, height: 844},
      isMobile: true, deviceScaleFactor: 2, hasTouch: true});
    const trialPage = await trialContext.newPage();
    await (await trialContext.newCDPSession(trialPage)).send("Emulation.setCPUThrottlingRate", {rate: 4});
    await trialPage.addInitScript(() => {
      Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
      localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
      localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
      sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
    });
    await trialPage.goto(`http://127.0.0.1:${port}/?harness=jest`);
    await trialPage.locator(".keyboard button:not([disabled])").first().waitFor({timeout: 15_000});
    await trialPage.evaluate(() => {
      const original = window.dispatchEvent.bind(window);
      window.dispatchEvent = event => event.type === "riddle-quest:host-to-game" &&
        event.detail?.payload?.operation === "guess" ? true : original(event);
    });
    for (const [index, word] of ["ZZZZZ", "XXXXX", "VVVVV", "BBBBB", "PIANO"].entries()) {
      for (const letter of word)
        await trialPage.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      const duration = await trialPage.locator(".submit-action").evaluate(async (button, attempt) => {
        const startedAt = performance.now();
        button.click();
        const color = attempt === 4 ? "green" : "red";
        while (document.querySelectorAll(".guess-row")[attempt]?.querySelectorAll(`.cell.${color}`).length !== 5) {
          if (performance.now() - startedAt > 1_000) throw new Error("Feedback waited for confirmation");
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
        return performance.now() - startedAt;
      }, index);
      feedbackSamples.push(Number(duration.toFixed(1)));
      const guidance = trialPage.getByRole("button", {name: /got it/i});
      if (await guidance.isVisible()) await guidance.click();
    }
    const transition = await trialPage.getByRole("button", {name: /next level/i}).evaluate(async button => {
      const startedAt = performance.now();
      button.click();
      while (!document.querySelector(".riddle-card h1")?.textContent?.includes("face and hands")) {
        if (performance.now() - startedAt > 1_000) throw new Error("Next question waited for confirmation");
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      return performance.now() - startedAt;
    });
    transitionSamples.push(Number(transition.toFixed(1)));
    await trialContext.close();
  }
  const p95 = samples => [...samples].sort((a,b) => a-b)[Math.ceil(samples.length*.95)-1];
  observations.soloFeedback = {samples: feedbackSamples, p95Ms: p95(feedbackSamples)};
  observations.bufferedTransition = {samples: transitionSamples, p95Ms: p95(transitionSamples)};
  const raceSamples = [];
  for (let trial = 0; trial < 5; trial++) {
    const raceContext = await browser.newContext({viewport: {width: 390, height: 844},
      isMobile: true, deviceScaleFactor: 2, hasTouch: true});
    const racePage = await raceContext.newPage();
    await (await raceContext.newCDPSession(racePage)).send("Emulation.setCPUThrottlingRate", {rate: 4});
    await racePage.addInitScript(() => {
      Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
      localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
      localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
      sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
    });
    await racePage.goto(`http://127.0.0.1:${port}/?harness=jest`);
    await racePage.locator(".multiplayer-navigation-action").click();
    await racePage.locator(".race-category-grid button").first().click();
    await racePage.locator(".race-native-answer-input").waitFor({timeout: 10_000});
    await racePage.evaluate(() => {
      const original = window.dispatchEvent.bind(window);
      window.dispatchEvent = event => event.type === "riddle-quest:host-to-game" &&
        event.detail?.payload?.operation === "raceGuess" ? true : original(event);
    });
    await racePage.locator(".race-native-answer-input").fill("PIANO");
    const latency = await racePage.locator(".race-actions .submit-action").evaluate(async button => {
      const startedAt = performance.now();
      button.click();
      while (document.querySelectorAll(".race-gameplay .guess-row:first-child .cell.green").length < 5) {
        if (performance.now() - startedAt > 1_000) throw new Error("Race feedback waited for confirmation");
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      return performance.now() - startedAt;
    });
    raceSamples.push(Number(latency.toFixed(1)));
    await raceContext.close();
  }
  observations.raceFeedback = {samples: raceSamples, p95Ms: p95(raceSamples)};
  observations.mobileProfile = "390x844, DPR 2, 4x CPU slowdown, 4 logical cores, 4 GiB reported memory, local injected Jest harness";
  console.log(JSON.stringify(observations, null, 2));
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(observations, null, 2)+"\n");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
