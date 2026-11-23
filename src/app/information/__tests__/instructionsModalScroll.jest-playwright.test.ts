import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {chromium, type Browser} from "@playwright/test";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {installCompletedMockGameTour, completeMockOnboarding} from "../../testing/browser/__tests__/mockOnboarding.jest-playwright.support.ts";

/** Runs against the injected Jest harness in the built artifact. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("instructions modal without scrolling", () => {
  /** HTTP server serving the injected browser harness. */
  let server: Server;
  /** Headless browser shared by the modal check. */
  let browser: Browser;
  /** Local origin assigned to the harness server. */
  let origin: string;

  beforeAll(async () => {
    /** Directory containing the built Jest artifact. */
    const dist = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.resolve(__dirname, "../../../../../builds/jest");
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

  it.each([{width: 402, height: 682}, {width: 320, height: 568}, {width: 390, height: 844}])(
    "keeps every translated instruction and the final action in view at $width x $height", async viewport => {
    /** The actual Jest frame and narrow phone viewports must expose all help content together. */
    const page = await browser.newPage({viewport, hasTouch: true});
    try {
      await page.route("https://cdn.jest.com/**", route => route.fulfill({status: 200,
        contentType: "application/javascript", body: ""}));
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest`);
      await completeMockOnboarding(page);
      await page.getByTestId("server-activity-loader").waitFor({state: "hidden"});
      await page.getByRole("button", {name: /^settings$/i}).click();
      /** The real language menu enumerates every supported locale, including RTL. */
      const locales = await page.locator(".modal-settings select option").evaluateAll(options =>
        options.map(option => option.getAttribute("value")).filter((locale): locale is string => Boolean(locale)));
      for (const locale of locales) {
        /** Existing translated help labels drive the same route a player uses. */
        const settings = JSON.parse(await readFile(path.resolve(__dirname,
          "../../../../../src/locales", locale, "settings.json"), "utf8")).Settings;
        /** All existing instruction strings must remain visible after the compact layout change. */
        const copy = JSON.parse(await readFile(path.resolve(__dirname,
          "../../../../../src/locales", locale, "onboarding.json"), "utf8")).Instructions;
        await page.locator(".modal-settings select").selectOption(locale);
        await page.locator(".modal-settings").getByRole("button", {name: settings.HELP_BUTTON, exact: true}).click();
        /** Fonts settle before geometry is measured for long translations. */
        await page.evaluate(() => document.fonts.ready);
        /** Help remains one complete panel with no scroll container or clipped content. */
        const instructions = page.locator(".modal-instructions .instructions-page");
        await instructions.waitFor();
        /** The actual visible text, layout and action are measured without changing scroll positions. */
        const measurements = await instructions.evaluate(element => {
          /** The containing dialog determines the visible content boundary. */
          const modal = element.closest<HTMLElement>(".modal-instructions");
          /** The final primary action must be visible without scrolling. */
          const action = element.querySelector<HTMLButtonElement>(".play-primary");
          if (!modal || !action) throw new Error("Missing instructions dialog or action");
          /** Real rectangles expose overflow even when an ancestor clips it. */
          const rect = (node: Element) => {
            /** The rendered box used by browser hit testing. */
            const box = node.getBoundingClientRect();
            return {left: box.left, right: box.right, top: box.top, bottom: box.bottom, height: box.height};
          };
          return {text: element.textContent ?? "", modal: rect(modal), action: rect(action),
            modalClient: modal.clientHeight, modalScroll: modal.scrollHeight,
            pageClient: element.clientHeight, pageScroll: element.scrollHeight,
            widthClient: element.clientWidth, widthScroll: element.scrollWidth,
            overflow: getComputedStyle(element).overflowY,
            paragraphs: Array.from(element.querySelectorAll("p"), paragraph => ({
              fontSize: Number.parseFloat(getComputedStyle(paragraph).fontSize),
              clientWidth: paragraph.clientWidth, scrollWidth: paragraph.scrollWidth,
            })),
            content: Array.from(modal.querySelectorAll("h2,h3,p,button"), rect),
            direction: document.documentElement.dir};
        });
        for (const key of ["GOAL_DESCRIPTION", "COLOR_CLUES_TITLE", "COLOR_CORRECT", "COLOR_MISPLACED",
          "COLOR_WRONG", "TIPS_TITLE", "TIPS_DESCRIPTION", "GOT_IT_BUTTON"]) {
          expect(measurements.text).toContain(copy[key]);
        }
        expect(measurements.modalScroll).toBeLessThanOrEqual(measurements.modalClient + 1);
        expect(measurements.pageScroll).toBeLessThanOrEqual(measurements.pageClient + 1);
        expect(measurements.widthScroll).toBeLessThanOrEqual(measurements.widthClient + 1);
        expect(measurements.overflow).toBe("visible");
        expect(measurements.action.height).toBeGreaterThanOrEqual(48);
        expect(measurements.action.bottom).toBeLessThanOrEqual(viewport.height - 12);
        expect(measurements.modal.top).toBeGreaterThanOrEqual(0);
        expect(measurements.modal.bottom).toBeLessThanOrEqual(viewport.height);
        expect(measurements.direction).toBe(locale === "ar" ? "rtl" : "ltr");
        for (const paragraph of measurements.paragraphs) {
          expect(paragraph.fontSize).toBeGreaterThanOrEqual(16);
          expect(paragraph.scrollWidth).toBeLessThanOrEqual(paragraph.clientWidth + 1);
        }
        for (const box of measurements.content) {
          expect(box.left).toBeGreaterThanOrEqual(measurements.modal.left);
          expect(box.right).toBeLessThanOrEqual(measurements.modal.right);
          expect(box.top).toBeGreaterThanOrEqual(measurements.modal.top);
          expect(box.bottom).toBeLessThanOrEqual(measurements.modal.bottom);
        }
        expect(await instructions.getByRole("button", {name: copy.GOT_IT_BUTTON, exact: true}).isEnabled()).toBe(true);
        await instructions.getByRole("button", {name: copy.GOT_IT_BUTTON, exact: true}).click();
        await instructions.waitFor({state: "hidden"});
        await page.locator(".game-bottom-navigation button").first().click();
      }
    } finally {
      await page.close();
    }
  }, 90_000);

});
