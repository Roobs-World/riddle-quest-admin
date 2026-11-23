import {installCompletedMockGameTour, completeMockOnboarding} from "../../../../app/testing/browser/__tests__/mockOnboarding.jest-playwright.support.ts";
import {describe, expect, it} from "@jest/globals";
import {execFileSync} from "node:child_process";
import {existsSync} from "node:fs";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {chromium} from "@playwright/test";
/** Provides describe browser behavior. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("solo coin collection and successor routing", () => {
  it.each([{mode: "classic", continued: false}, {mode: "challenge", continued: false}, {mode: "classic", continued: true}])(
    "shows the confirmed balance and loads a playable successor after $mode rewards (continued=$continued)", async ({mode, continued}) => {
    /** Provides dist dir behavior. */
    const distDir = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.resolve(__dirname, "../../../../../builds/jest");
    if (!existsSync(path.join(distDir, "index.html"))) {
      execFileSync("pnpm", ["build:jest"], {cwd: path.resolve(__dirname, "../../../../web/.."), stdio: "inherit"});
    }
    /** Provides server behavior. */
    const server = createServer(async (request, response) => {
      /** Provides pathname behavior. */
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      /** Provides candidate behavior. */
      const candidate = path.join(distDir, pathname === "/" ? "index.html" : pathname);
      /** Provides file path behavior. */
      const filePath = path.extname(candidate) ? candidate : path.join(distDir, "index.html");
      try {
        /** Provides body behavior. */
        const body = await readFile(filePath);
        /** Provides mime behavior. */
        const mime: Record<string, string> = {
          ".css": "text/css",
          ".html": "text/html",
          ".js": "text/javascript",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".webp": "image/webp",
          ".woff2": "font/woff2",
          ".webm": "audio/webm",
        };
        response.writeHead(200, {"Content-Type": mime[path.extname(filePath)] ?? "application/octet-stream"});
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    /** Provides address behavior. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    /** Provides browser behavior. */
    const browser = await chromium.launch({headless: true});
    try {
      /** Provides page behavior. */
      const page = await browser.newPage({viewport: {width: 390, height: 844}});
      // Slow CI runners need headroom for entrance animations to settle; the 30 s test budget still bounds it.
      page.setDefaultTimeout(10_000);
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        /** Observe correlated content failures without changing bridge delivery. */
        const failures: string[] = [];
        Object.assign(window, {__NEXT_LOAD_FAILURES__: failures});
        window.addEventListener("riddle-quest:host-to-game", event => {
          /** Correlated host operation result observed by this browser fixture. */
          const message = (event as CustomEvent).detail;
          if (message?.type === "host:operationResult" && message.payload?.operation === "loadRiddle" &&
            message.payload.ok === false && message.requestId) failures.push(message.requestId);
        });
        Object.defineProperty(navigator, "hardwareConcurrency", {configurable: true, value: 4});
        Object.defineProperty(navigator, "deviceMemory", {configurable: true, value: 4});
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: {effectiveType: "4g", saveData: false},
        });
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
        /** The coin meter's Web Animations call fails so the award must still complete without it. */
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
          if (this.matches("[data-coin-meter]")) throw new Error("Animation API unavailable");
          return animate.apply(this, args);
        };
      });
      // Select either Daily completion or the supported post-Daily Classic launch.
      await page.goto(`http://127.0.0.1:${address.port}/?harness=jest${mode === "classic" ? "&dailyCompleted=1" : ""}`);
      await completeMockOnboarding(page);
      await page.getByText(mode === "classic" ? /what has keys/i : /speak without a mouth/i).waitFor({timeout: 15_000});
      if (continued) {
        for (const letter of ["A", "B", "C", "D", "E"]) {
          for (let index = 0; index < 5; index += 1) await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
          await page.locator(".game-input-actions").getByRole("button", {name: /submit/i}).click();
          if (letter === "A") await page.locator(".tooltip-card").getByRole("button", {name: /got it/i}).click();
        }
        await page.getByRole("button", {name: "Use 50 Coins to Try Again", exact: true}).click();
        await page.locator(".modal-continue").waitFor({state: "hidden"});
      }
      for (const letter of mode === "classic" ? "PIANO" : "ECHO") {
        await page
          .locator(".keyboard")
          .getByRole("button", {name: new RegExp(`^${letter}$`)})
          .click();
      }
      await page
        .locator(".game-input-actions")
        .getByRole("button", {name: /submit/i})
        .click();
      await page.locator(".modal-victory").waitFor({timeout: 15_000});
      /** Provides chest behavior. */
      const chest = page.locator(".modal-victory .reward-chest");
      // The provisional victory opens before the confirmed coin award arrives.
      await chest.waitFor({timeout: 15_000});
      /** The primary win action advances Daily and Classic directly. */
      const nextRound = page.locator(".modal-victory .reward-continue");
      // Coins are already granted: the CTA never waits on the chest celebration.
      expect(await nextRound.isDisabled()).toBe(false);
      expect(await nextRound.innerText()).toMatch(/^next(?: level)?$/i);
      expect(await page.getByRole("button", {name: /tap the chest/i}).count()).toBe(0);
      /** The win panel displays the confirmed total independently of the decorative counter. */
      const confirmedTotal = Number((await page.locator(".coin-award > span").innerText()).replace(/[^\d]/g, ""));
      expect(Number.isSafeInteger(confirmedTotal) && confirmedTotal >= 0).toBe(true);
      // A failed celebration must still leave the actual header at the confirmed balance.
      await page.waitForFunction(
        (total) => document.querySelector(".game-header .coin-pill strong")?.textContent?.trim() === total.toLocaleString(),
        confirmedTotal,
        {timeout: 3_500},
      );
      expect(await page.locator(".modal-victory").evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
      expect(await nextRound.isEnabled()).toBe(true);
      await nextRound.click();
      await page.locator(".modal-victory").waitFor({state: "detached"});
      await page.getByText(mode === "classic" ? /face and hands/i : /what has keys/i).waitFor();
      expect(await page.locator(".game-mode-label").textContent()).toMatch(/classic/i);
      expect(await page.locator(".keyboard button").first().isEnabled()).toBe(true);
      expect(await page.evaluate(() => Reflect.get(window, "__NEXT_LOAD_FAILURES__"))).toEqual([]);
    } finally {
      await browser.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 30_000);
});
