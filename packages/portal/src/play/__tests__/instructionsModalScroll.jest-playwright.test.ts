import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {chromium, type Browser} from "@playwright/test";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {completeMockOnboarding} from "./mockOnboarding.jest-playwright.support";

/** Runs against the injected Jest harness in the built artifact. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("instructions modal scrolling", () => {
  /** HTTP server serving the injected browser harness. */
  let server: Server;
  /** Headless browser shared by the modal check. */
  let browser: Browser;
  /** Local origin assigned to the harness server. */
  let origin: string;

  beforeAll(async () => {
    /** Directory containing the built Jest artifact. */
    const dist = path.resolve(__dirname, "../../../dist-jest");
    /** Content types used to serve artifact resources. */
    const types: Record<string, string> = {
      ".css": "text/css",
      ".html": "text/html",
      ".js": "text/javascript",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".ttf": "font/ttf",
      ".webm": "audio/webm",
      ".webp": "image/webp",
    };
    server = createServer(async (request, response) => {
      /** Requested path within the artifact. */
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      /** Artifact file corresponding to the request. */
      const file = path.join(dist, pathname === "/" ? "index.html" : pathname);
      try {
        /** Resource bytes returned to the browser. */
        const body = await readFile(file);
        response.writeHead(200, {"Content-Type": types[path.extname(file)] ?? "application/octet-stream"});
        response.end(body);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    /** Bound server address used to construct the harness origin. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({headless: true});
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it("scrolls to the final help action in a compact viewport", async () => {
    /** Compact mobile page where the translated instructions exceed the viewport. */
    const page = await browser.newPage({viewport: {width: 320, height: 568}, hasTouch: true});
    try {
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest`);
      // The platform's onboarding state takes precedence over browser-storage hints.
      await completeMockOnboarding(page);
      await page.getByTestId("server-activity-loader").waitFor({state: "hidden"});
      await page.getByRole("button", {name: /^settings$/i}).click();
      await page.getByRole("button", {name: /^help/i}).evaluate((button: HTMLButtonElement) => button.click());
      await page.setViewportSize({width: 320, height: 400});

      /** Scrollable instructions content controlled by the modal shell. */
      const instructions = page.locator(".modal-instructions .instructions-page");
      await instructions.waitFor();
      /** Initial dimensions prove the scenario requires scrolling. */
      const dimensions = await instructions.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
      /** Grid tracks keep the title fixed and assign all remaining height to instructions. */
      const modalRows = await page.locator(".modal-instructions").evaluate((element) =>
        getComputedStyle(element).gridTemplateRows.split(" ").filter(Boolean),
      );
      expect(modalRows).toHaveLength(2);

      /** Visible points used to exercise native touch scrolling rather than mutating scrollTop directly. */
      const box = await instructions.boundingBox();
      expect(box).not.toBeNull();
      /** Chrome DevTools session used to send a real finger gesture. */
      const session = await page.context().newCDPSession(page);
      /** Horizontal center of the instructions content. */
      const x = box!.x + box!.width / 2;
      /** Finger position near the bottom of the instructions content. */
      const startY = box!.y + box!.height * 0.8;
      /** Finger position near the top of the instructions content. */
      const endY = box!.y + box!.height * 0.2;
      await session.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x, y: startY}]});
      await session.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [{x, y: endY}]});
      await session.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
      await page.waitForTimeout(100);
      expect(await instructions.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      expect(await instructions.getByRole("button", {name: /got it/i}).isVisible()).toBe(true);
    } finally {
      await page.close();
    }
  }, 15_000);
});
