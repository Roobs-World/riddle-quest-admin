import assert from "node:assert/strict";
import {createServer} from "node:http";
import {createRequire} from "node:module";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, "../../..");
const artifact = process.env.INSTRUCTIONS_ARTIFACT ?? path.join(root, "builds/jest");
const require = createRequire(path.join(root, "packages/portal/package.json"));
const {chromium} = require("@playwright/test");
const styles = await readFile(path.join(output, "instructions-prototype.css"), "utf8");
const results = {artifact, checks: [], failures: []};
const types = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webm": "audio/webm"};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = path.join(artifact, pathname === "/" ? "index.html" : pathname);
    response.setHeader("content-type", types[path.extname(file)] ?? "application/octet-stream");
    response.end(await readFile(file));
  } catch {response.writeHead(404).end();}
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 402, height: 682}});
  page.setDefaultTimeout(10000);
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue()
    : route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
  await page.addInitScript(() => {
    window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
    localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v4:jest-guest", "seen");
    localStorage.setItem("riddleQuest:tooltipSeen:gameCoins:jest-guest", "seen");
    sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
  });
  await page.goto(origin + "/?harness=jest&dailyCompleted=1");
  await page.getByRole("button", {name: "Let's Play", exact: true}).click();
  await page.locator(".onboarding-card").getByRole("button", {name: /got it/i}).click();
  await page.locator(".onboarding-card").waitFor({state: "hidden"});
  await page.getByRole("button", {name: "Settings", exact: true}).click();
  await page.getByRole("button", {name: "Help", exact: true}).click();
  results.before = await page.locator(".instructions-page").evaluate(element => ({clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight, paragraphs: [...element.querySelectorAll("p")].map(p => ({font: getComputedStyle(p).fontSize,
      lineHeight: getComputedStyle(p).lineHeight, margin: getComputedStyle(p).margin}))}));
  await page.locator(".instructions-page .play-primary").click();
  await page.addStyleTag({content: styles});
  for (const locale of ["en", "de", "fr", "ar", "es", "pt", "ja", "ko", "hi", "ru", "tr", "id", "it", "nl", "pl", "vi"]) {
    const settings = JSON.parse(await readFile(path.join(root, "src/locales", locale, "settings.json"), "utf8")).Settings;
    const instructions = JSON.parse(await readFile(path.join(root, "src/locales", locale, "onboarding.json"), "utf8")).Instructions;
    await page.locator(".game-bottom-navigation button").first().click();
    await page.locator(".modal-settings select").selectOption(locale);
    await page.locator(".modal-settings").getByRole("button", {name: settings.HELP_BUTTON, exact: true}).click();
    for (const viewport of [{width: 402, height: 682}, {width: 320, height: 568}, {width: 390, height: 844}]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".modal-instructions").evaluate(element => Promise.all(element.getAnimations({subtree: true})
        .map(animation => animation.finished.catch(() => undefined))));
      const metrics = await page.locator(".modal-instructions").evaluate(modal => {
        const page = modal.querySelector(".instructions-page"), action = page.querySelector("button");
        const rect = element => {const b = element.getBoundingClientRect(); return {x: b.x, y: b.y, width: b.width, height: b.height, bottom: b.bottom, right: b.right};};
        return {modal: rect(modal), clientHeight: modal.clientHeight, scrollHeight: modal.scrollHeight,
          page: {clientHeight: page.clientHeight, scrollHeight: page.scrollHeight}, action: rect(action),
          text: page.innerText, fontSizes: [...page.querySelectorAll("p")].map(p => Number.parseFloat(getComputedStyle(p).fontSize)),
          content: [...modal.querySelectorAll("h2,h3,p,button")].map(rect)};
      });
      const check = {locale, ...viewport, ...metrics};
      try {
        assert.ok(metrics.scrollHeight <= metrics.clientHeight + 1, "modal content must fit");
        assert.ok(metrics.page.scrollHeight <= metrics.page.clientHeight + 1, "instructions must not scroll");
        assert.ok(metrics.modal.y >= 0 && metrics.modal.bottom <= viewport.height, "modal fits viewport");
        assert.ok(metrics.action.height >= 48 && metrics.action.bottom <= viewport.height - 12, "readable action fits");
        assert.ok(metrics.fontSizes.every(size => size >= 16), "paragraph type remains readable");
        assert.ok(metrics.content.every(b => b.x >= 0 && b.y >= 0 && b.right <= viewport.width && b.bottom <= viewport.height), "every content element fits");
        for (const key of ["GOAL_DESCRIPTION", "COLOR_CORRECT", "COLOR_MISPLACED", "COLOR_WRONG", "TIPS_DESCRIPTION", "GOT_IT_BUTTON"])
          assert.ok(metrics.text.includes(instructions[key]), key + " remains present");
        check.passed = true;
      } catch (error) {check.passed = false; check.error = error.message; results.failures.push({locale, ...viewport, message: error.message});}
      results.checks.push(check);
      if (["en", "de", "fr", "ar", "hi"].includes(locale) && viewport.width !== 390)
        await page.screenshot({path: path.join(output, `instructions-${locale}-${viewport.width}-prototype.png`)});
    }
    await page.locator(".instructions-page .play-primary").click();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(output, "instructions-prototype-results.json"), JSON.stringify(results, null, 2) + "\n");
}
console.log(JSON.stringify({checks: results.checks.length, failures: results.failures}));
assert.equal(results.failures.length, 0);
