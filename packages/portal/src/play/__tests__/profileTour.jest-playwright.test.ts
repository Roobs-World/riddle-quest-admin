import {completeMockOnboarding} from "./mockOnboarding.jest-playwright.support";
import {afterAll, beforeAll, describe, it} from "@jest/globals";
import {chromium, expect, type Browser, type Page} from "@playwright/test";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {PROFILE_TOUR} from "../guidance/guidanceConfig";
/** Runs against the injected Jest harness in the built artifact. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("profile walkthrough", () => {
  /** HTTP server serving the injected browser harness. */
  let server: Server;
  /** Headless browser shared by the walkthrough checks. */
  let browser: Browser;
  /** Local origin assigned to the harness server. */
  let origin: string;

  beforeAll(async () => {
    /** Directory containing the built Jest artifact. */
    const dist = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.resolve(__dirname, "../../../dist-jest");
    /** Content types used to serve artifact resources. */
    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
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
  /** Opens the actual profile with only its first-run tour still unseen. */
  const openProfile = async (page: Page) => {
    await page.addInitScript(() => {
      Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
      localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
      localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
      sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
    });
    await page.goto(`${origin}/?harness=jest`);
    await completeMockOnboarding(page);
    await page.getByRole("button", {name: /^profile$/i}).click();
    await expect(page.locator(".tooltip-backdrop")).toHaveAttribute("data-tooltip-id", PROFILE_TOUR[0]);
  };

  it.each([
    {width: 459, height: 591},
    {width: 320, height: 568},
  ])(
    "advances every step with one tap and keeps profile open at %j",
    async (viewport) => {
      /** Isolated page for this walkthrough scenario. */
      const page = await browser.newPage({viewport, hasTouch: true});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      try {
        await openProfile(page);
        for (const id of PROFILE_TOUR) {
          await expect(page.locator(".tooltip-backdrop")).toHaveAttribute("data-tooltip-id", id);
          // Let the target measurement settle, then exercise actual touch hit testing.
          await page.waitForTimeout(150);
          /** Tooltip bounds used to verify viewport containment. */
          const card = await page.locator(".tooltip-card").boundingBox();
          expect(card!.y).toBeGreaterThanOrEqual(0);
          expect(card!.y + card!.height).toBeLessThanOrEqual(viewport.height);
          if (
            [
              "profileProgression",
              "profileAchievements",
              "profileRanks",
              "profileStatistics",
              "profileLeaderboard",
              "profileTreasure",
            ].includes(id)
          ) {
            /** Spotlight bounds used to verify viewport containment. */
            const spotlight = await page.locator(".tooltip-spotlight").boundingBox();
            expect(spotlight!.y).toBeGreaterThanOrEqual(0);
            expect(spotlight!.y + spotlight!.height).toBeLessThanOrEqual(viewport.height);
            if (id !== "profileProgression") {
              /** Provides separated behavior. */
              const separated = card!.y + card!.height < spotlight!.y || card!.y > spotlight!.y + spotlight!.height;
              expect(separated).toBe(true);
            }
          }
          if (id === "profileStats" && viewport.width === 459) {
            await page.screenshot({path: "/tmp/profile-tour-stats.png"});
          }
          await page.locator(".tooltip-card button").tap({timeout: 2000});
          await expect(page.locator(".modal-profile")).toBeVisible();
        }
        await expect(page.locator(".tooltip-card")).toHaveCount(0);
      } finally {
        await page.close();
      }
    },
    30_000,
  );

  it("opens all 35 custom rank frames from the built profile on a narrow screen", async () => {
    /** Built-game journey validates the complete rank catalogue independently of race setup. */
    const page = await browser.newPage({viewport: {width: 320, height: 568}});
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await openProfile(page);
      for (const id of PROFILE_TOUR) {
        await expect(page.locator(".tooltip-backdrop")).toHaveAttribute("data-tooltip-id", id);
        await page.locator(".tooltip-card button").click();
      }
      await page.getByRole("button", {name: "Ranks", exact: true}).click();
      await expect(page.locator(".modal-ranks")).toBeVisible();
      await expect(page.locator(".rank-list article")).toHaveCount(35);
      await expect(page.locator(".rank-list .ranked-avatar")).toHaveCount(35);
      await expect(page.locator(".rank-list article[aria-current='step']")).toHaveCount(1);
      /** Each rank exposes its own large symbol in its frame preview. */
      const symbols = await page.locator(".rank-list [data-rank-icon]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-rank-icon")));
      expect(new Set(symbols).size).toBe(35);
      expect(await page.locator(".rank-material-heading").allTextContents()).toEqual(["Bronze", "Silver", "Gold", "Mithril"]);
      /** The final locked rank remains readable after scrolling the modal. */
      const finalRank = page.locator(".rank-list article").last();
      await finalRank.scrollIntoViewIfNeeded();
      await expect(finalRank.getByText("Quest Legend", {exact: true})).toBeVisible();
      await expect(finalRank.locator(".ranked-avatar")).toHaveAttribute("data-avatar-material", "mithril");
    } finally {
      await page.close();
    }
  }, 30_000);

  it("keeps the next step's button in place throughout an immediate press", async () => {
    /** Isolated page for this walkthrough scenario. */
    const page = await browser.newPage({viewport: {width: 459, height: 591}});
    // The SDK is injected by this mock harness; avoid an unrelated external startup request.
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await openProfile(page);
      await page.locator(".tooltip-card button").click();
      await expect(page.locator(".tooltip-backdrop")).toHaveAttribute("data-tooltip-id", PROFILE_TOUR[1]);
      /** Action bounds used to simulate an immediate pointer press. */
      const button = await page.locator(".tooltip-card button").boundingBox();
      await page.mouse.move(button!.x + button!.width / 2, button!.y + button!.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(120);
      await page.mouse.up();
      await expect(page.locator(".tooltip-backdrop")).toHaveAttribute("data-tooltip-id", PROFILE_TOUR[2]);
      await expect(page.locator(".modal-profile")).toBeVisible();
    } finally {
      await page.close();
    }
  }, 15_000);

  it("removes the tour when its profile closes and permits a fresh tour on reopening", async () => {
    /** Isolated page for this walkthrough scenario. */
    const page = await browser.newPage({viewport: {width: 459, height: 591}});
    // The SDK is injected by this mock harness; avoid an unrelated external startup request.
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await openProfile(page);
      // Simulate a modal dismissal arriving while the walkthrough owns input.
      await page.locator(".modal-profile .modal-x").evaluate((button: HTMLButtonElement) => button.click());
      await expect(page.locator(".modal-profile")).toHaveCount(0);
      await expect(page.locator(".tooltip-card")).toHaveCount(0, {timeout: 1000});
      await page.getByRole("button", {name: /^profile$/i}).click();
      await expect(page.locator(".tooltip-backdrop")).toHaveAttribute("data-tooltip-id", PROFILE_TOUR[0]);
    } finally {
      await page.close();
    }
  }, 15_000);

  it("opens the coin shop without a guidance popup", async () => {
    /** Browser page for the shop navigation check. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    // The SDK is injected by this mock harness; avoid an unrelated external startup request.
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest`);
      await completeMockOnboarding(page);
      await page
        .getByRole("button", {name: /buy coins/i})
        .first()
        .click();
      await expect(page.getByRole("heading", {name: /coin shop/i})).toBeVisible();
      await expect(page.locator(".tooltip-card")).toHaveCount(0);
    } finally {
      await page.close();
    }
  }, 15_000);
});
