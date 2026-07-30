import {afterAll, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type BrowserContext, type Page} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
const baseUrl = "http://127.0.0.1:4179";

type AuthHarnessState = {
  scenario: string;
  calls: string[];
  backendExchanges: string[];
  firebaseTokens: string[];
  overlayOptions: Array<{theme?: string; source?: string}>;
  playerDataReads: number;
  preferenceWrites: Array<Record<string, unknown>>;
  profileReads: number;
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
    };
    const once = (key: string) => {
      const storageKey = `riddleQuest:jestAuthHarness:${key}`;
      if (sessionStorage.getItem(storageKey) === "1") return false;
      sessionStorage.setItem(storageKey, "1");
      return true;
    };
    const params = new URLSearchParams(location.search);
    const player = {
      playerId: "jest-auth-player-stable",
      registered:
        params.get("registered") === "1" ||
        localStorage.getItem("riddleQuest:jestAuthHarness:registered") === "1",
    };
    const preferences: Record<string, unknown> = {};
    let overlayClosed = false;
    const sdk = {
      init: async () => {
        state.calls.push("sdk.init");
        if (
          selectedScenario === "init-failure" ||
          (selectedScenario === "init-once-failure" && once("initFailed"))
        ) {
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
        entryPayload?: {source?: string};
        onClose: () => void;
      }) => {
        state.calls.push("sdk.showRegistrationOverlay");
        state.overlayOptions.push({
          theme: options.theme,
          source: options.entryPayload?.source,
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
      getEntryPayload: () => ({}),
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
        scheduleNotification: async () => {},
        unscheduleNotification: async () => {},
      },
      referrals: {
        listReferrals: async () => ({referralsSigned: "signed-referrals"}),
        shareReferralLink: async () => ({canceled: false}),
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
  page.evaluate(() =>
    (window as typeof window & {
      __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
    }).__RIDDLE_QUEST_JEST_AUTH_TEST__,
  );

const openHarness = async (
  browser: Browser,
  options: {registered?: boolean; scenario?: string} = {},
) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await context.newPage();
  await page.route("https://cdn.jest.com/**", (route) => route.abort());
  await installJestSdkHarness(page, options.scenario);
  const query = new URLSearchParams({harness: "jest-auth"});
  if (options.registered) query.set("registered", "1");
  await page.goto(`${baseUrl}/?${query}`);
  return {context, page};
};

const advanceToRegistration = async (page: Page) => {
  await page.getByRole("button", {name: /let's play/i}).click();
  await page.getByRole("button", {name: /got it/i}).click();
  await page.getByRole("heading", {name: /playing as a guest/i}).waitFor();
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
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => error ? reject(error) : resolve()),
    );
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
    await context.close();
  });

  it("prompts only after instructions and dismisses without treating the guest as registered", async () => {
    const {context, page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    await page.getByRole("button", {name: /let's play/i}).click();
    expect((await getHarnessState(page)).overlayOptions).toEqual([]);
    await page.getByRole("button", {name: /got it/i}).click();
    await page.getByRole("heading", {name: /playing as a guest/i}).waitFor();
    expect((await getHarnessState(page)).overlayOptions).toEqual([
      {theme: "dark", source: "post_instructions"},
    ]);
    await page.getByRole("button", {name: /^ok$/i}).click();
    await page.getByRole("heading", {name: /playing as a guest/i}).waitFor({state: "detached"});
    const state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.registration.closeButtonAction");
    expect(state.backendExchanges).toHaveLength(1);
    expect(state.preferenceWrites.some((value) =>
      typeof value.registrationPromptDismissedAt === "number",
    )).toBe(true);
    await context.close();
  });

  it("registers with a stable player id, re-signs identity, refreshes profile, and survives reload", async () => {
    const {context, page} = await openHarness(browser);
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /upgrade account/i}).click();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    let state = await getHarnessState(page);
    expect(state.calls).toContain("sdk.registration.loginButtonAction");
    expect(state.backendExchanges).toEqual([
      "signed:jest-auth-player-stable:false",
      "signed:jest-auth-player-stable:true",
    ]);
    expect(state.firebaseTokens).toEqual(["mock", "mock"]);
    expect(state.profileReads).toBe(1);

    await page.reload();
    await page.getByText(/what has keys/i).waitFor({timeout: 15_000});
    state = await getHarnessState(page);
    expect(state.backendExchanges).toEqual(["signed:jest-auth-player-stable:true"]);
    expect(state.profileReads).toBe(1);
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

  it("falls back to SDK login when the custom registration overlay cannot open", async () => {
    const {context, page} = await openHarness(browser, {scenario: "overlay-failure"});
    await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15_000});
    await advanceToRegistration(page);
    await page.getByRole("button", {name: /upgrade account/i}).click();
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
    await page.getByRole("button", {name: /upgrade account/i}).click();
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
