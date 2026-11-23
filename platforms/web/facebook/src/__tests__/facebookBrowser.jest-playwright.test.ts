import {verifyImmediateSoloFeedback} from "../../../../../src/web/play/__tests__/instantFeedback.jest-playwright.support";
import {verifyRewardedContinue} from "./rewardedContinue.jest-playwright.support";
import {verifyTournamentScoreRecovery} from "./tournamentRecovery.jest-playwright.support";
import {installRaceContextDialogs, verifyRaceContextDialogs} from "./raceDialogs.jest-playwright.support";
import {verifyContextChallenges} from "./contextChallenges.jest-playwright.support";
import {installTournamentPresentation, verifyTournamentPresentation, verifyTournamentEntry, verifyTournamentLiveResult} from "./tournaments.jest-playwright.support";
import {installLiveMultiplayerJourney} from "../../../../../src/web/play/__tests__/liveMultiplayer.jest-playwright.support";
import {describe, expect, it} from "@jest/globals";
import {expectWebStandards} from "../../../../../src/web/play/__tests__/webStandards.jest-playwright.support";
import {chromium} from "@playwright/test";
import type {PlayerData} from "../../../../../src/web/platform/types";

/** Documents global. */
declare global {
  /** Defines the contract for window. */
  interface Window {
    /** Stores facebook events. */
    __facebookEvents: string[];
    /** Stores facebook pause. */
    __facebookPause?: () => void;
    /** Stored callbacks from Meta's resume event registration. */
    __facebookResume?: () => void;
    /** Stores riddle quest browser test. */
    __RIDDLE_QUEST_BROWSER_TEST__?: boolean;
  }
}

/** Provides describe browser behavior. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
/** Defines the failure nonce value. */
const FAILURE_NONCE = "f".repeat(43);
/** Defines the success nonce value. */
const SUCCESS_NONCE = "s".repeat(43);

describeBrowser("Facebook artifact with injected FBInstant SDK", () => {
  it("runs failure recovery plus authenticated restore/pause/reload lifecycle", async () => {
    /** Provides {exec file sync} behavior. */
    const {execFileSync} = await import("node:child_process");
    /** Provides {create server} behavior. */
    const {createServer} = await import("node:http");
    /** Provides {mkdtemp, read file, rm} behavior. */
    const {mkdtemp, readFile, rm} = await import("node:fs/promises");
    /** Provides {tmpdir} behavior. */
    const {tmpdir} = await import("node:os");
    /** Provides path behavior. */
    const path = await import("node:path");
    /** Provides package root behavior. */
    const packageRoot = path.resolve(__dirname, "../../..");
    // This harness owns a separate explicit 13+ fixture so reusing other release
    // builds cannot silently disable the platform capabilities under test.
    /** Provides dist directory behavior. */
    const distDirectory = await mkdtemp(path.join(tmpdir(), "riddle-quest-facebook-browser-"));
    execFileSync("pnpm", ["--filter", "riddle-quest", "build:facebook"], {
      cwd: path.resolve(packageRoot, "../.."),
      env: {
        ...process.env,
        FACEBOOK_BUILD_OUT_DIR: distDirectory,
        VITE_FACEBOOK_AGE_CATEGORY: "13_plus",
      },
      stdio: "inherit",
    });
    /** Provides server behavior. */
    const server = createServer(async (request, response) => {
      /** Requests url. */
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      /** Requests ed. */
      const requested = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.replace(/^\//u, "");
      /** Provides file path behavior. */
      const filePath = path.resolve(distDirectory, requested);
      if (!filePath.startsWith(`${distDirectory}${path.sep}`) && filePath !== path.join(distDirectory, "index.html")) {
        response.writeHead(404).end();
        return;
      }
      try {
        /** Provides body behavior. */
        const body = await readFile(filePath);
        /** Provides extension behavior. */
        const extension = path.extname(filePath);
        response.writeHead(200, {
          "content-type":
            extension === ".html"
              ? "text/html"
              : extension === ".js"
                ? "text/javascript"
                : extension === ".css"
                  ? "text/css"
                  : extension === ".svg"
                    ? "image/svg+xml"
                  : "application/octet-stream",
        });
        response.end(body);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    /** This harness owns its ephemeral port independently of other platform verification. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Facebook browser fixture did not bind a TCP port");
    /** Both provider journeys use the same isolated build origin. */
    const origin = `http://127.0.0.1:${address.port}`;
    /** Provides browser behavior. */
    const browser = await chromium.launch({headless: true});
    try {
      /** Provides page behavior. */
      const page = await (await browser.newContext({viewport: {width: 390, height: 844}})).newPage();
      await page.route("https://connect.facebook.net/en_US/fbinstant.8.0.js", (route) =>
        route.fulfill({status: 200, contentType: "text/javascript", body: "/* injected by browser contract test */"}),
      );
      await page.route("**/issueFacebookIdentityNonce", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({nonce: FAILURE_NONCE, expiresAtMs: Date.now() + 60_000}),
        }),
      );
      await page.route("**/exchangeFacebookIdentity", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({error: "temporarily-unavailable"}),
        }),
      );
      await page.addInitScript(() => {
        window.__facebookEvents = [];
        window.FBInstant = {
          /** Provides initialize async behavior. */
          async initializeAsync() {
            window.__facebookEvents.push("initialize");
          },
          /** Sets loading progress. */
          setLoadingProgress(progress) {
            window.__facebookEvents.push(`progress:${progress}`);
          },
          /** Starts game async. */
          async startGameAsync() {
            window.__facebookEvents.push("start");
          },
          /** Gets supported ap is. */
          getSupportedAPIs() {
            return [];
          },
          /** Provides on pause behavior. */
          onPause(callback) {
            /** Previously registered provider callback retained by this fixture. */
            const previous = window.__facebookPause;
            window.__facebookPause = () => {previous?.(); callback();};
          },
          /** Registers the provider resume callback. */
          onResume(callback) {
            /** Previously registered provider callback retained by this fixture. */
            const previous = window.__facebookResume;
            window.__facebookResume = () => {previous?.(); callback();};
          },
          player: {
            /** Gets id. */
            getID() {
              window.__facebookEvents.push("player");
              return "facebook-browser-player";
            },
            /** Gets signed player info async. */
            async getSignedPlayerInfoAsync(nonce) {
              window.__facebookEvents.push(`signed:${nonce}`);
              return {getSignature: () => "signature.payload", getPlayerID: () => "facebook-browser-player"};
            },
            /** Gets data async. */
            async getDataAsync(keys) {
              window.__facebookEvents.push(`read:${keys.join(",")}`);
              return {};
            },
            /** Sets data async. */
            async setDataAsync() {
              window.__facebookEvents.push("write");
            },
            /** Provides flush data async behavior. */
            async flushDataAsync() {
              window.__facebookEvents.push("flush");
            },
          },
        };
      });
      await page.goto(origin);
      await page.getByRole("alert").getByRole("heading").waitFor({timeout: 15_000});
      await expectWebStandards(page, "facebook startup recovery");
      expect(await page.getByRole("button", {name: /retry/i}).isVisible()).toBe(true);
      expect(await page.evaluate(() => window.__facebookEvents)).toEqual([
        "initialize",
        "progress:30",
        "progress:70",
        "progress:100",
        "start",
        "player",
        "read:riddleQuestPreferences",
        `signed:${FAILURE_NONCE}`,
        "player",
      ]);
      expect(await page.locator('script[src*="fbinstant.8.0.js"]').count()).toBe(1);
      expect(await page.locator('script[src*="cdn.jest.com"]').count()).toBe(0);

      /** Provides success page behavior. */
      const successPage = await (await browser.newContext({viewport: {width: 390, height: 844}})).newPage();
      successPage.setDefaultTimeout(5_000);
      /** Provides success requests behavior. */
      const successRequests: string[] = [];
      /** Cross-device prompt lease state simulated by the authenticated backend boundary. */
      let notificationAccepted = false;
      /** Count server-authorized prompt attempts independently of SDK dialogs. */
      let notificationClaims = 0;
      /** Provides configuration request behavior. */
      let configurationRequest: {
        /** Stores authorization. */
        authorization?: string; /** Stores app check. */
        /** Stores app check. */
        appCheck?: string; /** Stores body. */
        /** Stores body. */
        body?: string;
      };
      successPage.on("request", (request) => successRequests.push(request.url()));
      /** The native share issuer receives authenticated, App Check-protected requests only. */
      const referralRequests: {
        /** Firebase authorization captured at the callable boundary. */
        authorization?: string;
        /** Custom App Check captured at the callable boundary. */
        appCheck?: string;
        /** Exact game-owned request envelope. */
        body: string;
      }[] = [];
      await successPage.route("**/createFacebookReferral", async route => {
        /** Stores headers for this isolated provider verification. */
        const headers = await route.request().allHeaders();
        referralRequests.push({authorization: headers.authorization, appCheck: headers["x-firebase-appcheck"], body: route.request().postData() ?? ""});
        await route.fulfill({status: 200, contentType: "application/json",
          body: JSON.stringify({data: {token: "t".repeat(43), expiresAtMs: Date.now() + 60_000}})});
      });
      await successPage.route("https://connect.facebook.net/en_US/fbinstant.8.0.js", (route) =>
        route.fulfill({status: 200, contentType: "text/javascript", body: "/* injected by browser contract test */"}),
      );
      await successPage.route("**/issueFacebookIdentityNonce", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({nonce: SUCCESS_NONCE, expiresAtMs: Date.now() + 60_000}),
        }),
      );
      /** Provides now seconds behavior. */
      const nowSeconds = Math.floor(Date.now() / 1_000);
      /** Provides encode behavior. */
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
      /** Provides app check token behavior. */
      const appCheckToken = [
        encode({alg: "none", typ: "JWT"}),
        encode({aud: ["projects/329028367192"], exp: nowSeconds + 3_600, iat: nowSeconds, sub: "facebook-browser"}),
        "browser-signature",
      ].join(".");
      await successPage.route("**/exchangeFacebookIdentity", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            customToken: "browser-custom-token",
            appCheckToken,
            appCheckExpiresInMs: 3_600_000,
            uid: `facebook_${"a".repeat(40)}`,
          }),
        }),
      );
      /** Provides firebase id token behavior. */
      const firebaseIdToken = [
        encode({alg: "none", typ: "JWT"}),
        encode({
          aud: "riddle-quest-ec2b2",
          auth_time: nowSeconds,
          exp: nowSeconds + 3_600,
          firebase: {sign_in_provider: "custom"},
          iat: nowSeconds,
          iss: "https://securetoken.google.com/riddle-quest-ec2b2",
          sub: `facebook_${"a".repeat(40)}`,
          user_id: `facebook_${"a".repeat(40)}`,
        }),
        "browser-signature",
      ].join(".");
      await successPage.route("**/v1/accounts:signInWithCustomToken**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            expiresIn: "3600",
            idToken: firebaseIdToken,
            isNewUser: false,
            localId: `facebook_${"a".repeat(40)}`,
            refreshToken: "browser-refresh-token",
          }),
        }),
      );
      await successPage.route("**/v1/accounts:lookup**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            users: [
              {
                createdAt: String(Date.now() - 1_000),
                lastLoginAt: String(Date.now()),
                localId: `facebook_${"a".repeat(40)}`,
                providerUserInfo: [],
              },
            ],
          }),
        }),
      );
      await successPage.route("**/getFacebookClientConfiguration", async (route) => {
        /** Provides headers behavior. */
        const headers = await route.request().allHeaders();
        configurationRequest = {
          authorization: headers.authorization,
          appCheck: headers["x-firebase-appcheck"],
          body: route.request().postData() ?? undefined,
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              interstitialsEnabled: true,
              notificationsEnabled: true,
              commerceEnabled: false,
              rewardedAdsEnabled: new URL(route.request().frame().url()).searchParams.get("rewarded") === "on",
              referralsEnabled: true,
              matchmakingEnabled: true,
              tournamentsEnabled: new URL(route.request().frame().url()).searchParams.get("tournaments") !== "off",
              presenceEnabled: false,
              removeInterstitialAds: false,
            },
          }),
        });
      });
      await successPage.route("**/claimFacebookNotificationPermissionPrompt", route => {
        notificationClaims += 1;
        return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({
          data: notificationAccepted ? {granted: false} : {granted: true, claimedAtMs: Date.now()},
        })});
      });
      await successPage.route("**/acceptFacebookNotificationPermissionPrompt", route => {
        notificationAccepted = true;
        return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data: {accepted: true}})});
      });
      await successPage.addInitScript(() => {
        window.__facebookEvents = [];
        window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
        /** Meta fixture controls subscription state independently of game preferences. */
        let botSubscribed = false;
        /** One page lifetime mirrors SDK read-after-write behavior; reload deliberately starts a fresh fixture. */
        const playerData: Record<string, unknown> = {
          riddleQuestPreferences: {
            locale: new URL(location.href).searchParams.get("rewarded") === "on" ? "en" : "fr",
            muted: true, reducedMotion: true, highContrast: true, onboardingComplete: false, presenceEnabled: false,
          },
          riddleQuestPlayerState: {schemaVersion: 1, updatedAt: 42, coins: 300},
        };
        /** Held native storage exposes whether pause drains the app queue before provider flush. */
        Reflect.set(window, "__facebookQueueEvents", []);
        window.FBInstant = {
          /** Provides initialize async behavior. */
          async initializeAsync() {
            window.__facebookEvents.push("initialize");
          },
          /** Sets loading progress. */
          setLoadingProgress(progress) {
            window.__facebookEvents.push(`progress:${progress}`);
          },
          /** Starts game async. */
          async startGameAsync() {
            window.__facebookEvents.push("start");
          },
          /** Gets supported ap is. */
          getSupportedAPIs() {
            return [
              "logEvent",
              "overlayViews.createProfilePictureOverlayViewAsync",
              "overlayViews.createProfileNameOverlayViewAsync",
              "player.canSubscribeBotAsync",
              "player.isSubscribedBotAsync",
              "player.subscribeBotAsync",
              "getInterstitialAdAsync",
              "getRewardedVideoAsync",
              "shareAsync",
            ];
          },
          /** Records native analytics at the provider boundary. */
          logEvent(name, _value, parameters) {
            window.__facebookEvents.push(`analytics:${name}:${JSON.stringify(parameters)}`);
            return null;
          },
          /** Simulates Meta's completion, cancellation and no-fill contracts without creating rewards. */
          async getRewardedVideoAsync(placementId) {
            window.__facebookEvents.push(`rewarded:placement:${placementId}`);
            return {
              /** Mock Meta video load resolves before the completion adapter is used. */
              async loadAsync() {
                window.__facebookEvents.push("rewarded:load");
                if (Reflect.get(window, "__rewardedMode") === "no-fill") throw Object.assign(new Error("no fill"), {code: "ADS_NO_FILL"});
              },
              /** Mock Meta completion supports cancellation, no-fill and held-video scenarios. */
              async showAsync() {
                window.__facebookEvents.push("rewarded:show");
                if (Reflect.get(window, "__rewardedMode") === "cancel") throw Object.assign(new Error("dismissed"), {code: "USER_INPUT"});
                if (Reflect.get(window, "__rewardedMode") === "hold") await new Promise<void>(resolve => Reflect.set(window, "__finishRewarded", resolve));
                window.__facebookEvents.push("rewarded:complete");
              },
            };
          },
          /** Captures Meta-native sharing without granting currency or switching context. */
          async shareAsync(payload) {
            /** Stores previous for this isolated provider verification. */
            const previous = Reflect.get(window, "__facebookShares") ?? [];
            Reflect.set(window, "__facebookShares", [...previous, payload]);
            window.__facebookEvents.push(`share:${payload.intent}`);
            if (previous.length === 0) throw {code: "USER_INPUT"};
          },
          /** Provides on pause behavior. */
          onPause(callback) {
            /** Previously registered provider callback retained by this fixture. */
            const previous = window.__facebookPause;
            window.__facebookPause = () => {previous?.(); callback();};
          },
          /** Registers the provider resume callback. */
          onResume(callback) {
            /** Previously registered provider callback retained by this fixture. */
            const previous = window.__facebookResume;
            window.__facebookResume = () => {previous?.(); callback();};
          },
          /** Captures the actual configured Meta result placement. */
          async getInterstitialAdAsync(placementId) {
            window.__facebookEvents.push(`ads:interstitial:${placementId}`);
            return {
              /** Models Meta's required load before display. */
              async loadAsync() {window.__facebookEvents.push("ads:load");},
              /** Models a completed provider impression. */
              async showAsync() {window.__facebookEvents.push("ads:show");},
            };
          },
          overlayViews: {
            /** Creates profile picture overlay view async. */
            async createProfilePictureOverlayViewAsync(surface) {
              window.__facebookEvents.push(`overlay:picture:${surface.dataset.platformOwnedIdentity !== undefined}`);
              return {
                /** Provides show async behavior. */
                async showAsync() {
                  window.__facebookEvents.push("overlay:picture:show");
                },
                /** Provides dismiss async behavior. */
                async dismissAsync() {
                  window.__facebookEvents.push("overlay:picture:dismiss");
                },
                /** Provides destroy overlay view behavior. */
                async destroyAsync() {
                  window.__facebookEvents.push("overlay:picture:destroy");
                },
              };
            },
            /** Creates profile name overlay view async. */
            async createProfileNameOverlayViewAsync(surface) {
              window.__facebookEvents.push(`overlay:name:${surface.dataset.platformOwnedIdentity !== undefined}`);
              return {
                /** Provides show async behavior. */
                async showAsync() {
                  window.__facebookEvents.push("overlay:name:show");
                },
                /** Provides dismiss async behavior. */
                async dismissAsync() {
                  window.__facebookEvents.push("overlay:name:dismiss");
                },
                /** Provides destroy overlay view behavior. */
                async destroyAsync() {
                  window.__facebookEvents.push("overlay:name:destroy");
                },
              };
            },
          },
          player: {
            /** Checks eligibility through Meta rather than another provider. */
            async canSubscribeBotAsync() {window.__facebookEvents.push("notifications:eligible"); return true;},
            /** Returns current provider subscription consent. */
            async isSubscribedBotAsync() {return botSubscribed;},
            /** Simulates accepting Meta's own subscription UI. */
            async subscribeBotAsync() {window.__facebookEvents.push("notifications:subscribe"); botSubscribed = true;},
            /** Gets id. */
            getID() {
              window.__facebookEvents.push("player");
              return "facebook-browser-player";
            },
            /** Gets signed player info async. */
            async getSignedPlayerInfoAsync(nonce) {
              window.__facebookEvents.push(`signed:${nonce}`);
              return {getSignature: () => "signature.payload", getPlayerID: () => "facebook-browser-player"};
            },
            /** Gets data async. */
            async getDataAsync(keys) {
              window.__facebookEvents.push(`read:${keys.join(",")}`);
              return Object.fromEntries(keys.map(key => [key, structuredClone(playerData[key])]));
            },
            /** Sets data async. */
            async setDataAsync(update) {
              window.__facebookEvents.push("write");
              /** Player snapshot supplied by the actual target storage adapter. */
              const value = Reflect.get(update, "riddleQuestPlayerState");
              if (value?.activeGame?.currentLetters.join("") === "PIAN" && Reflect.get(window, "__facebookFailDraft")) {
                Reflect.set(window, "__facebookFailDraft", false);
                window.__facebookEvents.push("save-failure:PIAN");
                throw new Error("injected-facebook-progress-save-failure");
              }
              if (Reflect.get(window, "__holdFacebookWrite")) {
                Reflect.set(window, "__holdFacebookWrite", false);
                Reflect.set(window, "__facebookQueueEvents", []);
                Reflect.get(window, "__facebookQueueEvents").push(`write:${value?.activeGame?.currentLetters.join("")}`);
                await new Promise<void>(resolve => Reflect.set(window, "__releaseFacebookWrite", resolve));
              } else if (value && Reflect.get(window, "__releaseFacebookWrite")) {
                Reflect.get(window, "__facebookQueueEvents").push(`write:${value.activeGame?.currentLetters.join("")}`);
              }
              Object.assign(playerData, structuredClone(update));
            },
            /** Provides flush data async behavior. */
            async flushDataAsync() {
              window.__facebookEvents.push("flush");
              Reflect.set(window, "__facebookAcknowledgedDraft", (playerData.riddleQuestPlayerState as PlayerData)?.activeGame?.currentLetters.join(""));
              if (Reflect.get(window, "__releaseFacebookWrite")) {
                Reflect.get(window, "__facebookQueueEvents").push(`flush:${(playerData.riddleQuestPlayerState as PlayerData)?.activeGame?.currentLetters.join("")}`);
              }
            },
          },
        };
      });
      /** Current multiplayer journey crosses the authenticated Facebook live transport. */
      const verifyMultiplayer = await installLiveMultiplayerJourney(successPage, "Facebook");
      /** This variant proves context surfaces operate without an advertised or callable native matcher. */
      const nativeMatching = process.env.FACEBOOK_BROWSER_CONTEXT_MATCHING !== "0";
      await installRaceContextDialogs(successPage, nativeMatching, process.env.FACEBOOK_BROWSER_CONTEXT_EVENTS !== "0",
        process.env.FACEBOOK_BROWSER_CONTEXT_CHALLENGES === "1");
      await installTournamentPresentation(successPage);
      await successPage.goto(`${origin}/?harness=race`);
      try {
        await successPage.waitForFunction(
          () => window.__facebookEvents.includes("read:riddleQuestPlayerState"),
          undefined,
          {timeout: 15_000},
        );
      } catch (error) {
        /** Provides diagnostics behavior. */
        const diagnostics = await successPage.evaluate(() => ({
          events: window.__facebookEvents,
          body: document.body.innerText,
        }));
        throw new Error(
          `${error instanceof Error ? error.message : String(error)} ${JSON.stringify({
            ...diagnostics,
            requests: successRequests.filter((url) => !url.startsWith("http://127.0.0.1:4181/assets/")),
          })}`,
        );
      }
      expect(await successPage.getByRole("alert").count()).toBe(0);
      expect(await successPage.evaluate(() => ({chooser: window.FBInstant!.getSupportedAPIs().includes("context.chooseAsync"),
        matcher: window.FBInstant!.getSupportedAPIs().includes("matchPlayerAsync"), callableMatcher: typeof window.FBInstant!.matchPlayerAsync === "function"})))
        .toEqual({chooser: true, matcher: nativeMatching, callableMatcher: nativeMatching});
      await successPage.waitForFunction(() => window.__facebookEvents.some(event => event.startsWith("analytics:screen_view:")));
      expect((await successPage.evaluate(() => window.__facebookEvents)).filter(event => event.startsWith("analytics:session_started:"))).toHaveLength(1);
      expect(await successPage.evaluate(() => window.__facebookEvents)).toEqual(
        expect.arrayContaining([
          "initialize",
          "start",
          `signed:${SUCCESS_NONCE}`,
          "read:riddleQuestPreferences",
          "read:riddleQuestPlayerState",
        ]),
      );
      expect(configurationRequest).toEqual({
        authorization: `Bearer ${firebaseIdToken}`,
        appCheck: appCheckToken,
        body: JSON.stringify({data: {}}),
      });
      // SDK preference restore precedes gameplay startup. Wait for the game's
      // deliberate unmuted initial state before checking the settled preferences.
      await successPage.waitForFunction(
        () => localStorage.getItem("riddleQuest:soundEnabled") === "true",
        undefined,
        {timeout: 5_000},
      );
      expect(
        await successPage.evaluate(() => ({
          locale: localStorage.getItem("appLanguage"),
          soundEnabled: localStorage.getItem("riddleQuest:soundEnabled"),
          reducedMotion: document.documentElement.dataset.riddleQuestReducedMotion,
          highContrast: document.documentElement.dataset.riddleQuestHighContrast,
        })),
      ).toEqual({locale: "fr", soundEnabled: "true", reducedMotion: "true", highContrast: "true"});
      expect(
        await successPage.evaluate(() => {
          /** Provides original language behavior. */
          const originalLanguage = document.documentElement.lang;
          /** Provides expected first faces behavior. */
          const expectedFirstFaces = {
            ar: '"Noto Sans Arabic"',
            hi: '"Noto Sans Devanagari"',
            ja: '"Hiragino Sans"',
            ko: '"Apple SD Gothic Neo"',
            ru: '"Noto Sans"',
          };
          /** Provides actual behavior. */
          const actual = Object.fromEntries(
            Object.entries(expectedFirstFaces).map(([locale]) => {
              document.documentElement.lang = locale;
              return [locale, getComputedStyle(document.documentElement).fontFamily.split(",")[0]];
            }),
          );
          document.documentElement.lang = originalLanguage;
          return {actual, expectedFirstFaces};
        }),
      ).toEqual({
        actual: {
          ar: '"Noto Sans Arabic"',
          hi: '"Noto Sans Devanagari"',
          ja: '"Hiragino Sans"',
          ko: '"Apple SD Gothic Neo"',
          ru: '"Noto Sans"',
        },
        expectedFirstFaces: {
          ar: '"Noto Sans Arabic"',
          hi: '"Noto Sans Devanagari"',
          ja: '"Hiragino Sans"',
          ko: '"Apple SD Gothic Neo"',
          ru: '"Noto Sans"',
        },
      });
      /** Provides onboarding action behavior. */
      const onboardingAction = successPage.locator(".onboarding-card .play-primary");
      await onboardingAction.waitFor({timeout: 5_000});
      await onboardingAction.evaluate((element: HTMLElement) => element.click());
      await successPage.locator(".onboarding-clues").waitFor({timeout: 5_000});
      expect(await successPage.locator(".onboarding-progress").innerText()).toBe("2/2");
      await onboardingAction.click();
      await onboardingAction.waitFor({state: "detached", timeout: 5_000});
      expect(await successPage.locator(".onboarding-card").count()).toBe(0);
      expect(await successPage.locator(".onboarding-registration-actions").count()).toBe(0);
      // A provider with disabled checkout must never advertise purchasing in its tour.
      await successPage.locator('.tooltip-backdrop[data-tooltip-id="gameHint"]').waitFor();
      expect(await successPage.locator('[data-tooltip="gameCoins"]').count()).toBe(0);
      for (const id of ["gameHint", "submitAnswer", "gameSkip", "gameMultiplayer"]) {
        /** Current tour step whose acknowledgement advances the provider-safe guidance. */
        const tooltip = successPage.locator(`.tooltip-backdrop[data-tooltip-id="${id}"]`);
        await tooltip.waitFor();
        await tooltip.locator("button").click();
      }
      await successPage.locator(".tooltip-backdrop").waitFor({state: "detached"});
      await expectWebStandards(successPage, "facebook game");
      await verifyMultiplayer("fr");
      await successPage.locator(".multiplayer-navigation-action").click();
      await verifyTournamentPresentation(successPage);
      await verifyRaceContextDialogs(successPage, process.env.FACEBOOK_CONTEXT_SCREENSHOT_PATH);
      if (process.env.FACEBOOK_BROWSER_CONTEXT_CHALLENGES === "1") await verifyContextChallenges(successPage);
      await successPage.locator(".race-close").click();
      await verifyImmediateSoloFeedback(successPage, "Facebook");
      expect(await successPage.evaluate(() => window.__facebookEvents.some(event => event.startsWith("analytics:button_press:")))).toBe(true);
      expect(await successPage.evaluate(() => window.__facebookEvents.some(event => event.startsWith("analytics:guess_submitted:")))).toBe(true);
      expect(notificationClaims).toBe(0);
      expect(await successPage.evaluate(() => window.__facebookEvents.includes("notifications:subscribe"))).toBe(false);
      expect(await successPage.evaluate(() => window.__facebookEvents.includes("ads:show"))).toBe(false);
      await successPage.evaluate(() => Reflect.set(window, "__holdFacebookWrite", true));
      await successPage.locator(".keyboard").getByRole("button", {name: "I", exact: true}).click();
      await successPage.waitForFunction(() => typeof Reflect.get(window, "__releaseFacebookWrite") === "function");
      await successPage.locator(".keyboard").getByRole("button", {name: "A", exact: true}).click();
      await successPage.waitForFunction(() => document.querySelectorAll(".guess-row")[1]?.textContent === "PIA");
      await successPage.evaluate(() => window.__facebookPause?.());
      await successPage.waitForFunction(() => window.__facebookEvents.includes("flush"));
      await successPage.locator(".game-app.paused").waitFor();
      expect(await successPage.evaluate(() => Reflect.get(window, "__facebookQueueEvents"))).toEqual(["write:PI"]);
      await successPage.evaluate(() => Reflect.get(window, "__releaseFacebookWrite")());
      await successPage.waitForFunction(() => Reflect.get(window, "__facebookQueueEvents").filter((event: string) => event.startsWith("flush:")).length >= 3);
      expect(await successPage.evaluate(() => Reflect.get(window, "__facebookQueueEvents"))).toEqual([
        "write:PI", "flush:PI", "write:PIA", "flush:PIA", "flush:PIA",
      ]);
      await successPage.evaluate(() => Reflect.deleteProperty(window, "__releaseFacebookWrite"));
      expect(await successPage.evaluate(() => document.visibilityState)).toBe("visible");
      await successPage.evaluate(() => window.__facebookResume?.());
      await successPage.locator(".game-app.paused").waitFor({state: "detached"});
      await successPage.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        Reflect.set(window, "__facebookFailDraft", true);
        Reflect.set(window, "__facebookUnhandledProgress", []);
        window.addEventListener("unhandledrejection", event => Reflect.get(window, "__facebookUnhandledProgress").push(String(event.reason)));
      });
      await successPage.keyboard.type("n");
      await successPage.waitForFunction(() => window.__facebookEvents.includes("save-failure:PIAN"));
      await successPage.waitForFunction(() => Reflect.get(window, "__facebookAcknowledgedDraft") === "PIAN");
      expect(await successPage.evaluate(() => Reflect.get(window, "__facebookUnhandledProgress"))).toEqual([]);
      expect(await successPage.locator(".player-save-notice").count()).toBe(0);
      for (let index = 0; index < 3; index++) {
        await successPage.keyboard.press("Backspace");
      }
      // The prior feedback check left the next draft at P. Complete the fixture's
      // PIANO answer through the UI so only an authoritative win can cause a prompt.
      for (const letter of "IANO") {
        await successPage.locator(".keyboard").getByRole("button", {name: new RegExp(`^${letter}$`)}).click();
      }
      /** Waits for the authenticated acceptance boundary, not only the SDK dialog. */
      const notificationAcceptance = successPage.waitForResponse("**/acceptFacebookNotificationPermissionPrompt");
      await successPage.locator(".submit-action").click();
      await successPage.waitForFunction(() => window.__facebookEvents.includes("notifications:subscribe"));
      await notificationAcceptance;
      expect(notificationAccepted).toBe(true);
      expect(notificationClaims).toBe(1);
      expect(await successPage.evaluate(() => window.__facebookEvents.filter(event => event === "notifications:subscribe").length)).toBe(1);
      await successPage.waitForFunction(() => window.__facebookEvents.includes("ads:show"));
      /** The post-result ad follows subscription consent, uses Meta's configured ID, and loads before showing. */
      const providerEvents = await successPage.evaluate(() => window.__facebookEvents);
      expect(providerEvents).toContain("ads:interstitial:1748953042991569_1765481644672042");
      expect(providerEvents.indexOf("notifications:subscribe")).toBeLessThan(providerEvents.indexOf("ads:load"));
      expect(providerEvents.indexOf("ads:load")).toBeLessThan(providerEvents.indexOf("ads:show"));
      /** Dismissing Meta sharing leaves the result available for a later explicit retry. */
      const resultShare = successPage.locator(".fanfare-content .play-secondary");
      await resultShare.click();
      await successPage.waitForFunction(() => Reflect.get(window, "__facebookShares")?.length === 1);
      await resultShare.click();
      await successPage.waitForFunction(() => Reflect.get(window, "__facebookShares")?.length === 2);
      expect(await successPage.evaluate(() => Reflect.get(window, "__facebookShares").map((payload: import("../fbinstant").FacebookSharePayload) =>
        ({intent: payload.intent, switchContext: payload.switchContext, data: payload.data, png: payload.image.startsWith("data:image/png;base64,")}))))
        .toEqual([{intent: "SHARE", switchContext: false, data: {gameMode: "classic", referralToken: "t".repeat(43)}, png: true},
          {intent: "SHARE", switchContext: false, data: {gameMode: "classic", referralToken: "t".repeat(43)}, png: true}]);
      expect(referralRequests).toEqual(Array.from({length: 2}, () => ({authorization: `Bearer ${firebaseIdToken}`, appCheck: appCheckToken,
        body: JSON.stringify({data: {}})})));
      await successPage.reload();
      await successPage.waitForFunction(
        () => window.__facebookEvents.includes("read:riddleQuestPlayerState"),
        undefined,
        {timeout: 15_000},
      );
      expect(await successPage.getByRole("alert").count()).toBe(0);
      expect(
        await successPage.evaluate(
          () => window.__facebookEvents.filter((event) => event === "read:riddleQuestPreferences").length,
        ),
      ).toBe(2);
      // Exercise the real Facebook session's account authority using only fake services.
      // This SDK fixture returns a fresh player record on every reload.
      await successPage.locator('.onboarding-card .play-primary').click();
      await successPage.locator('.onboarding-clues').waitFor();
      await successPage.locator('.onboarding-card .play-primary').click();
      await successPage.locator('.onboarding-card').waitFor({state: 'detached'});
      await successPage.locator('.game-bottom-navigation button').last().click();
      await successPage.locator('.profile-page').waitFor();
      // A first profile visit shows the profile tour for this Facebook account; finish it like a player would.
      for (let step = 0; step < 8; step++) {
        /** Open profile-tour step, if the tour is (still) showing. */
        const tourStep = successPage.locator('.tooltip-backdrop');
        try {
          await tourStep.first().waitFor({timeout: 1_500});
        } catch {
          break;
        }
        await tourStep.first().locator('button').last().click();
      }
      await successPage.locator('.tooltip-backdrop').waitFor({state: 'detached'});
      await successPage.locator('.profile-invite-button').click();
      await successPage.waitForFunction(() => window.__facebookEvents.includes("share:INVITE"));
      expect(await successPage.locator('.profile-invite-button').innerText()).not.toMatch(/100|Jest/);
      expect(await successPage.locator('.profile-avatar-input').count()).toBe(0);
      await successPage.locator('.profile-identity .play-text-button').click();
      await successPage.locator('.username-form input').fill('FacebookTester');
      await successPage.locator('.username-form button').click();
      await successPage.getByText('FacebookTester', {exact: true}).first().waitFor();
      await successPage.locator('.profile-danger-zone .profile-delete-account-button').click();
      await successPage.locator('.profile-delete-dialog .profile-delete-account-button').click();
      await successPage.locator('.profile-page').waitFor({state: 'detached'});
      expect(await successPage.locator('body').innerText()).not.toContain('host-account-capability-unavailable');
      await verifyRewardedContinue(successPage, origin);
      await verifyTournamentEntry(successPage, origin);
      await verifyTournamentScoreRecovery(successPage, origin);
      // Independent flags must permit native live-win consent with and without the tournament surface.
      for (const tournaments of [true, false]) {
        notificationAccepted = false;
        /** Provides prior live claims behavior. */
        const priorLiveClaims = notificationClaims;
        await installTournamentPresentation(successPage);
        await successPage.goto(`${origin}/?harness=race&live-consent=on&tournaments=${tournaments ? "on" : "off"}`);
        await successPage.locator(".game-bottom-navigation").waitFor();
        expect(notificationClaims).toBe(priorLiveClaims);
        /** Provides fresh onboarding behavior. */
        const freshOnboarding = successPage.locator(".onboarding-card .play-primary");
        if (await freshOnboarding.count()) {
          await freshOnboarding.click();
          await successPage.locator(".onboarding-clues").waitFor();
          await freshOnboarding.click();
          await freshOnboarding.waitFor({state: "detached"});
        }
        for (const id of ["gameHint", "submitAnswer", "gameSkip"]) {
          /** Provides tooltip behavior. */
          const tooltip = successPage.locator(`.tooltip-backdrop[data-tooltip-id="${id}"]`);
          if (await tooltip.count()) await tooltip.locator("button").click();
        }
        if (tournaments) {
          await successPage.locator(".multiplayer-navigation-action").click();
          await verifyTournamentPresentation(successPage);
          await successPage.locator(".race-close").click();
        }
        /** Provides live acceptance behavior. */
        const liveAcceptance = successPage.waitForResponse("**/acceptFacebookNotificationPermissionPrompt", {timeout: 5000});
        void liveAcceptance.catch(() => undefined);
        await verifyTournamentLiveResult(successPage, tournaments);
        await liveAcceptance;
        expect(notificationAccepted).toBe(true);
        expect(notificationClaims).toBe(priorLiveClaims + 1);
        expect(await successPage.evaluate(() => window.__facebookEvents.filter(event => event === "notifications:subscribe").length)).toBe(1);
      }
    } finally {
      await browser.close();
      try {
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      } finally {
        await rm(distDirectory, {force: true, recursive: true});
      }
    }
  }, 60_000);
});
