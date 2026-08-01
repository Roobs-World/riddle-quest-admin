import {describe, expect, it} from "@jest/globals";
import {chromium} from "@playwright/test";

const describeSoak = process.env.PORTAL_SOAK_TESTS === "1" ? describe : describe.skip;
const durationMs = Number(process.env.PORTAL_SOAK_DURATION_MS ?? 10 * 60 * 1_000);

describeSoak("low-end mobile stability", () => {
  it("remains responsive and memory-bounded during extended play", async () => {
    const {execFileSync} = await import("node:child_process");
    const {createServer} = await import("node:http");
    const {readFile} = await import("node:fs/promises");
    const path = await import("node:path");
    const packageRoot = path.resolve(__dirname, "../../..");
    execFileSync("pnpm", ["--filter", "@qwordly/portal", "build:jest"], {
      cwd: path.resolve(packageRoot, "../.."),
      stdio: "inherit",
    });

    const distDir = path.join(packageRoot, "dist-jest");
    const server = createServer(async (request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const candidate = path.join(distDir, requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname);
      const filePath = path.extname(candidate) ? candidate : path.join(distDir, "index.html");
      try {
        const body = await readFile(filePath);
        const contentType = {
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

    const browser = await chromium.launch({headless: true, args: ["--enable-precise-memory-info"]});
    const context = await browser.newContext({
      viewport: {width: 360, height: 740},
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 11; Pixel 3a) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
    });
    const page = await context.newPage();
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", {configurable: true, value: 4});
      Object.defineProperty(navigator, "deviceMemory", {configurable: true, value: 4});
      localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
      localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
      sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
    });

    try {
      await page.goto("http://127.0.0.1:4180/?harness=jest");
      await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
      const cdp = await context.newCDPSession(page);
      await cdp.send("HeapProfiler.collectGarbage");
      const heapSize = () => page.evaluate(() => {
        const memory = (performance as Performance & {memory?: {usedJSHeapSize: number}}).memory;
        return memory?.usedJSHeapSize ?? 0;
      });
      const initialHeap = await heapSize();
      const startedAt = Date.now();
      let cycle = 0;
      while (Date.now() - startedAt < durationMs) {
        await page.locator(".keyboard").getByRole("button", {name: /^A$/}).click();
        await page.locator(".keyboard").getByRole("button", {name: /backspace/i}).click();
        if (cycle % 10 === 0) {
          await page.getByRole("button", {name: /^settings$/i}).first().click();
          await page.keyboard.press("Escape");
        }
        if (cycle % 20 === 0) {
          await page.setViewportSize(cycle % 40 === 0 ? {width: 740, height: 360} : {width: 360, height: 740});
        }
        expect(await page.locator(".keyboard").isVisible()).toBe(true);
        await page.waitForTimeout(2_000);
        cycle += 1;
      }
      await cdp.send("HeapProfiler.collectGarbage");
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
  }, durationMs + 90_000);
});
