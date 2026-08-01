import {afterAll, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type BrowserContext, type Frame, type Page} from "@playwright/test";
import {existsSync} from "node:fs";

const liveRequested = process.env.PORTAL_DEPLOYED_TESTS === "1";
const sandboxLoginUrl = process.env.JEST_SANDBOX_LOGIN_URL;
const gameLaunchUrl = process.env.JEST_DEPLOYED_GAME_URL ?? "https://jest.com/g/riddle-q";
const sandboxStatePath =
  process.env.JEST_SANDBOX_STORAGE_STATE ?? "/tmp/riddle-quest-jest-sandbox-state.json";
const expectedGameId = process.env.JEST_GAME_ID ?? "019faa68-f3ec-755d-9ab5-c887fb426801";
const expectedSubscriptionSku = "com.roobsworld.riddlequest.premium.monthly";

if (liveRequested && !sandboxLoginUrl && !existsSync(sandboxStatePath)) {
  throw new Error(
    "JEST_SANDBOX_LOGIN_URL or JEST_SANDBOX_STORAGE_STATE is required for deployed Jest tests",
  );
}

const describeDeployed = liveRequested ? describe : describe.skip;

async function waitForDeployedGame(page: Page): Promise<Frame> {
  await page.waitForFunction(
    (gameId) => Array.from(document.querySelectorAll("iframe")).some((iframe) => {
      try {
        const url = new URL((iframe as HTMLIFrameElement).src);
        return url.hostname === `${gameId}.builds.jest.com`;
      } catch {
        return false;
      }
    }),
    expectedGameId,
    {timeout: 30_000},
  );
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const frame = page.frames().find((candidate) => {
      try {
        return new URL(candidate.url()).hostname === `${expectedGameId}.builds.jest.com`;
      } catch {
        return false;
      }
    });
    if (frame) return frame;
    // The iframe element can be present just before Playwright observes the
    // cross-origin frame attachment. Poll the frame tree instead of treating
    // that normal hand-off as a missing deployment.
    await page.waitForTimeout(100);
  }
  throw new Error("The deployed Jest game iframe was not found");
}

describeDeployed("deployed Jest sandbox game", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({headless: true});
    context = await browser.newContext({
      viewport: {width: 390, height: 844},
      ...(existsSync(sandboxStatePath) ? {storageState: sandboxStatePath} : {}),
    });
    page = await context.newPage();
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  it("runs the active uploaded build inside a real registered Jest sandbox session", async () => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const successfulFunctions = new Set<string>();

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => failedRequests.push(request.url()));
    page.on("response", (response) => {
      if (
        response.ok() &&
        response.url().includes("cloudfunctions.net")
      ) {
        successfulFunctions.add(new URL(response.url()).pathname.split("/").filter(Boolean).at(-1) ?? "");
      }
    });

    if (sandboxLoginUrl) {
      await page.goto(sandboxLoginUrl, {waitUntil: "domcontentloaded"});
      await page.waitForURL((url) => url.hostname === "jest.com", {timeout: 30_000});
      expect(await page.getByText(/the link has expired/i).count()).toBe(0);
      await context.storageState({path: sandboxStatePath});
    }
    await page.goto(gameLaunchUrl, {waitUntil: "domcontentloaded"});

    const game = await waitForDeployedGame(page);
    expect(new URL(game.url()).hostname).toBe(`${expectedGameId}.builds.jest.com`);
    expect(game.url()).not.toContain("harness=");

    await game.getByRole("button", {name: /let's play/i}).waitFor({timeout: 30_000});
    await game.getByRole("button", {name: /let's play/i}).click();
    await game.getByRole("button", {name: /got it/i}).click();
    await game.locator(".riddle-card h1").waitFor({timeout: 30_000});
    for (let step = 0; step < 12; step += 1) {
      const tooltipContinue = game.locator(".tooltip-card").getByRole("button", {name: /got it/i});
      if (await tooltipContinue.isVisible()) {
        await tooltipContinue.click();
      } else if (await game.locator(".game-content").getAttribute("aria-hidden") !== "true") {
        break;
      }
      await page.waitForTimeout(250);
    }
    await expect(game.locator(".game-content").getAttribute("aria-hidden")).resolves.not.toBe("true");
    expect((await game.locator(".riddle-card h1").innerText()).trim()).not.toBe("");

    expect(await game.locator(".keyboard").isVisible()).toBe(true);
    expect(await game.locator(".guess-row").count()).toBe(5);
    expect(
      await game.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true);

    await game.getByRole("button", {name: /buy coins/i}).first().click();
    await game.getByRole("heading", {name: /coin shop/i}).waitFor();
    expect(await game.locator(".game-shop-grid article").count()).toBeGreaterThan(0);

    expect([...successfulFunctions]).toEqual(expect.arrayContaining([
      "exchangeJestIdentity",
      "getCurrentClassicRiddle",
    ]));
    expect(failedRequests.filter((url) => url.includes("cloudfunctions.net"))).toEqual([]);
    expect(consoleErrors).toEqual([]);

    const subscriptionSkus = await game.evaluate(async () => {
      const sdk = (globalThis as typeof globalThis & {
        JestSDK: {
          payments: {
            getSubscriptions(): Promise<{subscriptions: Array<{sku: string}>}>;
          };
        };
      }).JestSDK;
      const result = await sdk.payments.getSubscriptions();
      return result.subscriptions.map(({sku}) => sku);
    });
    expect(subscriptionSkus).toContain(expectedSubscriptionSku);
    expect(await game.locator(".shop-subscription-card").count()).toBe(1);
  });
});

jest.setTimeout(120_000);
