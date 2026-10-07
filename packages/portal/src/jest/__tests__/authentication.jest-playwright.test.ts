import {openAuthenticationHarness} from "./authenticationHarness.jest-playwright.support";
import {afterAll, afterEach, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {
  type AuthHarnessState,
  getHarnessState,
  advanceToRegistration,
  enterRegisteredGame,
  verifyShortJestPreview,
  verifySlowStartupWatchdog,
  verifyDelayedHostHandshake,
  verifyOptionalProfileFailure,
  verifyRetryableStartupScreen,
  retryFailedStartup,
  dismissDailyCompletionGuidance,
  verifyGuestStartupIdentity,
  openProfileAfterGuidance,
} from "./authentication.jest-playwright.support";
import {PLAYER_NOTIFICATION_IDS} from "../notifications/engagement";
/** Provides describe browser behavior. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
/** Provides base url behavior. */
let baseUrl: string;
/** Provides shared race challenges behavior. */
const sharedRaceChallenges = new Map<string, string>();
/** Binds each isolated page to the suite-owned local server. */
const openHarness = (browser: Browser, options: Parameters<typeof openAuthenticationHarness>[2] = {}) =>
  openAuthenticationHarness(browser, baseUrl, options);

describeBrowser("Jest authentication integration", () => {
  /** Provides browser behavior. */
  let browser: Browser;
  /** Provides server behavior. */
  let server: Server;

  beforeAll(async () => {
    /** Provides package root behavior. */
    const packageRoot = path.resolve(__dirname, "../../..");
    if (process.env.PORTAL_USE_EXISTING_BUILD !== "1") {
      execFileSync("pnpm", ["--filter", "@qwordly/portal", "build:jest"], {
        cwd: path.resolve(packageRoot, "../.."),
        stdio: "inherit",
      });
    }
    /** Provides dist dir behavior. */
    const distDir = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.join(packageRoot, "../../builds/jest");
    /** Provides content types behavior. */
    const contentTypes: Record<string, string> = {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".ttf": "font/ttf",
      ".svg": "image/svg+xml",
      ".webm": "audio/webm",
      ".webp": "image/webp",
    };
    server = createServer(async (request, response) => {
      /** Requests url. */
      const requestUrl = new URL(request.url ?? "/", baseUrl);
      /** Provides shared race match behavior. */
      const sharedRaceMatch = requestUrl.pathname.match(/^\/__race-harness\/challenges\/([^/]+)$/);
      if (sharedRaceMatch) {
        /** Provides challenge id behavior. */
        const challengeId = decodeURIComponent(sharedRaceMatch[1]);
        if (request.method === "PUT") {
          /** Provides chunks behavior. */
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          sharedRaceChallenges.set(challengeId, Buffer.concat(chunks).toString("utf8"));
          response.writeHead(204).end();
          return;
        }
        /** Provides challenge behavior. */
        const challenge = sharedRaceChallenges.get(challengeId);
        response.writeHead(challenge ? 200 : 404, {"Content-Type": "application/json; charset=utf-8"});
        response.end(challenge ?? JSON.stringify({error: "not_found"}));
        return;
      }
      /** Provides candidate behavior. */
      const candidate = path.join(distDir, requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname);
      /** Provides file path behavior. */
      const filePath = path.extname(candidate) ? candidate : path.join(distDir, "index.html");
      try {
        /** Provides body behavior. */
        const body = await readFile(filePath);
        response.writeHead(200, {
          "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
        });
        response.end(body);
      } catch {
        response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
        response.end("Not found");
      }
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    /** OS-assigned port avoids collisions with concurrent browser harnesses. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Browser harness TCP address unavailable");
    baseUrl = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({headless: true, args: ["--renderer-process-limit=4"]});
  });

  afterEach(async () =>
    Promise.all(browser?.contexts().map((context) => context.close().catch(() => undefined)) ?? []),
  );

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
  });

  it("survives the hosted loading watchdog while signed identity takes 25 seconds", async () => {
    /** Provides {page, page errors} behavior. */
    const {page, pageErrors} = await openHarness(browser, {scenario: "loading-watchdog"});
    await verifySlowStartupWatchdog(page, pageErrors);
  }, 60_000);

  it("uses the restored language for the first hosted game handshake after reload", async () => {
    /** Extracts the fixture or authority fields required by this transition. */
    const {context, page, pageErrors} = await openHarness(browser, {registered: true, scenario: "returning-turkish"});
    try {
      await page.addInitScript(() => {
        window.addEventListener("riddle-quest:host-to-game", event => {
          /** Correlated bridge envelope exposes the authoritative operation. */
          const message = (event as CustomEvent<HostToGameMessage>).detail;
          if (message.type === "host:init" && !sessionStorage.getItem("test:first-host-locale")) {
            sessionStorage.setItem("test:first-host-locale", message.payload.locale);
          }
        });
      });
      await page.reload();
      await page.waitForFunction(() => sessionStorage.getItem("test:first-host-locale") !== null);
      expect(await page.evaluate(() => sessionStorage.getItem("test:first-host-locale"))).toBe("tr");
      expect(await page.locator("html").getAttribute("lang")).toBe("tr");
      expect(pageErrors).toEqual([]);
    } finally {await context.close();}
  });


  it("keeps unavailable Daily visible without silently opening Classic", async () => {
    /** Extracts the fixture or authority fields required by this transition. */
    const {context, page} = await openHarness(browser, {registered: true, gameMode: "challenge", dailyUnavailable: true});
    try {
      await page.getByRole("status").filter({hasText: "No daily challenge available at the moment."}).waitFor({timeout: 15000});
      expect(await page.getByRole("heading", {name: "What has keys but cannot open doors?", exact: true}).count()).toBe(0);
    } finally { await context.close(); }
  });

  it("keeps the riddle and controls usable in the short Jest phone preview", async () => {
    await verifyShortJestPreview((await openHarness(browser, {registered: true})).page);
  });

  it("localizes game-owned Shop copy in Arabic and preserves provider descriptions", async () => {
    /** Isolated browser context and captured page errors for this player pathway. */
    const {page} = await openHarness(browser, {registered: true, scenario: "localized-coin-catalog"});
    await enterRegisteredGame(page);
    await page.getByRole("button", {name: "Settings", exact: true}).click();
    await page.getByRole("combobox", {name: "Language", exact: true}).selectOption("ar");
    await page.getByRole("button", {name: "شراء العملات المعدنية", exact: true}).first().click();
    await page.getByText("أفضل قيمة", {exact: true}).waitFor();
    await page.getByText("أضف 7,000 عملة إلى رصيدك.", {exact: true}).waitFor();
    await page.getByText("للمبتدئين", {exact: true}).waitFor();
    await page.getByText("Provider custom description", {exact: true}).waitFor();
    expect(await page.getByText("BEST VALUE", {exact: true}).count()).toBe(0);
    expect(await page.locator("html").getAttribute("dir")).toBe("rtl");
  });

  it("refreshes subscription changes, hides active purchase buttons, and cancels renewal from Profile", async () => {
    /** Explicit Daily entry keeps the canonical riddle available for subscription assertions. */
    const {page} = await openHarness(browser, {registered: true, gameMode: "challenge"});
    await enterRegisteredGame(page, /I speak without a mouth/i);
    await page.locator(".game-mode-label").getByText(/daily/i).waitFor();
    await page
      .getByRole("button", {name: /buy coins/i})
      .first()
      .click();
    await page.getByRole("button", {name: /start free trial/i}).waitFor();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("test:subscription-state", {detail: true})));
    /** Finds the active plan’s cancellation action. */
    const cancel = page.getByRole("button", {name: /cancel subscription/i});
    await page.getByText("Premium active", {exact: true}).waitFor();
    expect(await cancel.count()).toBe(0);
    expect(await page.getByRole("button", {name: /start free trial|^subscribe$/i}).count()).toBe(0);
    await page.getByRole("button", {name: "Close", exact: true}).click();
    await page.getByRole("button", {name: "Settings", exact: true}).click();
    await cancel.waitFor();
    expect(await page.locator(".settings-page button").last().textContent()).toMatch(/cancel subscription/i);
    await page.screenshot({path: "/tmp/riddle-settings-subscription.png"});
    await page.getByRole("button", {name: "Close", exact: true}).click();
    await openProfileAfterGuidance(page);
    await cancel.waitFor();
    expect(await page.locator(".profile-page button").last().textContent()).toMatch(/delete account/i);
    expect(await cancel.evaluate((button) => {
      /** Provides deletion behavior. */
      const deletion = document.querySelector(".profile-delete-account-button");
      return deletion !== null && button.closest(".profile-subscriptions")?.nextElementSibling === deletion.parentElement
        && button.getBoundingClientRect().bottom <= deletion.getBoundingClientRect().top;
    })).toBe(true);
    expect((await getHarnessState(page)).calls).not.toContain("sdk.payments.beginSubscription");
    for (const scenario of ["subscription-cancel-dismiss", "subscription-cancel-error", "success"]) {
      await page.evaluate((value) => {
        (window as any).__RIDDLE_QUEST_JEST_AUTH_TEST__.scenario = value;
      }, scenario);
      await cancel.click();
      await page.getByTestId("server-activity-loader").waitFor({state: "hidden"});
      if (scenario === "subscription-cancel-error")
        await page
          .getByRole("alert")
          .filter({hasText: /unexpected error/i})
          .waitFor();
      if (scenario !== "success") expect(await page.getByText(/renewal cancelled/i).count()).toBe(0);
    }
    await page.getByText(/renewal cancelled/i).waitFor();
    expect(await page.getByText("Premium active", {exact: true}).isVisible()).toBe(true);
    expect(
      (await getHarnessState(page)).calls.filter((call) => call.startsWith("sdk.payments.cancelSubscription:")),
    ).toHaveLength(3);
    await page.screenshot({path: "/tmp/riddle-subscription-cancelled.png"});
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("test:subscription-state", {detail: false})));
    await cancel.waitFor({state: "hidden"});
    await page.getByRole("button", {name: "Close", exact: true}).click();
    await page.getByRole("button", {name: /buy coins/i}).first().click();
    await page.getByRole("button", {name: /start free trial/i}).waitFor();
  }, 30_000);

  it("delivers native analytics for startup, controls, and confirmed gameplay", async () => {
    /** Isolated Classic fixture with Daily already completed. */
    const {context, page, pageErrors} = await openHarness(browser, {registered: true, gameMode: "classic", dailyCompleted: true});
    try {
      await enterRegisteredGame(page);
      for (const letter of "PIANO") await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      await page.getByRole("button", {name: /submit/i}).click();
      await page.waitForFunction(() => window.__RIDDLE_QUEST_JEST_AUTH_TEST__?.calls.some(call => call.startsWith("sdk.captureEvent:level_end:")));
      /** Events observed at the provider boundary. */
      const events = (await getHarnessState(page)).calls.filter(call => call.startsWith("sdk.captureEvent:"));
      expect(events.filter(call => call.startsWith("sdk.captureEvent:session_started:"))).toHaveLength(1);
      expect(events.some(call => call.startsWith("sdk.captureEvent:screen_view:"))).toBe(true);
      expect(events.some(call => call.startsWith("sdk.captureEvent:button_press:"))).toBe(true);
      expect(events.some(call => call.includes('"success":true'))).toBe(true);
      expect(pageErrors).toEqual([]);
    } catch (error) {
      throw new Error(`${String(error)}; body: ${await page.locator("body").innerText()}; errors: ${JSON.stringify(pageErrors)}`);
    } finally { await context.close(); }
  }, 30_000);

  it("refreshes an unavailable cancellation without claiming it succeeded or revoking paid access", async () => {
    /** Extracts the fixture or authority fields required by this transition. */
    const {page} = await openHarness(browser, {registered: true, scenario: "subscription-cancel-inactive"});
    await enterRegisteredGame(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("test:subscription-state", {detail: true})));
    await page.getByRole("button", {name: "Settings", exact: true}).click();
    /** Controlled cancellation result cannot revoke access before confirmation. */
    const cancel = page.getByRole("button", {name: /cancel subscription/i});
    await cancel.waitFor();
    await cancel.click();
    await page.getByText(/Cancellation is unavailable for this subscription/).waitFor();
    expect(await cancel.isEnabled()).toBe(false);
    expect(await page.getByText("Premium active", {exact: true}).isVisible()).toBe(true);
    expect(await page.getByText(/renewal cancelled/i).count()).toBe(0);
    expect(await page.getByRole("alert").filter({hasText: /unexpected error/i}).count()).toBe(0);
    await page.getByRole("button", {name: "Close", exact: true}).click();
    await page.getByRole("button", {name: /buy coins/i}).first().click();
    await page.getByText("Premium active", {exact: true}).waitFor();
    expect(await page.getByRole("button", {name: /start free trial|^subscribe$/i}).count()).toBe(0);
  }, 30_000);

  it("reports first_milestone after a returning player solves a riddle", async () => {
    /** Restores a wallet that completed the milestone in an earlier session. */
    const {page} = await openHarness(browser, {registered: true, scenario: "returning-milestone"});
    await enterRegisteredGame(page);
    expect((await getHarnessState(page)).calls).not.toContain("sdk.markFirstMilestone");
    for (const letter of "PIANO")
      await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
    await page.getByRole("button", {name: /submit/i}).click();
    await page.waitForFunction(() =>
      (
        window as typeof window & {
          /** Observed SDK calls for this test session. */
          __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
        }
      ).__RIDDLE_QUEST_JEST_AUTH_TEST__.calls.includes("sdk.markFirstMilestone"),
    );
    expect((await getHarnessState(page)).calls.filter((call) => call === "sdk.markFirstMilestone")).toHaveLength(1);
  }, 30_000);

  it("starts a guest through signed identity exchange and reads stable-player progress", async () => {
    /** Starts an isolated guest browser context. */
    const {page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    verifyGuestStartupIdentity(state);
  });

  it("renders startup while the external Jest SDK request is still pending", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {scenario: "sdk-request-delay"});
    expect(await page.locator("#root > *").count()).toBe(1);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await context.close();
  });

  it("keeps play interactive while the product catalog loads in the background", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {scenario: "background-catalog-delay"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.markGameLoaded");
    expect(state.calls).toContain("sdk.payments.getProducts:start");
    expect(state.calls).not.toContain("sdk.payments.getProducts:end");
    await page.locator(".game-app:not([inert])").waitFor({timeout: 2_000});
    expect(await page.getByTestId("server-activity-loader").count()).toBe(0);
    await context.close();
  });

  it.each([
    ["new guest", "success"],
    ["guest with a legacy milestone", "returning-milestone"],
    ["returning guest with two saved wins", "returning-guest-two-wins"],
    ["guest when the milestone call fails", "milestone-failure"],
  ])("prompts a %s after the first solved riddle", async (_label, scenario) => {
    /** Fresh guest with no prior milestone or onboarding. */
    const {context, page} = await openHarness(browser, {customName: "Nova", scenario});
    await enterRegisteredGame(page);
    expect(await page.locator(".game-header .coin-pill strong").innerText()).toBe("300");
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    expect(await page.getByText("Keep your progress", {exact: true}).count()).toBe(0);
    await page.locator(".keyboard").getByRole("button", {name: /^P$/}).click();
    expect(await page.getByRole("button", {name: /^letter 1: p$/i}).isVisible()).toBe(true);
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    for (const letter of ["I", "A", "N", "O"]) {
      await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
    }
    await page
      .locator(".game-input-actions")
      .getByRole("button", {name: /submit/i})
      .click();
    await page.waitForFunction((milestoneFailure) => {
      /** Provides state behavior. */
      const state = (
        window as typeof window & {
          /** Captured provider calls and preferences from the injected SDK. */
          __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
        }
      ).__RIDDLE_QUEST_JEST_AUTH_TEST__;
      return milestoneFailure
        ? state.calls.includes("sdk.markFirstMilestone")
        : state.preferenceWrites.some((value) => value.firstMilestoneMarked === true);
    }, scenario === "milestone-failure");
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    await page.locator(".modal-victory").waitFor();
    await page.getByRole("button", {name: /tap the chest/i}).waitFor();
    /** Provides fanfare steps behavior. */
    const fanfareSteps: string[] = [];
    for (let step = 0; step < 6 && (await page.locator(".modal-victory").count()); step += 1) {
      fanfareSteps.push(await page.locator(".modal-victory").innerText());
      expect(await page.locator(".jest-registration-dialog").count()).toBe(0);
      if (await page.getByRole("button", {name: /tap the chest/i}).isVisible()) {
        await page.getByRole("button", {name: /tap the chest/i}).click();
      }
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".reward-continue")?.disabled);
      await page.locator(".reward-continue").click();
    }
    expect(fanfareSteps[0]).toContain("NICE JOB!");
    expect(fanfareSteps.filter((value) => value.includes("NICE JOB!"))).toHaveLength(1);
    expect(fanfareSteps.some((value) => value.includes("Achievement Unlocked!"))).toBe(true);
    for (let step = 0; step < 5; step += 1) {
      await page.waitForFunction(() => Boolean(document.querySelector(".tooltip-backdrop, .jest-registration-dialog")));
      if (await page.locator(".jest-registration-dialog").count()) break;
      expect(await page.locator(".jest-registration-dialog").count()).toBe(0);
      expect(await page.locator("[data-tooltip-id='achievementEarned']").count()).toBe(0);
      await page
        .locator(".tooltip-backdrop")
        .getByRole("button", {name: /^got it$/i})
        .click();
    }
    await page.locator(".tooltip-backdrop").waitFor({state: "detached"});
    await page.getByText("Keep your progress", {exact: true}).waitFor();
    /** Provides dialog behavior. */
    const dialog = page.locator(".jest-registration-dialog");
    expect(await dialog.isVisible()).toBe(true);
    await page.waitForFunction(() => !document.querySelector(".jest-registration-dialog")?.hasAttribute("inert"));
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.calls.filter((call) => call === "sdk.markFirstMilestone")).toHaveLength(1);
    expect(state.overlayOptions).toEqual([expect.objectContaining({source: "authoritative_win"})]);
    await dialog.locator(".play-text-button").click();
    await dialog.waitFor({state: "detached"});
    await context.close();
  });

  it("contains guest registration keyboard input until Play as guest dismisses the prompt", async () => {
    /** Isolated injected game and its native keyboard surface. */
    const {context, page} = await openHarness(browser);
    await advanceToRegistration(page);
    /** Registration prompt owning focus while visible. */
    const dialog = page.locator(".jest-registration-dialog");
    /** Gameplay input that must remain unchanged behind registration. */
    const draft = page.locator(".guess-row").first();
    /** Initial draft used to detect leaked keyboard input. */
    const before = await draft.textContent();
    await page.keyboard.type("ZI", {delay: 0});
    expect(await draft.textContent()).toBe(before);
    await page.keyboard.press("Backspace");
    expect(await draft.textContent()).toBe(before);
    await page.waitForFunction(() => document.querySelector(".jest-registration-dialog")?.contains(document.activeElement));
    expect(await dialog.getByRole("button", {name: /^register$/i}).evaluate(button => button === document.activeElement)).toBe(true);
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.getByRole("button", {name: /play as guest/i}).evaluate(button => button === document.activeElement)).toBe(true);
    await page.keyboard.press("Tab");
    expect(await dialog.getByRole("button", {name: /^register$/i}).evaluate(button => button === document.activeElement)).toBe(true);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await dialog.waitFor({state: "detached"});
    expect(await draft.textContent()).toBe(before);
    await page.getByRole("heading", {name: /what has keys/i}).click();
    await page.keyboard.press("P");
    await page.waitForFunction(() => document.querySelector(".guess-row")?.textContent?.trim() === "P");
    expect(await draft.textContent()).toBe("P");
    /** SDK calls verify guest dismissal did not start registration. */
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.registration.closeButtonAction");
    expect(state.calls).not.toContain("sdk.registration.loginButtonAction");
    await context.close();
  });

  it("reports a guest Daily completion without opening registration", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {gameMode: "challenge"});
    await enterRegisteredGame(page, /i speak without a mouth/i);
    await page.locator(".game-mode-label").getByText(/daily/i).waitFor();
    for (const letter of "ECHO") {
      await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
    }
    await page
      .locator(".game-input-actions")
      .getByRole("button", {name: /submit/i})
      .click();
    await page.locator(".modal-victory").waitFor();
    await page.getByRole("button", {name: /tap the chest/i}).waitFor();
    for (let step = 0; step < 6 && (await page.locator(".modal-victory").count()); step += 1) {
      await page.locator(".reward-continue").waitFor();
      /** Provides current step behavior. */
      const currentStep = await page.locator(".modal-victory").textContent();
      if (await page.getByRole("button", {name: /tap the chest/i}).isVisible()) {
        await page.getByRole("button", {name: /tap the chest/i}).click();
      }
      await page.waitForFunction(() =>
        Boolean(document.querySelector<HTMLButtonElement>(".reward-continue:not(:disabled)")),
      );
      await page.locator(".reward-continue").click();
      await page.waitForFunction(
        (previous) =>
          !document.querySelector(".modal-victory") ||
          document.querySelector(".modal-victory")?.textContent !== previous,
        currentStep,
      );
    }
    await dismissDailyCompletionGuidance(page);
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.calls.filter((call) => call === "sdk.markFirstMilestone")).toHaveLength(1);
    expect(state.overlayOptions).toEqual([]);
    expect(await page.locator(".jest-registration-dialog").count()).toBe(0);
    await context.close();
  });

  it("offers registration when confirmation arrives after all completion popups were dismissed", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser);
    try {
      await enterRegisteredGame(page);
      await page.evaluate(() => {
        /** Provides dispatch behavior. */
        const dispatch = window.dispatchEvent.bind(window);
        /** Provides deferred behavior. */
        const deferred: Event[] = [];
        Object.assign(window, {
          __RELEASE_DELAYED_GUESS__: () => deferred.splice(0).forEach((event) => dispatch(event)),
        });
        window.dispatchEvent = (event: Event) => {
          if (event.type === "riddle-quest:completion-popups-dismissed")
            Object.assign(window, {__COMPLETION_DISMISSED__: true});
          if (
            event.type === "riddle-quest:game-to-host" &&
            (event as CustomEvent).detail?.type === "game:submitGuess"
          ) {
            deferred.push(event);
            return true;
          }
          return dispatch(event);
        };
      });
      for (const letter of "PIANO")
        await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      await page
        .locator(".game-input-actions")
        .getByRole("button", {name: /submit/i})
        .click();
      await page.locator(".modal-victory").waitFor();
      for (let step = 0; step < 6 && (await page.locator(".modal-victory").count()); step++) {
        /** Provides chest behavior. */
        const chest = page.getByRole("button", {name: /tap the chest/i});
        if (await chest.isVisible()) await chest.click();
        await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".reward-continue")?.disabled);
        await page.locator(".reward-continue").click();
      }
      for (let step = 0; step < 5; step++) {
        await page.waitForFunction(
          () =>
            (
              window as typeof window & {
                /** Stores completion dismissed. */
                __COMPLETION_DISMISSED__?: boolean;
              }
            ).__COMPLETION_DISMISSED__ || Boolean(document.querySelector(".tooltip-backdrop")),
        );
        if (
          await page.evaluate(() =>
            Boolean(
              (
                window as typeof window & {
                  /** Stores completion dismissed. */
                  __COMPLETION_DISMISSED__?: boolean;
                }
              ).__COMPLETION_DISMISSED__,
            ),
          )
        )
          break;
        await page
          .locator(".tooltip-backdrop")
          .getByRole("button", {name: /^got it$/i})
          .click();
      }
      expect(await page.locator(".jest-registration-dialog").count()).toBe(0);
      await page.evaluate(() =>
        (
          window as typeof window & {
            /** Stores release delayed guess. */
            __RELEASE_DELAYED_GUESS__: () => void;
          }
        ).__RELEASE_DELAYED_GUESS__(),
      );
      await page.getByText("Keep your progress", {exact: true}).waitFor();
      expect((await getHarnessState(page)).overlayOptions).toHaveLength(1);
    } finally {
      await context.close();
    }
  });

  it("offers registration after the first Classic victory while reward syncing is delayed", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser);
    await enterRegisteredGame(page);
    await page.evaluate(() => {
      /** Provides dispatch behavior. */
      const dispatch = window.dispatchEvent.bind(window);
      window.dispatchEvent = (event: Event) => {
        if (event.type === "riddle-quest:game-to-host" && (event as CustomEvent).detail?.type === "game:completeGame")
          return true;
        return dispatch(event);
      };
    });
    for (const letter of "PIANO") {
      await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
    }
    await page
      .locator(".game-input-actions")
      .getByRole("button", {name: /submit/i})
      .click();
    await page.locator(".modal-victory").waitFor();
    for (let step = 0; step < 6 && (await page.locator(".modal-victory").count()); step += 1) {
      await page.locator(".reward-continue").click();
    }
    for (let step = 0; step < 5; step += 1) {
      if (await page.locator(".jest-registration-dialog").count()) break;
      /** Provides tooltip behavior. */
      const tooltip = page.locator(".tooltip-backdrop");
      await tooltip.waitFor({state: "visible", timeout: 5_000});
      await tooltip.getByRole("button", {name: /^got it$/i}).click();
    }
    await page.getByText("Keep your progress", {exact: true}).waitFor({timeout: 5_000});
    expect(await page.locator(".jest-registration-dialog").isVisible()).toBe(true);
    await context.close();
  });

  it("registers with a stable player id, re-signs identity, refreshes profile, and survives reload", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.evaluate(() => {
      /** Provides dispatch behavior. */
      const dispatch = window.dispatchEvent.bind(window);
      window.dispatchEvent = ((event: Event) => {
        if (event.type === "riddle-quest:registration-prompt-closed") {
          window.setTimeout(() => dispatch(event), 50);
          return true;
        }
        return dispatch(event);
      }) as typeof window.dispatchEvent;
    });
    await page.getByRole("button", {name: /^register$/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    await page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.backendExchanges.length === 2,
    );
    /** Provides state behavior. */
    let state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.registration.loginButtonAction");
    expect(state.backendExchanges).toEqual([
      "signed:jest-auth-player-stable:false",
      "signed:jest-auth-player-stable:true",
    ]);
    expect(state.firebaseTokens).toEqual(["mock", "mock"]);
    expect(state.profileReads).toBe(1);
    await page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.notificationSchedules.length >= 7,
    );
    expect((await getHarnessState(page)).notificationSchedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identifier: "riddle-quest-d1-v3",
          scheduledInDays: 1,
          priority: "medium",
          asset: expect.stringMatching(/^data:image\/png;base64,/),
          entryPayload: expect.objectContaining({
            gameMode: "challenge",
            reference: "notification_d1_v4",
            notification_offset: "D1",
          }),
        }),
        expect.objectContaining({
          identifier: "riddle-quest-d3-v3",
          scheduledInDays: 3,
          priority: "high",
        }),
        expect.objectContaining({
          identifier: "riddle-quest-d7-v3",
          scheduledInDays: 7,
          priority: "high",
        }),
      ]),
    );
    expect((await getHarnessState(page)).calls).toContain("sdk.payments.getSubscriptions");
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("riddle-quest:share-referral", {
          detail: {
            gameMode: "challenge",
            riddleId: "daily-riddle-1",
            attempts: 2,
            emojiGrid: "⬛🟨⬛⬛⬛\n🟩🟩🟩🟩🟩",
          },
        }),
      ),
    );
    await page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 1,
    );
    /** Provides [share] behavior. */
    const [share] = (await getHarnessState(page)).referralShares;
    expect(share).toEqual(
      expect.objectContaining({
        reference: expect.stringMatching(/^rq_fc_v2_[0-9a-f]{16}$/),
        shareTitle: "Check out my Riddle Quest result!",
        entryPayload: expect.objectContaining({
          campaign: "friend_challenge_v2",
          reference: "victory_friend_challenge_v2",
          inviteKind: "result",
          gameMode: "challenge",
          riddleId: "daily-riddle-1",
        }),
      }),
    );
    expect(share.shareText).toContain("2 attempts");
    expect(share.shareText).toContain("🟩🟩🟩🟩🟩");
    expect(share.shareText).toContain("both earn 100 coins");
    expect(share.shareImage).toMatch(/^data:image\/png;base64,/);

    await page.evaluate(() => {
      /** Restores normal canvas capture after the next oversized share image. */
      const original = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function () {
        HTMLCanvasElement.prototype.toDataURL = original;
        return `data:image/png;base64,${"A".repeat(2 * 1024 * 1024)}`;
      };
    });
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("riddle-quest:share-referral", {
          detail: {gameMode: "classic", riddleId: "classic-riddle-2", attempts: 1, emojiGrid: "🟩🟩🟩"},
        }),
      ),
    );
    await page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 2,
    );
    /** Provides second result share behavior. */
    const secondResultShare = (await getHarnessState(page)).referralShares[1];
    expect(secondResultShare.reference).toMatch(/^rq_fc_v2_[0-9a-f]{16}$/);
    expect(secondResultShare.reference).not.toBe(share.reference);
    expect(secondResultShare.entryPayload).toEqual(expect.objectContaining({riddleId: "classic-riddle-2"}));
    expect(secondResultShare).not.toHaveProperty("shareImage");

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("riddle-quest:share-invite")));
    await page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 3,
    );
    /** Provides generic invite behavior. */
    const genericInvite = (await getHarnessState(page)).referralShares[2];
    expect([share, secondResultShare, genericInvite].map((item) => item.onboardingSlug)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(genericInvite).toEqual(
      expect.objectContaining({
        reference: "riddle_quest_friend_challenge_v2",
        shareTitle: "Riddle Quest",
        shareText:
          "Authenticated Solver challenged you to Riddle Quest. Register through this invite and you both earn 100 coins!",
        shareImage: expect.stringMatching(/^data:image\/png;base64,/),
        entryPayload: expect.objectContaining({
          inviteKind: "open",
          campaign: "open_invite_v1",
          reference: "profile_invite_v1",
        }),
      }),
    );
    expect(genericInvite.shareText).toContain("both earn 100 coins");

    await page.reload();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    state = await getHarnessState(page);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(state.profileReads).toBe(1);
    await context.close();
  });

  it("prefills the Jest profile picture from the SDK avatar", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {registered: true, scenario: "avatar-profile"});
    await enterRegisteredGame(page);
    await openProfileAfterGuidance(page);
    expect(await page.locator(".profile-identity img").getAttribute("src")).toBe(
      "https://cdn.jest.com/mock-avatar.webp",
    );
    await context.close();
  });

  it("runs the complete profile invite, attributed registration, and inviter reward journey", async () => {
    /** Provides creator behavior. */
    const creator = await openHarness(browser, {
      registered: true,
      playerId: "viral-creator",
    });
    await enterRegisteredGame(creator.page);
    await openProfileAfterGuidance(creator.page);
    expect(await creator.page.locator(".profile-identity").innerText()).toContain("Authenticated Solver");
    expect(await creator.page.locator(".profile-identity input[type=file]").count()).toBe(0);
    /** Provides invite button behavior. */
    const inviteButton = creator.page.getByRole("button", {name: /invite a friend/i});
    await inviteButton.waitFor({state: "visible"});
    await inviteButton.evaluate((button) => {
      /** Marks the exact synchronous Profile-button callback under test. */
      const target = window as typeof window & {
        /** True only while the profile invite button's synchronous handler is running. */
        __RIDDLE_QUEST_PROFILE_INVITE_CLICK__?: boolean;
      };
      target.__RIDDLE_QUEST_PROFILE_INVITE_CLICK__ = true;
      try {
        button.click();
      } finally {
        target.__RIDDLE_QUEST_PROFILE_INVITE_CLICK__ = false;
      }
    });
    await creator.page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 1,
    );
    /** Captures the referral request opened by the profile invite action. */
    const creatorState = await getHarnessState(creator.page);
    /** First and only referral share request emitted during the journey. */
    const share = creatorState.referralShares[0];
    expect(creatorState.calls).toContain("sdk.referrals.shareReferralLink");
    expect(creatorState.referralSharesStartedFromProfileClick).toEqual([true]);
    expect(share.onboardingSlug).toBeUndefined();
    expect(share).toEqual(
      expect.objectContaining({
        reference: "riddle_quest_friend_challenge_v2",
        shareTitle: "Riddle Quest",
        shareText:
          "Authenticated Solver challenged you to Riddle Quest. Register through this invite and you both earn 100 coins!",
        shareImage: expect.stringMatching(/^data:image\/png;base64,/),
        entryPayload: expect.objectContaining({
          campaign: "open_invite_v1",
          reference: "profile_invite_v1",
          inviteKind: "open",
          inviterName: "Authenticated Solver",
        }),
      }),
    );
    /** Provides entry payload behavior. */
    const entryPayload = share.entryPayload!;
    /** Provides recipient behavior. */
    const recipient = await openHarness(browser, {
      playerId: "viral-recipient",
      inviteKind: entryPayload.inviteKind,
      campaign: entryPayload.campaign,
      reference: entryPayload.reference,
      inviterName: entryPayload.inviterName,
    });
    await recipient.page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(recipient.page);
    await recipient.page.getByText("Authenticated Solver invited you to play.", {exact: true}).waitFor();
    expect((await getHarnessState(recipient.page)).overlayOptions).toContainEqual(
      expect.objectContaining({
        source: "profile",
        campaign: "open_invite_v1",
        reference: "registration_profile_v1",
        acquisitionReference: "profile_invite_v1",
        inviteKind: "open",
        inviterName: "Authenticated Solver",
      }),
    );
    await recipient.page.getByRole("button", {name: /^register$/i}).click();
    await recipient.page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    await recipient.page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.backendExchanges.length === 2,
    );
    expect((await getHarnessState(recipient.page)).backendExchanges).toEqual([
      "signed:viral-recipient:false",
      "signed:viral-recipient:true",
    ]);
    await Promise.all([creator.context.close(), recipient.context.close()]);
    /** Provides rewarded creator behavior. */
    const rewardedCreator = await openHarness(browser, {
      registered: true,
      scenario: "referral-reward",
      playerId: "viral-creator",
    });
    await rewardedCreator.page.getByRole("heading", {name: /a friend joined/i}).waitFor({timeout: 15_000});
    expect(await rewardedCreator.page.locator(".game-modal").innerText()).toContain("+100");
    await rewardedCreator.context.close();
  });

  it("logs an existing Jest player in from the onboarding choice", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^log in$/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    await page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.backendExchanges.length === 2,
    );
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.login");
    expect(state.calls).toContain("sdk.registration.closeButtonAction");
    expect(state.calls).not.toContain("sdk.registration.loginButtonAction");
    expect(state.backendExchanges.at(-1)).toBe("signed:jest-auth-player-stable:true");
    await context.close();
  });

  it("skips the registration step for an already registered Jest player and restores platform data", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {registered: true});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await page.getByRole("button", {name: /let's play/i}).click();
    await page.getByRole("button", {name: /got it/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.overlayOptions).toEqual([]);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(state.profileReads).toBe(1);
    expect(state.calls.filter((call) => call === "sdk.data.getAll").length).toBeGreaterThan(1);
    await context.close();
  });

  it("surfaces a server-authoritative referral reward in the game", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {registered: true, scenario: "referral-reward"});
    await page.getByRole("heading", {name: /a friend joined/i}).waitFor({timeout: 15_000});
    expect(await page.locator(".game-modal").innerText()).toContain("+100");
    await context.close();
  });

  it("schedules decodable inline daily and race cards without library references", async () => {
    /** Registered SDK session with real browser canvas rendering. */
    const {context, page} = await openHarness(browser, {registered: true});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await page.waitForFunction(() => (window as any).__RIDDLE_QUEST_JEST_AUTH_TEST__.notificationSchedules.length >= 7);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {detail: {challengeId: "inline-card-race"}})));
    await page.waitForFunction(() => (window as any).__RIDDLE_QUEST_JEST_AUTH_TEST__.notificationSchedules.some((item: any) => item.identifier === "race_to_10_results_v1"));
    /** All dispatches, including replacement after stored progress loads. */
    const schedules = (await getHarnessState(page)).notificationSchedules;
    /** Latest rolling series reflects the current personalized progress. */
    const daily = [...new Map(schedules.filter((item) => item.identifier?.startsWith("riddle-quest-d")).map((item) => [item.identifier, item])).values()];
    expect(new Set(daily.map((item) => item.asset)).size).toBe(3);
    expect(daily.map((item) => item.scheduledInDays)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const item of schedules) {
      expect(item.assetReference).toBeUndefined();
      expect(item.asset).toMatch(/^data:image\/png;base64,/);
      /** Decoded payload size is checked independently of the production validator. */
      const data = Buffer.from(item.asset!.split(",")[1], "base64");
      expect(data.length).toBeLessThanOrEqual(2 * 1024 * 1024);
      expect(await page.evaluate(async (asset) => {
        /** Browser decoding confirms the image bytes and dimensions. */
        const image = new Image();
        image.src = asset;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }, item.asset!)).toEqual([900, 600]);
    }
    /** Race card retains its inbox attribution. */
    const race = schedules.find((item) => item.identifier === "race_to_10_results_v1")!;
    expect(race.entryPayload).toMatchObject({challengeId: "inline-card-race", challengeDestination: "inbox"});
    if (process.env.JEST_NOTIFICATION_IMAGE_REPORT_DIR) {
      /** Optional artifact destination for operator visual inspection. */
      const directory = process.env.JEST_NOTIFICATION_IMAGE_REPORT_DIR;
      await mkdir(directory, {recursive: true});
      for (const [index, item] of [...daily.slice(0, 3), race].entries()) {
        await writeFile(path.join(directory, `notification-${index + 1}.png`), Buffer.from(item.asset!.split(",")[1], "base64"));
      }
    }
    await context.close();
  });

  it("shares a race challenge and schedules its attributed registered-player reminder", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {registered: true});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await page.evaluate(() => {
      /** Provides publication behavior. */
      const publication = {
        challengeId: "race-challenge-42",
        preview: {categoryId: "history", adjustedTimeToBeatMs: 72_300},
      };
      window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {detail: publication}));
      window.dispatchEvent(
        new CustomEvent("riddle-quest:share-race", {
          detail: {...publication, outcome: {adjustedFinishMs: 72_300}},
        }),
      );
    });
    await page.waitForFunction(() => {
      /** Provides state behavior. */
      const state = (
        window as typeof window & {
          /** Stores riddle quest jest auth test. */
          __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
        }
      ).__RIDDLE_QUEST_JEST_AUTH_TEST__;
      return (
        state.notificationSchedules.some((item) => item.identifier === "race_to_10_results_v1") &&
        state.referralShares.some((item) => /^rq_r10_v1_[0-9a-f]{16}$/.test(item.reference ?? ""))
      );
    });
    /** Provides state behavior. */
    let state = await getHarnessState(page);
    expect(state.notificationSchedules).toContainEqual(
      expect.objectContaining({
        identifier: "race_to_10_results_v1",
        scheduledInDays: 1,
        asset: expect.stringMatching(/^data:image\/png;base64,/),
        entryPayload: expect.objectContaining({
          challengeId: "race-challenge-42",
          challengeDestination: "inbox",
          reference: "race_to_10_results_d1_v1",
        }),
      }),
    );
    expect(state.referralShares).toContainEqual(
      expect.objectContaining({
        reference: expect.stringMatching(/^rq_r10_v1_[0-9a-f]{16}$/),
        shareImage: expect.stringMatching(/^data:image\/png;base64,/),
        entryPayload: expect.objectContaining({
          challengeId: "race-challenge-42",
          campaign: "race_to_10_v1",
          inviteKind: "race",
        }),
      }),
    );
    /** Provides first race share behavior. */
    const firstRaceShare = state.referralShares.find((item) => item.entryPayload?.challengeId === "race-challenge-42")!;
    expect(firstRaceShare.onboardingSlug).toBeUndefined();
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("riddle-quest:share-race", {
          detail: {
            challengeId: "race-challenge-43",
            preview: {categoryId: "science", adjustedTimeToBeatMs: 55_000},
          },
        }),
      );
    });
    await page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 2,
    );
    state = await getHarnessState(page);
    /** Provides second race share behavior. */
    const secondRaceShare = state.referralShares.find(
      (item) => item.entryPayload?.challengeId === "race-challenge-43",
    )!;
    expect(secondRaceShare.reference).toMatch(/^rq_r10_v1_[0-9a-f]{16}$/);
    expect(secondRaceShare.reference).not.toBe(firstRaceShare.reference);
    await context.close();
  });

  it.each([
    {name: "ordinary multiplayer"},
    {name: "retired results inbox", challengeDestination: "inbox"},
    {name: "retired recorded challenge", challengeId: "recorded-challenge", inviteKind: "race"},
  ])("opens the live PvP intro for $name without recorded fallback", async ({name, ...entry}) => {
    /** Fresh production artifact with the native identity harness and no live match provider. */
    const {context, page, pageErrors} = await openHarness(browser, {
      registered: true, harness: "race-auth", playerId: `pvp-entry-${name}`, ...entry,
    });
    /** Ordinary entry uses guidance; incoming links open multiplayer directly. */
    if (!entry.challengeDestination && !entry.challengeId) {
      await enterRegisteredGame(page);
      await page.getByRole("button", {name: /^multiplayer$/i}).click();
    }
    await page.getByRole("heading", {name: "Choose your category", exact: true}).waitFor();
    expect(await page.getByRole("button", {name: "Start PvP match", exact: true}).isDisabled()).toBe(true);
    await page.getByRole("alert").filter({hasText: "Opponent search is unavailable for this account."}).waitFor();
    expect(await page.locator(".race-gameplay").count()).toBe(0);
    expect(await page.getByRole("button", {name: /^(activity|record|publish|rematch)$/i}).count()).toBe(0);
    /** Absence of a live provider must never issue recorded run, invitation or inbox operations. */
    const commands = await page.evaluate(() => Reflect.get(window, "__pvpEntryCommands") as string[]);
    expect(commands.filter(type => /Race/.test(type) && type !== "game:listRaceCategories")).toEqual([]);
    if (entry.challengeDestination === "inbox") {
      expect((await getHarnessState(page)).notificationRemovals).toContain("race_to_10_results_v1");
    }
    expect(pageErrors).toEqual([]);
    await context.close();
  });

  it("does not schedule race reminders for an unregistered player", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("riddle-quest:race-challenge-published", {
          detail: {challengeId: "race-challenge-guest"},
        }),
      ),
    );
    await page.waitForTimeout(100);
    expect((await getHarnessState(page)).notificationSchedules).toEqual([]);
    await context.close();
  });

  it("falls back to SDK login when the custom registration overlay cannot open", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {scenario: "overlay-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^register$/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    await page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.backendExchanges.length === 2,
    );
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.login");
    expect(state.loginPayloads).toEqual([
      {
        source: "profile",
        campaign: "direct_to_game_registration_v2",
        reference: "registration_profile_v1",
      },
    ]);
    expect(state.backendExchanges.at(-1)).toBe("signed:jest-auth-player-stable:true");
    await context.close();
  });

  it("retains a retryable registration prompt when fallback SDK login fails", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {scenario: "overlay-login-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^register$/i}).click();

    await page
      .getByRole("alert")
      .filter({hasText: /check your internet connection and try again/i})
      .waitFor();
    /** Provides register button behavior. */
    const registerButton = page.getByRole("button", {name: /^register$/i});
    await registerButton.waitFor();
    await expect(registerButton.isEnabled()).resolves.toBe(true);
    /** Provides state behavior. */
    let state = await getHarnessState(page);
    expect(state.calls.filter((call) => call === "sdk.login")).toHaveLength(1);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:false"]);
    expect(state.preferenceWrites.some((value) => typeof value.registrationPromptDismissedAt === "number")).toBe(false);

    await registerButton.click();
    await page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.calls.filter((call) => call === "sdk.login").length === 2,
    );
    state = await getHarnessState(page);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:false"]);
    expect(state.preferenceWrites.some((value) => typeof value.registrationPromptDismissedAt === "number")).toBe(false);
    expect(await page.getByRole("button", {name: /^register$/i}).isVisible()).toBe(true);
    await context.close();
  });

  it("retains a retryable registration prompt when the overlay login action fails", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {scenario: "overlay-action-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    /** Provides register button behavior. */
    const registerButton = page.getByRole("button", {name: /^register$/i});
    await registerButton.click();

    await page
      .getByRole("alert")
      .filter({hasText: /check your internet connection and try again/i})
      .waitFor();
    await expect(registerButton.isEnabled()).resolves.toBe(true);
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.calls.filter((call) => call === "sdk.registration.loginButtonAction")).toHaveLength(1);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:false"]);
    expect(state.preferenceWrites.some((value) => typeof value.registrationPromptDismissedAt === "number")).toBe(false);
    await context.close();
  });

  it("handles duplicate registration close callbacks idempotently", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {scenario: "duplicate-close"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^register$/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    await page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.backendExchanges.length === 2,
    );
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.backendExchanges).toHaveLength(2);
    expect(state.calls.filter((call) => call === "sdk.social.getProfile")).toHaveLength(1);
    await context.close();
  });

  it("shows a retryable terminal screen when registered identity synchronization fails", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {scenario: "registration-identity-once-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.evaluate(() => {
      /** Provides test window behavior. */
      const testWindow = window as typeof window & {
        /** Stores registration closed. */
        __REGISTRATION_CLOSED__?: boolean[];
      };
      testWindow.__REGISTRATION_CLOSED__ = [];
      window.addEventListener("riddle-quest:registration-prompt-closed", (event) => {
        testWindow.__REGISTRATION_CLOSED__?.push(
          Boolean(
            (
              event as CustomEvent<{
                /** Stores registered. */
                registered?: boolean;
              }>
            ).detail?.registered,
          ),
        );
      });
    });
    await page.getByRole("button", {name: /^register$/i}).click();
    await page.getByRole("heading", {name: /startup failed/i}).waitFor({timeout: 15_000});
    expect(await page.getByText(/unexpected error occurred/i).isVisible()).toBe(true);
    expect(
      await page.evaluate(
        () =>
          (
            window as typeof window & {
              /** Stores registration closed. */
              __REGISTRATION_CLOSED__?: boolean[];
            }
          ).__REGISTRATION_CLOSED__,
      ),
    ).toEqual([false]);
    expect((await getHarnessState(page)).backendExchanges).toEqual([
      "signed:jest-auth-player-stable:false",
      "signed:jest-auth-player-stable:true",
    ]);

    await page.getByRole("button", {name: /retry/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    expect(await page.getByRole("heading", {name: /startup failed/i}).count()).toBe(0);
    expect((await getHarnessState(page)).backendExchanges).toEqual(["signed:jest-auth-player-stable:true"]);
    await context.close();
  });

  it("stops registration when the authoritative identity is already deleted", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {scenario: "registration-account-deleted"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^register$/i}).click();

    await page.getByRole("heading", {name: /account deleted/i}).waitFor({timeout: 15_000});
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.backendExchanges).toHaveLength(2);
    expect(state.backendDeletionRetries).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(state.firebaseTokens).toEqual(["mock"]);
    expect(await page.locator(".game-app").count()).toBe(0);
    await context.close();
  });

  it("replaces play with a terminal screen that cannot reload the deleted identity", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {registered: true});
    await enterRegisteredGame(page);
    await openProfileAfterGuidance(page);
    await page.getByRole("button", {name: /^delete account$/i}).click();
    /** Provides confirmation behavior. */
    const confirmation = page.getByRole("alertdialog", {name: /delete account/i});
    await confirmation.getByRole("button", {name: /^delete account$/i}).click();

    await page.getByRole("heading", {name: /account deleted/i}).waitFor({timeout: 15_000});
    expect(await page.getByText("Your account has been deleted.", {exact: true}).isVisible()).toBe(true);
    expect(await page.getByRole("button", {name: /^play$/i}).count()).toBe(0);
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.notificationRemovals).toEqual(expect.arrayContaining([...PLAYER_NOTIFICATION_IDS]));
    expect(state.calls).toContain("sdk.data.delete:riddleQuestPlayerState");
    expect(await page.locator(".game-app").count()).toBe(0);
    await context.close();
  });

  it.each([
    ["SDK initialization", "init-failure", /service temporarily unavailable\. please try again\./i],
    ["SDK initialization timeout", "init-timeout", /please check your internet connection and try again/i],
    ["signed player", "signed-player-failure", /service temporarily unavailable\. please try again\./i],
    ["identity exchange", "identity-failure", /service temporarily unavailable\. please try again\./i],
  ])("shows a retryable startup screen for %s failures", async (_name, scenario, message) => {
    /** Provides {context, page} behavior. */
    const {context, page, pageErrors} = await openHarness(browser, {
      scenario,
    });
    await verifyRetryableStartupScreen(page, message, pageErrors, scenario === "init-timeout" ? 35_000 : 15_000);
    if (scenario === "identity-failure") {
      expect((await getHarnessState(page)).calls).not.toContain("sdk.payments.getIncompletePurchases");
    }
    await context.close();
  });

  it("waits for a delayed host handshake before accessing player state and reaches playable UI", async () => {
    /** Provides the browser context and delayed SDK handshake page. */
    const harness = await openHarness(browser, {scenario: "init-delayed"});
    await verifyDelayedHostHandshake(harness, () => getHarnessState(harness.page));
  });

  it("authenticates during a pending social profile and reports readiness only after playable UI", async () => {
    /** Native adapter uses a social read controlled by the injected SDK. */
    const {context, page, pageErrors} = await openHarness(browser, {registered: true, scenario: "profile-controlled"});
    await page.waitForFunction(() =>
      (window as typeof window & {
        /** Injected SDK state used to observe authentication independently of profile loading. */
        __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
      })
        .__RIDDLE_QUEST_JEST_AUTH_TEST__.firebaseTokens.length === 1,
    );
    /** Authentication completed while the social request remains pending. */
    const pending = await getHarnessState(page);
    expect(pending.profileReads).toBe(1);
    expect(pending.backendExchanges).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(pending.calls).not.toContain("sdk.markGameLoaded");
    expect(await page.locator(".game-app").count()).toBe(0);
    await page.evaluate(() => window.dispatchEvent(new Event("test:resolve-social-profile")));
    await enterRegisteredGame(page);
    expect((await getHarnessState(page)).calls).toContain("sdk.markGameLoaded");
    expect(await page.locator(".game-header .coin-pill strong").innerText()).toBe("300");
    expect(pageErrors).toEqual([]);
    if (process.env.PORTAL_JEST_LOAD_EVIDENCE_DIR) {
      await mkdir(process.env.PORTAL_JEST_LOAD_EVIDENCE_DIR, {recursive: true});
      await page.screenshot({path: path.join(process.env.PORTAL_JEST_LOAD_EVIDENCE_DIR, "jest-390.png")});
      await page.setViewportSize({width: 1280, height: 900});
      await page.screenshot({path: path.join(process.env.PORTAL_JEST_LOAD_EVIDENCE_DIR, "jest-1280.png")});
    }
    await context.close();
  });

  it("keeps registered play available when the optional Jest social profile is unavailable", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {registered: true, scenario: "profile-failure"});
    await verifyOptionalProfileFailure(page, () => getHarnessState(page));
    await context.close();
  });

  it("recovers from a transient SDK initialization failure when Retry is pressed", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {scenario: "init-once-failure"});
    await retryFailedStartup(page);
    expect((await getHarnessState(page)).backendExchanges).toHaveLength(1);
    await context.close();
  });
});

jest.setTimeout(180_000);
