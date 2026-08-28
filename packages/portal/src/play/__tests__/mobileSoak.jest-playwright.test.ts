import {describe, expect, it} from "@jest/globals";
import {chromium} from "@playwright/test";

/** Provides describe soak behavior. */
const describeSoak = process.env.PORTAL_SOAK_TESTS === "1" ? describe : describe.skip;
/** Provides duration ms behavior. */
const durationMs = Number(process.env.PORTAL_SOAK_DURATION_MS ?? 10 * 60 * 1_000);

describeSoak("low-end mobile stability", () => {
  it(
    "remains responsive and memory-bounded during extended play",
    async () => {
      /** Provides {exec file sync} behavior. */
      const {execFileSync} = await import("node:child_process");
      /** Provides {create server} behavior. */
      const {createServer} = await import("node:http");
      /** Provides {read file} behavior. */
      const {readFile} = await import("node:fs/promises");
      /** Provides path behavior. */
      const path = await import("node:path");
      /** Provides package root behavior. */
      const packageRoot = path.resolve(__dirname, "../../..");
      if (process.env.PORTAL_USE_EXISTING_BUILD !== "1") {
        execFileSync("pnpm", ["--filter", "@qwordly/portal", "build:jest"], {
          cwd: path.resolve(packageRoot, "../.."),
          stdio: "inherit",
        });
      }

      /** Provides dist dir behavior. */
      const distDir = process.env.PORTAL_JEST_BUILD_DIR
        ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
        : path.join(packageRoot, "dist-jest");
      /** Provides server behavior. */
      const server = createServer(async (request, response) => {
        /** Requests url. */
        const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
        /** Provides candidate behavior. */
        const candidate = path.join(distDir, requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname);
        /** Provides file path behavior. */
        const filePath = path.extname(candidate) ? candidate : path.join(distDir, "index.html");
        try {
          /** Provides body behavior. */
          const body = await readFile(filePath);
          /** Provides content type behavior. */
          const contentType =
            {
              ".css": "text/css",
              ".html": "text/html",
              ".js": "text/javascript",
              ".svg": "image/svg+xml",
              ".ttf": "font/ttf",
              ".webm": "audio/webm",
              ".webp": "image/webp",
            }[path.extname(filePath)] ?? "application/octet-stream";
          response.writeHead(200, {"Content-Type": contentType});
          response.end(body);
        } catch {
          response.writeHead(404);
          response.end();
        }
      });
      await new Promise<void>((resolve) => server.listen(4180, "127.0.0.1", resolve));

      /** Provides browser behavior. */
      const browser = await chromium.launch({headless: true, args: ["--enable-precise-memory-info"]});
      /** Provides context behavior. */
      const context = await browser.newContext({
        viewport: {width: 360, height: 740},
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 11; Pixel 3a) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
      });
      /** Provides page behavior. */
      const page = await context.newPage();
      /** Provides runtime errors behavior. */
      const runtimeErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        Object.defineProperty(navigator, "hardwareConcurrency", {configurable: true, value: 4});
        Object.defineProperty(navigator, "deviceMemory", {configurable: true, value: 4});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });

      try {
        await page.goto("http://127.0.0.1:4180/?harness=jest");
        await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
        /** Provides letter a behavior. */
        const letterA = page.locator(".keyboard").getByRole("button", {name: /^A$/});
        try {
          await letterA.waitFor({state: "visible", timeout: 5_000});
        } catch (error) {
          /** Provides state behavior. */
          const state = await page.evaluate(() => ({
            activeDialogs: Array.from(document.querySelectorAll("[role='dialog'], [role='alertdialog']"), (dialog) => ({
              className: dialog.className,
              text: dialog.textContent?.slice(0, 120),
            })),
            gameInert: document.querySelector(".game-app")?.hasAttribute("inert"),
            keyboardButtons: document.querySelectorAll(".keyboard button").length,
            onboardingSeen: localStorage.getItem("riddleQuest:onboarding:jest-guest"),
            tourSeen: localStorage.getItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest"),
          }));
          throw new Error(`Mobile soak did not reach an interactive keyboard: ${JSON.stringify(state)}`, {
            cause: error,
          });
        }
        /** Provides cdp behavior. */
        const cdp = await context.newCDPSession(page);
        await cdp.send("HeapProfiler.collectGarbage");
        /** Provides heap size behavior. */
        const heapSize = () =>
          page.evaluate(() => {
            /** Provides memory behavior. */
            const memory = (
              performance as Performance & {
                /** Stores memory. */
                memory?: {
                  /** Stores used js heap size. */
                  usedJSHeapSize: number;
                };
              }
            ).memory;
            return memory?.usedJSHeapSize ?? 0;
          });
        /** Provides initial heap behavior. */
        const initialHeap = await heapSize();
        /** Starts ed at. */
        const startedAt = Date.now();
        /** Provides cycle behavior. */
        let cycle = 0;
        while (Date.now() - startedAt < durationMs) {
          await letterA.click();
          await page
            .locator(".keyboard")
            .getByRole("button", {name: /backspace/i})
            .click();
          if (cycle % 10 === 0) {
            await page
              .getByRole("button", {name: /^settings$/i})
              .first()
              .click();
            /** Sets tings dialog. */
            const settingsDialog = page.getByRole("dialog", {name: /^settings$/i});
            await settingsDialog.waitFor({state: "visible"});
            await page.keyboard.press("Escape");
            await settingsDialog.waitFor({state: "detached"});
          }
          if (cycle % 20 === 0) {
            await page.setViewportSize(cycle % 40 === 0 ? {width: 740, height: 360} : {width: 360, height: 740});
          }
          expect(await page.locator(".keyboard").isVisible()).toBe(true);
          await page.waitForTimeout(2_000);
          cycle += 1;
        }
        await cdp.send("HeapProfiler.collectGarbage");
        /** Provides final heap behavior. */
        const finalHeap = await heapSize();
        expect(await page.locator(".solar-system").count()).toBe(0);
        expect(runtimeErrors).toEqual([]);
        if (initialHeap > 0 && finalHeap > 0) {
          expect(finalHeap - initialHeap).toBeLessThan(32 * 1024 * 1024);
        }
      } finally {
        await context.close();
        await browser.close();
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      }
    },
    durationMs + 90_000,
  );
});
