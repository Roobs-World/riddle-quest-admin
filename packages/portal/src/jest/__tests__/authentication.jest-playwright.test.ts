import {afterAll, afterEach, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type Page} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";

import {
  advanceToRegistration,
  enterRegisteredGame,
  openProfileAfterGuidance,
  solveFakeRace,
} from "./authentication.jest-playwright.support";
import {PLAYER_NOTIFICATION_IDS} from "../notifications/engagement";

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
const baseUrl = "http://127.0.0.1:4179";
const sharedRaceChallenges = new Map<string, string>();

type AuthHarnessState = {
  scenario: string;
  calls: string[];
  backendExchanges: string[];
  backendDeletionRetries: string[];
  firebaseTokens: string[];
  loginPayloads: Array<Record<string, string>>;
  overlayOptions: Array<{
    theme?: string;
    source?: string;
    campaign?: string;
    reference?: string;
    acquisitionReference?: string;
    inviteKind?: string;
    inviterName?: string;
    customName?: string;
  }>;
  playerDataReads: number;
  preferenceWrites: Array<Record<string, unknown>>;
  profileReads: number;
  notificationSchedules: Array<{
    identifier?: string;
    scheduledInDays?: number;
    priority?: string;
    body?: string;
    ctaText?: string;
    entryPayload?: Record<string, string>;
  }>;
  notificationRemovals: string[];
  referralShares: Array<{
    reference?: string;
    shareTitle?: string;
    shareText?: string;
    shareImage?: string;
    onboardingSlug?: string;
    entryPayload?: Record<string, string>;
  }>;
};

const installJestSdkHarness = async (page: Page, scenario = "success") => {
  await page.addInitScript((selectedScenario) => {
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
    const once = (key: string) => {
      const storageKey = `riddleQuest:jestAuthHarness:${key}`;
      if (sessionStorage.getItem(storageKey) === "1") return false;
      sessionStorage.setItem(storageKey, "1");
      return true;
    };
    const params = new URLSearchParams(location.search);
    const player = {
      playerId: params.get("playerId") ?? "jest-auth-player-stable",
      registered:
        params.get("registered") === "1" || localStorage.getItem("riddleQuest:jestAuthHarness:registered") === "1",
    };
    const preferences: Record<string, unknown> = {};
    let overlayClosed = false;
    let subscriptionActive = false;
    const sdk = {
      init: async () => {
        state.calls.push("sdk.init");
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
      login: async (options?: {entryPayload?: Record<string, string>}) => {
        state.calls.push("sdk.login");
        state.loginPayloads.push(structuredClone(options?.entryPayload ?? {}));
        if (selectedScenario === "overlay-login-failure") {
          throw new Error("Mock Jest login failed");
        }
        player.registered = true;
        localStorage.setItem("riddleQuest:jestAuthHarness:registered", "1");
      },
      showRegistrationOverlay: (options: {
        theme?: string;
        entryPayload?: {
          source?: string;
          campaign?: string;
          reference?: string;
          acquisition_reference?: string;
          inviteKind?: string;
          inviterName?: string;
          customName?: string;
        };
        onClose: () => void;
      }) => {
        state.calls.push("sdk.showRegistrationOverlay");
        state.overlayOptions.push({
          theme: options.theme,
          source: options.entryPayload?.source,
          campaign: options.entryPayload?.campaign,
          reference: options.entryPayload?.reference,
          ...(options.entryPayload?.acquisition_reference
            ? {acquisitionReference: options.entryPayload.acquisition_reference}
            : {}),
          ...(options.entryPayload?.inviteKind ? {inviteKind: options.entryPayload.inviteKind} : {}),
          ...(options.entryPayload?.inviterName ? {inviterName: options.entryPayload.inviterName} : {}),
          customName: options.entryPayload?.customName,
        });
        if (selectedScenario === "overlay-failure" || selectedScenario === "overlay-login-failure") {
          throw new Error("Mock registration overlay failed");
        }
        overlayClosed = false;
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
          const update =
            args.length === 2 && typeof args[0] === "string"
              ? {[String(args[0])]: args[1]}
              : (args[0] as Record<string, unknown>);
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
        unscheduleNotification: async ({identifier}: {identifier: string}) => {
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
        getIncompletePurchases: async () => ({
          purchases: [],
          purchasesSigned: "signed-purchases",
          hasMore: false,
        }),
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
        beginSubscription: async ({subscriptionSku}: {subscriptionSku: string}) => {
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
      markFirstMilestone: async () => {},
      setLoadingProgress: (progress: number) => state.calls.push(`sdk.progress:${progress}`),
      markGameLoaded: () => state.calls.push("sdk.markGameLoaded"),
    };
    Object.assign(window, {
      JestSDK: sdk,
      __RIDDLE_QUEST_JEST_AUTH_TEST__: state,
    });
  }, scenario);
};

const getHarnessState = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as typeof window & {
          __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
        }
      ).__RIDDLE_QUEST_JEST_AUTH_TEST__,
  );

const openHarness = async (
  browser: Browser,
  options: {
    registered?: boolean;
    scenario?: string;
    customName?: string;
    inviteKind?: string;
    campaign?: string;
    reference?: string;
    inviterName?: string;
    gameMode?: string;
    riddleId?: string;
    challengeId?: string;
    challengeDestination?: string;
    harness?: "jest-auth" | "race-auth";
    playerId?: string;
    sharedRace?: boolean;
    raceStartDelayMs?: number;
    raceOutcomeDelayMs?: number;
  } = {},
) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await context.newPage();
  await page.route("https://cdn.jest.com/**", async (route) => {
    if (options.scenario === "sdk-request-delay") {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    await route.abort();
  });
  await installJestSdkHarness(page, options.scenario);
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
  const navigation = page.goto(`${baseUrl}/?${query}`);
  if (options.scenario === "sdk-request-delay") {
    await page.locator("#root > *").waitFor({timeout: 2_000});
  }
  await navigation;
  return {context, page};
};

describeBrowser("Jest authentication integration", () => {
  let browser: Browser;
  let server: Server;

  beforeAll(async () => {
    const packageRoot = path.resolve(__dirname, "../../..");
    if (process.env.PORTAL_USE_EXISTING_BUILD !== "1") {
      execFileSync("pnpm", ["--filter", "@qwordly/portal", "build:jest"], {
        cwd: path.resolve(packageRoot, "../.."),
        stdio: "inherit",
      });
    }
    const distDir = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.join(packageRoot, "dist-jest");
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
      const requestUrl = new URL(request.url ?? "/", baseUrl);
      const sharedRaceMatch = requestUrl.pathname.match(/^\/__race-harness\/challenges\/([^/]+)$/);
      if (sharedRaceMatch) {
        const challengeId = decodeURIComponent(sharedRaceMatch[1]);
        if (request.method === "PUT") {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          sharedRaceChallenges.set(challengeId, Buffer.concat(chunks).toString("utf8"));
          response.writeHead(204).end();
          return;
        }
        const challenge = sharedRaceChallenges.get(challengeId);
        response.writeHead(challenge ? 200 : 404, {"Content-Type": "application/json; charset=utf-8"});
        response.end(challenge ?? JSON.stringify({error: "not_found"}));
        return;
      }
      const candidate = path.join(distDir, requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname);
      const filePath = path.extname(candidate) ? candidate : path.join(distDir, "index.html");
      try {
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
    await new Promise<void>((resolve) => server.listen(4179, "127.0.0.1", resolve));
    browser = await chromium.launch({headless: true, args: ["--renderer-process-limit=4"]});
  });

  afterEach(async () => Promise.all(browser?.contexts().map((context) => context.close().catch(() => undefined)) ?? []));

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
  });

  it("starts a guest through signed identity exchange and reads stable-player progress", async () => {
    const {context, page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.init");
    expect(state.calls).toContain("sdk.getPlayerSigned");
    expect(state.calls.indexOf("sdk.init")).toBeLessThan(state.calls.indexOf("sdk.getPlayerSigned"));
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:false"]);
    expect(state.firebaseTokens).toEqual(["mock"]);
    expect(state.profileReads).toBe(0);
    expect(state.calls).not.toContain("sdk.social.getProfile");
    expect(state.calls.filter((call) => call === "sdk.data.getAll")).toHaveLength(2);
    expect(state.notificationSchedules).toEqual([]);
    await context.close();
  });

  it("renders startup while the external Jest SDK request is still pending", async () => {
    const {context, page} = await openHarness(browser, {scenario: "sdk-request-delay"});
    expect(await page.locator("#root > *").count()).toBe(1);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await context.close();
  });

  it("keeps play interactive while the product catalog loads in the background", async () => {
    const {context, page} = await openHarness(browser, {scenario: "background-catalog-delay"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.markGameLoaded");
    expect(state.calls).toContain("sdk.payments.getProducts:start");
    expect(state.calls).not.toContain("sdk.payments.getProducts:end");
    await page.locator(".game-app:not([inert])").waitFor({timeout: 2_000});
    expect(await page.getByTestId("server-activity-loader").count()).toBe(0);
    await context.close();
  });

  it("prompts only after instructions and dismisses without treating the guest as registered", async () => {
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
        source: "post_instructions",
        campaign: "jest_onboarding",
        reference: "registration_post_instructions_v1",
        customName: "Nova",
      },
    ]);
    await page.getByRole("button", {name: /play as guest/i}).click();
    await page.getByText("Keep your progress", {exact: true}).waitFor({state: "detached"});
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.registration.closeButtonAction");
    expect(state.backendExchanges).toHaveLength(1);
    expect(state.preferenceWrites.some((value) => typeof value.registrationPromptDismissedAt === "number")).toBe(true);
    await context.close();
  });

  it("registers with a stable player id, re-signs identity, refreshes profile, and survives reload", async () => {
    const {context, page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.evaluate(() => {
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
    await page.waitForFunction(() => (
      window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState}
    ).__RIDDLE_QUEST_JEST_AUTH_TEST__.backendExchanges.length === 2);
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
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.notificationSchedules.length === 7,
    );
    expect((await getHarnessState(page)).notificationSchedules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        identifier: "riddle-quest-d1-v3",
        scheduledInDays: 1,
        priority: "medium",
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
    ]));
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
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 1,
    );
    const [share] = (await getHarnessState(page)).referralShares;
    expect(share).toEqual(
      expect.objectContaining({
        reference: expect.stringMatching(
          /^riddle_quest_friend_challenge_v2_result_[0-9a-f]{16}$/,
        ),
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
      () => (window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState})
        .__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 2,
    );
    const secondResultShare = (await getHarnessState(page)).referralShares[1];
    expect(secondResultShare.reference).toMatch(
      /^riddle_quest_friend_challenge_v2_result_[0-9a-f]{16}$/,
    );
    expect(secondResultShare.reference).not.toBe(share.reference);
    expect(secondResultShare.entryPayload).toEqual(expect.objectContaining({riddleId: "classic-riddle-2"}));

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("riddle-quest:share-invite")));
    await page.waitForFunction(
      () => (window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState})
        .__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 3,
    );
    const genericInvite = (await getHarnessState(page)).referralShares[2];
    expect(genericInvite).toEqual(expect.objectContaining({
      reference: "riddle_quest_friend_challenge_v2",
      onboardingSlug: "friend-challenge",
      entryPayload: expect.objectContaining({
        inviteKind: "open",
        campaign: "open_invite_v1",
        reference: "profile_invite_v1",
      }),
    }));
    expect(genericInvite.shareText).toContain("both earn 100 coins");

    await page.reload();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    state = await getHarnessState(page);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(state.profileReads).toBe(1);
    await context.close();
  });

  it("runs the complete profile invite, attributed registration, and inviter reward journey", async () => {
    const creator = await openHarness(browser, {
      registered: true,
      playerId: "viral-creator",
    });
    await enterRegisteredGame(creator.page);
    await openProfileAfterGuidance(creator.page);
    const inviteButton = creator.page.getByRole("button", {name: /invite a friend/i});
    await inviteButton.waitFor({state: "visible"});
    await inviteButton.click();
    await creator.page.waitForFunction(
      () => (window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState})
        .__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 1,
    );
    const [share] = (await getHarnessState(creator.page)).referralShares;
    expect(share).toEqual(expect.objectContaining({
      reference: "riddle_quest_friend_challenge_v2",
      onboardingSlug: "friend-challenge",
      entryPayload: expect.objectContaining({
        campaign: "open_invite_v1",
        reference: "profile_invite_v1",
        inviteKind: "open",
        inviterName: "Authenticated Solver",
      }),
    }));

    const entryPayload = share.entryPayload!;
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
    expect((await getHarnessState(recipient.page)).overlayOptions).toContainEqual(expect.objectContaining({
      source: "post_instructions",
      campaign: "open_invite_v1",
      reference: "registration_post_instructions_v1",
      acquisitionReference: "profile_invite_v1",
      inviteKind: "open",
      inviterName: "Authenticated Solver",
    }));
    await recipient.page.getByRole("button", {name: /^register$/i}).click();
    await recipient.page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    await recipient.page.waitForFunction(() => (
      window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState}
    ).__RIDDLE_QUEST_JEST_AUTH_TEST__.backendExchanges.length === 2);
    expect((await getHarnessState(recipient.page)).backendExchanges).toEqual([
      "signed:viral-recipient:false",
      "signed:viral-recipient:true",
    ]);

    const rewardedCreator = await openHarness(browser, {
      registered: true,
      scenario: "referral-reward",
      playerId: "viral-creator",
    });
    await rewardedCreator.page.getByRole("heading", {name: /a friend joined/i}).waitFor({timeout: 15_000});
    expect(await rewardedCreator.page.locator(".game-modal").innerText()).toContain("+100");

    await Promise.all([
      creator.context.close(),
      recipient.context.close(),
      rewardedCreator.context.close(),
    ]);
  });

  it("logs an existing Jest player in from the onboarding choice", async () => {
    const {context, page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^log in$/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    await page.waitForFunction(() => (
      window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState}
    ).__RIDDLE_QUEST_JEST_AUTH_TEST__.backendExchanges.length === 2);
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.login");
    expect(state.calls).toContain("sdk.registration.closeButtonAction");
    expect(state.calls).not.toContain("sdk.registration.loginButtonAction");
    expect(state.backendExchanges.at(-1)).toBe("signed:jest-auth-player-stable:true");
    await context.close();
  });

  it("skips the registration step for an already registered Jest player and restores platform data", async () => {
    const {context, page} = await openHarness(browser, {registered: true});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await page.getByRole("button", {name: /let's play/i}).click();
    await page.getByRole("button", {name: /got it/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    const state = await getHarnessState(page);
    expect(state.overlayOptions).toEqual([]);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(state.profileReads).toBe(1);
    expect(state.calls.filter((call) => call === "sdk.data.getAll").length).toBeGreaterThan(1);
    await context.close();
  });

  it("surfaces a server-authoritative referral reward in the game", async () => {
    const {context, page} = await openHarness(browser, {registered: true, scenario: "referral-reward"});
    await page.getByRole("heading", {name: /a friend joined/i}).waitFor({timeout: 15_000});
    expect(await page.locator(".game-modal").innerText()).toContain("+100");
    await context.close();
  });

  it("shares a race challenge and schedules its attributed registered-player reminder", async () => {
    const {context, page} = await openHarness(browser, {registered: true});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await page.evaluate(() => {
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
      const state = (window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState})
        .__RIDDLE_QUEST_JEST_AUTH_TEST__;
      return (
        state.notificationSchedules.some((item) => item.identifier === "race_to_10_results_v1") &&
        state.referralShares.some((item) =>
          /^riddle_quest_race_to_10_v1_share_[0-9a-f]{16}$/.test(item.reference ?? ""),
        )
      );
    });
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
    const firstRaceShare = state.referralShares.find(
      (item) => item.entryPayload?.challengeId === "race-challenge-42",
    )!;
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("riddle-quest:share-race", {
        detail: {
          challengeId: "race-challenge-43",
          preview: {categoryId: "science", adjustedTimeToBeatMs: 55_000},
        },
      }));
    });
    await page.waitForFunction(
      () => (window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState})
        .__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 2,
    );
    state = await getHarnessState(page);
    const secondRaceShare = state.referralShares.find(
      (item) => item.entryPayload?.challengeId === "race-challenge-43",
    )!;
    expect(secondRaceShare.reference).toMatch(/^riddle_quest_race_to_10_v1_share_[0-9a-f]{16}$/);
    expect(secondRaceShare.reference).not.toBe(firstRaceShare.reference);
    await context.close();
  });

  it("opens the authoritative race results inbox from a messaging deep link", async () => {
    const {context, page} = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-results-player",
      challengeDestination: "inbox",
    });

    await page.getByRole("heading", {name: /challenge results/i}).waitFor({timeout: 15_000});
    expect(await page.getByText("Nova", {exact: true}).isVisible()).toBe(true);
    expect(await page.getByText(/time difference: 0:03\.5/i).isVisible()).toBe(true);
    const state = await getHarnessState(page);
    expect(state.notificationRemovals).toContain("race_to_10_results_v1");
    expect(state.calls).toContain("sdk.notifications.unscheduleNotification");
    await page.getByRole("button", {name: /^rematch$/i}).click();
    await page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});
    await context.close();
  });

  it("runs a creator-to-recipient race across isolated browser contexts", async () => {
    sharedRaceChallenges.clear();
    const creator = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-creator",
      sharedRace: true,
      raceStartDelayMs: 2_500,
      raceOutcomeDelayMs: 500,
    });
    await enterRegisteredGame(creator.page);
    const multiplayerButton = creator.page.getByRole("button", {name: /^multiplayer$/i});
    await multiplayerButton.waitFor({timeout: 5_000});
    expect(await creator.page.locator(".race-mode-launcher").count()).toBe(0);
    const actionLabels = await creator.page.locator(".game-input-actions > button").allInnerTexts();
    expect(actionLabels).toEqual(["Hint", "SUBMIT", "Skip"]);
    const navigationLabels = await creator.page.locator(".game-bottom-navigation > button").evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
    expect(navigationLabels).toEqual(["Settings", "Multiplayer", "Profile"]);
    await creator.page.setViewportSize({width: 390, height: 667});
    await multiplayerButton.click();
    await creator.page.getByRole("button", {name: /^History /}).waitFor();
    expect(await creator.page.locator('[data-testid="server-activity-loader"]').count()).toBe(0);
    await creator.page.evaluate(() => {
      const timingWindow = window as typeof window & {
        __RIDDLE_QUEST_RACE_START_TIMING__?: {goAt?: number; gameplayAt?: number};
      };
      const timing = {} as {goAt?: number; gameplayAt?: number};
      timingWindow.__RIDDLE_QUEST_RACE_START_TIMING__ = timing;
      const observer = new MutationObserver(() => {
        if (
          timing.goAt === undefined &&
          document.querySelector(".race-countdown > span")?.textContent?.trim() === "GO!"
        ) {
          timing.goAt = performance.now();
        }
        if (timing.goAt !== undefined && document.querySelector(".race-gameplay")) {
          timing.gameplayAt = performance.now();
          observer.disconnect();
        }
      });
      observer.observe(document.body, {subtree: true, childList: true, characterData: true});
    });
    await creator.page.getByRole("button", {name: /^History /}).click();
    const countdownRail = creator.page.locator(".race-countdown-rail");
    await countdownRail.waitFor();
    await creator.page.waitForTimeout(1_200);
    expect(await creator.page.locator(".race-countdown > span").innerText()).toBe("3");
    expect(await creator.page.locator(".race-countdown > p").innerText()).toMatch(/loading/i);
    expect(await creator.page.locator(".race-topbar").count()).toBe(0);
    expect(await countdownRail.getByText(/recorded head-to-head/i).isVisible()).toBe(true);
    expect(await countdownRail.locator(".race-coin-balance").isVisible()).toBe(true);
    expect(await countdownRail.getByRole("button", {name: /close race to 10/i}).isVisible()).toBe(true);
    const countdownCenterOffset = await creator.page.locator(".race-countdown > span").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - innerWidth / 2);
    });
    expect(countdownCenterOffset).toBeLessThanOrEqual(0.5);
    await creator.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    const raceStartTiming = await creator.page.evaluate(
      () =>
        (
          window as typeof window & {
            __RIDDLE_QUEST_RACE_START_TIMING__?: {goAt?: number; gameplayAt?: number};
          }
        ).__RIDDLE_QUEST_RACE_START_TIMING__,
    );
    expect(raceStartTiming?.goAt).toBeDefined();
    expect(raceStartTiming?.gameplayAt).toBeDefined();
    expect((raceStartTiming?.gameplayAt ?? Infinity) - (raceStartTiming?.goAt ?? 0)).toBeLessThan(600);
    const getMultiplayerLayout = () => creator.page.locator(".race-gameplay").evaluate((gameplay) => {
      const rail = gameplay.querySelector(".race-scoreboard")?.getBoundingClientRect();
      const riddle = gameplay.querySelector(".race-riddle-surface")?.getBoundingClientRect();
      const status = gameplay.querySelector(".race-rail-status")?.getBoundingClientRect();
      return {
        statusInRail: Boolean(gameplay.querySelector(".race-scoreboard .race-rail-status")),
        statusInGameInfo: Boolean(gameplay.querySelector(".race-rail-game-info > .race-rail-status")),
        statusInRiddle: Boolean(gameplay.querySelector(".race-riddle-surface .race-rail-status")),
        statusIsRightOfRiddle: Boolean(status && riddle && status.left >= riddle.right),
        railIsRightOfRiddle: Boolean(rail && riddle && rail.left >= riddle.right),
      };
    });
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
    await creator.page.waitForFunction(() =>
      Boolean(document.querySelector(".race-gameplay-viewport")?.getAttribute("data-viewport-scale")),
    );
    await creator.page.waitForFunction(() => {
      const screen = document.querySelector(".race-screen");
      return Boolean(screen && screen.scrollHeight <= screen.clientHeight + 1);
    });
    await solveFakeRace(creator.page, {expectChainedSubmitLoader: true});
    await creator.page.getByRole("button", {name: /create challenge/i}).click();
    await creator.page.getByRole("button", {name: /challenge a friend/i}).waitFor({timeout: 10_000});
    expect(sharedRaceChallenges.has("fake-challenge-2")).toBe(true);

    const recipient = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-recipient",
      challengeId: "fake-challenge-2",
      inviteKind: "race",
      campaign: "race_to_10_v1",
      sharedRace: true,
    });
    await recipient.page
      .locator('[data-testid="server-activity-loader"]')
      .waitFor({state: "detached", timeout: 15_000});
    await recipient.page.getByRole("heading", {name: /Guest Solver challenged you/i}).waitFor({timeout: 10_000});
    await recipient.page.getByRole("button", {name: /accept challenge/i}).click();
    await recipient.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    const opponentProgress = recipient.page.locator(".race-progress > div").nth(1);
    await opponentProgress.getByText("10/10", {exact: true}).waitFor({timeout: 10_000});
    await solveFakeRace(recipient.page);
    expect(await recipient.page.locator(".race-result-grid").innerText()).toContain("Adjusted time");
    expect(await recipient.page.locator(".race-result h2").innerText()).toMatch(/You win|Opponent wins|tie/i);

    await Promise.all([creator.context.close(), recipient.context.close()]);
  });

  it("confirms quitting an active race and abandons it with no result", async () => {
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
    const serverSelectedHint = page.locator(".race-gameplay .guess-row .cell.green").first();
    await serverSelectedHint.waitFor({state: "visible", timeout: 5_000});
    expect((await serverSelectedHint.innerText()).trim()).not.toBe("");
    expect(await page.locator(".race-header-clock small").innerText()).toContain("0:15.0");

    await page.getByRole("button", {name: /close race to 10/i}).click();
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
    const {context, page} = await openHarness(browser, {scenario: "overlay-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^register$/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    await page.waitForFunction(() => (
      window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState}
    ).__RIDDLE_QUEST_JEST_AUTH_TEST__.backendExchanges.length === 2);
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
    const {context, page} = await openHarness(browser, {scenario: "overlay-login-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^register$/i}).click();

    await page.getByRole("alert").filter({hasText: /check your internet connection and try again/i}).waitFor();
    const registerButton = page.getByRole("button", {name: /^register$/i});
    await registerButton.waitFor();
    await expect(registerButton.isEnabled()).resolves.toBe(true);

    let state = await getHarnessState(page);
    expect(state.calls.filter((call) => call === "sdk.login")).toHaveLength(1);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:false"]);
    expect(
      state.preferenceWrites.some((value) => typeof value.registrationPromptDismissedAt === "number"),
    ).toBe(false);

    await registerButton.click();
    await page.waitForFunction(
      () => (window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState})
        .__RIDDLE_QUEST_JEST_AUTH_TEST__.calls.filter((call) => call === "sdk.login").length === 2,
    );
    state = await getHarnessState(page);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:false"]);
    expect(
      state.preferenceWrites.some((value) => typeof value.registrationPromptDismissedAt === "number"),
    ).toBe(false);
    expect(await page.getByRole("button", {name: /^register$/i}).isVisible()).toBe(true);
    await context.close();
  });

  it("retains a retryable registration prompt when the overlay login action fails", async () => {
    const {context, page} = await openHarness(browser, {scenario: "overlay-action-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    const registerButton = page.getByRole("button", {name: /^register$/i});
    await registerButton.click();

    await page.getByRole("alert").filter({hasText: /check your internet connection and try again/i}).waitFor();
    await expect(registerButton.isEnabled()).resolves.toBe(true);
    const state = await getHarnessState(page);
    expect(state.calls.filter((call) => call === "sdk.registration.loginButtonAction")).toHaveLength(1);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:false"]);
    expect(
      state.preferenceWrites.some((value) => typeof value.registrationPromptDismissedAt === "number"),
    ).toBe(false);
    await context.close();
  });

  it("handles duplicate registration close callbacks idempotently", async () => {
    const {context, page} = await openHarness(browser, {scenario: "duplicate-close"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^register$/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    await page.waitForFunction(() => (
      window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState}
    ).__RIDDLE_QUEST_JEST_AUTH_TEST__.backendExchanges.length === 2);
    const state = await getHarnessState(page);
    expect(state.backendExchanges).toHaveLength(2);
    expect(state.calls.filter((call) => call === "sdk.social.getProfile")).toHaveLength(1);
    await context.close();
  });

  it("shows a retryable terminal screen when registered identity synchronization fails", async () => {
    const {context, page} = await openHarness(browser, {scenario: "registration-identity-once-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.evaluate(() => {
      const testWindow = window as typeof window & {__REGISTRATION_CLOSED__?: boolean[]};
      testWindow.__REGISTRATION_CLOSED__ = [];
      window.addEventListener("riddle-quest:registration-prompt-closed", (event) => {
        testWindow.__REGISTRATION_CLOSED__?.push(
          Boolean((event as CustomEvent<{registered?: boolean}>).detail?.registered),
        );
      });
    });
    await page.getByRole("button", {name: /^register$/i}).click();
    await page.getByRole("heading", {name: /startup failed/i}).waitFor({timeout: 15_000});
    expect(await page.getByText(/unexpected error occurred/i).isVisible()).toBe(true);
    expect(await page.evaluate(() => (
      window as typeof window & {__REGISTRATION_CLOSED__?: boolean[]}
    ).__REGISTRATION_CLOSED__)).toEqual([false]);
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
    const {context, page} = await openHarness(browser, {scenario: "registration-account-deleted"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^register$/i}).click();

    await page.getByRole("heading", {name: /account deleted/i}).waitFor({timeout: 15_000});
    const state = await getHarnessState(page);
    expect(state.backendExchanges).toHaveLength(2);
    expect(state.backendDeletionRetries).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(state.firebaseTokens).toEqual(["mock"]);
    expect(await page.locator(".game-app").count()).toBe(0);
    await context.close();
  });

  it("replaces play with a restartable terminal screen after account deletion", async () => {
    const {context, page} = await openHarness(browser, {registered: true});
    await enterRegisteredGame(page);
    await openProfileAfterGuidance(page);
    await page.getByRole("button", {name: /^delete account$/i}).click();
    const confirmation = page.getByRole("alertdialog", {name: /delete account/i});
    await confirmation.getByRole("button", {name: /^delete account$/i}).click();

    await page.getByRole("heading", {name: /account deleted/i}).waitFor({timeout: 15_000});
    expect(await page.getByText("Your account has been deleted.", {exact: true}).isVisible()).toBe(true);
    expect(await page.getByRole("button", {name: /^play$/i}).isVisible()).toBe(true);
    const state = await getHarnessState(page);
    expect(state.notificationRemovals).toEqual(expect.arrayContaining([...PLAYER_NOTIFICATION_IDS]));
    expect(state.calls).toContain("sdk.data.delete:riddleQuestPlayerState");
    expect(await page.locator(".game-app").count()).toBe(0);
    await context.close();
  });

  it.each([
    ["SDK initialization", "init-failure", /sdk initialization failed/i],
    ["signed player", "signed-player-failure", /signed player request failed/i],
    ["identity exchange", "identity-failure", /identity exchange failed/i],
  ])("shows a retryable startup screen for %s failures", async (_name, scenario, message) => {
    const {context, page} = await openHarness(browser, {
      scenario,
    });
    await page.getByRole("heading", {name: /startup failed/i}).waitFor({timeout: 15_000});
    expect(await page.getByText(message).isVisible()).toBe(true);
    expect(await page.getByRole("button", {name: /retry/i}).isVisible()).toBe(true);
    await context.close();
  });

  it("keeps registered play available when the optional Jest social profile is unavailable", async () => {
    const {context, page} = await openHarness(browser, {registered: true, scenario: "profile-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    const state = await getHarnessState(page);
    expect(state.profileReads).toBe(1);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(await page.getByRole("heading", {name: /startup failed/i}).count()).toBe(0);
    await context.close();
  });

  it("recovers from a transient SDK initialization failure when Retry is pressed", async () => {
    const {context, page} = await openHarness(browser, {scenario: "init-once-failure"});
    await page.getByRole("heading", {name: /startup failed/i}).waitFor({timeout: 15_000});
    await page.getByRole("button", {name: /retry/i}).click();
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    expect((await getHarnessState(page)).backendExchanges).toHaveLength(1);
    await context.close();
  });
});

jest.setTimeout(180_000);
