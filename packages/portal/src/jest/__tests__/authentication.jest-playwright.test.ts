import {afterAll, afterEach, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type Page} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";

import {advanceToRegistration, enterRegisteredGame, openProfileAfterGuidance, solveFakeRace} from "./authentication.jest-playwright.support";
import {PLAYER_NOTIFICATION_IDS} from "../notifications/engagement";

/** Provides describe browser behavior. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
/** Provides base url behavior. */
let baseUrl: string;
/** Provides shared race challenges behavior. */
const sharedRaceChallenges = new Map<string, string>();

/** Describes auth harness state. */
type AuthHarnessState = {
  /** Stores scenario. */
  scenario: string;
  /** Stores calls. */
  calls: string[];
  /** Stores backend exchanges. */
  backendExchanges: string[];
  /** Stores backend deletion retries. */
  backendDeletionRetries: string[];
  /** Stores firebase tokens. */
  firebaseTokens: string[];
  /** Stores login payloads. */
  loginPayloads: Array<Record<string, string>>;
  /** Stores overlay options. */
  overlayOptions: Array<{
    /** Stores theme. */
    theme?: string;
    /** Stores registration message. */
    message?: string;
    /** Stores source. */
    source?: string;
    /** Stores campaign. */
    campaign?: string;
    /** Stores reference. */
    reference?: string;
    /** Stores acquisition reference. */
    acquisitionReference?: string;
    /** Stores invite kind. */
    inviteKind?: string;
    /** Stores inviter name. */
    inviterName?: string;
    /** Stores custom name. */
    customName?: string;
  }>;
  /** Stores player data reads. */
  playerDataReads: number;
  /** Stores preference writes. */
  preferenceWrites: Array<Record<string, unknown>>;
  /** Stores profile reads. */
  profileReads: number;
  /** Stores notification schedules. */
  notificationSchedules: Array<{
    /** Stores identifier. */
    identifier?: string;
    /** Stores scheduled in days. */
    scheduledInDays?: number;
    /** Stores priority. */
    priority?: string;
    /** Stores body. */
    body?: string;
    /** Stores cta text. */
    ctaText?: string;
    /** Stores asset reference. */
    assetReference?: string;
    /** Stores entry payload. */
    entryPayload?: Record<string, string>;
  }>;
  /** Stores notification removals. */
  notificationRemovals: string[];
  /** Stores referral shares. */
  referralShares: Array<{
    /** Stores reference. */
    reference?: string;
    /** Stores share title. */
    shareTitle?: string;
    /** Stores share text. */
    shareText?: string;
    /** Stores share image. */
    shareImage?: string;
    /** Stores onboarding slug. */
    onboardingSlug?: string;
    /** Stores entry payload. */
    entryPayload?: Record<string, string>;
  }>;
};

/** Provides install jest sdk harness behavior. */
const installJestSdkHarness = async (page: Page, scenario = "success") => {
  await page.addInitScript((selectedScenario) => {
    /** Provides state behavior. */
    const state: AuthHarnessState = {
      scenario: selectedScenario,
      calls: [],
      backendExchanges: [],
      backendDeletionRetries: [],
      firebaseTokens: [],
      loginPayloads: [],
      overlayOptions: [],
      playerDataReads: 0,
      preferenceWrites: [],
      profileReads: 0,
      notificationSchedules: [],
      notificationRemovals: [],
      referralShares: [],
    };
    /** Provides once behavior. */
    const once = (key: string) => {
      /** Provides storage key behavior. */
      const storageKey = `riddleQuest:jestAuthHarness:${key}`;
      if (sessionStorage.getItem(storageKey) === "1") return false;
      sessionStorage.setItem(storageKey, "1");
      return true;
    };
    /** Provides params behavior. */
    const params = new URLSearchParams(location.search);
    /** Provides player behavior. */
    const player = {
      playerId: params.get("playerId") ?? "jest-auth-player-stable",
      registered: params.get("registered") === "1" || localStorage.getItem("riddleQuest:jestAuthHarness:registered") === "1",
    };
    /** Provides preferences behavior. */
    const preferences: Record<string, unknown> = selectedScenario === "returning-milestone"
      ? {firstMilestoneMarked: true} : {};
    /** Provides overlay closed behavior. */
    let overlayClosed = false;
    /** Provides subscription active behavior. */
    let subscriptionActive = false;
    window.addEventListener("test:subscription-state", (event) => {
      subscriptionActive = Boolean((event as CustomEvent).detail);
    });
    /** Provides sdk behavior. */
    const sdk = {
      init: async () => {
        state.calls.push("sdk.init");
        if (selectedScenario === "init-timeout") {
          await new Promise<void>(() => undefined);
        }
        if (selectedScenario === "init-failure" || (selectedScenario === "init-once-failure" && once("initFailed"))) {
          throw new Error("Mock Jest SDK initialization failed");
        }
      },
      getPlayer: () => {
        state.calls.push("sdk.getPlayer");
        return {...player};
      },
      getPlayerSigned: async () => {
        state.calls.push("sdk.getPlayerSigned");
        if (selectedScenario === "signed-player-failure") {
          throw new Error("Mock signed player request failed");
        }
        return {player: {...player}, playerSigned: `signed:${player.playerId}:${player.registered}`};
      },
      login: async (options?: {/** Stores entry payload. */ /** Stores entry payload. */ /** Stores entry payload. */
      /** Stores entry payload. */
      entryPayload?: Record<string, string>}) => {
        state.calls.push("sdk.login");
        state.loginPayloads.push(structuredClone(options?.entryPayload ?? {}));
        if (selectedScenario === "overlay-login-failure") {
          throw new Error("Mock Jest login failed");
        }
        player.registered = true;
        localStorage.setItem("riddleQuest:jestAuthHarness:registered", "1");
      },
      showRegistrationOverlay: (options: {
        /** Stores theme. */
        theme?: string;
        /** Stores registration message. */
        message?: string;
        /** Stores entry payload. */
        entryPayload?: {
          /** Stores source. */
          source?: string;
          /** Stores campaign. */
          campaign?: string;
          /** Stores reference. */
          reference?: string;
          /** Stores acquisition reference. */
          acquisition_reference?: string;
          /** Stores invite kind. */
          inviteKind?: string;
          /** Stores inviter name. */
          inviterName?: string;
          /** Stores custom name. */
          customName?: string;
        };
        /** Stores on close. */
        onClose: () => void;
      }) => {
        state.calls.push("sdk.showRegistrationOverlay");
        state.overlayOptions.push({
          theme: options.theme,
          message: options.message,
          source: options.entryPayload?.source,
          campaign: options.entryPayload?.campaign,
          reference: options.entryPayload?.reference,
          ...(options.entryPayload?.acquisition_reference ? {acquisitionReference: options.entryPayload.acquisition_reference} : {}),
          ...(options.entryPayload?.inviteKind ? {inviteKind: options.entryPayload.inviteKind} : {}),
          ...(options.entryPayload?.inviterName ? {inviterName: options.entryPayload.inviterName} : {}),
          customName: options.entryPayload?.customName,
        });
        if (selectedScenario === "overlay-failure" || selectedScenario === "overlay-login-failure") {
          throw new Error("Mock registration overlay failed");
        }
        overlayClosed = false;
        /** Provides close behavior. */
        const close = () => {
          if (overlayClosed) return;
          overlayClosed = true;
          state.calls.push("sdk.registration.onClose");
          options.onClose();
          if (selectedScenario === "duplicate-close") options.onClose();
        };
        return {
          loginButtonAction: () => {
            state.calls.push("sdk.registration.loginButtonAction");
            if (selectedScenario === "overlay-action-failure") {
              throw new Error("Mock registration overlay login action failed");
            }
            player.registered = true;
            localStorage.setItem("riddleQuest:jestAuthHarness:registered", "1");
            close();
          },
          closeButtonAction: () => {
            state.calls.push("sdk.registration.closeButtonAction");
            close();
          },
        };
      },
      data: {
        getAll: () => {
          state.calls.push("sdk.data.getAll");
          state.playerDataReads += 1;
          return preferences;
        },
        set: (...args: unknown[]) => {
          state.calls.push("sdk.data.set");
          /** Provides update behavior. */
          const update = args.length === 2 && typeof args[0] === "string" ? {[String(args[0])]: args[1]} : (args[0] as Record<string, unknown>);
          Object.assign(preferences, update);
          state.preferenceWrites.push(update);
        },
        delete: (key: string) => {
          state.calls.push(`sdk.data.delete:${key}`);
          delete preferences[key];
        },
        flush: async () => {
          state.calls.push("sdk.data.flush");
        },
      },
      getEntryPayload: () => ({
        ...(params.get("customName") ? {customName: params.get("customName"), campaign: "jest_onboarding"} : {}),
        ...(params.get("inviteKind") ? {inviteKind: params.get("inviteKind")} : {}),
        ...(params.get("campaign") ? {campaign: params.get("campaign")} : {}),
        ...(params.get("reference") ? {reference: params.get("reference")} : {}),
        ...(params.get("inviterName") ? {inviterName: params.get("inviterName")} : {}),
        ...(params.get("gameMode") ? {gameMode: params.get("gameMode")} : {}),
        ...(params.get("riddleId") ? {riddleId: params.get("riddleId")} : {}),
        ...(params.get("challengeId") ? {challengeId: params.get("challengeId")} : {}),
        ...(params.get("challengeDestination") ? {challengeDestination: params.get("challengeDestination")} : {}),
      }),
      social: {
        getProfile: async () => {
          state.calls.push("sdk.social.getProfile");
          state.profileReads += 1;
          if (selectedScenario === "profile-failure") throw new Error("Mock profile request failed");
          return {username: "Authenticated Solver", avatarUrl: null};
        },
        setScreenshotProvider: () => {},
      },
      notifications: {
        scheduleNotification: async (input: AuthHarnessState["notificationSchedules"][number]) => {
          state.calls.push("sdk.notifications.scheduleNotification");
          state.notificationSchedules.push(structuredClone(input));
        },
        unscheduleNotification: async ({identifier}: {/** Stores identifier. */ /** Stores identifier. */ /** Stores identifier. */
        /** Stores identifier. */
        identifier: string}) => {
          state.calls.push("sdk.notifications.unscheduleNotification");
          state.notificationRemovals.push(identifier);
        },
      },
      referrals: {
        listReferrals: async () => ({referralsSigned: "signed-referrals"}),
        shareReferralLink: async (input: AuthHarnessState["referralShares"][number]) => {
          state.calls.push("sdk.referrals.shareReferralLink");
          state.referralShares.push(structuredClone(input));
          return {canceled: false};
        },
      },
      payments: {
        getProducts: async () => {
          state.calls.push("sdk.payments.getProducts:start");
          if (selectedScenario === "background-catalog-delay") {
            await new Promise((resolve) => window.setTimeout(resolve, 10_000));
          }
          state.calls.push("sdk.payments.getProducts:end");
          return [];
        },
        getIncompletePurchases: async () => {
          state.calls.push("sdk.payments.getIncompletePurchases");
          return {
            purchases: [],
            purchasesSigned: "signed-purchases",
            hasMore: false,
          };
        },
        completePurchase: async () => ({result: "success"}),
        beginPurchase: async () => ({result: "cancel"}),
        getSubscriptions: async () => {
          state.calls.push("sdk.payments.getSubscriptions");
          return {
            subscriptions: player.registered
              ? [
                  {
                    sku: "com.roobsworld.riddlequest.premium.monthly",
                    displayName: "Riddle Quest Premium",
                    displayDescription: "Premium membership",
                    price: 4.99,
                    currency: "USD",
                    billingPeriod: "monthly",
                    status: subscriptionActive ? "active" : "inactive",
                    trialEligible: !subscriptionActive,
                  },
                ]
              : [],
            signed: subscriptionActive ? "mock.subscriptions.active.signed" : "mock.subscriptions.inactive.signed",
          };
        },
        cancelSubscription: async ({subscriptionSku}: {
          /** Provider SKU selected by the shop. */
          subscriptionSku: string;
        }) => {
          state.calls.push(`sdk.payments.cancelSubscription:${subscriptionSku}`);
          if (state.scenario === "subscription-cancel-dismiss") return {result: "cancel"};
          if (state.scenario === "subscription-cancel-error") return {result: "error", error: "internal_error"};
          return {result: "success"};
        },
        beginSubscription: async ({subscriptionSku}: {/** Stores subscription sku. */ /** Stores subscription sku. */ /** Stores subscription sku. */
        /** Stores subscription sku. */
        subscriptionSku: string}) => {
          state.calls.push("sdk.payments.beginSubscription");
          subscriptionActive = true;
          return {
            result: "success",
            subscription: {
              sku: subscriptionSku,
              displayName: "Riddle Quest Premium",
              displayDescription: "Premium membership",
              price: 4.99,
              currency: "USD",
              billingPeriod: "monthly",
              status: "active",
              trialEligible: false,
            },
            subscriptionSigned: "mock.subscription.active.signed",
          };
        },
      },
      markFirstMilestone: async () => { state.calls.push("sdk.markFirstMilestone"); },
      setLoadingProgress: (progress: number) => state.calls.push(`sdk.progress:${progress}`),
      markGameLoaded: () => state.calls.push("sdk.markGameLoaded"),
    };
    Object.assign(window, {
      JestSDK: sdk,
      __RIDDLE_QUEST_JEST_AUTH_TEST__: state,
    });
  }, scenario);
};

/** Gets harness state. */
const getHarnessState = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as typeof window & {
          /** Stores riddle quest jest auth test. */
          __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
        }
      ).__RIDDLE_QUEST_JEST_AUTH_TEST__,
  );

/** Provides open harness behavior. */
const openHarness = async (
  browser: Browser,
  options: {
    /** Stores registered. */
    registered?: boolean;
    /** Stores scenario. */
    scenario?: string;
    /** Stores custom name. */
    customName?: string;
    /** Stores invite kind. */
    inviteKind?: string;
    /** Stores campaign. */
    campaign?: string;
    /** Stores reference. */
    reference?: string;
    /** Stores inviter name. */
    inviterName?: string;
    /** Stores game mode. */
    gameMode?: string;
    /** Stores riddle id. */
    riddleId?: string;
    /** Stores challenge id. */
    challengeId?: string;
    /** Stores challenge destination. */
    challengeDestination?: string;
    /** Stores harness. */
    harness?: "jest-auth" | "race-auth";
    /** Stores player id. */
    playerId?: string;
    /** Stores shared race. */
    sharedRace?: boolean;
    /** Stores race start delay ms. */
    raceStartDelayMs?: number;
    /** Stores race outcome delay ms. */
    raceOutcomeDelayMs?: number;
  } = {},
) => {
  /** Provides context behavior. */
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  /** Provides page behavior. */
  const page = await context.newPage();
  /** Captures uncaught startup failures, including asynchronous translation errors. */
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("https://cdn.jest.com/**", async (route) => {
    if (options.scenario === "sdk-request-delay") {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    await route.abort();
  });
  await installJestSdkHarness(page, options.scenario);
  /** Provides query behavior. */
  const query = new URLSearchParams({harness: options.harness ?? "jest-auth"});
  if (options.registered) query.set("registered", "1");
  if (options.customName) query.set("customName", options.customName);
  if (options.inviteKind) query.set("inviteKind", options.inviteKind);
  if (options.campaign) query.set("campaign", options.campaign);
  if (options.reference) query.set("reference", options.reference);
  if (options.inviterName) query.set("inviterName", options.inviterName);
  if (options.gameMode) query.set("gameMode", options.gameMode);
  if (options.riddleId) query.set("riddleId", options.riddleId);
  if (options.challengeId) query.set("challengeId", options.challengeId);
  if (options.challengeDestination) query.set("challengeDestination", options.challengeDestination);
  if (options.playerId) query.set("playerId", options.playerId);
  if (options.sharedRace) query.set("sharedRace", "1");
  if (options.raceStartDelayMs) query.set("raceStartDelayMs", String(options.raceStartDelayMs));
  if (options.raceOutcomeDelayMs) query.set("raceOutcomeDelayMs", String(options.raceOutcomeDelayMs));
  /** Provides navigation behavior. */
  const navigation = page.goto(`${baseUrl}/?${query}`);
  if (options.scenario === "sdk-request-delay") {
    await page.locator("#root > *").waitFor({timeout: 2_000});
  }
  await navigation;
  return {context, page, pageErrors};
};

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
    const distDir = process.env.PORTAL_JEST_BUILD_DIR ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR) : path.join(packageRoot, "dist-jest");
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

  afterEach(async () => Promise.all(browser?.contexts().map((context) => context.close().catch(() => undefined)) ?? []));

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
  });

  it("refreshes Config-panel subscription changes and cancels renewal from the shop", async () => {
    /** Starts a registered wallet in the injected SDK harness. */
    const {page} = await openHarness(browser, {registered: true});
    await enterRegisteredGame(page);
    await page.getByRole("button", {name: /buy coins/i}).first().click();
    await page.getByRole("button", {name: /start free trial/i}).waitFor();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("test:subscription-state", {detail: true})));
    /** Finds the active plan’s cancellation action. */
    const cancel = page.getByRole("button", {name: /cancel subscription/i});
    await cancel.waitFor();
    expect(await page.getByRole("button", {name: /start free trial|^subscribe$/i}).count()).toBe(0);
    expect((await getHarnessState(page)).calls).not.toContain("sdk.payments.beginSubscription");
    for (const scenario of ["subscription-cancel-dismiss", "subscription-cancel-error", "success"]) {
      await page.evaluate((value) => {
        (window as any).__RIDDLE_QUEST_JEST_AUTH_TEST__.scenario = value;
      }, scenario);
      await cancel.click();
      await page.getByTestId("server-activity-loader").waitFor({state: "hidden"});
      if (scenario === "subscription-cancel-error") await page.getByRole("alert").filter({hasText: /unexpected error/i}).waitFor();
      if (scenario !== "success") expect(await page.getByText(/renewal cancelled/i).count()).toBe(0);
    }
    await page.getByText(/renewal cancelled/i).waitFor();
    expect(await page.getByText("Premium active", {exact: true}).isVisible()).toBe(true);
    expect((await getHarnessState(page)).calls.filter((call) => call.startsWith("sdk.payments.cancelSubscription:"))).toHaveLength(3);
    await page.screenshot({path: "/tmp/riddle-subscription-cancelled.png"});
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("test:subscription-state", {detail: false})));
    await page.getByRole("button", {name: /start free trial/i}).waitFor();
  }, 30_000);

  it("reports first_milestone after a returning player solves a riddle", async () => {
    /** Restores a wallet that completed the milestone in an earlier session. */
    const {page} = await openHarness(browser, {registered: true, scenario: "returning-milestone"});
    await enterRegisteredGame(page);
    expect((await getHarnessState(page)).calls).not.toContain("sdk.markFirstMilestone");
    for (const letter of "PIANO") await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
    await page.getByRole("button", {name: /submit/i}).click();
    await page.waitForFunction(() =>
      (window as typeof window & {
        /** Observed SDK calls for this test session. */
        __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
      }).__RIDDLE_QUEST_JEST_AUTH_TEST__.calls.includes("sdk.markFirstMilestone"));
    expect((await getHarnessState(page)).calls.filter((call) => call === "sdk.markFirstMilestone")).toHaveLength(1);
  }, 30_000);

  it("starts a guest through signed identity exchange and reads stable-player progress", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.init");
    expect(state.calls).toContain("sdk.getPlayer");
    expect(state.calls).toContain("sdk.getPlayerSigned");
    expect(state.calls.indexOf("sdk.init")).toBeLessThan(state.calls.indexOf("sdk.getPlayer"));
    expect(state.calls.indexOf("sdk.getPlayer")).toBeLessThan(state.calls.indexOf("sdk.getPlayerSigned"));
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:false"]);
    expect(state.firebaseTokens).toEqual(["mock"]);
    expect(state.profileReads).toBe(0);
    expect(state.calls).not.toContain("sdk.social.getProfile");
    expect(state.calls.filter((call) => call === "sdk.data.getAll")).toHaveLength(2);
    expect(state.notificationSchedules).toEqual([]);
    await context.close();
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

  it("prompts only after instructions and dismisses without treating the guest as registered", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {customName: "Nova"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    await page.getByRole("button", {name: /let's play/i}).click();
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    await page.getByRole("button", {name: /got it/i}).click();
    await page.getByText("Keep your progress", {exact: true}).waitFor();
    await page.getByText("Welcome, Nova.").waitFor();
    expect((await getHarnessState(page)).overlayOptions).toEqual([
      {
        theme: "dark",
        message: "Keep my Riddle Quest progress! {{registrationCode}} is my registration code.",
        source: "post_instructions",
        campaign: "jest_onboarding",
        reference: "registration_post_instructions_v1",
        customName: "Nova",
      },
    ]);
    await page.getByRole("button", {name: /play as guest/i}).click();
    await page.getByText("Keep your progress", {exact: true}).waitFor({state: "detached"});
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.registration.closeButtonAction");
    expect(state.backendExchanges).toHaveLength(1);
    expect(state.preferenceWrites.some((value) => typeof value.registrationPromptDismissedAt === "number")).toBe(true);
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
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:false", "signed:jest-auth-player-stable:true"]);
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
          assetReference: "riddle-q-notification",
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
        reference: expect.stringMatching(/^riddle_quest_friend_challenge_v2_result_[0-9a-f]{16}$/),
        shareTitle: "Check out my Riddle Quest result!",
        onboardingSlug: "friend-challenge",
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
    expect(secondResultShare.reference).toMatch(/^riddle_quest_friend_challenge_v2_result_[0-9a-f]{16}$/);
    expect(secondResultShare.reference).not.toBe(share.reference);
    expect(secondResultShare.entryPayload).toEqual(expect.objectContaining({riddleId: "classic-riddle-2"}));

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
    expect(genericInvite).toEqual(
      expect.objectContaining({
        reference: "riddle_quest_friend_challenge_v2",
        onboardingSlug: "friend-challenge",
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

  it("runs the complete profile invite, attributed registration, and inviter reward journey", async () => {
    /** Provides creator behavior. */
    const creator = await openHarness(browser, {
      registered: true,
      playerId: "viral-creator",
    });
    await enterRegisteredGame(creator.page);
    await openProfileAfterGuidance(creator.page);
    /** Provides invite button behavior. */
    const inviteButton = creator.page.getByRole("button", {name: /invite a friend/i});
    await inviteButton.waitFor({state: "visible"});
    await inviteButton.click();
    await creator.page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 1,
    );
    /** Provides [share] behavior. */
    const [share] = (await getHarnessState(creator.page)).referralShares;
    expect(share).toEqual(
      expect.objectContaining({
        reference: "riddle_quest_friend_challenge_v2",
        onboardingSlug: "friend-challenge",
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
        source: "post_instructions",
        campaign: "open_invite_v1",
        reference: "registration_post_instructions_v1",
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
    expect((await getHarnessState(recipient.page)).backendExchanges).toEqual(["signed:viral-recipient:false", "signed:viral-recipient:true"]);
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
      return state.notificationSchedules.some((item) => item.identifier === "race_to_10_results_v1") && state.referralShares.some((item) => /^riddle_quest_race_to_10_v1_share_[0-9a-f]{16}$/.test(item.reference ?? ""));
    });
    /** Provides state behavior. */
    let state = await getHarnessState(page);
    expect(state.notificationSchedules).toContainEqual(
      expect.objectContaining({
        identifier: "race_to_10_results_v1",
        scheduledInDays: 1,
        entryPayload: expect.objectContaining({
          challengeId: "race-challenge-42",
          challengeDestination: "inbox",
          reference: "race_to_10_results_d1_v1",
        }),
      }),
    );
    expect(state.referralShares).toContainEqual(
      expect.objectContaining({
        reference: expect.stringMatching(/^riddle_quest_race_to_10_v1_share_[0-9a-f]{16}$/),
        onboardingSlug: "race-to-10",
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
    const secondRaceShare = state.referralShares.find((item) => item.entryPayload?.challengeId === "race-challenge-43")!;
    expect(secondRaceShare.reference).toMatch(/^riddle_quest_race_to_10_v1_share_[0-9a-f]{16}$/);
    expect(secondRaceShare.reference).not.toBe(firstRaceShare.reference);
    await context.close();
  });

  it("opens the authoritative race results inbox from a messaging deep link", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-results-player",
      challengeDestination: "inbox",
    });

    await page.getByRole("heading", {name: /challenge results/i}).waitFor({timeout: 15_000});
    await page.getByText("Nova", {exact: true}).waitFor({state: "visible"});
    await page.getByText(/time difference: 0:03\.5/i).waitFor({state: "visible"});
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.notificationRemovals).toContain("race_to_10_results_v1");
    expect(state.calls).toContain("sdk.notifications.unscheduleNotification");
    await page.getByRole("button", {name: /^rematch$/i}).click();
    await page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});
    await context.close();
  });

  it("runs a creator-to-recipient race across isolated browser contexts", async () => {
    sharedRaceChallenges.clear();
    /** Provides creator behavior. */
    const creator = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-creator",
      sharedRace: true,
      raceStartDelayMs: 2_500,
      raceOutcomeDelayMs: 500,
    });
    await enterRegisteredGame(creator.page);
    /** Provides multiplayer button behavior. */
    const multiplayerButton = creator.page.getByRole("button", {name: /^multiplayer$/i});
    await multiplayerButton.waitFor({timeout: 5_000});
    expect(await creator.page.locator(".race-mode-launcher").count()).toBe(0);
    /** Provides action labels behavior. */
    const actionLabels = await creator.page.locator(".game-input-actions > button").allInnerTexts();
    expect(actionLabels).toEqual(["Hint", "SUBMIT", "Skip"]);
    /** Provides navigation labels behavior. */
    const navigationLabels = await creator.page.locator(".game-bottom-navigation > button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    expect(navigationLabels).toEqual(["Settings", "Multiplayer", "Profile"]);
    await creator.page.setViewportSize({width: 390, height: 667});
    await multiplayerButton.click();
    await creator.page.getByRole("button", {name: /^History /}).waitFor();
    await creator.page.getByRole("button", {name: "Play with friends", exact: true}).click();
    await creator.page.waitForFunction(() =>
      (window as typeof window & {
        /** Injected Jest share-dialog receipts. */
        __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
      })
        .__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.some((share) => share.entryPayload?.challengeDestination === "multiplayer"),
    );
    /** Invitation captured at the real SDK adapter boundary. */
    const multiplayerInvite = (await getHarnessState(creator.page)).referralShares.find(
      (share) => share.entryPayload?.challengeDestination === "multiplayer",
    );
    expect(multiplayerInvite?.shareTitle).toBe("Race to 10");
    expect(multiplayerInvite?.shareText).toContain("challenged you");
    expect(multiplayerInvite?.entryPayload?.challengeId).toBeUndefined();
    await creator.page.getByTestId("server-activity-loader").waitFor({state: "detached"});
    expect(await creator.page.locator('[data-testid="server-activity-loader"]').count()).toBe(0);
    await creator.page.evaluate(() => {
      /** Provides timing window behavior. */
      const timingWindow = window as typeof window & {
        /** Stores riddle quest race start timing. */
        __RIDDLE_QUEST_RACE_START_TIMING__?: {
          /** Stores go at. */
          goAt?: number; /** Stores gameplay at. */
          /** Stores gameplay at. */
          gameplayAt?: number;
        };
      };
      /** Provides timing behavior. */
      const timing = {} as {
        /** Stores go at. */
        goAt?: number; /** Stores gameplay at. */
        /** Stores gameplay at. */
        gameplayAt?: number;
      };
      timingWindow.__RIDDLE_QUEST_RACE_START_TIMING__ = timing;
      /** Provides observer behavior. */
      const observer = new MutationObserver(() => {
        if (timing.goAt === undefined && document.querySelector(".race-countdown > span")?.textContent?.trim() === "GO!") {
          timing.goAt = performance.now();
        }
        if (timing.goAt !== undefined && document.querySelector(".race-gameplay")) {
          timing.gameplayAt = performance.now();
          observer.disconnect();
        }
      });
      observer.observe(document.body, {subtree: true, childList: true, characterData: true});
    });
    /** Lobby action used to create a challenge for another player. */
    const challengePlayer = creator.page.getByRole("button", {name: "Challenge another player", exact: true});
    expect(await challengePlayer.isEnabled()).toBe(true);
    /** Mobile bounds used to verify the challenge action remains tappable. */
    const challengeBounds = await challengePlayer.boundingBox();
    expect(challengeBounds).not.toBeNull();
    expect(challengeBounds!.x).toBeGreaterThanOrEqual(0);
    expect(challengeBounds!.x + challengeBounds!.width).toBeLessThanOrEqual(390);
    expect(challengeBounds!.height).toBeGreaterThanOrEqual(48);
    await challengePlayer.click();
    /** Provides countdown rail behavior. */
    const countdownRail = creator.page.locator(".race-countdown-rail");
    await countdownRail.waitFor();
    await creator.page.waitForTimeout(1_200);
    expect(await creator.page.locator(".race-countdown > span").innerText()).toBe("3");
    expect(await creator.page.locator(".race-countdown > p").innerText()).toMatch(/loading/i);
    expect(await creator.page.locator(".race-topbar").count()).toBe(0);
    expect(await countdownRail.getByText(/recorded head-to-head/i).isVisible()).toBe(true);
    expect(await countdownRail.locator(".race-coin-balance").isVisible()).toBe(true);
    expect(await countdownRail.getByRole("button", {name: /close race to 10/i}).isVisible()).toBe(true);
    /** Provides countdown center offset behavior. */
    const countdownCenterOffset = await creator.page.locator(".race-countdown > span").evaluate((element) => {
      /** Provides rect behavior. */
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - innerWidth / 2);
    });
    expect(countdownCenterOffset).toBeLessThanOrEqual(0.5);
    await creator.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    /** Horizontal coverage of the multiplayer keyboard within the game surface. */
    const keyboardCoverage = await creator.page.locator(".race-gameplay").evaluate((gameplay) => {
      /** Available game width. */
      const surface = gameplay.getBoundingClientRect();
      /** Rendered keyboard width. */
      const keyboard = gameplay.querySelector(".keyboard")!.getBoundingClientRect();
      return keyboard.width / surface.width;
    });
    expect(keyboardCoverage).toBeGreaterThan(0.98);
    /** Provides race start timing behavior. */
    const raceStartTiming = await creator.page.evaluate(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest race start timing. */
            __RIDDLE_QUEST_RACE_START_TIMING__?: {
              /** Stores go at. */
              goAt?: number; /** Stores gameplay at. */
              /** Stores gameplay at. */
              gameplayAt?: number;
            };
          }
        ).__RIDDLE_QUEST_RACE_START_TIMING__,
    );
    expect(raceStartTiming?.goAt).toBeDefined();
    expect(raceStartTiming?.gameplayAt).toBeDefined();
    expect((raceStartTiming?.gameplayAt ?? Infinity) - (raceStartTiming?.goAt ?? 0)).toBeLessThan(600);
    /** Gets multiplayer layout. */
    const getMultiplayerLayout = () =>
      creator.page.locator(".race-gameplay").evaluate((gameplay) => {
        /** Provides rail behavior. */
        const rail = gameplay.querySelector(".race-scoreboard")?.getBoundingClientRect();
        /** Provides riddle behavior. */
        const riddle = gameplay.querySelector(".race-riddle-surface")?.getBoundingClientRect();
        /** Provides status behavior. */
        const status = gameplay.querySelector(".race-rail-status")?.getBoundingClientRect();
        return {
          statusInRail: Boolean(gameplay.querySelector(".race-scoreboard .race-rail-status")),
          statusInGameInfo: Boolean(gameplay.querySelector(".race-rail-game-info > .race-rail-status")),
          statusInRiddle: Boolean(gameplay.querySelector(".race-riddle-surface .race-rail-status")),
          statusIsRightOfRiddle: Boolean(status && riddle && status.left >= riddle.right),
          railIsRightOfRiddle: Boolean(rail && riddle && rail.left >= riddle.right),
        };
      });
    /** Provides expected multiplayer layout behavior. */
    const expectedMultiplayerLayout = {
      statusInRail: true,
      statusInGameInfo: true,
      statusInRiddle: false,
      statusIsRightOfRiddle: true,
      railIsRightOfRiddle: true,
    };
    expect(await getMultiplayerLayout()).toEqual(expectedMultiplayerLayout);
    await creator.page.setViewportSize({width: 900, height: 844});
    expect(await getMultiplayerLayout()).toEqual(expectedMultiplayerLayout);
    await creator.page.setViewportSize({width: 390, height: 667});
    await creator.page.waitForFunction(() => Boolean(document.querySelector(".race-gameplay-viewport")?.getAttribute("data-viewport-scale")));
    /** Captures use of the available portrait multiplayer height. */
    const portraitRaceLayout = await creator.page.locator(".race-gameplay-viewport").evaluate((viewport) => {
      /** Captures the multiplayer screen bounds. */
      const screen = viewport.closest(".race-screen")!;
      /** Captures the screen's usable lower edge. */
      const usableBottom = screen.getBoundingClientRect().bottom - Number.parseFloat(getComputedStyle(screen).paddingBottom);
      /** Captures the multiplayer answer board bounds. */
      const guessBoard = viewport.querySelector(".guess-board")?.getBoundingClientRect();
      return {
        bottomGap: usableBottom - viewport.getBoundingClientRect().bottom,
        guessBoardWidth: guessBoard?.width ?? 0,
      };
    });
    expect(portraitRaceLayout.bottomGap).toBeLessThanOrEqual(1);
    expect(portraitRaceLayout.guessBoardWidth).toBeGreaterThan(250);
    await creator.page.screenshot({path: "/tmp/riddle-multiplayer-portrait.png"});
    await creator.page.waitForFunction(() => {
      /** Provides screen behavior. */
      const screen = document.querySelector(".race-screen");
      return Boolean(screen && screen.scrollHeight <= screen.clientHeight + 1);
    });
    await solveFakeRace(creator.page, {expectChainedSubmitLoader: true});
    await creator.page.getByText("Choose a mobile number or another Jest user in Jest.", {exact: true}).waitFor();
    await creator.page.getByRole("button", {name: /send challenge/i}).click();
    await creator.page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.some(
          (share) => share.entryPayload?.challengeId === "fake-challenge-2",
        ),
    );
    await creator.page.getByRole("button", {name: /challenge a friend/i}).waitFor({timeout: 10_000});
    expect(sharedRaceChallenges.has("fake-challenge-2")).toBe(true);

    /** A recipient of the lobby invitation enters multiplayer without a fabricated race result. */
    const invited = await openHarness(browser, {registered: true, harness: "race-auth", challengeDestination: "multiplayer"});
    await invited.page.locator(".race-category-grid").waitFor({state: "visible", timeout: 15_000});
    await invited.context.close();

    /** Provides recipient behavior. */
    const recipient = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-recipient",
      challengeId: "fake-challenge-2",
      inviteKind: "race",
      campaign: "race_to_10_v1",
      sharedRace: true,
    });
    await recipient.page.locator('[data-testid="server-activity-loader"]').waitFor({state: "detached", timeout: 15_000});
    await recipient.page.getByRole("heading", {name: /Guest Solver challenged you/i}).waitFor({timeout: 10_000});
    await recipient.page.getByRole("button", {name: /accept challenge/i}).click();
    await recipient.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    /** Provides opponent progress behavior. */
    const opponentProgress = recipient.page.locator(".race-progress > div").nth(1);
    await opponentProgress.getByText("10/10", {exact: true}).waitFor({timeout: 10_000});
    await solveFakeRace(recipient.page);
    expect(await recipient.page.locator(".race-result-grid").innerText()).toContain("Adjusted time");
    expect(await recipient.page.locator(".race-result h2").innerText()).toMatch(/You win|Opponent wins|tie/i);

    await Promise.all([creator.context.close(), recipient.context.close()]);
  });

  it("confirms quitting an active race and abandons it with no result", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-quitter",
    });
    await enterRegisteredGame(page);
    await page.getByRole("button", {name: /^multiplayer$/i}).click();
    await page.getByRole("button", {name: /^History /}).click();
    await page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});

    await page.locator(".race-actions").getByRole("button", {name: /^hint/i}).click();
    /** Provides server selected hint behavior. */
    const serverSelectedHint = page.locator(".race-gameplay .guess-row .cell.green").first();
    await serverSelectedHint.waitFor({state: "visible", timeout: 5_000});
    expect((await serverSelectedHint.innerText()).trim()).not.toBe("");
    expect(await page.locator(".race-header-clock small").innerText()).toContain("0:15.0");

    await page.getByRole("button", {name: /close race to 10/i}).click();
    /** Provides confirmation behavior. */
    const confirmation = page.getByRole("alertdialog", {name: /quit this race/i});
    await confirmation.waitFor();
    expect(await confirmation.innerText()).toMatch(/result for this session will be null/i);
    await confirmation.getByRole("button", {name: /keep playing/i}).click();
    await confirmation.waitFor({state: "detached"});
    expect(await page.locator(".race-gameplay").isVisible()).toBe(true);

    await page.getByRole("button", {name: /close race to 10/i}).click();
    await confirmation.getByRole("button", {name: /quit race/i}).click();
    await page.locator(".race-screen").waitFor({state: "detached", timeout: 10_000});
    expect(await page.evaluate(() => localStorage.getItem("riddleQuest:activeRaceRun"))).toBeNull();

    await page.getByRole("button", {name: /^multiplayer$/i}).click();
    await page.getByRole("button", {name: /^History /}).waitFor();
    expect(await page.locator(".race-gameplay").count()).toBe(0);
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
        source: "post_instructions",
        campaign: "direct_to_game_registration_v2",
        reference: "registration_post_instructions_v1",
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
    expect((await getHarnessState(page)).backendExchanges).toEqual(["signed:jest-auth-player-stable:false", "signed:jest-auth-player-stable:true"]);

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
    ["SDK initialization", "init-failure", /sdk initialization failed/i],
    ["SDK initialization timeout", "init-timeout", /please check your internet connection and try again/i],
    ["signed player", "signed-player-failure", /signed player request failed/i],
    ["identity exchange", "identity-failure", /identity exchange failed/i],
  ])("shows a retryable startup screen for %s failures", async (_name, scenario, message) => {
    /** Provides {context, page} behavior. */
    const {context, page, pageErrors} = await openHarness(browser, {
      scenario,
    });
    await page.getByRole("heading", {name: /startup failed/i}).waitFor({timeout: 15_000});
    expect(await page.getByText(message).isVisible()).toBe(true);
    expect(await page.getByRole("button", {name: /retry/i}).isVisible()).toBe(true);
    expect(pageErrors).toEqual([]);
    if (scenario === "identity-failure") {
      expect((await getHarnessState(page)).calls).toContain("sdk.payments.getIncompletePurchases");
    }
    await context.close();
  });

  it("keeps registered play available when the optional Jest social profile is unavailable", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {registered: true, scenario: "profile-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    /** Provides state behavior. */
    const state = await getHarnessState(page);
    expect(state.profileReads).toBe(1);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(await page.getByRole("heading", {name: /startup failed/i}).count()).toBe(0);
    await context.close();
  });

  it("recovers from a transient SDK initialization failure when Retry is pressed", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {scenario: "init-once-failure"});
    await page.getByRole("heading", {name: /startup failed/i}).waitFor({timeout: 15_000});
    await page.getByRole("button", {name: /retry/i}).click();
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    expect((await getHarnessState(page)).backendExchanges).toHaveLength(1);
    await context.close();
  });
});

jest.setTimeout(180_000);
