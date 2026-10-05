import assert from "node:assert/strict";
import {mkdir, readFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.resolve(root, "../../artifacts/multiplayer-wins-leaderboard");
await mkdir(evidence, {recursive: true});
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = path.join(root, "../../builds/jest", pathname === "/" ? "index.html" : pathname);
    const types = {".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".woff2": "font/woff2"};
    response.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
    response.end(await readFile(file));
  } catch {response.writeHead(404).end();}
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({headless: true});
try {
  for (const width of [1280, 390, 280]) {
    const context = await browser.newContext({viewport: {width, height: 844}});
    await context.route("https://cdn.jest.com/**", route => route.fulfill({status: 200, contentType: "text/javascript", body: ""}));
    await context.addInitScript(() => {
      window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
      localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
      localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:v2:jest-guest", "seen");
    });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?harness=jest&dailyCompleted=1`);
    await page.getByRole("button", {name: /let's play/i}).click();
    await page.locator(".onboarding-card").getByRole("button", {name: /got it/i}).click();
    await page.locator(".onboarding-card").waitFor({state: "hidden"});
    const guest = page.getByRole("button", {name: /play as guest/i});
    if (await guest.isVisible()) await guest.click();
    await page.locator(".keyboard").waitFor();

    await page.getByRole("button", {name: /^profile$/i}).first().click();
    await page.getByRole("button", {name: /^leaderboard$/i}).click();
    const list = page.locator(".leaderboard-list");
    const waitForScores = () => page.waitForFunction(() => document.querySelector(".leaderboard-list")?.getAttribute("aria-busy") === "false");
    await waitForScores();
    await page.getByRole("button", {name: /next page/i}).click();
    assert.equal(await list.locator("li b").first().innerText(), "11");
    const multiplayer = page.getByRole("button", {name: /^multiplayer wins$/i});
    await multiplayer.click();
    await waitForScores();
    assert.equal(await multiplayer.getAttribute("aria-pressed"), "true");
    assert.equal(await list.locator("li b").first().innerText(), "1");
    assert.equal(await list.locator("li strong").first().innerText(), "20");
    assert.match(await list.locator("li").first().innerText(), /Solver 20/);
    assert.equal(await list.locator("li").count(), 10);
    const scores = await list.locator("li strong").allTextContents();
    assert.deepEqual(scores.map(Number), [20, 19, 18, 17, 17, 16, 15, 14, 13, 12]);
    await page.getByRole("button", {name: /next page/i}).click();
    assert.equal(await list.locator("li b").first().innerText(), "11");
    await page.getByRole("button", {name: /previous page/i}).click();
    assert.equal(await list.locator("li b").first().innerText(), "1");
    await page.evaluate(async () => {await document.fonts.ready; await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {})));});
    const overflow = await page.locator(".modal-leaderboard").evaluate(modal => ({
      horizontal: modal.scrollWidth - modal.clientWidth,
      clippedTabs: [...modal.querySelectorAll(".leaderboard-tabs button")].some(button => button.scrollWidth > button.clientWidth),
    }));
    assert.equal(overflow.horizontal, 0);
    assert.equal(overflow.clippedTabs, false);
    assert.deepEqual((await new AxeBuilder({page}).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations, []);
    await list.focus();
    assert.equal(await list.evaluate(element => document.activeElement === element), true);
    await page.screenshot({path: path.join(evidence, `leaderboard-${width}.png`)});
    await page.getByRole("button", {name: /^wins$/i}).click();
    await waitForScores();
    assert.equal(await list.locator("li strong").first().innerText(), "29");
    assert.deepEqual(errors, []);
    console.log(`Injected leaderboard passed at ${width}px: bridge metric, scores, pagination, solo distinction, layout, accessibility.`);
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
