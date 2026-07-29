import {describe, expect, it} from "@jest/globals";
import {chromium, type Page} from "@playwright/test";

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

const completeOnboardingAndTours = async (page: Page) => {
  await page.getByRole("button", {name: /let's play/i}).click();
  await page.getByRole("button", {name: /got it/i}).click();
  const guestContinue = page.getByRole("button", {name: /^ok$/i});
  if (await guestContinue.isVisible()) {
    await guestContinue.click();
  }
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", {name: /got it/i}).click();
  }
};

describeBrowser("standalone Jest browser game", () => {
  it("covers onboarding, navigation, gameplay, rewards, restoration and responsive layouts", async () => {
    const {execFileSync} = await import("node:child_process");
    const {createServer} = await import("node:http");
    const {readFile} = await import("node:fs/promises");
    const path = await import("node:path");

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
    const server = createServer(async (request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
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

    await new Promise<void>((resolve) => server.listen(4178, "127.0.0.1", resolve));
    const browser = await chromium.launch({headless: true});
    try {
      const page = await browser.newPage({viewport: {width: 390, height: 844}});
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      await page.goto("http://127.0.0.1:4178/?harness=jest");
      await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15000});
      await completeOnboardingAndTours(page);

      expect(await page.locator(".solar-system").count()).toBe(1);
      expect(await page.locator(".guess-row").count()).toBe(5);
      expect(await page.locator(".keyboard").isVisible()).toBe(true);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth + 1 &&
            document.documentElement.scrollHeight <= innerHeight + 1,
        ),
      ).toBe(true);

      await page.getByRole("button", {name: /^profile$/i}).first().click();
      await page.getByRole("heading", {name: /^profile$/i}).waitFor();
      for (const name of [/statistics/i, /achievements/i, /ranks/i, /leaderboard/i, /treasure/i]) {
        expect(await page.getByRole("button", {name}).isVisible()).toBe(true);
      }
      await page.keyboard.press("Escape");
      await page.getByRole("button", {name: /^settings$/i}).first().click();
      await page.getByRole("heading", {name: /^settings$/i}).waitFor();
      for (const text of [/sound/i, /language/i, /help/i, /credits/i, /about/i, /buy coins/i]) {
        expect(await page.getByText(text).first().isVisible()).toBe(true);
      }
      await page.keyboard.press("Escape");

      await page.locator(".keyboard").getByRole("button", {name: /^P$/}).click();
      await page.locator(".guess-row").first().getByRole("button", {name: /^letter 3$/i}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^A$/}).click();
      await page.reload();
      await page.getByText(/what has keys/i).waitFor({timeout: 15000});
      expect(await page.getByRole("button", {name: /^letter 1: p$/i}).isVisible()).toBe(true);
      expect(await page.getByRole("button", {name: /^letter 3: a$/i}).isVisible()).toBe(true);

      await page.locator(".guess-row").first().getByRole("button", {name: /^letter 2$/i}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^I$/}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^N$/}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^O$/}).click();
      await page.locator(".game-input-actions").getByRole("button", {name: /submit/i}).click();

      await page.getByRole("heading", {name: /achievement unlocked/i}).waitFor({timeout: 15000});
      expect(await page.locator(".sequence-progress").textContent()).toBe("1/2");
      expect(await page.locator(".game-content").evaluate((element) => (element as HTMLElement).inert)).toBe(true);
      await page.getByRole("button", {name: /^next$/i}).click();
      await page.getByRole("heading", {name: /nice job/i}).waitFor();
      await page.waitForTimeout(2800);
      expect(await page.locator(".modal-victory").count()).toBe(1);

      await page.setViewportSize({width: 844, height: 390});
      await page.keyboard.press("Escape");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.setViewportSize({width: 1280, height: 800});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

      expect(await page.locator("body").innerText()).not.toMatch(
        /Clerk|Auth0|sign in with Google|rewarded ad|install the app/i,
      );
      expect(consoleErrors).toEqual([]);

      const iframePage = await browser.newPage({viewport: {width: 390, height: 844}});
      await iframePage.setContent(
        '<iframe title="Jest host" style="width:390px;height:844px;border:0" src="http://127.0.0.1:4178/?harness=jest"></iframe>',
      );
      await iframePage
        .frameLocator('iframe[title="Jest host"]')
        .getByText(/what has keys/i)
        .waitFor({timeout: 15000});
      await iframePage.close();
    } finally {
      await browser.close();
      server.close();
    }
  }, 120000);
});
