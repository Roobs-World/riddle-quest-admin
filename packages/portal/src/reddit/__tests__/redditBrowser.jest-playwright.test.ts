import {protectContent} from "@qwordly/core/contentProtection";
import {installLiveMultiplayerJourney} from "../../play/__tests__/liveMultiplayer.jest-playwright.support";
import {verifyImmediateSoloFeedback} from "../../play/__tests__/instantFeedback.jest-playwright.support";
import {verifyRedditBrowserRedirects} from "./redditRedirect.jest-playwright.support";
import {verifyRedditTournamentBoard, verifyRedditTournamentLiveResult} from "./redditTournament.jest-playwright.support";
import {describe, expect, it} from "@jest/globals";
import {chromium, type Page} from "@playwright/test";

/** Documents global. */
declare global {
  // Devvit injects this before the client bundle executes.
  /** Provides devvit behavior. */
  var devvit: {
    /** Stores context. */
    context: Record<string, unknown>;
    /** Stores entrypoints. */
    entrypoints: Record<string, string>;
    /** Stores token. */
    token: string;
    /** Stores web view mode. */
    webViewMode: number;
  };
  /** Defines the contract for window. */
  interface Window {
    /** Stores reddit effects. */
    __redditEffects: Array<{
      /** Correlates Devvit requests and replies. */
      id?: string;
      /** Captures checkout arguments sent to Reddit. */
      createOrder?: {
        /** Requested Reddit product identifiers. */
        skus: string[];
        /** Opaque account association for recovery. */
        metadata: Record<string, string>;
      };
    }>;
  }
}

/** Provides describe browser behavior. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

/** Provides inject devvit behavior. */
const injectDevvit = async (page: Page, mode: 1 | 2, origin: string) => {
  await page.addInitScript(({webViewMode, origin}) => {
    globalThis.devvit = {
      context: {},
      entrypoints: {game: `${origin}/game.html`},
      token: "browser-test-token",
      webViewMode,
    };
    window.__redditEffects = [];
    window.addEventListener("message", (event) => {
      if (event.data?.type === "devvit-internal") window.__redditEffects.push(event.data);
    });
  }, {webViewMode: mode, origin});
};

describeBrowser("Reddit artifact with injected Devvit context", () => {
  it("requires a trusted click to expand and starts authenticated play through same-origin APIs", async () => {
    /** Provides {exec file sync} behavior. */
    const {execFileSync} = await import("node:child_process");
    /** Provides {create server} behavior. */
    const {createServer} = await import("node:http");
    /** Provides {read file} behavior. */
    const {readFile} = await import("node:fs/promises");
    /** Provides path behavior. */
    const path = await import("node:path");
    /** Provides package root behavior. */
    const packageRoot = path.resolve(__dirname, "../../..");
    if (process.env.PORTAL_USE_EXISTING_BUILD !== "1") {
      execFileSync("pnpm", ["--filter", "@qwordly/portal", "build:reddit"], {
        cwd: path.resolve(packageRoot, "../.."),
        stdio: "inherit",
      });
    }
    /** Provides dist directory behavior. */
    const distDirectory = process.env.PORTAL_REDDIT_BUILD_DIR
      ? path.resolve(process.env.PORTAL_REDDIT_BUILD_DIR)
      : path.join(packageRoot, "dist-reddit");
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
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    /** Ephemeral origin isolates this fixture from concurrent browser checks. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("reddit-browser-server-address-missing");
    /** SDK entry points and browser navigation use the same isolated server. */
    const origin = `http://127.0.0.1:${address.port}`;
    /** Provides browser behavior. */
    const browser = await chromium.launch({headless: true});
    try {
      await verifyRedditBrowserRedirects(browser, origin, injectDevvit);
      /** Provides inline behavior. */
      const inline = await browser.newPage({viewport: {width: 390, height: 844}});
      await injectDevvit(inline, 1, origin);
      await inline.addInitScript(() => window.localStorage.setItem("appLanguage", "ar"));
      await inline.route("**/api/session", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ok: true, authenticated: false}),
        }),
      );
      await inline.goto(`${origin}/reddit-inline.html`);
      await inline.getByRole("button", {name: "العب"}).click();
      expect(await inline.locator("html").getAttribute("lang")).toBe("ar");
      expect(await inline.locator("html").getAttribute("dir")).toBe("rtl");
      await expect(inline.getByText("حل لغز اليوم وتحدَّ المجتمع.", {exact: true}).count()).resolves.toBe(1);
      await inline.waitForFunction(() => window.__redditEffects.length > 0);
      /** Provides effects behavior. */
      const effects = await inline.evaluate(() => window.__redditEffects);
      expect(JSON.stringify(effects)).toContain("game.html");
      expect(JSON.stringify(effects)).toContain("immersiveMode");

      /** Provides locale smoke behavior. */
      const localeSmoke = await browser.newPage({viewport: {width: 390, height: 844}});
      await injectDevvit(localeSmoke, 1, origin);
      await localeSmoke.route("**/api/session", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ok: true, authenticated: false}),
        }),
      );
      await localeSmoke.goto(`${origin}/reddit-inline.html`);
      for (const locale of [
        "ar",
        "de",
        "en",
        "es",
        "fr",
        "hi",
        "id",
        "it",
        "ja",
        "ko",
        "nl",
        "pl",
        "pt",
        "ru",
        "tr",
        "vi",

      ]) {
        await localeSmoke.evaluate((value) => window.localStorage.setItem("appLanguage", value), locale);
        await localeSmoke.reload();
        await localeSmoke.locator(`html[lang="${locale}"]`).waitFor();
        expect(await localeSmoke.getByRole("button").count()).toBe(1);
        expect(await localeSmoke.locator("main h1").innerText()).toBe("Riddle Quest");
      }

      /** Provides authenticated locale smoke behavior. */
      const authenticatedLocaleSmoke = await browser.newPage({viewport: {width: 390, height: 844}});
      await injectDevvit(authenticatedLocaleSmoke, 2, origin);
      /** Saves d locale. */
      let savedLocale = "en";
      /** Enables checkout only for the dedicated commerce journey. */
      let commerceEnabled = false;
      /** Models the authoritative balance returned by the gateway. */
      let commerceBalance = 300;
      await authenticatedLocaleSmoke.route("**/api/**", (route) => {
        /** Provides pathname behavior. */
        const pathname = new URL(route.request().url()).pathname;
        /** Provides json behavior. */
        const json = async (body: unknown) => {
          /** Real wire negotiation from the built Reddit artifact. */
          const protection = route.request().postDataJSON()?.contentProtection;
          if (protection === 1 && body && typeof body === "object" && "result" in body) {
            /** Server ciphertext traverses the same-origin gateway unchanged. */
            const result = await protectContent(body.result);
            return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({...body, result})});
          }
          return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify(body)});
        };
        if (pathname === "/api/session")
          return json({
            ok: true,
            authenticated: true,
            accountGeneration: 1,
            features: {
              identity: true,
              gameplay: true,
              commerce: commerceEnabled,
              referrals: false,
              notifications: false,
              matchmaking: false,
              tournaments: false,
              presence: false,
            },
          });
        if (pathname === "/api/commerce/recover") return json({ok: true, recovered: 0});
        if (pathname === "/api/commerce/key")
          return json({ok: true, key: "R".repeat(43), metadataKey: "riddle-account"});
        if (pathname === "/api/storage/write") return json({ok: true});
        if (pathname === "/api/storage/read")
          return json({ok: true, preferences: {locale: savedLocale, onboardingComplete: true}, playerData: null});
        if (pathname === "/api/game/profile.load")
          return json({
            ok: true,
            result: {
              username: "LocaleSolver",
              coins: commerceBalance,
              level: 1,
              xp: 0,
              winStreak: 0,
              gamesPlayed: 0,
              wins: 0,
              achievements: [],
              classicIndex: 1,
            },
          });
        if (pathname === "/api/game/race.access")
          return json({ok: true, result: {enabled: false, locale: savedLocale, reason: "disabled"}});
        if (pathname === "/api/game/riddle.classic")
          return json({
            ok: true,
            result: {
              challenge: {
                totalQuestions: 1,
                questions: [
                  {
                    riddleId: `riddle-${savedLocale}`,
                    text: `locale-riddle-${savedLocale}`,
                    answerLength: 5,
                    sessionToken: "00000000-0000-4000-8000-000000000001",
                    questionNumber: 1,
                    attemptsUsed: 0,
                    hasUsedContinue: false,
                    awaitingContinue: false,
                  },
                ],
              },
            },
          });
        return json({ok: false, error: `unexpected ${pathname}`});
      });
      for (const locale of [
        "ar",
        "de",
        "en",
        "es",
        "fr",
        "hi",
        "id",
        "it",
        "ja",
        "ko",
        "nl",
        "pl",
        "pt",
        "ru",
        "tr",
        "vi",

      ]) {
        savedLocale = locale;
        await authenticatedLocaleSmoke.goto(`${origin}/`);
        await authenticatedLocaleSmoke.getByText(`locale-riddle-${locale}`, {exact: true}).waitFor();
        await authenticatedLocaleSmoke.waitForFunction((value) => document.documentElement.lang === value, locale);
        expect(await authenticatedLocaleSmoke.locator("html").getAttribute("lang")).toBe(locale);
      }

      // Exercise the real Devvit checkout bridge without spending live Reddit Gold.
      authenticatedLocaleSmoke.setDefaultTimeout(5_000);
      try {
        commerceEnabled = true;
        savedLocale = "en";
        await authenticatedLocaleSmoke.goto(`${origin}/`);
        await authenticatedLocaleSmoke.getByText("locale-riddle-en", {exact: true}).waitFor();
        await authenticatedLocaleSmoke.getByTestId("server-activity-loader").waitFor({state: "hidden"});
        await authenticatedLocaleSmoke.getByRole("button", {name: /let's play/i}).click();
        await authenticatedLocaleSmoke.getByRole("button", {name: /got it/i}).click();
        for (let step = 0; step < 4; step += 1) {
          /** Advances only the visible registered-player tutorial steps. */
          const next = authenticatedLocaleSmoke.getByRole("button", {name: /got it/i});
          if (!await next.isVisible()) break;
          await next.click();
        }
        await authenticatedLocaleSmoke.locator("button.coin-pill").click();
        await authenticatedLocaleSmoke.locator(".game-shop-grid article").first().waitFor();
        expect(await authenticatedLocaleSmoke.locator(".game-shop-grid article").count()).toBe(6);
        for (const gold of [50, 100, 150, 250, 500, 1000]) {
          expect(await authenticatedLocaleSmoke.getByRole("button", {name: new RegExp(`^${gold} Gold$`)}).count()).toBe(1);
        }
        expect(await authenticatedLocaleSmoke.locator(".shop-balance strong").innerText()).toBe("300");
        for (const status of [0, 1]) {
          await authenticatedLocaleSmoke.evaluate(() => { window.__redditEffects = []; });
          await authenticatedLocaleSmoke.getByRole("button", {name: /^50 Gold$/}).click();
          await authenticatedLocaleSmoke.waitForFunction(() =>
            window.__redditEffects.some((effect) => effect.createOrder),
          );
          // The client must not award coins merely for opening checkout.
          expect(await authenticatedLocaleSmoke.locator(".shop-balance strong").innerText()).toBe("300");
          if (status === 1) commerceBalance = 550;
          await authenticatedLocaleSmoke.evaluate((checkoutStatus) => {
            /** Checkout message emitted by the installed Devvit SDK. */
            const effect = window.__redditEffects.find((value) => value.createOrder);
            if (!effect?.createOrder) throw new Error("missing-reddit-checkout-effect");
            if (JSON.stringify(effect.createOrder.skus) !== JSON.stringify(["riddle_quest_coins_250"]) ||
              effect.createOrder.metadata["riddle-account"] !== "R".repeat(43)) {
              throw new Error("incorrect-reddit-checkout-payload");
            }
            window.postMessage({type: "devvit-message", data: {
              id: effect.id,
              orderResult: {status: checkoutStatus, orderId: checkoutStatus === 1 ? "gold-order-1" : ""},
            }}, "*");
          }, status);
          if (status === 1) {
            await authenticatedLocaleSmoke.getByText("250 coins added.", {exact: true}).waitFor();
          } else {
            await authenticatedLocaleSmoke.getByRole("button", {name: /^50 Gold$/}).waitFor();
          }
        }
        await authenticatedLocaleSmoke.reload();
        await authenticatedLocaleSmoke.getByText("locale-riddle-en", {exact: true}).waitFor();
        await authenticatedLocaleSmoke.waitForFunction(() =>
          document.querySelector(".coin-pill strong")?.textContent === "550",
        );
      } catch (error) {
        throw new Error(`${String(error)} ${await authenticatedLocaleSmoke.locator("body").innerText()}`);
      }

      /** Provides guest behavior. */
      const guest = await browser.newPage({viewport: {width: 390, height: 844}});
      /** Provides guest api requests behavior. */
      const guestApiRequests: string[] = [];
      await injectDevvit(guest, 2, origin);
      await guest.route("**/api/**", (route) => {
        guestApiRequests.push(new URL(route.request().url()).pathname);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ok: true, authenticated: false}),
        });
      });
      await guest.goto(`${origin}/`);
      await guest.getByText("What has keys but cannot open doors?", {exact: true}).waitFor({timeout: 15_000});
      expect(guestApiRequests).toEqual(["/api/session"]);
      await guest.getByRole("button", {name: "Log in to save progress"}).click();
      await guest.waitForFunction(() => JSON.stringify(window.__redditEffects).includes("loginPrompt"));

      /** Provides expanded behavior. */
      const expanded = await browser.newPage({viewport: {width: 390, height: 844}});
      /** Provides api requests behavior. */
      const apiRequests: string[] = [];
      await injectDevvit(expanded, 2, origin);
      await expanded.addInitScript(() => {
        // Seed the same locale as the authoritative preference fixture before the first session renders.
        window.localStorage.setItem("appLanguage", "ar");
        // The translation catalog can commit before the embedded game receives host initialization.
        window.addEventListener("riddle-quest:host-to-game", event => {
          /** Observed initialization is the rendered game's locale authority. */
          const message = (event as CustomEvent).detail;
          if (message?.type === "host:init") document.documentElement.dataset.redditHostLocale = message.payload.locale;
        });
      });
      /** One actual same-origin storage rejection must recover without further input. */
      let failDraftOnce = false, failedDrafts = 0, recoveredDrafts = 0;
      await expanded.route("**/api/**", async (route) => {
        /** Provides pathname behavior. */
        const pathname = new URL(route.request().url()).pathname;
        apiRequests.push(pathname);
        if (pathname === "/api/session")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              authenticated: true,
              accountGeneration: 1,
              features: {
                identity: true,
                gameplay: true,
                commerce: false,
                referrals: false,
                notifications: false,
                matchmaking: true,
                tournaments: true,
                presence: true,
              },
            }),
          });
        if (pathname === "/api/storage/read")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              preferences: {
                locale: "ar",
                reducedMotion: true,
                highContrast: true,
                onboardingComplete: true,
                presenceEnabled: true,
              },
              playerData: null,
            }),
          });
        if (pathname === "/api/storage/write") {
          /** Observes the real Reddit adapter's versioned projection payload. */
          const input = route.request().postDataJSON();
          if (input.playerData?.activeGame?.currentLetters.join("") === "PIAN") {
            if (failDraftOnce) {failDraftOnce = false; failedDrafts++; return route.fulfill({status: 503, contentType: "application/json", body: JSON.stringify({ok: false})});}
            if (failedDrafts > 0) recoveredDrafts++;
          }
          return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true})});
        }
        if (pathname === "/api/game/profile.load")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              result: {
                username: "RedditSolver",
                coins: 300,
                level: 1,
                xp: 0,
                winStreak: 0,
                gamesPlayed: 0,
                wins: 0,
                achievements: [],
                classicIndex: 1,
              },
            }),
          });
        if (pathname === "/api/game/race.access")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ok: true, result: {enabled: true, locale: route.request().postDataJSON().locale, reason: "enabled"}}),
          });
        if (pathname === "/api/game/presence.poll")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ok: true, result: {rivals: []}}),
          });
        if (pathname === "/api/game/presence.disconnect")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ok: true, result: {success: true}}),
          });
        if (pathname === "/api/game/riddle.classic")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              result: {
                challenge: {
                  totalQuestions: 1,
                  questions: [
                    {
                      riddleId: "reddit-browser-riddle",
                      text: "What has keys but no locks?",
                      evaluation: {answer: "piano", locale: route.request().postDataJSON().locale},
                      answerLength: 5,
                      sessionToken: "00000000-0000-4000-8000-000000000001",
                      questionNumber: 1,
                      attemptsUsed: 0,
                      hasUsedContinue: false,
                      awaitingContinue: false,
                    },
                  ],
                },
              },
            }),
          });
        if (pathname === "/api/game/guess.submit") return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ok: true, result: {
            feedback: [..."crane"].map((letter, index) => ({letter, status: index === 2 || index === 3 ? "green" : "red"})),
            attempts: 1, isCorrect: false, gameOver: false,
          }}),
        });
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ok: false, error: `unexpected ${pathname}`}),
        });
      });
      /** Current multiplayer journey crosses only same-origin Devvit live endpoints. */
      const verifyMultiplayer = await installLiveMultiplayerJourney(expanded, "Reddit");
      await expanded.goto(`${origin}/`);
      try {
        await expanded.getByText("What has keys but no locks?", {exact: true}).waitFor({timeout: 15_000});
      } catch (error) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)} ${JSON.stringify({
            body: await expanded.locator("body").innerText(),
            apiRequests,
          })}`,
        );
      }
      expect(apiRequests).toContain("/api/session");
      expect(apiRequests).toContain("/api/storage/read");
      expect(apiRequests).toContain("/api/game/profile.load");
      expect(apiRequests).toContain("/api/game/presence.poll");
      expect(apiRequests.every((request) => request.startsWith("/api/"))).toBe(true);
      await expanded.waitForFunction(() => document.documentElement.lang === "ar");
      try {
        await expanded.waitForFunction(() => document.documentElement.dataset.redditHostLocale === "ar");
      } catch (error) {
        throw new Error(`${String(error)} ${JSON.stringify(await expanded.evaluate(() => ({
          lang: document.documentElement.lang, hostLocale: document.documentElement.dataset.redditHostLocale,
          body: document.body.innerText,
        })))}`);
      }
      expect(await expanded.locator("html").getAttribute("dir")).toBe("rtl");
      expect(await expanded.locator("html").getAttribute("data-riddle-quest-reduced-motion")).toBe("true");
      expect(await expanded.locator("html").getAttribute("data-riddle-quest-high-contrast")).toBe("true");
      expect(await expanded.getByRole("button", {name: /buy coins/i}).count()).toBe(0);
      await expanded.locator(".onboarding-card button").waitFor();
      for (let step = 0; step < 10; step += 1) {
        /** Currently visible onboarding or tutorial action. */
        const guidanceButton = expanded.locator(".onboarding-card button, .tooltip-card button");
        if (await guidanceButton.count()) await guidanceButton.last().click();
        await expanded.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      await verifyMultiplayer("ar");
      await verifyRedditTournamentBoard(expanded);
      await verifyRedditTournamentLiveResult(expanded);
      expect(apiRequests.every(request => request.startsWith("/api/"))).toBe(true);
      await verifyImmediateSoloFeedback(expanded, "Reddit");
      failDraftOnce = true;
      await expanded.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        Reflect.set(window, "__redditUnhandledProgress", []);
        window.addEventListener("unhandledrejection", event => Reflect.get(window, "__redditUnhandledProgress").push(String(event.reason)));
      });
      await expanded.keyboard.type("ian");
      await expanded.waitForResponse(response => response.url().endsWith("/api/storage/write") && response.status() === 200 &&
        response.request().postDataJSON()?.playerData?.activeGame?.currentLetters.join("") === "PIAN");
      expect(failedDrafts).toBe(1);
      expect(recoveredDrafts).toBe(1);
      expect(await expanded.evaluate(() => Reflect.get(window, "__redditUnhandledProgress"))).toEqual([]);
      expect(await expanded.locator(".player-save-notice").count()).toBe(0);
      for (let index = 0; index < 3; index++) await expanded.keyboard.press("Backspace");
      /** Sets tings button. */
      const settingsButton = expanded.locator(".game-bottom-navigation button").first();
      await settingsButton.click({force: true});
      await expanded.getByRole("dialog").waitFor();
      expect(
        await expanded
          .getByRole("dialog")
          .getByText(/buy coins/i)
          .count(),
      ).toBe(0);
      expect(
        await expanded
          .getByRole("dialog")
          .getByText(/subscribe|premium|remove ads|ad[- ]?free/i)
          .count(),
      ).toBe(0);
      expect(await expanded.locator('script[src*="firebase"]').count()).toBe(0);
      expect(await expanded.locator('script[src*="fbinstant"]').count()).toBe(0);
      expect(await expanded.locator('script[src*="cdn.jest.com"]').count()).toBe(0);
      /** Devvit returns focus when expanded play closes, even while the document remains visible. */
      const disconnected = expanded.waitForResponse(response => new URL(response.url()).pathname === "/api/game/presence.disconnect");
      await expanded.evaluate(() => {
        devvit.webViewMode = 1;
        window.dispatchEvent(new Event("focus"));
      });
      await expanded.locator(".reddit-entry button").waitFor();
      await disconnected;
      expect(await expanded.locator(".game-bottom-navigation").count()).toBe(0);
      await expanded.evaluate(() => {
        devvit.webViewMode = 2;
        window.dispatchEvent(new Event("focus"));
      });
      await expanded.getByText("What has keys but no locks?", {exact: true}).waitFor({timeout: 15_000});
      expect(await expanded.locator(".reddit-entry").count()).toBe(0);
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  }, 150_000);
});
