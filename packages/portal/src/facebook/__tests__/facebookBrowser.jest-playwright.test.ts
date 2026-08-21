import {describe, expect, it} from "@jest/globals";
import {chromium} from "@playwright/test";

declare global {
  interface Window {
    __facebookEvents: string[];
    __facebookPause?: () => void;
    __RIDDLE_QUEST_BROWSER_TEST__?: boolean;
  }
}

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
const FAILURE_NONCE = "f".repeat(43);
const SUCCESS_NONCE = "s".repeat(43);

describeBrowser("Facebook artifact with injected FBInstant SDK", () => {
  it("runs failure recovery plus authenticated restore/pause/reload lifecycle", async () => {
    const {execFileSync} = await import("node:child_process");
    const {createServer} = await import("node:http");
    const {readFile} = await import("node:fs/promises");
    const path = await import("node:path");
    const packageRoot = path.resolve(__dirname, "../../..");
    if (process.env.PORTAL_USE_EXISTING_BUILD !== "1") {
      execFileSync("pnpm", ["--filter", "@qwordly/portal", "build:facebook"], {
        cwd: path.resolve(packageRoot, "../.."),
        stdio: "inherit",
      });
    }
    const distDirectory = path.join(packageRoot, "dist-facebook");
    const server = createServer(async (request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const requested = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.replace(/^\//u, "");
      const filePath = path.resolve(distDirectory, requested);
      if (!filePath.startsWith(`${distDirectory}${path.sep}`) && filePath !== path.join(distDirectory, "index.html")) {
        response.writeHead(404).end();
        return;
      }
      try {
        const body = await readFile(filePath);
        const extension = path.extname(filePath);
        response.writeHead(200, {"content-type": extension === ".html"
          ? "text/html"
          : extension === ".js"
            ? "text/javascript"
            : extension === ".css"
              ? "text/css"
              : "application/octet-stream"});
        response.end(body);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => server.listen(4181, "127.0.0.1", resolve));
    const browser = await chromium.launch({headless: true});
    try {
      const page = await browser.newPage({viewport: {width: 390, height: 844}});
      await page.route("https://connect.facebook.net/en_US/fbinstant.8.0.js", (route) =>
        route.fulfill({status: 200, contentType: "text/javascript", body: "/* injected by browser contract test */"}));
      await page.route("**/issueFacebookIdentityNonce", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({nonce: FAILURE_NONCE, expiresAtMs: Date.now() + 60_000}),
      }));
      await page.route("**/exchangeFacebookIdentity", (route) => route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({error: "temporarily-unavailable"}),
      }));
      await page.addInitScript(() => {
        window.__facebookEvents = [];
        window.FBInstant = {
          async initializeAsync() { window.__facebookEvents.push("initialize"); },
          setLoadingProgress(progress) { window.__facebookEvents.push(`progress:${progress}`); },
          async startGameAsync() { window.__facebookEvents.push("start"); },
          getSupportedAPIs() { return []; },
          onPause(callback) { window.__facebookPause = callback; },
          player: {
            getID() { window.__facebookEvents.push("player"); return "facebook-browser-player"; },
            async getSignedPlayerInfoAsync(nonce) {
              window.__facebookEvents.push(`signed:${nonce}`);
              return {getSignature: () => "signature.payload", getPlayerID: () => "facebook-browser-player"};
            },
            async getDataAsync(keys) {
              window.__facebookEvents.push(`read:${keys.join(",")}`);
              return {};
            },
            async setDataAsync() { window.__facebookEvents.push("write"); },
            async flushDataAsync() { window.__facebookEvents.push("flush"); },
          },
        };
      });
      await page.goto("http://127.0.0.1:4181/");
      await page.getByRole("alert").getByRole("heading").waitFor({timeout: 15_000});
      expect(await page.getByRole("button", {name: /retry/i}).isVisible()).toBe(true);
      expect(await page.evaluate(() => window.__facebookEvents)).toEqual([
        "initialize",
        "progress:30",
        "player",
        "read:riddleQuestPreferences",
        "progress:70",
        "start",
        "progress:100",
        `signed:${FAILURE_NONCE}`,
        "player",
      ]);
      expect(await page.locator('script[src*="fbinstant.8.0.js"]').count()).toBe(1);
      expect(await page.locator('script[src*="cdn.jest.com"]').count()).toBe(0);

      const successPage = await browser.newPage({viewport: {width: 390, height: 844}});
      const successRequests: string[] = [];
      let configurationRequest: {authorization?: string; appCheck?: string; body?: string};
      successPage.on("request", (request) => successRequests.push(request.url()));
      await successPage.route("https://connect.facebook.net/en_US/fbinstant.8.0.js", (route) =>
        route.fulfill({status: 200, contentType: "text/javascript", body: "/* injected by browser contract test */"}));
      await successPage.route("**/issueFacebookIdentityNonce", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({nonce: SUCCESS_NONCE, expiresAtMs: Date.now() + 60_000}),
      }));
      const nowSeconds = Math.floor(Date.now() / 1_000);
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const appCheckToken = [
        encode({alg: "none", typ: "JWT"}),
        encode({aud: ["projects/329028367192"], exp: nowSeconds + 3_600, iat: nowSeconds, sub: "facebook-browser"}),
        "browser-signature",
      ].join(".");
      await successPage.route("**/exchangeFacebookIdentity", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          customToken: "browser-custom-token",
          appCheckToken,
          appCheckExpiresInMs: 3_600_000,
          uid: `facebook_${"a".repeat(40)}`,
        }),
      }));
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
      await successPage.route("**/v1/accounts:signInWithCustomToken**", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          expiresIn: "3600",
          idToken: firebaseIdToken,
          isNewUser: false,
          localId: `facebook_${"a".repeat(40)}`,
          refreshToken: "browser-refresh-token",
        }),
      }));
      await successPage.route("**/v1/accounts:lookup**", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({users: [{
          createdAt: String(Date.now() - 1_000),
          lastLoginAt: String(Date.now()),
          localId: `facebook_${"a".repeat(40)}`,
          providerUserInfo: [],
        }]}),
      }));
      await successPage.route("**/getFacebookClientConfiguration", async (route) => {
        const headers = await route.request().allHeaders();
        configurationRequest = {
          authorization: headers.authorization,
          appCheck: headers["x-firebase-appcheck"],
          body: route.request().postData() ?? undefined,
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({data: {
            interstitialsEnabled: false,
            notificationsEnabled: false,
            commerceEnabled: false,
            rewardedAdsEnabled: false,
            referralsEnabled: false,
            matchmakingEnabled: false,
            tournamentsEnabled: true,
            presenceEnabled: false,
            removeInterstitialAds: false,
          }}),
        });
      });
      await successPage.addInitScript(() => {
        window.__facebookEvents = [];
        window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
        window.FBInstant = {
          async initializeAsync() { window.__facebookEvents.push("initialize"); },
          setLoadingProgress(progress) { window.__facebookEvents.push(`progress:${progress}`); },
          async startGameAsync() { window.__facebookEvents.push("start"); },
          getSupportedAPIs() {
            return [
              "overlayViews.createProfilePictureOverlayViewAsync",
              "overlayViews.createProfileNameOverlayViewAsync",
            ];
          },
          onPause(callback) { window.__facebookPause = callback; },
          overlayViews: {
            async createProfilePictureOverlayViewAsync(surface) {
              window.__facebookEvents.push(`overlay:picture:${surface.dataset.platformOwnedIdentity !== undefined}`);
              return {
                async showAsync() { window.__facebookEvents.push("overlay:picture:show"); },
                async dismissAsync() { window.__facebookEvents.push("overlay:picture:dismiss"); },
                async destroyOverlayView() { window.__facebookEvents.push("overlay:picture:destroy"); },
              };
            },
            async createProfileNameOverlayViewAsync(surface) {
              window.__facebookEvents.push(`overlay:name:${surface.dataset.platformOwnedIdentity !== undefined}`);
              return {
                async showAsync() { window.__facebookEvents.push("overlay:name:show"); },
                async dismissAsync() { window.__facebookEvents.push("overlay:name:dismiss"); },
                async destroyOverlayView() { window.__facebookEvents.push("overlay:name:destroy"); },
              };
            },
          },
          player: {
            getID() { window.__facebookEvents.push("player"); return "facebook-browser-player"; },
            async getSignedPlayerInfoAsync(nonce) {
              window.__facebookEvents.push(`signed:${nonce}`);
              return {getSignature: () => "signature.payload", getPlayerID: () => "facebook-browser-player"};
            },
            async getDataAsync(keys) {
              window.__facebookEvents.push(`read:${keys.join(",")}`);
              return {
                riddleQuestPreferences: {
                  locale: "fr",
                  muted: true,
                  reducedMotion: true,
                  highContrast: true,
                  onboardingComplete: true,
                  presenceEnabled: false,
                },
                riddleQuestPlayerState: {schemaVersion: 1, updatedAt: 42, coins: 300},
              };
            },
            async setDataAsync() { window.__facebookEvents.push("write"); },
            async flushDataAsync() { window.__facebookEvents.push("flush"); },
          },
        };
      });
      await successPage.goto("http://127.0.0.1:4181/?harness=race");
      try {
        await successPage.waitForFunction(() =>
          window.__facebookEvents.includes("read:riddleQuestPlayerState"), undefined, {timeout: 15_000});
      } catch (error) {
        const diagnostics = await successPage.evaluate(() => ({events: window.__facebookEvents, body: document.body.innerText}));
        throw new Error(`${error instanceof Error ? error.message : String(error)} ${JSON.stringify({
          ...diagnostics,
          requests: successRequests.filter((url) => !url.startsWith("http://127.0.0.1:4181/assets/")),
        })}`);
      }
      expect(await successPage.getByRole("alert").count()).toBe(0);
      expect(await successPage.evaluate(() => window.__facebookEvents)).toEqual(expect.arrayContaining([
        "initialize",
        "start",
        `signed:${SUCCESS_NONCE}`,
        "read:riddleQuestPreferences",
        "read:riddleQuestPlayerState",
      ]));
      expect(configurationRequest).toEqual({
        authorization: `Bearer ${firebaseIdToken}`,
        appCheck: appCheckToken,
        body: JSON.stringify({data: null}),
      });
      expect(await successPage.evaluate(() => ({
        locale: localStorage.getItem("appLanguage"),
        soundEnabled: localStorage.getItem("riddleQuest:soundEnabled"),
        reducedMotion: document.documentElement.dataset.riddleQuestReducedMotion,
        highContrast: document.documentElement.dataset.riddleQuestHighContrast,
      }))).toEqual({locale: "fr", soundEnabled: "false", reducedMotion: "true", highContrast: "true"});
      expect(await successPage.evaluate(() => {
        const originalLanguage = document.documentElement.lang;
        const expectedFirstFaces = {
          ar: '"Noto Sans Arabic"',
          hi: '"Noto Sans Devanagari"',
          ja: '"Hiragino Sans"',
          ko: '"Apple SD Gothic Neo"',
          ru: '"Noto Sans"',
          zh: '"PingFang SC"',
        };
        const actual = Object.fromEntries(Object.entries(expectedFirstFaces).map(([locale]) => {
          document.documentElement.lang = locale;
          return [locale, getComputedStyle(document.documentElement).fontFamily.split(",")[0]];
        }));
        document.documentElement.lang = originalLanguage;
        return {actual, expectedFirstFaces};
      })).toEqual({
        actual: {
          ar: '"Noto Sans Arabic"', hi: '"Noto Sans Devanagari"', ja: '"Hiragino Sans"',
          ko: '"Apple SD Gothic Neo"', ru: '"Noto Sans"', zh: '"PingFang SC"',
        },
        expectedFirstFaces: {
          ar: '"Noto Sans Arabic"', hi: '"Noto Sans Devanagari"', ja: '"Hiragino Sans"',
          ko: '"Apple SD Gothic Neo"', ru: '"Noto Sans"', zh: '"PingFang SC"',
        },
      });
      await successPage.evaluate(() =>
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen"));
      const onboardingAction = successPage.locator(".onboarding-card .play-primary");
      await onboardingAction.waitFor({timeout: 5_000});
      await onboardingAction.evaluate((element: HTMLElement) => element.click());
      await onboardingAction.waitFor({state: "detached", timeout: 5_000});
      expect(await successPage.locator(".onboarding-card").count()).toBe(0);
      try {
        await successPage.locator(".multiplayer-navigation-action").click({timeout: 5_000});
        await successPage.locator(".race-hub-tabs").waitFor({timeout: 5_000});
      } catch (error) {
        const diagnostics = await successPage.evaluate(() => ({
          body: document.body.innerText,
          events: window.__facebookEvents,
          route: location.href,
          viewport: {width: innerWidth, height: innerHeight},
          multiplayerBox: (() => {
            const box = document.querySelector(".multiplayer-navigation-action")?.getBoundingClientRect();
            return box ? {x: box.x, y: box.y, width: box.width, height: box.height} : null;
          })(),
          content: (() => {
            const element = document.querySelector(".game-content") as HTMLElement | null;
            const box = element?.getBoundingClientRect();
            return element && box ? {x: box.x, width: box.width, transform: element.style.transform,
              direction: getComputedStyle(element).direction} : null;
          })(),
          navigation: (() => {
            const box = document.querySelector(".game-bottom-navigation")?.getBoundingClientRect();
            return box ? {x: box.x, width: box.width} : null;
          })(),
          ancestors: [".game-app", ".play-game-shell", "#root"].map((selector) => {
            const box = document.querySelector(selector)?.getBoundingClientRect();
            return {selector, ...(box ? {x: box.x, width: box.width} : {})};
          }),
        }));
        throw new Error(`Facebook hub did not open: ${error instanceof Error ? error.message : String(error)} ${JSON.stringify(diagnostics)}`);
      }
      const facebookHubTabs = successPage.getByRole("tab");
      expect(await facebookHubTabs.count()).toBe(2);
      expect(await successPage.getByRole("tab", {name: /^tournois$/i}).count()).toBe(0);
      await facebookHubTabs.first().focus();
      await facebookHubTabs.first().press("ArrowRight");
      expect(await facebookHubTabs.nth(1).getAttribute("aria-selected")).toBe("true");
      expect(await facebookHubTabs.nth(1).evaluate((element) => element === document.activeElement)).toBe(true);
      await successPage.waitForFunction(() => window.__facebookEvents.includes("overlay:name:show"));
      expect(await successPage.evaluate(() => window.__facebookEvents)).toEqual(expect.arrayContaining([
        "overlay:picture:true",
        "overlay:name:true",
        "overlay:picture:show",
        "overlay:name:show",
      ]));
      await facebookHubTabs.first().click();
      await successPage.waitForFunction(() => window.__facebookEvents.includes("overlay:name:destroy"));
      expect(await successPage.evaluate(() => window.__facebookEvents.filter((event) =>
        event.endsWith(":destroy")).sort())).toEqual(["overlay:name:destroy", "overlay:picture:destroy"]);
      const mobileHubBox = await successPage.locator(".race-hub-tabs").boundingBox();
      expect(mobileHubBox).not.toBeNull();
      expect(mobileHubBox!.x).toBeGreaterThanOrEqual(0);
      expect(mobileHubBox!.x + mobileHubBox!.width).toBeLessThanOrEqual(390);
      await successPage.setViewportSize({width: 1280, height: 800});
      const desktopHubBox = await successPage.locator(".race-hub-tabs").boundingBox();
      expect(desktopHubBox).not.toBeNull();
      expect(desktopHubBox!.x).toBeGreaterThanOrEqual(0);
      expect(desktopHubBox!.x + desktopHubBox!.width).toBeLessThanOrEqual(1280);
      await successPage.locator(".race-close").click();
      await successPage.evaluate(() => window.__facebookPause?.());
      await successPage.waitForFunction(() => window.__facebookEvents.includes("flush"));
      await successPage.reload();
      await successPage.waitForFunction(() =>
        window.__facebookEvents.includes("read:riddleQuestPlayerState"), undefined, {timeout: 15_000});
      expect(await successPage.getByRole("alert").count()).toBe(0);
      expect(await successPage.evaluate(() => window.__facebookEvents.filter((event) =>
        event === "read:riddleQuestPreferences").length)).toBe(2);
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }, 30_000);
});
