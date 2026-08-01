import {afterAll, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type BrowserContext, type Page} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
const baseUrl = "http://127.0.0.1:4179";
const sharedRaceChallenges = new Map<string, string>();

type AuthHarnessState = {
  scenario: string;
  calls: string[];
  backendExchanges: string[];
  firebaseTokens: string[];
  overlayOptions: Array<{
    theme?: string;
    source?: string;
    campaign?: string;
    reference?: string;
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
      firebaseTokens: [],
      overlayOptions: [],
      playerDataReads: 0,
      preferenceWrites: [],
      profileReads: 0,
      notificationSchedules: [],
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
      login: async () => {
        state.calls.push("sdk.login");
        player.registered = true;
        localStorage.setItem("riddleQuest:jestAuthHarness:registered", "1");
      },
      showRegistrationOverlay: (options: {
        theme?: string;
        entryPayload?: {
          source?: string;
          campaign?: string;
          reference?: string;
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
          customName: options.entryPayload?.customName,
        });
        if (selectedScenario === "overlay-failure") {
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
        flush: async () => {
          state.calls.push("sdk.data.flush");
        },
      },
      getEntryPayload: () => ({
        ...(params.get("customName") ? {customName: params.get("customName"), campaign: "jest_onboarding"} : {}),
        ...(params.get("challengeId") ? {challengeId: params.get("challengeId")} : {}),
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
        unscheduleNotification: async () => {
          state.calls.push("sdk.notifications.unscheduleNotification");
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
        getProducts: async () => [],
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
    challengeId?: string;
    harness?: "jest-auth" | "race-auth";
    playerId?: string;
    sharedRace?: boolean;
  } = {},
) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await context.newPage();
  await page.route("https://cdn.jest.com/**", (route) => route.abort());
  await installJestSdkHarness(page, options.scenario);
  const query = new URLSearchParams({harness: options.harness ?? "jest-auth"});
  if (options.registered) query.set("registered", "1");
  if (options.customName) query.set("customName", options.customName);
  if (options.challengeId) query.set("challengeId", options.challengeId);
  if (options.playerId) query.set("playerId", options.playerId);
  if (options.sharedRace) query.set("sharedRace", "1");
  await page.goto(`${baseUrl}/?${query}`);
  return {context, page};
};

const advanceToRegistration = async (page: Page) => {
  await page.getByRole("button", {name: /let's play/i}).click();
  await page.getByRole("button", {name: /got it/i}).click();
  await page.getByText("Keep your cosmic progress", {exact: true}).waitFor();
  expect(await page.locator(".onboarding-progress").textContent()).toBe("3/3");
  expect(await page.getByRole("button", {name: /^register$/i}).isVisible()).toBe(true);
  expect(await page.getByRole("button", {name: /^log in$/i}).isVisible()).toBe(true);
  expect(await page.getByRole("button", {name: /play as guest/i}).isVisible()).toBe(true);
};

const enterRegisteredGame = async (page: Page) => {
  await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
  await page.getByRole("button", {name: /let's play/i}).click();
  await page.getByRole("button", {name: /got it/i}).click();
  await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
  await page.waitForTimeout(500);
  for (let step = 0; step < 5; step += 1) {
    const tooltipButton = page.locator(".tooltip-backdrop").getByRole("button", {name: /got it/i});
    if ((await tooltipButton.count()) === 0 || !(await tooltipButton.isVisible())) break;
    await tooltipButton.click();
  }
  await page.locator(".tooltip-backdrop").waitFor({state: "detached", timeout: 5_000});
};

const solveFakeRace = async (page: Page) => {
  for (const answer of ["piano", "clock", "towel", "bottle", "stamp", "needle", "name", "comb", "water", "book"]) {
    const board = page.locator(".race-gameplay .guess-board");
    const heading = page.locator(".race-riddle-surface .riddle-card h2");
    const previousRiddle = await heading.innerText();
    await board.waitFor({state: "visible"});
    await page.waitForFunction(
      () => !document.querySelector<HTMLButtonElement>(".race-gameplay .keyboard .key")?.disabled,
    );
    await board.click();
    await page.keyboard.type(answer);
    const submit = page.locator(".race-actions .submit-action");
    await submit.waitFor({state: "visible"});
    try {
      await page.waitForFunction(
        () => {
          const button = document.querySelector<HTMLButtonElement>(".race-actions .submit-action");
          return button && !button.disabled;
        },
        undefined,
        {timeout: 5_000},
      );
    } catch {
      const state = await page.locator(".race-gameplay").evaluate((gameplay) => ({
        clue: gameplay.querySelector(".riddle-card h2")?.textContent,
        answer: Array.from(gameplay.querySelectorAll(".guess-row:last-child .cell"), (cell) => cell.textContent).join(""),
        activeElement: document.activeElement?.tagName,
        submitDisabled: (document.querySelector(".race-actions .submit-action") as HTMLButtonElement | null)?.disabled,
      }));
      throw new Error(`Race solver could not submit ${answer}: ${JSON.stringify(state)}`);
    }
    await submit.click({timeout: 5_000});
    if (answer !== "book") {
      await page.waitForFunction(
        (previous) => document.querySelector(".race-riddle-surface .riddle-card h2")?.textContent !== previous,
        previousRiddle,
      );
    }
  }
  await page.getByRole("heading", {name: /run recorded|you win|opponent wins|tie/i}).waitFor({timeout: 15_000});
};

describeBrowser("Jest authentication integration", () => {
  let browser: Browser;
  let server: Server;

  beforeAll(async () => {
    const packageRoot = path.resolve(__dirname, "../../..");
    execFileSync("pnpm", ["--filter", "@qwordly/portal", "build:jest"], {
      cwd: path.resolve(packageRoot, "../.."),
      stdio: "inherit",
    });
    const distDir = path.join(packageRoot, "dist-jest");
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
    browser = await chromium.launch({headless: true});
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
  });

  it("starts a guest through signed identity exchange without reading saved player progress", async () => {
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
    expect(state.calls.filter((call) => call === "sdk.data.getAll")).toHaveLength(1);
    expect(state.notificationSchedules).toEqual([]);
    await context.close();
  });

  it("prompts only after instructions and dismisses without treating the guest as registered", async () => {
    const {context, page} = await openHarness(browser, {customName: "Nova"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    await page.getByRole("button", {name: /let's play/i}).click();
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    await page.getByRole("button", {name: /got it/i}).click();
    await page.getByText("Keep your cosmic progress", {exact: true}).waitFor();
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
    await page.getByText("Keep your cosmic progress", {exact: true}).waitFor({state: "detached"});
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
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.notificationSchedules.length === 3,
    );
    expect((await getHarnessState(page)).notificationSchedules).toEqual([
      expect.objectContaining({
        identifier: "riddle-quest-d1-v2",
        scheduledInDays: 1,
        priority: "medium",
        ctaText: "Solve it",
        entryPayload: expect.objectContaining({
          gameMode: "challenge",
          reference: "notification_d1_v3",
          notification_template: "daily_reward_progress_v3",
          notification_offset: "D1",
          callback: "daily_coin_reward",
        }),
      }),
      expect.objectContaining({
        identifier: "riddle-quest-d3-v2",
        scheduledInDays: 3,
        priority: "high",
      }),
      expect.objectContaining({
        identifier: "riddle-quest-d7-v2",
        scheduledInDays: 7,
        priority: "high",
      }),
    ]);
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("riddle-quest:share-referral", {
          detail: {
            gameMode: "challenge",
            challengeId: "daily-riddle-1",
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
        reference: "riddle_quest_friend_challenge_v2",
        shareTitle: "Check out my Riddle Quest result!",
        onboardingSlug: "friend-challenge",
        entryPayload: expect.objectContaining({
          campaign: "friend_challenge_v2",
          reference: "victory_friend_challenge_v2",
          gameMode: "challenge",
          challengeId: "daily-riddle-1",
        }),
      }),
    );
    expect(share.shareText).toContain("2 attempts");
    expect(share.shareText).toContain("🟩🟩🟩🟩🟩");
    expect(share.shareImage).toMatch(/^data:image\/png;base64,/);

    await page.reload();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    state = await getHarnessState(page);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(state.profileReads).toBe(1);
    await context.close();
  });

  it("logs an existing Jest player in from the onboarding choice", async () => {
    const {context, page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^log in$/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
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
        state.notificationSchedules.some((item) => item.identifier === "race_to_10_return_v1") &&
        state.referralShares.some((item) => item.reference === "riddle_quest_race_to_10_v1")
      );
    });
    const state = await getHarnessState(page);
    expect(state.notificationSchedules).toContainEqual(
      expect.objectContaining({
        identifier: "race_to_10_return_v1",
        scheduledInDays: 1,
        entryPayload: expect.objectContaining({
          challengeId: "race-challenge-42",
          reference: "race_to_10_return_d1_v1",
        }),
      }),
    );
    expect(state.referralShares).toContainEqual(
      expect.objectContaining({
        reference: "riddle_quest_race_to_10_v1",
        onboardingSlug: "race-to-10",
        shareImage: expect.stringMatching(/^data:image\/png;base64,/),
        entryPayload: expect.objectContaining({
          challengeId: "race-challenge-42",
          campaign: "race_to_10_v1",
        }),
      }),
    );
    await context.close();
  });

  it("runs a creator-to-recipient race across isolated browser contexts", async () => {
    sharedRaceChallenges.clear();
    const creator = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-creator",
      sharedRace: true,
    });
    await enterRegisteredGame(creator.page);
    await creator.page.locator("button.race-mode-launcher").click({timeout: 5_000});
    await creator.page.getByRole("button", {name: /^History /}).click();
    await creator.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    await solveFakeRace(creator.page);
    await creator.page.getByRole("button", {name: /create challenge/i}).click();
    await creator.page.getByRole("button", {name: /challenge a friend/i}).waitFor({timeout: 10_000});
    expect(sharedRaceChallenges.has("fake-challenge-2")).toBe(true);

    const recipient = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-recipient",
      challengeId: "fake-challenge-2",
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
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.login");
    expect(state.backendExchanges.at(-1)).toBe("signed:jest-auth-player-stable:true");
    await context.close();
  });

  it("handles duplicate registration close callbacks idempotently", async () => {
    const {context, page} = await openHarness(browser, {scenario: "duplicate-close"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /^register$/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    const state = await getHarnessState(page);
    expect(state.backendExchanges).toHaveLength(2);
    expect(state.calls.filter((call) => call === "sdk.social.getProfile")).toHaveLength(1);
    await context.close();
  });

  it.each([
    ["SDK initialization", "init-failure", /sdk initialization failed/i],
    ["signed player", "signed-player-failure", /signed player request failed/i],
    ["identity exchange", "identity-failure", /identity exchange failed/i],
    ["registered profile", "profile-failure", /profile request failed/i],
  ])("shows a retryable startup screen for %s failures", async (_name, scenario, message) => {
    const {context, page} = await openHarness(browser, {
      registered: scenario === "profile-failure",
      scenario,
    });
    await page.getByRole("heading", {name: /could not start/i}).waitFor({timeout: 15_000});
    expect(await page.getByText(message).isVisible()).toBe(true);
    expect(await page.getByRole("button", {name: /retry/i}).isVisible()).toBe(true);
    await context.close();
  });

  it("recovers from a transient SDK initialization failure when Retry is pressed", async () => {
    const {context, page} = await openHarness(browser, {scenario: "init-once-failure"});
    await page.getByRole("heading", {name: /could not start/i}).waitFor({timeout: 15_000});
    await page.getByRole("button", {name: /retry/i}).click();
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    expect((await getHarnessState(page)).backendExchanges).toHaveLength(1);
    await context.close();
  });
});

jest.setTimeout(180_000);
