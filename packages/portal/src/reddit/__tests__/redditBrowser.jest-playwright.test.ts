import {describe, expect, it} from "@jest/globals";
import {chromium, type Page} from "@playwright/test";

declare global {
  // Devvit injects this before the client bundle executes.
  var devvit: {context: Record<string, unknown>; entrypoints: Record<string, string>; token: string; webViewMode: number};
  interface Window { __redditEffects: unknown[]; }
}

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

const injectDevvit = async (page: Page, mode: 1 | 2) => {
  await page.addInitScript((webViewMode) => {
    globalThis.devvit = {
      context: {},
      entrypoints: {game: "http://127.0.0.1:4182/game.html"},
      token: "browser-test-token",
      webViewMode,
    };
    window.__redditEffects = [];
    window.addEventListener("message", (event) => {
      if (event.data?.type === "devvit-internal") window.__redditEffects.push(event.data);
    });
  }, mode);
};

describeBrowser("Reddit artifact with injected Devvit context", () => {
  it("requires a trusted click to expand and starts authenticated play through same-origin APIs", async () => {
    const {execFileSync} = await import("node:child_process");
    const {createServer} = await import("node:http");
    const {readFile} = await import("node:fs/promises");
    const path = await import("node:path");
    const packageRoot = path.resolve(__dirname, "../../..");
    if (process.env.PORTAL_USE_EXISTING_BUILD !== "1") {
      execFileSync("pnpm", ["--filter", "@qwordly/portal", "build:reddit"], {
        cwd: path.resolve(packageRoot, "../.."), stdio: "inherit",
      });
    }
    const distDirectory = path.join(packageRoot, "dist-reddit");
    const server = createServer(async (request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const requested = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.replace(/^\//u, "");
      const filePath = path.resolve(distDirectory, requested);
      if (!filePath.startsWith(`${distDirectory}${path.sep}`) && filePath !== path.join(distDirectory, "index.html")) {
        response.writeHead(404).end(); return;
      }
      try {
        const body = await readFile(filePath);
        const extension = path.extname(filePath);
        response.writeHead(200, {"content-type": extension === ".html" ? "text/html" : extension === ".js" ? "text/javascript" : extension === ".css" ? "text/css" : "application/octet-stream"});
        response.end(body);
      } catch { response.writeHead(404).end(); }
    });
    await new Promise<void>((resolve) => server.listen(4182, "127.0.0.1", resolve));
    const browser = await chromium.launch({headless: true});
    try {
      const inline = await browser.newPage({viewport: {width: 390, height: 844}});
      await injectDevvit(inline, 1);
      await inline.addInitScript(() => window.localStorage.setItem("appLanguage", "ar"));
      await inline.route("**/api/session", (route) => route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, authenticated: false})}));
      await inline.goto("http://127.0.0.1:4182/reddit-inline.html");
      await inline.getByRole("button", {name: "العب"}).click();
      expect(await inline.locator("html").getAttribute("lang")).toBe("ar");
      expect(await inline.locator("html").getAttribute("dir")).toBe("rtl");
      await expect(inline.getByText("حل لغز اليوم وتحدَّ المجتمع.", {exact: true}).count()).resolves.toBe(1);
      await inline.waitForFunction(() => window.__redditEffects.length > 0);
      const effects = await inline.evaluate(() => window.__redditEffects);
      expect(JSON.stringify(effects)).toContain("game.html");
      expect(JSON.stringify(effects)).toContain("immersiveMode");

      const localeSmoke = await browser.newPage({viewport: {width: 390, height: 844}});
      await injectDevvit(localeSmoke, 1);
      await localeSmoke.route("**/api/session", (route) => route.fulfill({status: 200,
        contentType: "application/json", body: JSON.stringify({ok: true, authenticated: false})}));
      await localeSmoke.goto("http://127.0.0.1:4182/reddit-inline.html");
      for (const locale of ["ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "vi", "zh"]) {
        await localeSmoke.evaluate((value) => window.localStorage.setItem("appLanguage", value), locale);
        await localeSmoke.reload();
        await localeSmoke.locator(`html[lang="${locale}"]`).waitFor();
        expect(await localeSmoke.getByRole("button").count()).toBe(1);
        expect(await localeSmoke.locator("main h1").innerText()).toBe("Riddle Quest");
      }

      const authenticatedLocaleSmoke = await browser.newPage({viewport: {width: 390, height: 844}});
      await injectDevvit(authenticatedLocaleSmoke, 2);
      let savedLocale = "en";
      await authenticatedLocaleSmoke.route("**/api/**", (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const json = (body: unknown) => route.fulfill({status: 200, contentType: "application/json",
          body: JSON.stringify(body)});
        if (pathname === "/api/session") return json({ok: true, authenticated: true, accountGeneration: 1,
          features: {identity: true, gameplay: true, commerce: false, referrals: false, notifications: false,
            matchmaking: false, tournaments: false, presence: false}});
        if (pathname === "/api/storage/read") return json({ok: true,
          preferences: {locale: savedLocale, onboardingComplete: true}, playerData: null});
        if (pathname === "/api/game/profile.load") return json({ok: true, result: {username: "LocaleSolver",
          coins: 300, level: 1, xp: 0, winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
        if (pathname === "/api/game/race.access") return json({ok: true, result: {enabled: false,
          locale: savedLocale, reason: "disabled"}});
        if (pathname === "/api/game/riddle.classic") return json({ok: true, result: {challenge: {
          totalQuestions: 1, questions: [{riddleId: `riddle-${savedLocale}`, text: `locale-riddle-${savedLocale}`,
            answerLength: 5, sessionToken: "00000000-0000-4000-8000-000000000001", questionNumber: 1,
            attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false}]}}});
        return json({ok: false, error: `unexpected ${pathname}`});
      });
      for (const locale of ["ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "vi", "zh"]) {
        savedLocale = locale;
        await authenticatedLocaleSmoke.goto("http://127.0.0.1:4182/");
        await authenticatedLocaleSmoke.getByText(`locale-riddle-${locale}`, {exact: true}).waitFor();
        await authenticatedLocaleSmoke.waitForFunction((value) => document.documentElement.lang === value, locale);
        expect(await authenticatedLocaleSmoke.locator("html").getAttribute("lang")).toBe(locale);
      }

      const guest = await browser.newPage({viewport: {width: 390, height: 844}});
      const guestApiRequests: string[] = [];
      await injectDevvit(guest, 2);
      await guest.route("**/api/**", (route) => {
        guestApiRequests.push(new URL(route.request().url()).pathname);
        return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, authenticated: false})});
      });
      await guest.goto("http://127.0.0.1:4182/");
      await guest.getByText("What has keys but cannot open doors?", {exact: true}).waitFor({timeout: 15_000});
      expect(guestApiRequests).toEqual(["/api/session"]);
      await guest.getByRole("button", {name: "Log in to save progress"}).click();
      await guest.waitForFunction(() => JSON.stringify(window.__redditEffects).includes("loginPrompt"));

      const expanded = await browser.newPage({viewport: {width: 390, height: 844}});
      const apiRequests: string[] = [];
      await injectDevvit(expanded, 2);
      await expanded.route("**/api/**", async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        apiRequests.push(pathname);
        if (pathname === "/api/session") return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, authenticated: true, accountGeneration: 1, features: {identity: true, gameplay: true, commerce: false, referrals: false, notifications: false, matchmaking: true, tournaments: true, presence: true}})});
        if (pathname === "/api/storage/read") return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, preferences: {locale: "ar", reducedMotion: true, highContrast: true, onboardingComplete: true, presenceEnabled: true}, playerData: null})});
        if (pathname === "/api/storage/write") return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true})});
        if (pathname === "/api/game/profile.load") return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, result: {username: "RedditSolver", coins: 300, level: 1, xp: 0, winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}})});
        if (pathname === "/api/game/race.access") return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, result: {enabled: true, locale: "en", reason: "enabled"}})});
        if (pathname === "/api/game/race.match") return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, result: {status: "matched", challenge: {
          challengeId: "reddit-offline-match", creator: {displayName: "FreshRedditRival", avatarUrl: "https://styles.redditmedia.com/avatar.png"}, categoryId: "history", locale: "ar",
          targetCorrect: 10, adjustedTimeToBeatMs: 40_000, rulesVersion: "race10_v1", expiresAtMs: Date.now() + 60_000, status: "active",
        }}})});
        if (pathname === "/api/game/tournament.list") return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, result: {
          tournamentId: "reddit-race10-ar-2026-08-20", locale: "ar", startsAtMs: Date.UTC(2026, 7, 20),
          endsAtMs: Date.UTC(2026, 7, 21), sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
          standings: [{rank: 1, adjustedTimeMs: 25_000, isCurrentPlayer: true}],
          currentPlayer: {rank: 1, adjustedTimeMs: 25_000, isCurrentPlayer: true},
        }})});
        if (pathname === "/api/game/presence.poll") return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, result: {rivals: []}})});
        if (pathname === "/api/game/presence.disconnect") return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, result: {success: true}})});
        if (pathname === "/api/game/riddle.classic") return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({ok: true, result: {challenge: {totalQuestions: 1, questions: [{riddleId: "reddit-browser-riddle", text: "What has keys but no locks?", answerLength: 5, sessionToken: "00000000-0000-4000-8000-000000000001", questionNumber: 1, attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false}]}}})});
        return route.fulfill({status: 500, contentType: "application/json", body: JSON.stringify({ok: false, error: `unexpected ${pathname}`})});
      });
      await expanded.goto("http://127.0.0.1:4182/");
      try {
        await expanded.getByText("What has keys but no locks?", {exact: true}).waitFor({timeout: 15_000});
      } catch (error) {
        throw new Error(`${error instanceof Error ? error.message : String(error)} ${JSON.stringify({
          body: await expanded.locator("body").innerText(), apiRequests,
        })}`);
      }
      expect(apiRequests).toContain("/api/session");
      expect(apiRequests).toContain("/api/storage/read");
      expect(apiRequests).toContain("/api/game/profile.load");
      expect(apiRequests).toContain("/api/game/presence.poll");
      expect(apiRequests.every((request) => request.startsWith("/api/"))).toBe(true);
      await expanded.waitForFunction(() => document.documentElement.lang === "ar");
      expect(await expanded.locator("html").getAttribute("dir")).toBe("rtl");
      expect(await expanded.locator("html").getAttribute("data-riddle-quest-reduced-motion")).toBe("true");
      expect(await expanded.locator("html").getAttribute("data-riddle-quest-high-contrast")).toBe("true");
      expect(await expanded.getByRole("button", {name: /buy coins/i}).count()).toBe(0);
      await expanded.locator(".multiplayer-navigation-action").evaluate((button: HTMLButtonElement) => button.click());
      const hubTabs = expanded.locator('.race-hub-tabs [role="tab"]');
      await hubTabs.first().waitFor({state: "attached"});
      expect(await hubTabs.count()).toBe(3);
      expect(await expanded.locator('.race-hub-tabs [role="tablist"]').count()).toBe(1);
      expect(await expanded.locator('.race-hub-tabs [role="tab"][aria-selected="true"]').count()).toBe(1);
      expect(await expanded.locator(".race-hub-social-actions").count()).toBe(1);
      expect(await expanded.locator(".race-hub-social-actions button").count()).toBe(1);
      await hubTabs.last().click();
      await expanded.locator(".race-tournaments li").waitFor({state: "attached"});
      expect(await expanded.locator('.race-tournaments[data-rewards-enabled="false"]').count()).toBe(1);
      expect(await expanded.locator(".race-tournaments").innerText()).toContain("#1");
      expect(apiRequests.filter((request) => request === "/api/game/tournament.list")).toHaveLength(1);
      await hubTabs.first().click();
      await expanded.locator(".race-hub-social-actions button").evaluate((button: HTMLButtonElement) => button.click());
      await expanded.locator('[data-analytics-screen="multiplayer_challenge"]').waitFor({state: "attached"});
      expect(await expanded.locator('[data-analytics-screen="multiplayer_challenge"]').innerText()).toContain("FreshRedditRival");
      expect(apiRequests.filter((request) => request === "/api/game/race.match")).toHaveLength(1);
      await expanded.locator(".race-close").click();
      const settingsButton = expanded.locator(".game-bottom-navigation button").first();
      await settingsButton.click({force: true});
      await expanded.getByRole("dialog").waitFor();
      expect(await expanded.getByRole("dialog").getByText(/buy coins/i).count()).toBe(0);
      expect(await expanded.getByRole("dialog").getByText(/subscribe|premium|remove ads|ad[- ]?free/i).count()).toBe(0);
      expect(await expanded.locator('script[src*="firebase"]').count()).toBe(0);
      expect(await expanded.locator('script[src*="fbinstant"]').count()).toBe(0);
      expect(await expanded.locator('script[src*="cdn.jest.com"]').count()).toBe(0);
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }, 45_000);
});
