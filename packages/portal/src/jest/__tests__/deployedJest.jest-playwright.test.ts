import {afterAll, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type BrowserContext, type Frame, type Page} from "@playwright/test";
import {existsSync} from "node:fs";
import {RaceRunResponseSchema} from "@qwordly/core/race";

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
    if (frame && !frame.isDetached()) {
      // Jest briefly attaches a bootstrap iframe and replaces it with the
      // playable build. Require the same frame to remain attached before
      // handing it to assertions, without assuming first-run UI state.
      await page.waitForTimeout(750);
      if (!frame.isDetached() && page.frames().includes(frame)) return frame;
    }
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
    const referralVerifications: Array<Record<string, unknown>> = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => failedRequests.push(request.url()));
    page.on("response", (response) => {
      const functionName = new URL(response.url()).pathname.split("/").filter(Boolean).at(-1) ?? "";
      if (
        response.ok() &&
        response.url().includes("cloudfunctions.net")
      ) {
        successfulFunctions.add(functionName);
        if (functionName === "verifyJestReferrals") {
          void response.json().then((value: unknown) => {
            if (value && typeof value === "object" && !Array.isArray(value)) {
              referralVerifications.push(value as Record<string, unknown>);
            }
          });
        }
      }
    });

    if (sandboxLoginUrl) {
      await page.goto(sandboxLoginUrl, {waitUntil: "domcontentloaded"});
      await Promise.race([
        page.waitForURL(
          (url) => url.hostname === "jest.com" && !url.searchParams.has("l"),
          {timeout: 30_000},
        ),
        page.getByText(/the link has expired/i).waitFor({timeout: 30_000}),
      ]);
      expect(await page.getByText(/the link has expired/i).count()).toBe(0);
      await context.storageState({path: sandboxStatePath});
    }
    await page.goto(gameLaunchUrl, {waitUntil: "domcontentloaded"});

    const game = await waitForDeployedGame(page);
    expect(new URL(game.url()).hostname).toBe(`${expectedGameId}.builds.jest.com`);
    expect(game.url()).not.toContain("harness=");

    const letsPlay = game.getByRole("button", {name: /let's play/i});
    await game.locator(".onboarding-card-welcome, .riddle-card h1").first().waitFor({timeout: 30_000});
    if (await letsPlay.isVisible()) {
      await letsPlay.click();
      const onboardingContinue = game.getByRole("button", {name: /got it/i});
      if (await onboardingContinue.isVisible()) await onboardingContinue.click();
    }
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

    await game.evaluate(() => {
      const scope = globalThis as typeof globalThis & {__RIDDLE_QUEST_LIVE_RACE_MESSAGES__?: unknown[]};
      scope.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ = [];
      window.addEventListener("riddle-quest:host-to-game", (event) => {
        const detail = (event as CustomEvent<unknown>).detail;
        if (
          detail &&
          typeof detail === "object" &&
          "type" in detail &&
          detail.type === "host:operationResult"
        ) {
          scope.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__?.push(structuredClone(detail));
        }
      });
    });
    await game.getByRole("button", {name: /^multiplayer$/i}).click();
    await game.getByRole("button", {name: /^History /}).click();
    await game.waitForFunction(
      () =>
        (globalThis as typeof globalThis & {__RIDDLE_QUEST_LIVE_RACE_MESSAGES__?: Array<{payload?: {operation?: string}}>} )
          .__RIDDLE_QUEST_LIVE_RACE_MESSAGES__?.some((message) => message.payload?.operation === "raceStart") === true,
      undefined,
      {timeout: 30_000},
    );
    const raceMessages = await game.evaluate(() =>
      (globalThis as typeof globalThis & {__RIDDLE_QUEST_LIVE_RACE_MESSAGES__?: unknown[]})
        .__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ ?? [],
    );
    expect(raceMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        payload: expect.objectContaining({operation: "raceStart", ok: true}),
      }),
    ]));
    const raceStart = raceMessages.find(
      (message): message is {payload: {operation: string; data: unknown}} =>
        typeof message === "object" &&
        message !== null &&
        "payload" in message &&
        typeof message.payload === "object" &&
        message.payload !== null &&
        "operation" in message.payload &&
        message.payload.operation === "raceStart",
    );
    const validation = RaceRunResponseSchema.safeParse(raceStart?.payload.data);
    if (!validation.success) {
      throw new Error(JSON.stringify({raceStart, issues: validation.error.issues}, null, 2));
    }
    await game.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 5_000});
    expect(await game.locator(".race-error").count()).toBe(0);
    await game.getByRole("button", {name: /close race to 10/i}).click();

    await game.getByRole("button", {name: /buy coins/i}).first().click();
    await game.getByRole("heading", {name: /coin shop/i}).waitFor();
    expect(await game.locator(".game-shop-grid article").count()).toBeGreaterThan(0);

    const referralDeadline = Date.now() + 10_000;
    while (referralVerifications.length === 0 && Date.now() < referralDeadline) {
      await page.waitForTimeout(100);
    }
    expect([...successfulFunctions]).toEqual(expect.arrayContaining([
      "exchangeJestIdentity",
      "getCurrentClassicRiddle",
      "startRaceRun",
      "verifyJestReferrals",
    ]));
    expect(referralVerifications).not.toHaveLength(0);
    expect(referralVerifications.at(-1)).toEqual(expect.objectContaining({
      verified: true,
      conversionCount: expect.any(Number),
      rewardsGranted: expect.any(Number),
      referredRewardsGranted: expect.any(Number),
      coinsPerPlayer: 100,
      newCoins: expect.any(Number),
    }));
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
