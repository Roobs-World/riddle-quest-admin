import {describe, expect, it} from "@jest/globals";
import {execFileSync} from "node:child_process";
import {existsSync} from "node:fs";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {chromium} from "@playwright/test";

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("classic coin collection", () => {
  it("enables Next Level when coin meter animation fails", async () => {
    const distDir = path.resolve(__dirname, "../../../dist-jest");
    if (!existsSync(path.join(distDir, "index.html"))) {
      execFileSync("pnpm", ["build:jest"], {cwd: path.resolve(__dirname, "../../.."), stdio: "inherit"});
    }
    const server = createServer(async (request, response) => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const candidate = path.join(distDir, pathname === "/" ? "index.html" : pathname);
      const filePath = path.extname(candidate) ? candidate : path.join(distDir, "index.html");
      try {
        const body = await readFile(filePath);
        const mime: Record<string, string> = {
          ".css": "text/css", ".html": "text/html", ".js": "text/javascript",
          ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp",
          ".woff2": "font/woff2", ".webm": "audio/webm",
        };
        response.writeHead(200, {"Content-Type": mime[path.extname(filePath)] ?? "application/octet-stream"});
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    const browser = await chromium.launch({headless: true});
    try {
      const page = await browser.newPage({viewport: {width: 390, height: 844}});
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        Object.defineProperty(navigator, "hardwareConcurrency", {configurable: true, value: 4});
        Object.defineProperty(navigator, "deviceMemory", {configurable: true, value: 4});
        Object.defineProperty(navigator, "connection", {
          configurable: true, value: {effectiveType: "4g", saveData: false},
        });
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`http://127.0.0.1:${address.port}/?harness=jest`);
      await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
      for (const letter of "PIANO") {
        await page.locator(".keyboard").getByRole("button", {name: new RegExp(`^${letter}$`)}).click();
      }
      await page.locator(".game-input-actions").getByRole("button", {name: /submit/i}).click();
      await page.locator(".modal-victory").waitFor({timeout: 15_000});
      const chest = page.getByRole("button", {name: /tap the chest/i});
      for (let step = 0; step < 10 && await chest.count() === 0; step += 1) {
        await page.getByRole("button", {name: /^next$/i}).click();
      }
      await chest.waitFor();
      const nextLevel = page.getByRole("button", {name: /next level/i});
      expect(await nextLevel.isDisabled()).toBe(true);
      await page.evaluate(() => {
        const meter = document.querySelector<HTMLElement>("[data-coin-meter]");
        if (!meter) throw new Error("Coin meter missing");
        Object.defineProperty(meter, "animate", {
          configurable: true,
          value: () => { throw new Error("Animation API unavailable"); },
        });
      });
      await chest.click();
      await page.waitForFunction(() => document.querySelector(".coin-award")?.getAttribute("data-coin-collection") ===
        "complete", undefined, {timeout: 3_500});
      expect(await nextLevel.isEnabled()).toBe(true);
      await nextLevel.click();
      await page.locator(".modal-victory").waitFor({state: "detached"});
    } finally {
      await browser.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 30_000);
});
