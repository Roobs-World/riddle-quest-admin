import {afterAll, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type BrowserContext, type Frame, type Page} from "@playwright/test";
import {existsSync} from "node:fs";
import {RaceRunResponseSchema} from "@qwordly/core/race";

import {assertPrivateJestStorageState, persistPrivateJestStorageState} from "./deployedJestStorageState";
import {assertExactDeployedJestBuildUrl} from "./deployedJestBuildIdentity";

/** Provides live requested behavior. */
const liveRequested = process.env.PORTAL_DEPLOYED_TESTS === "1";
/** Provides sandbox login url behavior. */
const sandboxLoginUrl = process.env.JEST_SANDBOX_LOGIN_URL;
/** Provides game launch url behavior. */
const gameLaunchUrl = process.env.JEST_DEPLOYED_GAME_URL ?? "https://jest.com/g/riddle-q";
/** Provides sandbox state path behavior. */
const sandboxStatePath = process.env.JEST_SANDBOX_STORAGE_STATE ?? "/tmp/riddle-quest-jest-sandbox-state.json";
/** Provides expected game id behavior. */
const expectedGameId = process.env.JEST_GAME_ID ?? "019faa68-f3ec-755d-9ab5-c887fb426801";
/** Provides expected build version behavior. */
const expectedBuildVersion = process.env.JEST_EXPECTED_BUILD_VERSION ?? "";
/** Provides expected subscription sku behavior. */
const expectedSubscriptionSku = "com.roobsworld.riddlequest.premium.monthly";
/** Provides run headless behavior. */
const runHeadless = process.env.JEST_DEPLOYED_HEADED !== "1";
/** Provides app check debug token behavior. */
const appCheckDebugToken = process.env.FIREBASE_APPCHECK_DEBUG_TOKEN;

if (liveRequested && !sandboxLoginUrl && !existsSync(sandboxStatePath)) {
  throw new Error("JEST_SANDBOX_LOGIN_URL or JEST_SANDBOX_STORAGE_STATE is required for deployed Jest tests");
}
if (liveRequested && !expectedBuildVersion) {
  throw new Error("JEST_EXPECTED_BUILD_VERSION is required to prove the exact active Jest artifact");
}

/** Provides describe deployed behavior. */
const describeDeployed = liveRequested ? describe : describe.skip;

/** Provides wait for deployed game behavior. */
async function waitForDeployedGame(page: Page): Promise<Frame> {
  await page.waitForFunction(
    (gameId) =>
      Array.from(document.querySelectorAll("iframe")).some((iframe) => {
        try {
          /** Provides url behavior. */
          const url = new URL((iframe as HTMLIFrameElement).src);
          return url.hostname === `${gameId}.builds.jest.com`;
        } catch {
          return false;
        }
      }),
    expectedGameId,
    {timeout: 30_000},
  );
  /** Provides deadline behavior. */
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    /** Provides frame behavior. */
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
  /** Provides browser behavior. */
  let browser: Browser;
  /** Provides context behavior. */
  let context: BrowserContext;
  /** Provides page behavior. */
  let page: Page;

  beforeAll(async () => {
    if (existsSync(sandboxStatePath)) {
      await assertPrivateJestStorageState(sandboxStatePath);
    }
    browser = await chromium.launch({headless: runHeadless});
    context = await browser.newContext({
      viewport: {width: 390, height: 844},
      ...(existsSync(sandboxStatePath) ? {storageState: sandboxStatePath} : {}),
    });
    if (appCheckDebugToken) {
      await context.addInitScript((token) => {
        (
          globalThis as typeof globalThis & {
            /** Stores firebase appcheck debug token. */
            FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
          }
        ).FIREBASE_APPCHECK_DEBUG_TOKEN = token;
      }, appCheckDebugToken);
    }
    page = await context.newPage();
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  it("runs the active uploaded build inside a real registered Jest sandbox session", async () => {
    /** Provides console errors behavior. */
    const consoleErrors: string[] = [];
    /** Provides failed requests behavior. */
    const failedRequests: string[] = [];
    /** Provides successful functions behavior. */
    const successfulFunctions = new Set<string>();
    /** Provides referral verifications behavior. */
    const referralVerifications: Array<Record<string, unknown>> = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => failedRequests.push(request.url()));
    page.on("response", (response) => {
      /** Provides function name behavior. */
      const functionName = new URL(response.url()).pathname.split("/").filter(Boolean).at(-1) ?? "";
      if (response.ok() && response.url().includes("cloudfunctions.net")) {
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
        page.waitForURL((url) => url.hostname === "jest.com" && !url.searchParams.has("l"), {timeout: 30_000}),
        page.getByText(/the link has expired/i).waitFor({timeout: 30_000}),
      ]);
      expect(await page.getByText(/the link has expired/i).count()).toBe(0);
      await persistPrivateJestStorageState(context, sandboxStatePath);
    }
    await page.goto(gameLaunchUrl, {waitUntil: "domcontentloaded"});

    /** Provides game behavior. */
    const game = await waitForDeployedGame(page);
    /** Provides deployed build url behavior. */
    const deployedBuildUrl = assertExactDeployedJestBuildUrl({
      buildVersion: expectedBuildVersion,
      gameId: expectedGameId,
      url: game.url(),
    });
    expect(deployedBuildUrl.hostname).toBe(`${expectedGameId}.builds.jest.com`);
    expect(game.url()).not.toContain("harness=");

    /** Provides lets play behavior. */
    const letsPlay = game.getByRole("button", {name: /let's play/i});
    /** Provides playable content behavior. */
    const playableContent = game.locator(".onboarding-card-welcome, .riddle-card h1").first();
    /** Starts up error. */
    const startupError = game.locator(".route-missing");
    await playableContent.or(startupError).first().waitFor({timeout: 30_000});
    if (await startupError.isVisible()) {
      throw new Error(`Deployed Jest startup failed: ${(await startupError.innerText()).replace(/\s+/g, " ").trim()}`);
    }
    if (await letsPlay.isVisible()) {
      await letsPlay.click();
      /** Provides onboarding continue behavior. */
      const onboardingContinue = game.getByRole("button", {name: /got it/i});
      if (await onboardingContinue.isVisible()) await onboardingContinue.click();
    }
    await game.locator(".riddle-card h1").waitFor({timeout: 30_000});
    for (let step = 0; step < 12; step += 1) {
      /** Provides tooltip continue behavior. */
      const tooltipContinue = game.locator(".tooltip-card").getByRole("button", {name: /got it/i});
      if (await tooltipContinue.isVisible()) {
        await tooltipContinue.click();
      } else if ((await game.locator(".game-content").getAttribute("aria-hidden")) !== "true") {
        break;
      }
      await page.waitForTimeout(250);
    }
    await expect(game.locator(".game-content").getAttribute("aria-hidden")).resolves.not.toBe("true");
    expect((await game.locator(".riddle-card h1").innerText()).trim()).not.toBe("");

    expect(await game.locator(".keyboard").isVisible()).toBe(true);
    expect(
      await game.locator(".keyboard").evaluate((keyboard) => {
        /** Provides first key behavior. */
        const firstKey = keyboard.querySelector<HTMLElement>(".key");
        /** Provides first row behavior. */
        const firstRow = keyboard.firstElementChild as HTMLElement | null;
        /** Provides key style behavior. */
        const keyStyle = firstKey ? getComputedStyle(firstKey) : null;
        /** Provides keyboard style behavior. */
        const keyboardStyle = getComputedStyle(keyboard);
        /** Provides row style behavior. */
        const rowStyle = firstRow ? getComputedStyle(firstRow) : null;
        return {
          keyHeight: keyStyle?.height,
          keyMinHeight: keyStyle?.minHeight,
          letterGap: rowStyle?.columnGap,
          rowGap: keyboardStyle.rowGap,
        };
      }),
    ).toEqual({keyHeight: "32px", keyMinHeight: "32px", letterGap: "2px", rowGap: "0px"});
    expect(await game.locator(".guess-row").count()).toBe(5);
    expect(
      await game.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true);

    await game.evaluate(() => {
      /** Provides scope behavior. */
      const scope = globalThis as typeof globalThis & {
        /** Stores riddle quest live race messages. */
        __RIDDLE_QUEST_LIVE_RACE_MESSAGES__?: unknown[];
      };
      scope.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ = [];
      window.addEventListener("riddle-quest:host-to-game", (event) => {
        /** Provides detail behavior. */
        const detail = (event as CustomEvent<unknown>).detail;
        if (detail && typeof detail === "object" && "type" in detail && detail.type === "host:operationResult") {
          scope.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__?.push(structuredClone(detail));
        }
      });
    });
    await game.getByRole("button", {name: /^multiplayer$/i}).click();
    await game.getByRole("button", {name: /^History /}).click();
    await game.waitForFunction(
      () =>
        (
          globalThis as typeof globalThis & {
            /** Stores riddle quest live race messages. */
            __RIDDLE_QUEST_LIVE_RACE_MESSAGES__?: Array<{
              /** Stores payload. */
              payload?: {
                /** Stores operation. */
                operation?: string;
              };
            }>;
          }
        ).__RIDDLE_QUEST_LIVE_RACE_MESSAGES__?.some((message) => message.payload?.operation === "raceStart") === true,
      undefined,
      {timeout: 30_000},
    );
    /** Provides race messages behavior. */
    const raceMessages = await game.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            /** Stores riddle quest live race messages. */
            __RIDDLE_QUEST_LIVE_RACE_MESSAGES__?: unknown[];
          }
        ).__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ ?? [],
    );
    expect(raceMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({operation: "raceStart", ok: true}),
        }),
      ]),
    );
    /** Provides race start behavior. */
    const raceStart = raceMessages.find(
      (
        message,
      ): message is {
        /** Stores payload. */
        payload: {
          /** Stores operation. */
          operation: string; /** Stores data. */
          /** Stores data. */
          data: unknown;
        };
      } =>
        typeof message === "object" &&
        message !== null &&
        "payload" in message &&
        typeof message.payload === "object" &&
        message.payload !== null &&
        "operation" in message.payload &&
        message.payload.operation === "raceStart",
    );
    /** Provides validation behavior. */
    const validation = RaceRunResponseSchema.safeParse(raceStart?.payload.data);
    if (!validation.success) {
      throw new Error(JSON.stringify({raceStart, issues: validation.error.issues}, null, 2));
    }
    await game.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 5_000});
    expect(await game.locator(".race-error").count()).toBe(0);
    await game.getByRole("button", {name: /close race to 10/i}).click();
    /** Provides confirm quit behavior. */
    const confirmQuit = game.getByRole("button", {name: /^quit race$/i});
    if (await confirmQuit.isVisible()) await confirmQuit.click();
    await game.waitForFunction(
      () => document.querySelector(".game-content")?.getAttribute("aria-hidden") !== "true",
      undefined,
      {timeout: 30_000},
    );

    await game
      .getByRole("button", {name: /buy coins/i})
      .first()
      .click();
    await game.getByRole("heading", {name: /coin shop/i}).waitFor();
    expect(await game.locator(".game-shop-grid article").count()).toBeGreaterThan(0);

    /** Provides referral deadline behavior. */
    const referralDeadline = Date.now() + 10_000;
    while (referralVerifications.length === 0 && Date.now() < referralDeadline) {
      await page.waitForTimeout(100);
    }
    expect([...successfulFunctions]).toEqual(
      expect.arrayContaining([
        "exchangeJestIdentity",
        "getCurrentClassicRiddle",
        "startRaceRun",
        "verifyJestReferrals",
      ]),
    );
    expect(referralVerifications).not.toHaveLength(0);
    expect(referralVerifications.at(-1)).toEqual(
      expect.objectContaining({
        verified: true,
        conversionCount: expect.any(Number),
        rewardsGranted: expect.any(Number),
        referredRewardsGranted: expect.any(Number),
        coinsPerPlayer: 100,
        newCoins: expect.any(Number),
      }),
    );
    expect(failedRequests.filter((url) => url.includes("cloudfunctions.net"))).toEqual([]);
    expect(
      consoleErrors.filter(
        (message) =>
          !message.startsWith("requestStorageAccess: Refused to execute request. The document is sandboxed,"),
      ),
    ).toEqual([]);

    /** Provides subscription skus behavior. */
    const subscriptionSkus = await game.evaluate(async () => {
      /** Provides sdk behavior. */
      const sdk = (
        globalThis as typeof globalThis & {
          /** Stores jest sdk. */
          JestSDK: {
            /** Stores payments. */
            payments: {
              /** Gets subscriptions. */
              getSubscriptions(): Promise<{
                /** Stores subscriptions. */
                subscriptions: Array<{
                  /** Stores sku. */
                  sku: string;
                }>;
              }>;
            };
          };
        }
      ).JestSDK;
      /** Provides result behavior. */
      const result = await sdk.payments.getSubscriptions();
      return result.subscriptions.map(({sku}) => sku);
    });
    expect(subscriptionSkus).toContain(expectedSubscriptionSku);
    // The inactive offer is production-visible only after its signed
    // entitlement has been verified by the backend.
    expect(await game.locator(".shop-subscription-card").count()).toBe(1);
    expect([...successfulFunctions]).toContain("syncJestSubscriptions");
  });
});

jest.setTimeout(120_000);
