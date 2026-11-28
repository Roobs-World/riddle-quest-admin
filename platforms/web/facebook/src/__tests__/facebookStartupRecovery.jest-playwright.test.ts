import {describe, expect, it} from "@jest/globals";
import {chromium} from "@playwright/test";

declare global {
  interface Window {
    __facebookStartupFixture: {
      events: string[];
      resolve: () => void;
      reject: () => void;
      launches: number;
    };
  }
}

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("Facebook pending startup recovery in the real artifact", () => {
  it("offers a reload after pending native startup and keeps late completion away from identity", async () => {
    const {execFileSync} = await import("node:child_process");
    const {createServer} = await import("node:http");
    const {mkdtemp, readFile, rm} = await import("node:fs/promises");
    const {tmpdir} = await import("node:os");
    const path = await import("node:path");
    const repositoryRoot = path.resolve(__dirname, "../../../../..");
    const distDirectory = await mkdtemp(path.join(tmpdir(), "riddle-quest-facebook-startup-"));
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    const server = createServer(async (request, response) => {
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      const file = path.resolve(distDirectory, pathname === "/" ? "index.html" : pathname.slice(1));
      if (!file.startsWith(`${distDirectory}${path.sep}`)) {response.writeHead(404).end(); return;}
      try {
        const body = await readFile(file);
        const mime: Record<string, string> = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml"};
        response.writeHead(200, {"content-type": mime[path.extname(file)] ?? "application/octet-stream"}).end(body);
      } catch {response.writeHead(404).end();}
    });
    try {
      execFileSync("pnpm", ["build:facebook"], {
        cwd: repositoryRoot,
        env: {...process.env, FACEBOOK_BUILD_OUT_DIR: distDirectory, VITE_FACEBOOK_AGE_CATEGORY: "13_plus", VITE_NOTIFICATION_SERVICE_URL: ""},
        stdio: "pipe",
      });
      await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Startup fixture server has no TCP address");
      const origin = `http://127.0.0.1:${address.port}`;
      browser = await chromium.launch({headless: true});
      for (const stage of ["initialize", "start"] as const) {
        for (const settlement of ["resolve", "reject"] as const) {
          const context = await browser.newContext({viewport: {width: 390, height: 844}});
          try {
            const page = await context.newPage();
            const identityRequests: string[] = [];
            const uncaught: string[] = [];
            page.on("pageerror", error => uncaught.push(error.message));
            await page.route("**/*", route => {
              const url = new URL(route.request().url());
              if (url.origin === origin) return route.continue();
              if (url.href === "https://connect.facebook.net/en_US/fbinstant.8.0.js") {
                return route.fulfill({status: 200, contentType: "text/javascript", body: "/* SDK injected by isolated startup fixture */"});
              }
              if (/issueFacebookIdentityNonce|exchangeFacebookIdentity|identitytoolkit/u.test(url.href)) identityRequests.push(url.pathname);
              return route.abort("blockedbyclient");
            });
            await page.addInitScript(heldStage => {
              window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
              const events: string[] = [];
              let resolve!: () => void;
              let reject!: (reason: Error) => void;
              const held = new Promise<void>((accept, decline) => {resolve = accept; reject = decline;});
              const launches = Number(sessionStorage.getItem("facebook-startup-fixture-launches") ?? "0") + 1;
              sessionStorage.setItem("facebook-startup-fixture-launches", String(launches));
              window.__facebookStartupFixture = {events, resolve, reject: () => reject(new Error("late-sdk-rejection")), launches};
              window.FBInstant = {
                initializeAsync: () => {events.push("initialize"); return heldStage === "initialize" ? held : Promise.resolve();},
                startGameAsync: () => {events.push("start"); return heldStage === "start" ? held : Promise.resolve();},
                setLoadingProgress: progress => {events.push(`progress:${progress}`);},
                getSupportedAPIs: () => [],
                onPause: () => undefined,
                player: {
                  getID: () => {events.push("player"); return "startup-fixture-player";},
                  getSignedPlayerInfoAsync: async () => {events.push("signed"); throw new Error("unexpected-identity-request");},
                  getDataAsync: async () => {events.push("storage-read"); return {};},
                  setDataAsync: async () => {events.push("storage-write");},
                  flushDataAsync: async () => {events.push("storage-flush");},
                },
              };
            }, stage);
            await page.clock.install();
            await page.goto(origin);
            const loading = page.getByRole("progressbar");
            await loading.waitFor();
            await page.waitForFunction(expected => window.__facebookStartupFixture.events.includes(expected), stage);
            await page.locator(`progress[value="${stage === "initialize" ? "5" : "70"}"]`).waitFor();
            expect(await loading.getAttribute("value")).toBe(stage === "initialize" ? "5" : "70");
            await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1));
            await page.clock.runFor(30_001);
            const recovery = page.getByRole("alert");
            await recovery.waitFor();
            expect(await recovery.getByRole("heading").innerText()).toMatch(/startup failed/iu);
            const retry = recovery.getByRole("button", {name: /retry/iu});
            expect(await retry.isEnabled()).toBe(true);
            const eventsAtRecovery = await page.evaluate(() => [...window.__facebookStartupFixture.events]);
            expect(eventsAtRecovery.filter(event => event === "initialize")).toHaveLength(1);
            expect(eventsAtRecovery.filter(event => event === "start")).toHaveLength(stage === "initialize" ? 0 : 1);
            await page.evaluate(outcome => window.__facebookStartupFixture[outcome](), settlement);
            await page.clock.runFor(1);
            expect(await recovery.isVisible()).toBe(true);
            expect(await page.evaluate(() => window.__facebookStartupFixture.events)).toEqual(eventsAtRecovery);
            expect(identityRequests).toEqual([]);
            expect(uncaught).toEqual([]);
            await page.clock.resume();
            await Promise.all([page.waitForNavigation({waitUntil: "domcontentloaded"}), retry.click()]);
            await page.getByRole("progressbar").waitFor();
            await page.waitForFunction(() => window.__facebookStartupFixture.events.includes("initialize"));
            expect(await page.evaluate(() => window.__facebookStartupFixture.launches)).toBe(2);
            expect(await page.evaluate(() => window.__facebookStartupFixture.events.filter(event => event === "initialize").length)).toBe(1);
            expect(identityRequests).toEqual([]);
            expect(uncaught).toEqual([]);
          } finally {await context.close();}
        }
      }
    } finally {
      await browser?.close();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await rm(distDirectory, {recursive: true, force: true});
    }
  }, 120_000);
});
