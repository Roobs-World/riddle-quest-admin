import {describe, expect, it} from "@jest/globals";
import {chromium} from "@playwright/test";
import {startYouTubeArtifactServer} from "../../../../platforms/web/youtube/src/__tests__/youtubeBrowser.jest-playwright.support";
import {expectWebStandards} from "../../play/__tests__/webStandards.jest-playwright.support";

/** Runs against the isolated candidate artifacts when browser verification is enabled. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("Candidate purchase currency boundaries", () => {
  it.each(["netflix", "yahoo"] as const)("%s exposes no paid shop or checkout currency", async (target) => {
    /** Isolated artifact served to the browser. */
    const artifact = await startYouTubeArtifactServer(target);
    /** Headless browser running the artifact. */
    const browser = await chromium.launch({headless: true});
    try {
      /** Fresh browser page for this target. */
      const page = await (await browser.newContext({locale: "en-GB", viewport: {width: 390, height: 844}})).newPage();
      /** Unexpected outbound requests from the self-contained artifact. */
      const externalRequests: string[] = [];
      /** Uncaught errors observed during page startup. */
      const errors: string[] = [];
      page.on("request", (request) => {
        if (!request.url().startsWith(artifact.origin)) externalRequests.push(request.url());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(artifact.origin);
      await page.getByRole("heading", {name: "Choose a puzzle"}).waitFor();
      await expectWebStandards(page, `${target} home`);
      expect(await page.getByRole("button", {name: /shop|buy|purchase|subscribe/i}).count()).toBe(0);
      expect(await page.locator("body").innerText()).not.toMatch(/USD|GBP|Gold|\$|£|€/);
      await page.getByRole("button", {name: /Classic/}).click();
      await page.getByRole("heading", {name: /Which ancient city/}).waitFor();
      await expectWebStandards(page, `${target} game`);
      for (const letter of "XXXX") {
        await page.locator(".yt-keyboard button", {hasText: new RegExp(`^${letter}$`)}).click();
      }
      /** Measures local feedback from the actual submit event. */
      const latency = await page.getByRole("button", {name: "Submit", exact: true}).evaluate(async (button) => {
        /** Starts before invoking the UI handler. */
        const started = performance.now();
        (button as HTMLButtonElement).click();
        while (document.querySelectorAll(".yt-guess-row .yt-tile.red").length !== 4) {
          if (performance.now() - started > 1000) throw new Error("Local feedback was delayed");
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
        return performance.now() - started;
      });
      expect(latency).toBeLessThan(250);
      for (const letter of "ROME") {
        await page.locator(".yt-keyboard button", {hasText: new RegExp(`^${letter}$`)}).click();
      }
      await page.getByRole("button", {name: "Submit", exact: true}).click();
      await page.getByRole("heading", {name: "Solved!"}).waitFor();
      await expectWebStandards(page, `${target} solved`);
      console.info(`${target}: local feedback ${latency.toFixed(1)}ms; wrong and correct answers verified`);
      expect(externalRequests).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await artifact.close();
    }
  }, 60_000);
});
