import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {createRequire} from "node:module";

export const {chromium} = createRequire(new URL("../../packages/web-game/package.json", import.meta.url))("@playwright/test");

/** Serves the actual release files without a development fallback or injected app code. */
export async function serveArtifact(directory) {
  const root = path.resolve(directory);
  const types = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png"};
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const file = path.resolve(root, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
      if (!file.startsWith(`${root}${path.sep}`)) throw new Error("outside-artifact");
      const data = await readFile(file);
      response.writeHead(200, {"Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store"});
      response.end(data);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => server.close(resolve))};
}

/** Exercises real input, economy, durable progress, viewport fit and optional offline reload. */
export async function verifySoloArtifact(browser, url, {gamesnacks = false, offline = false, screenshot} = {}) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, locale: "en-GB"});
  const errors = [], external = [], failed = [];
  const origin = new URL(url).origin;
  try {
    // Only the provider boundary is mocked. The release application's storage and gameplay remain real.
    if (gamesnacks) await context.addInitScript(() => {
      window.__gameSnacksEvents = [];
      window.GameSnacks = {
        audio: {isEnabled: true, subscribe() {}},
        game: {
          firstFrameReady() { window.__gameSnacksEvents.push("firstFrameReady"); },
          ready() { window.__gameSnacksEvents.push("ready"); },
          onPause(callback) { window.__pauseGame = callback; },
          onResume(callback) { window.__resumeGame = callback; },
        },
        storage: {
          getItem(key) { window.__gameSnacksEvents.push("load"); return localStorage.getItem(key); },
          setItem(key, value) { localStorage.setItem(key, value); window.__gameSnacksEvents.push("save"); },
        },
      };
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (new URL(request.url()).origin !== origin) external.push(request.url()); });
    page.on("response", response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
    const start = Date.now();
    await page.goto(url, {waitUntil: "domcontentloaded"});
    await page.getByRole("heading", {name: "Choose a puzzle"}).waitFor();
    const startupMs = Date.now() - start;
    assert.ok(startupMs < 10000, `Startup took ${startupMs} ms`);
    await page.getByRole("button", {name: /Classic/}).click();
    await page.getByRole("heading", {name: /Which ancient city/}).waitFor();
    await page.getByRole("textbox", {name: "Type your answer"}).fill("ROME");
    await page.getByRole("button", {name: /submit/i}).click();
    await page.waitForFunction(() => document.querySelector(".yt-status")?.textContent.includes("365"));
    if (gamesnacks) {
      const events = await page.evaluate(() => window.__gameSnacksEvents);
      assert.ok(events.indexOf("firstFrameReady") < events.indexOf("ready"));
      assert.ok(events.indexOf("load") < events.indexOf("ready"));
      assert.ok(events.includes("save"));
      await page.evaluate(() => window.__pauseGame());
      await page.waitForFunction(() => document.querySelector("[data-youtube-playable-root]")?.inert);
      await page.evaluate(() => window.__resumeGame());
      await page.waitForFunction(() => !document.querySelector("[data-youtube-playable-root]")?.inert);
    }
    if (screenshot) await page.screenshot({path: screenshot});
    await page.reload({waitUntil: "domcontentloaded"});
    await page.getByRole("button", {name: /Classic.*2\s*\/\s*180/}).waitFor();
    assert.match(await page.locator(".yt-status").innerText(), /365/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    if (offline) {
      const cdp = await context.newCDPSession(page);
      const installability = await cdp.send("Page.getInstallabilityErrors");
      assert.deepEqual(installability.installabilityErrors, [], "PWA installability errors");
      await cdp.detach();
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, {once: true}));
      });
      await context.setOffline(true);
      await page.reload({waitUntil: "domcontentloaded"});
      await page.getByRole("button", {name: /Classic.*2\s*\/\s*180/}).waitFor();
      assert.match(await page.locator(".yt-status").innerText(), /365/);
    }
    assert.deepEqual(errors, [], "Browser errors");
    assert.deepEqual(external, [], "Unexpected external requests");
    assert.deepEqual(failed, [], "Failed asset requests");
    return {startupMs, solve: "ROME", coins: 365, persistedClassicLevel: 2, externalRequests: 0, offlineReload: offline, installabilityChecked: offline};
  } finally { await context.close(); }
}
