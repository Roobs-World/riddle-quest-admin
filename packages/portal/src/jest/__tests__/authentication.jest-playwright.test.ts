import {afterAll, afterEach, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type Page} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {mkdir, readFile} from "node:fs/promises";
import path from "node:path";

import {advanceToRegistration, enterRegisteredGame, openProfileAfterGuidance, solveFakeRace} from "./authentication.jest-playwright.support";
import {PLAYER_NOTIFICATION_IDS} from "../notifications/engagement";

/** Provides describe browser behavior. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
/** Provides base url behavior. */
let baseUrl: string;
/** Provides shared race challenges behavior. */
const sharedRaceChallenges = new Map<string, string>();

/** Captures optional durable evidence for the two-player race journey. */
const captureMultiplayerEvidence = async (page: Page, filename: string) => {
  /** Directory selected only by an explicit evidence run. */
  const directory = process.env.JEST_MULTIPLAYER_EVIDENCE_DIR;
  if (!directory) return;
  await mkdir(directory, {recursive: true});
  await page.screenshot({path: path.join(directory, filename), fullPage: true});
};

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
  /** Records whether each referral request began synchronously in the profile click. */
  referralSharesStartedFromProfileClick: boolean[];
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
      referralSharesStartedFromProfileClick: [],
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
      ? {firstMilestoneMarked: true} : selectedScenario === "returning-guest-two-wins"
        ? {firstMilestoneMarked: true, jestGuestCompletedRiddles: 2} : {};
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
          return {
            username: "Authenticated Solver",
            avatarUrl: selectedScenario === "avatar-profile" ? "https://cdn.jest.com/mock-avatar.webp" : null,
          };
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
          state.referralSharesStartedFromProfileClick.push(Boolean(
            (window as typeof window & {
              /** True only while the profile invite button's synchronous handler is running. */
              __RIDDLE_QUEST_PROFILE_INVITE_CLICK__?: boolean;
            })
              .__RIDDLE_QUEST_PROFILE_INVITE_CLICK__,
          ));
          if (selectedScenario === "race-share-delay" && input.entryPayload?.inviteKind === "race") {
            await new Promise((resolve) => window.setTimeout(resolve, 2_000));
          }
          state.referralShares.push(structuredClone(input));
          return {canceled: selectedScenario === "race-share-cancel"};
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
      markFirstMilestone: async () => {
        state.calls.push("sdk.markFirstMilestone");
        if (selectedScenario === "milestone-failure") throw new Error("Milestone unavailable");
      },
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
    /** Number of outcome requests that fail before the harness recovers. */
    raceOutcomeFailures?: number;
    /** Stores race guess delay ms. */
    raceGuessDelayMs?: number;
    /** Stores race skip delay ms. */
    raceSkipDelayMs?: number;
    /** Whether late ghost guesses reproduce the production rejection. */
    raceRejectLateGuess?: boolean;
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
  if (options.raceOutcomeFailures) query.set("raceOutcomeFailures", String(options.raceOutcomeFailures));
  if (options.raceGuessDelayMs) query.set("raceGuessDelayMs", String(options.raceGuessDelayMs));
  if (options.raceSkipDelayMs) query.set("raceSkipDelayMs", String(options.raceSkipDelayMs));
  if (options.raceRejectLateGuess) query.set("raceRejectLateGuess", "1");
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
    await page.locator('.keyboard').getByRole('button', {name: /^P$/}).click();
    expect(await page.getByRole('button', {name: /^letter 1: p$/i}).isVisible()).toBe(true);
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    for (const letter of ["I", "A", "N", "O"]) {
      await page.locator('.keyboard').getByRole('button', {name: letter, exact: true}).click();
    }
    await page.locator('.game-input-actions').getByRole('button', {name: /submit/i}).click();
    await page.waitForFunction((milestoneFailure) => {
      const state = (window as typeof window & {
        /** Captured provider calls and preferences from the injected SDK. */
        __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
      }).__RIDDLE_QUEST_JEST_AUTH_TEST__;
      return milestoneFailure ? state.calls.includes("sdk.markFirstMilestone") :
        state.preferenceWrites.some(value => value.firstMilestoneMarked === true);
    }, scenario === "milestone-failure");
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    await page.locator('.modal-victory').waitFor();
    await page.getByRole('button', {name: /tap the chest/i}).waitFor();
    const fanfareSteps: string[] = [];
    for (let step = 0; step < 6 && await page.locator('.modal-victory').count(); step += 1) {
      fanfareSteps.push(await page.locator('.modal-victory').innerText());
      expect(await page.locator('.jest-registration-dialog').count()).toBe(0);
      if (await page.getByRole('button', {name: /tap the chest/i}).isVisible()) {
        await page.getByRole('button', {name: /tap the chest/i}).click();
      }
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.reward-continue')?.disabled);
      await page.locator('.reward-continue').click();
    }
    expect(fanfareSteps[0]).toContain("NICE JOB!");
    expect(fanfareSteps.filter(value => value.includes("NICE JOB!"))).toHaveLength(1);
    expect(fanfareSteps.some(value => value.includes("Achievement Unlocked!"))).toBe(true);
    for (let step = 0; step < 5; step += 1) {
      await page.waitForFunction(() => Boolean(document.querySelector('.tooltip-backdrop, .jest-registration-dialog')));
      if (await page.locator('.jest-registration-dialog').count()) break;
      expect(await page.locator('.jest-registration-dialog').count()).toBe(0);
      expect(await page.locator("[data-tooltip-id='achievementEarned']").count()).toBe(0);
      await page.locator('.tooltip-backdrop').getByRole('button', {name: /^got it$/i}).click();
    }
    await page.locator('.tooltip-backdrop').waitFor({state: 'detached'});
    await page.getByText("Keep your progress", {exact: true}).waitFor();
    const dialog = page.locator(".jest-registration-dialog");
    expect(await dialog.isVisible()).toBe(true);
    await page.waitForFunction(() => !document.querySelector(".jest-registration-dialog")?.hasAttribute("inert"));
    const state = await getHarnessState(page);
    expect(state.calls.filter((call) => call === "sdk.markFirstMilestone")).toHaveLength(1);
    expect(state.overlayOptions).toEqual([expect.objectContaining({source: "authoritative_win"})]);
    await dialog.locator(".play-text-button").click();
    await dialog.waitFor({state: "detached"});
    await context.close();
  });

  it("reports a guest Daily completion without opening registration", async () => {
    const {context, page} = await openHarness(browser, {gameMode: "challenge"});
    await enterRegisteredGame(page, /i speak without a mouth/i);
    await page.locator(".game-mode-label").getByText(/daily/i).waitFor();
    for (const letter of "ECHO") {
      await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
    }
    await page.locator(".game-input-actions").getByRole("button", {name: /submit/i}).click();
    await page.locator(".modal-victory").waitFor();
    await page.getByRole("button", {name: /tap the chest/i}).waitFor();
    for (let step = 0; step < 6 && await page.locator(".modal-victory").count(); step += 1) {
      await page.locator(".reward-continue").waitFor();
      const currentStep = await page.locator(".modal-victory").textContent();
      if (await page.getByRole("button", {name: /tap the chest/i}).isVisible()) {
        await page.getByRole("button", {name: /tap the chest/i}).click();
      }
      await page.waitForFunction(() => Boolean(document.querySelector<HTMLButtonElement>(".reward-continue:not(:disabled)")));
      await page.locator(".reward-continue").click();
      await page.waitForFunction((previous) => !document.querySelector(".modal-victory") ||
        document.querySelector(".modal-victory")?.textContent !== previous, currentStep);
    }
    await page.locator(".tooltip-backdrop").waitFor({state: "detached"});
    const state = await getHarnessState(page);
    expect(state.calls.filter((call) => call === "sdk.markFirstMilestone")).toHaveLength(1);
    expect(state.overlayOptions).toEqual([]);
    expect(await page.locator(".jest-registration-dialog").count()).toBe(0);
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
        shareText: "Authenticated Solver challenged you to Riddle Quest. Register through this invite and you both earn 100 coins!",
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
    const {context, page} = await openHarness(browser, {registered: true, scenario: "avatar-profile"});
    await enterRegisteredGame(page);
    await openProfileAfterGuidance(page);
    expect(await page.locator(".profile-identity img").getAttribute("src"))
      .toBe("https://cdn.jest.com/mock-avatar.webp");
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
    expect(await creator.page.locator('.profile-identity').innerText()).toContain('Authenticated Solver');
    expect(await creator.page.locator('.profile-identity input[type=file]').count()).toBe(0);
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
        shareText: "Authenticated Solver challenged you to Riddle Quest. Register through this invite and you both earn 100 coins!",
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
      return state.notificationSchedules.some((item) => item.identifier === "race_to_10_results_v1") && state.referralShares.some((item) => /^rq_r10_v1_[0-9a-f]{16}$/.test(item.reference ?? ""));
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
    const secondRaceShare = state.referralShares.find((item) => item.entryPayload?.challengeId === "race-challenge-43")!;
    expect(secondRaceShare.reference).toMatch(/^rq_r10_v1_[0-9a-f]{16}$/);
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

  it("renders the preloaded next riddle before a delayed skip response returns", async () => {
    /** Registered race harness with deliberately slow authoritative skip transport. */
    const {context, page} = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-instant-skip",
      raceSkipDelayMs: 2_000,
    });
    await enterRegisteredGame(page);
    await page.getByRole("button", {name: /^multiplayer$/i}).click();
    await page.getByRole("button", {name: /^History /}).click();
    await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    /** First clue shown after the full deck has loaded and the countdown has completed. */
    const firstRiddle = await page.locator(".race-riddle-surface h2").innerText();
    /** Skip control whose cooldown state is exercised by this flow. */
    const skipButton = page.getByRole("button", {name: /^Skip/});
    await skipButton.click();
    await page.waitForFunction(
      (previous) => document.querySelector(".race-riddle-surface h2")?.textContent !== previous,
      firstRiddle,
    );
    expect(await page.locator(".race-riddle-surface h2").innerText()).toContain("hands and a face");
    expect(await skipButton.isDisabled()).toBe(true);
    await page.waitForFunction(() => {
      /** Current skip control discovered inside the browser page. */
      const button = [...document.querySelectorAll<HTMLButtonElement>(".race-actions button")].find((candidate) =>
        candidate.textContent?.includes("Skip"),
      );
      return button?.disabled === false;
    });
    await context.close();
  });

  it("publishes a completed score before reusable Jest invites reach recipients", async () => {
    sharedRaceChallenges.clear();
    /** Provides creator behavior. */
    const creator = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-creator",
      sharedRace: true,
      raceStartDelayMs: 2_500,
      raceOutcomeDelayMs: 500,
      scenario: "race-share-delay",
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
    await creator.page.getByTestId("server-activity-loader").waitFor({state: "detached"});
    await captureMultiplayerEvidence(creator.page, "01-player-1-multiplayer-lobby.png");
    expect(await creator.page.locator('[data-testid="server-activity-loader"]').count()).toBe(0);
    /** Every lobby surface stays inside the narrow embedded game viewport. */
    const lobbyBounds = await creator.page.locator(".race-topbar, .race-hub-tabs, .race-panel").evaluateAll((elements) =>
      elements.map((element) => {
        /** Element bounds relative to the embedded game viewport. */
        const bounds = element.getBoundingClientRect();
        return {left: bounds.left, right: bounds.right};
      }),
    );
    expect(lobbyBounds).toHaveLength(3);
    for (const bounds of lobbyBounds) {
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(390);
    }
    /** The game dialog itself cannot retain a horizontal offset after transient child layout. */
    const lobbyOverflow = await creator.page.locator(".race-screen").evaluate((screen) => ({
      overflowX: getComputedStyle(screen).overflowX,
      scrollLeft: screen.scrollLeft,
      scrollWidth: screen.scrollWidth,
      clientWidth: screen.clientWidth,
    }));
    expect(lobbyOverflow).toEqual({
      overflowX: "hidden",
      scrollLeft: 0,
      scrollWidth: lobbyOverflow.clientWidth,
      clientWidth: lobbyOverflow.clientWidth,
    });
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
    expect(await creator.page.getByRole("button", {name: /challenge a player/i}).count()).toBe(0);
    expect((await getHarnessState(creator.page)).referralShares).toHaveLength(0);
    await creator.page.getByRole("button", {name: /^History /}).click();
    /** Provides countdown rail behavior. */
    const countdownRail = creator.page.locator(".race-countdown-rail");
    await countdownRail.waitFor();
    await creator.page.waitForTimeout(1_200);
    expect(await creator.page.locator(".race-countdown > span").count()).toBe(0);
    expect(await creator.page.locator(".race-countdown > p").innerText()).toMatch(/loading/i);
    expect(await creator.page.locator(".race-topbar").count()).toBe(0);
    expect(await countdownRail.getByText(/recorded head-to-head/i).isVisible()).toBe(true);
    expect(await countdownRail.locator(".race-coin-balance").count()).toBe(0);
    expect(await countdownRail.getByRole("button", {name: /close race to 10/i}).isVisible()).toBe(true);
    await creator.page.locator(".race-countdown > span").waitFor();
    /** Provides countdown center offset behavior. */
    const countdownCenterOffset = await creator.page.locator(".race-countdown > span").evaluate((element) => {
      /** Provides rect behavior. */
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - innerWidth / 2);
    });
    expect(countdownCenterOffset).toBeLessThanOrEqual(0.5);
    await creator.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    expect(await creator.page.locator(".race-progress strong").allInnerTexts()).toEqual(["Riddles solved: 0 / 10"]);
    await captureMultiplayerEvidence(creator.page, "02-player-1-race-started.png");
    /** Horizontal coverage of the multiplayer keyboard within its viewport. */
    const keyboardCoverage = await creator.page.locator(".race-gameplay-viewport").evaluate((viewport) => {
      /** Available viewport width. */
      const surface = viewport.getBoundingClientRect();
      /** Rendered keyboard width. */
      const keyboard = viewport.querySelector(".keyboard")!.getBoundingClientRect();
      return keyboard.width / surface.width;
    });
    expect(keyboardCoverage).toBeGreaterThan(0.98);
    /** Visual styles shared with the main-game keyboard at phone widths. */
    const multiplayerKeyboardStyle = await creator.page.locator(".race-gameplay .keyboard").evaluate((keyboard) => {
      /** First letter key. */
      const letterKey = keyboard.querySelector<HTMLElement>(".key:not(.utility)")!;
      /** Backspace key. */
      const utilityKey = keyboard.querySelector<HTMLElement>(".key.utility")!;
      /** Rendered letter-key style. */
      const letterStyle = getComputedStyle(letterKey);
      return {
        backgroundColor: letterStyle.backgroundColor,
        borderWidth: letterStyle.borderWidth,
        borderRadius: letterStyle.borderRadius,
        height: letterStyle.height,
        utilityWidth: getComputedStyle(utilityKey).width,
        letterWidth: letterStyle.width,
      };
    });
    expect(multiplayerKeyboardStyle).toEqual({
      backgroundColor: "rgba(255, 255, 255, 0.12)",
      borderWidth: "1px",
      borderRadius: "7px",
      height: "48px",
      utilityWidth: multiplayerKeyboardStyle.letterWidth,
      letterWidth: multiplayerKeyboardStyle.letterWidth,
    });
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
        return {
          redundantRemainingCount: Boolean(gameplay.querySelector(".race-rail-status")),
          railIsAboveRiddle: Boolean(rail && riddle && rail.bottom <= riddle.top),
        };
      });
    /** Provides expected multiplayer layout behavior. */
    const expectedMultiplayerLayout = {
      redundantRemainingCount: false,
      railIsAboveRiddle: true,
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
      /** Captures every rendered multiplayer answer cell. */
      const answerCells = [...viewport.querySelectorAll<HTMLElement>(".guess-board .cell")].map((cell) =>
        cell.getBoundingClientRect(),
      );
      return {
        bottomGap: usableBottom - viewport.getBoundingClientRect().bottom,
        minimumCellHeight: Math.min(...answerCells.map(({height}) => height)),
        minimumCellWidth: Math.min(...answerCells.map(({width}) => width)),
      };
    });
    expect(portraitRaceLayout.bottomGap).toBeLessThanOrEqual(1);
    expect(portraitRaceLayout.minimumCellHeight).toBeGreaterThanOrEqual(44);
    expect(portraitRaceLayout.minimumCellWidth).toBeGreaterThanOrEqual(44);
    await creator.page.screenshot({path: "/tmp/riddle-multiplayer-portrait.png"});
    await creator.page.waitForFunction(() => {
      /** Provides screen behavior. */
      const screen = document.querySelector(".race-screen");
      return Boolean(screen && screen.scrollHeight <= screen.clientHeight + 1);
    });
    await solveFakeRace(creator.page, {expectChainedSubmitLoader: true});
    await creator.page.getByText("Run recorded!", {exact: true}).waitFor();
    /** Completing gameplay must reset any horizontal offset created by the scaled answer surface. */
    const completedLayout = await creator.page.locator(".race-screen").evaluate((screen) => ({
      documentScrollLeft: document.scrollingElement?.scrollLeft ?? 0,
      screenScrollLeft: screen.scrollLeft,
      topbarLeft: screen.querySelector(".race-topbar")?.getBoundingClientRect().left ?? -1,
    }));
    expect(completedLayout).toEqual({documentScrollLeft: 0, screenScrollLeft: 0, topbarLeft: 18});
    expect((await getHarnessState(creator.page)).referralShares).toHaveLength(0);
    await captureMultiplayerEvidence(creator.page, "03-player-1-run-recorded.png");
    await creator.page.getByRole("button", {name: /send challenge/i}).click();
    /** Share control inspected while the Jest provider call remains in flight. */
    const sharingButton = creator.page.getByRole("button", {name: /challenge a friend/i});
    await sharingButton.waitFor({timeout: 10_000});
    expect(await sharingButton.getAttribute("aria-busy")).toBe("true");
    expect(await sharingButton.isDisabled()).toBe(true);
    await creator.page.waitForFunction(() =>
      (window as typeof window & {
        /** Captured referral shares from the injected Jest SDK. */
        __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
      })
        .__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 1,
    );
    /** First post-result share contains an already-published immutable score. */
    const firstInvite = (await getHarnessState(creator.page)).referralShares[0]!;
    expect(await sharingButton.getAttribute("aria-busy")).toBe("false");
    expect(await sharingButton.isEnabled()).toBe(true);
    /** Immutable challenge selected from the creator's first invite payload. */
    const invitedChallengeId = firstInvite.entryPayload?.challengeId;
    expect(firstInvite.shareTitle).toBe("Race to 10");
    expect(firstInvite.shareText).toContain("Time to beat");
    expect(invitedChallengeId).toMatch(/^fake-challenge-/);
    expect(sharedRaceChallenges.has(invitedChallengeId!)).toBe(true);
    await creator.page.getByRole("button", {name: /challenge a friend/i}).waitFor({timeout: 10_000});
    await captureMultiplayerEvidence(creator.page, "04-player-1-challenge-ready.png");

    /** The same completed challenge may be sent to as many Jest recipients as desired. */
    await creator.page.getByRole("button", {name: /challenge a friend/i}).click();
    await creator.page.getByRole("button", {name: /challenge a friend/i}).click();
    await creator.page.waitForFunction(() =>
      (window as typeof window & {
        /** Captured referral shares from the injected Jest SDK. */
        __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
      })
        .__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 3,
    );
    /** All repeated sends made from the same completed result. */
    const repeatedInvites = (await getHarnessState(creator.page)).referralShares;
    expect(repeatedInvites.map((invite) => invite.entryPayload?.challengeId)).toEqual([
      invitedChallengeId,
      invitedChallengeId,
      invitedChallengeId,
    ]);
    expect(new Set(repeatedInvites.map((invite) => invite.reference)).size).toBe(3);

    /** Recipient opens only after the creator's score and challenge both exist. */
    const recipient = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-recipient",
      challengeId: invitedChallengeId,
      inviteKind: "race",
      campaign: "race_to_10_v1",
      sharedRace: true,
    });

    await recipient.page.getByRole("heading", {name: /Guest Solver challenged you/i}).waitFor({timeout: 20_000});
    await captureMultiplayerEvidence(recipient.page, "05-player-2-invite-ready.png");
    await recipient.page.getByRole("button", {name: /accept challenge/i}).click();
    await recipient.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    /** Progress can race with the creator's first server-confirmed automatic clear. */
    const initialProgress = await recipient.page.locator(".race-progress strong").allInnerTexts();
    expect(initialProgress[0]).toBe("Riddles solved: 0 / 10");
    expect(initialProgress[1]).toMatch(/^Riddles solved: [01] \/ 10$/);
    await captureMultiplayerEvidence(recipient.page, "06-player-2-race-started.png");
    await recipient.page.getByRole("heading", {name: /opponent wins/i}).waitFor({timeout: 10_000});
    /** Final score makes the exact opponent replay explicit after automatic completion. */
    const finalScore = recipient.page.locator(".race-result-score");
    expect(await finalScore.innerText()).toContain("You\n0/10");
    expect(await finalScore.innerText()).toContain("Guest Solver\n10/10");
    await captureMultiplayerEvidence(recipient.page, "07-player-2-automatic-result.png");
    expect(await recipient.page.locator(".race-result-grid").innerText()).toContain("Adjusted time");
    expect(await recipient.page.locator(".race-result h2").innerText()).toMatch(/Opponent wins/i);
    await captureMultiplayerEvidence(recipient.page, "08-player-2-final-result.png");

    await Promise.all([creator.context.close(), recipient.context.close()]);
  });

  it("shows an opponent win immediately and keeps category navigation ahead of delayed outcome work", async () => {
    sharedRaceChallenges.clear();
    /** Deterministic challenge whose ghost finishes just after the gameplay countdown. */
    const challengeId = `jest-invite-${"a".repeat(64)}-${"b".repeat(32)}`;
    /** Server-issued ghost score replayed by the recipient. */
    const events = Array.from({length: 10}, (_, index) => ({
      sequence: index,
      type: "correct" as const,
      riddlePosition: index,
      wallElapsedMs: (index + 1) * 300,
      penaltyAddedMs: 0 as const,
      totalPenaltyMs: 0,
      adjustedElapsedMs: (index + 1) * 300,
      correctCount: index + 1,
    }));
    sharedRaceChallenges.set(challengeId, JSON.stringify({
      preview: {
        challengeId,
        creator: {displayName: "Fast Opponent"},
        categoryId: "mixed",
        locale: "en",
        targetCorrect: 10,
        adjustedTimeToBeatMs: 3_000,
        rulesVersion: "race10_v1",
        expiresAtMs: Date.now() + 60_000,
        status: "active",
      },
      runId: "fast-opponent-run",
      events,
    }));
    /** Recipient whose outcome response is deliberately slower than the local result presentation. */
    const recipient = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "automatic-loss-recipient",
      challengeId,
      inviteKind: "race",
      campaign: "race_to_10_v1",
      sharedRace: true,
      raceOutcomeDelayMs: 2_000,
    });
    await recipient.page.evaluate(() => {
      Object.assign(window, {__raceOutcomeResultCount: 0});
      window.addEventListener("riddle-quest:host-to-game", (event) => {
        if ((event as CustomEvent).detail?.payload?.operation === "raceOutcome") {
          Object.assign(window, {
            __raceOutcomeResultCount: Number((window as typeof window & {
              /** Counts authoritative race-outcome responses received by the game. */
              __raceOutcomeResultCount?: number;
            }).__raceOutcomeResultCount ?? 0) + 1,
          });
        }
      });
    });
    await recipient.page.getByRole("button", {name: /accept challenge/i}).waitFor({state: "visible"});
    await recipient.page.getByRole("button", {name: /accept challenge/i}).click();
    await recipient.page.locator(".race-countdown").waitFor({state: "visible", timeout: 10_000});
    await recipient.page.getByRole("heading", {name: /opponent wins/i}).waitFor({timeout: 5_000});
    expect(await recipient.page.evaluate(() => (window as typeof window & {
      /** Counts authoritative race-outcome responses received by the game. */
      __raceOutcomeResultCount?: number;
    }).__raceOutcomeResultCount)).toBe(0);
    expect(await recipient.page.getByRole("alert").count()).toBe(0);
    /** Cached category navigation must invalidate obsolete outcome presentation without a replacement request. */
    await recipient.page.getByRole("button", {name: /choose your category/i}).click();
    await recipient.page.locator(".race-category-grid").waitFor({state: "visible", timeout: 1_000});
    await recipient.page.waitForFunction(
      () => (window as typeof window & {
        /** Counts authoritative race-outcome responses received by the game. */
        __raceOutcomeResultCount?: number;
      }).__raceOutcomeResultCount === 1,
      undefined,
      {timeout: 5_000},
    );
    expect(await recipient.page.getByRole("heading", {name: /opponent wins/i}).count()).toBe(0);
    expect(await recipient.page.locator(".race-category-grid").isVisible()).toBe(true);
    await recipient.context.close();
  });

  it("shows a completed creator result while authoritative completion work continues in the background", async () => {
    /** Creator with deliberately delayed outcome reconciliation. */
    const creator = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "instant-result-creator",
      raceOutcomeDelayMs: 2_000,
    });
    await enterRegisteredGame(creator.page);
    await creator.page.getByRole("button", {name: /^multiplayer$/i}).click();
    await creator.page.getByRole("button", {name: /^History /}).click();
    await creator.page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});
    await creator.page.evaluate(() => {
      Object.assign(window, {__raceOutcomeResultCount: 0});
      window.addEventListener("riddle-quest:host-to-game", (event) => {
        if ((event as CustomEvent).detail?.payload?.operation === "raceOutcome") {
          Object.assign(window, {
            __raceOutcomeResultCount: Number((window as typeof window & {
              /** Counts authoritative race-outcome responses received by the game. */
              __raceOutcomeResultCount?: number;
            }).__raceOutcomeResultCount ?? 0) + 1,
          });
        }
      });
    });
    await solveFakeRace(creator.page, {
      expectChainedSubmitLoader: true,
      onFinalSubmitted: async () => {
        await creator.page.getByRole("heading", {name: /run recorded/i}).waitFor({timeout: 1_000});
        expect(await creator.page.evaluate(() => (window as typeof window & {
          /** Counts authoritative race-outcome responses received by the game. */
          __raceOutcomeResultCount?: number;
        }).__raceOutcomeResultCount)).toBe(0);
        /** The player's next intent is accepted immediately while outcome confirmation remains in flight. */
        const sendChallenge = creator.page.getByRole("button", {name: /send challenge/i});
        await sendChallenge.click({timeout: 1_000});
        expect(await sendChallenge.getAttribute("aria-busy")).toBe("true");
        expect(await sendChallenge.isDisabled()).toBe(true);
      },
    });
    await creator.page.waitForFunction(
      () => (window as typeof window & {
        /** Counts authoritative race-outcome responses received by the game. */
        __raceOutcomeResultCount?: number;
      }).__raceOutcomeResultCount === 1,
      undefined,
      {timeout: 5_000},
    );
    expect(await creator.page.getByRole("heading", {name: /run recorded/i}).isVisible()).toBe(true);
    await creator.page.waitForFunction(() =>
      (window as typeof window & {
        /** Captured referral shares from the injected Jest SDK. */
        __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
      }).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 1,
    );
    await creator.page.getByRole("button", {name: /challenge a friend/i}).waitFor({timeout: 5_000});
    await creator.context.close();
  });

  it("recovers a guess rejected after the ghost deadline without exposing a retry dead-end", async () => {
    sharedRaceChallenges.clear();
    /** Challenge long enough for the first guess to begin before, but finish after, the ghost deadline. */
    const challengeId = `jest-invite-${"c".repeat(64)}-${"d".repeat(32)}`;
    sharedRaceChallenges.set(challengeId, JSON.stringify({
      preview: {
        challengeId,
        creator: {displayName: "Deadline Opponent"},
        categoryId: "mixed",
        locale: "en",
        targetCorrect: 10,
        adjustedTimeToBeatMs: 5_000,
        rulesVersion: "race10_v1",
        expiresAtMs: Date.now() + 60_000,
        status: "active",
      },
      runId: "deadline-opponent-run",
      events: [],
    }));
    /** Recipient whose in-flight guess crosses the authoritative opponent deadline. */
    const recipient = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "late-guess-recipient",
      challengeId,
      inviteKind: "race",
      campaign: "race_to_10_v1",
      sharedRace: true,
      raceGuessDelayMs: 2_500,
      raceRejectLateGuess: true,
    });
    await recipient.page.getByRole("button", {name: /accept challenge/i}).waitFor({state: "visible"});
    await recipient.page.getByRole("button", {name: /accept challenge/i}).click();
    await recipient.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    await recipient.page.locator(".race-gameplay .guess-board").click();
    await recipient.page.keyboard.type("piano");
    await recipient.page.locator(".race-actions .submit-action").click();
    await recipient.page.getByRole("heading", {name: /opponent wins/i}).waitFor({timeout: 6_000});
    expect(await recipient.page.getByRole("alert").count()).toBe(0);
    expect(await recipient.page.getByRole("button", {name: /^retry$/i}).count()).toBe(0);
    await recipient.context.close();
  });

  it("keeps the immediate result visible and retries failed background reconciliation", async () => {
    /** Creator whose first background outcome request fails transiently. */
    const creator = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "outcome-retry-creator",
      raceOutcomeFailures: 1,
    });
    await enterRegisteredGame(creator.page);
    await creator.page.getByRole("button", {name: /^multiplayer$/i}).click();
    await creator.page.getByRole("button", {name: /^History /}).click();
    await creator.page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});
    await solveFakeRace(creator.page);
    await creator.page.getByRole("heading", {name: /run recorded/i}).waitFor({timeout: 1_000});
    await creator.page.getByRole("alert").waitFor({state: "visible", timeout: 5_000});
    expect(await creator.page.getByRole("heading", {name: /run recorded/i}).isVisible()).toBe(true);
    await creator.page.getByRole("button", {name: /^retry$/i}).click();
    await creator.page.getByRole("alert").waitFor({state: "hidden", timeout: 5_000});
    expect(await creator.page.getByRole("heading", {name: /run recorded/i}).isVisible()).toBe(true);
    await creator.context.close();
  });

  it("acknowledges close during a delayed start and abandons the created run before exiting", async () => {
    /** Player whose authoritative start deliberately resolves after the close intent. */
    const player = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "close-during-start-player",
      raceStartDelayMs: 2_000,
    });
    await enterRegisteredGame(player.page);
    await player.page.getByRole("button", {name: /^multiplayer$/i}).click();
    await player.page.getByRole("button", {name: /^History /}).click();
    await player.page.locator(".race-countdown").waitFor({state: "visible", timeout: 5_000});
    /** Close control inspected while the delayed authoritative start is reconciled. */
    const closeButton = player.page.locator(".race-close");
    await closeButton.click();
    expect(await closeButton.getAttribute("aria-busy")).toBe("true");
    expect(await closeButton.isDisabled()).toBe(true);
    expect(await player.page.locator(".race-screen").isVisible()).toBe(true);
    await player.page.locator(".race-screen").waitFor({state: "detached", timeout: 7_000});
    /** A subsequent race starts normally instead of inheriting an unknown active run. */
    await player.page.getByRole("button", {name: /^multiplayer$/i}).click();
    await player.page.getByRole("button", {name: /^History /}).click();
    await player.page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});
    await player.context.close();
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
    /** Hint control stays usable after each confirmed reveal. */
    const hintButton = page.locator(".race-actions").getByRole("button", {name: /^hint/i});
    await page.waitForFunction(() => {
      /** Current multiplayer hint control. */
      const button = document.querySelector<HTMLButtonElement>(".race-actions button:first-child");
      return button?.disabled === false;
    });
    expect(await hintButton.isEnabled()).toBe(true);
    await hintButton.click();
    await page.waitForFunction(() => document.querySelectorAll(".race-gameplay .guess-row .cell.green").length === 2);
    expect(await page.locator(".race-header-clock small").innerText()).toMatch(/0:30\./);
    await page.waitForFunction(() => {
      /** Current multiplayer hint control after the second reveal. */
      const button = document.querySelector<HTMLButtonElement>(".race-actions button:first-child");
      return button?.disabled === false;
    });
    expect(await hintButton.isEnabled()).toBe(true);

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
