import {completeMockOnboarding} from "./mockOnboarding.jest-playwright.support";
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
    "enables Next Level and loads a playable successor after $mode coin collection (continued=$continued)", async ({mode, continued}) => {
    /** Provides dist dir behavior. */
    const distDir = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.resolve(__dirname, "../../../dist-jest");
    if (!existsSync(path.join(distDir, "index.html"))) {
      execFileSync("pnpm", ["build:jest"], {cwd: path.resolve(__dirname, "../../.."), stdio: "inherit"});
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
      page.setDefaultTimeout(4_000);
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
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
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
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
      /** Provides next level behavior. */
      const nextLevel = page.getByRole("button", {name: /next level/i});
      /** Provides continue reward behavior. */
      const continueReward = page.locator(".modal-victory .reward-continue");
      expect(await continueReward.isDisabled()).toBe(true);
      await page.evaluate(() => {
        /** Provides meter behavior. */
        const meter = document.querySelector<HTMLElement>("[data-coin-meter]");
        if (!meter) throw new Error("Coin meter missing");
        Object.defineProperty(meter, "animate", {
          configurable: true,
          value: () => {
            throw new Error("Animation API unavailable");
          },
        });
      });
      await chest.click();
      await page.waitForFunction(
        () => document.querySelector(".coin-award")?.getAttribute("data-coin-collection") === "complete",
        undefined,
        {timeout: 3_500},
      );
      expect(await continueReward.isEnabled()).toBe(true);
      for (let step = 0; step < 10 && (await nextLevel.count()) === 0; step += 1) {
        /** Provides prior step behavior. */
        const priorStep = (await page.locator(".modal-victory .sequence-progress").innerText()).split("/")[0];
        await continueReward.click();
        await page.waitForFunction(previous => document.querySelector(".modal-victory .sequence-progress")?.textContent?.trim().split("/")[0] !== previous, priorStep);
        if (await chest.isVisible() && await chest.isEnabled()) await chest.click();
        await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".modal-victory .reward-continue")?.disabled);
      }
      expect(await nextLevel.isEnabled()).toBe(true);
      await nextLevel.click();
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
