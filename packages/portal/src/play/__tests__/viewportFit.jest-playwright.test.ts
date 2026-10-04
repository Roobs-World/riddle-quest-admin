import {describe, expect, it} from "@jest/globals";
import {chromium} from "@playwright/test";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {completeMockOnboarding} from "./mockOnboarding.jest-playwright.support";

/** Exercises the real fitting hook and CSS across short phone viewports. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
describeBrowser("phone viewport fitting", () => {
  it("settles without alternating clue wrapping or clipping navigation", async () => {
    /** Serves the built Jest artifact for supplementary layout regression coverage. */
    const root = path.resolve(__dirname, "../../../dist-jest");
    /** Serves the selected layout artifact without external SDK traffic. */
    const server = createServer(async (request, response) => {
      /** Resolves the requested bundled asset. */
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      /** Absolute path of the requested test artifact. */
      const file = path.join(root, pathname === "/" ? "index.html" : pathname);
      try {
        /** Chooses the content type required by the browser. */
        const types: Record<string, string> = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".ttf": "font/ttf", ".svg": "image/svg+xml"};
        response.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
        response.end(await readFile(file));
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    /** Opens a browser with the production layout engine. */
    const browser = await chromium.launch({headless: true});
    try {
      /** Reads the allocated local port. */
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing test server address");
      /** An unavailable Daily stays visible and never quietly starts Classic. */
      const unavailablePage = await browser.newPage({viewport: {width: 412, height: 720}});
      await unavailablePage.route("https://cdn.jest.com/**", route => route.fulfill({status: 200, body: ""}));
      await unavailablePage.addInitScript(() => Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true}));
      await unavailablePage.goto(`http://127.0.0.1:${address.port}/?harness=jest&dailyUnavailable=1`);
      await unavailablePage.getByRole("status").filter({hasText: "No daily challenge available at the moment."}).waitFor();
      expect(await unavailablePage.locator(".riddle-card h1").count()).toBe(0);
      await unavailablePage.getByRole("button", {name: "Settings", exact: true}).click();
      await unavailablePage.getByRole("dialog", {name: "Settings", exact: true}).waitFor();
      await unavailablePage.getByRole("combobox", {name: "Language", exact: true}).selectOption("es");
      await unavailablePage.getByRole("dialog").getByRole("button", {name: /^(Close|Cerrar)$/}).click();
      await unavailablePage.getByRole("button", {name: "Configuración", exact: true}).waitFor();
      expect(await unavailablePage.locator(".riddle-card h1").count()).toBe(0);
      await unavailablePage.close();
      for (const [width, height] of [[384, 650], [412, 650], [360, 600], [360, 650], [320, 568], [390, 640], [412, 720], [424, 661]]) {
        /** Creates an isolated guest layout at each fixed phone size. */
        const page = await browser.newPage({viewport: {width, height}, isMobile: true, hasTouch: true});
        await page.route("https://cdn.jest.com/**", route => route.fulfill({status: 200, body: ""}));
        await page.addInitScript(() => {
          Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
          localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
          localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:v2:jest-guest", "seen");
          sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
        });
        await page.goto(`http://127.0.0.1:${address.port}/?harness=jest`);
        await completeMockOnboarding(page);
        await page.locator(".game-bottom-navigation").waitFor();
        expect(await page.locator(".riddle-card h1").innerText()).toBe("I speak without a mouth and hear without ears. What am I?");
        if (height <= 650) {
          await page.evaluate(async () => {
            await document.fonts.ready;
            for (let frame = 0; frame < 30; frame += 1) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          });
          expect(await page.locator(".keyboard .key").first().evaluate(key => key.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        }
        // Replay the recorded clue at the real typography/layout seam, without changing provider state.
        await page.locator(".riddle-card h1").evaluate(heading => {
          heading.textContent = "Which navigation tool has a magnetic needle and a dial marked north, south, east and west?";
        });
        await page.locator(".guess-board").evaluate((board: HTMLElement) => {
          board.style.setProperty("--answer-length", "7");
          board.style.setProperty("--board-max-width", "454px");
          for (const row of board.querySelectorAll(".guess-row")) {
            while (row.children.length < 7) row.appendChild(row.lastElementChild!.cloneNode(true));
          }
        });
        /** Records frame-by-frame geometry after fonts and initial layout settle. */
        const samples = await page.evaluate(async () => {
          await document.fonts.ready;
          /** Frame geometry used to detect the recorded alternating layout. */
          const values: Array<{
            /** Bottom edge of the visible clue. */
            clueBottom: number;
            /** Bottom edge of the navigation controls. */
            navigationBottom: number;
            /** Bottom edge of the scaled content. */
            contentBottom: number;
            /** Difference between letter-cell width and height. */
            cellDistortion: number;
            /** Scale selected by the production fitting hook. */
            scale: string | undefined;
          }> = [];
          for (let frame = 0; frame < 150; frame += 1) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            if (frame < 30) continue;
            values.push({
              clueBottom: document.querySelector(".riddle-card")!.getBoundingClientRect().bottom,
              navigationBottom: document.querySelector(".game-bottom-navigation")!.getBoundingClientRect().bottom,
              contentBottom: document.querySelector(".game-content")!.getBoundingClientRect().bottom,
              cellDistortion: Math.abs(document.querySelector(".cell")!.getBoundingClientRect().width - document.querySelector(".cell")!.getBoundingClientRect().height),
              scale: document.querySelector<HTMLElement>(".game-content")!.dataset.viewportScale,
            });
          }
          return values;
        });
        /** Requires stable clue wrapping and usable navigation throughout the settled frames. */
        const bottoms = samples.map(value => value.clueBottom);

        expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
        expect(Math.max(...samples.map(value => value.navigationBottom))).toBeLessThanOrEqual(height + 1);
        expect(Math.max(...samples.map(value => Math.abs(value.contentBottom - height)))).toBeLessThanOrEqual(1);
        expect(Math.max(...samples.map(value => value.cellDistortion))).toBeLessThanOrEqual(1);
        expect(Math.min(...samples.map(value => value.navigationBottom))).toBeGreaterThanOrEqual(height - 1);
        expect(await page.locator(".cell").first().evaluate(cell => getComputedStyle(cell).borderRadius)).toBe("50%");
        if (width === 412 && height === 720 && process.env.PORTAL_LAYOUT_SCREENSHOT) {
          await page.screenshot({path: process.env.PORTAL_LAYOUT_SCREENSHOT});
        }
        // Focusing a scaled bottom control must not scroll its hidden, unscaled layout overflow.
        await page.getByRole("button", {name: "Settings", exact: true}).click();
        expect(await page.locator(".game-app").evaluate(shell => shell.scrollTop)).toBe(0);
        await page.getByRole("dialog", {name: "Settings", exact: true}).getByRole("button", {name: "Close", exact: true}).click();
        expect(await page.locator(".game-app").evaluate(shell => shell.scrollTop)).toBe(0);
        expect(await page.locator(".game-header").evaluate(header => header.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
        expect(await page.getByRole("button", {name: "Settings", exact: true}).evaluate(button => document.activeElement === button)).toBe(true);
        await page.close();
      }
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }, 60_000);
});
