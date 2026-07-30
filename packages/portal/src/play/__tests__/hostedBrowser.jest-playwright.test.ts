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
  it("covers onboarding, navigation, guest progress reset, gameplay, rewards and responsive layouts", async () => {
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
      await page.addInitScript(() => {
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:jest-guest", "seen");
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
      await page.getByRole("button", {name: /buy coins/i}).first().click();
      await page.getByRole("heading", {name: /coin shop/i}).waitFor();
      await page.keyboard.press("Escape");
      await page.setViewportSize({width: 390, height: 667});
      await page.waitForFunction(
        () => (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <= innerHeight + 1,
      );
      expect(
        await page.evaluate(() => {
          const navigation = document.querySelector(".game-bottom-navigation")?.getBoundingClientRect();
          return (
            document.documentElement.scrollWidth <= innerWidth + 1 &&
            document.documentElement.scrollHeight <= innerHeight + 1 &&
            Boolean(navigation && navigation.bottom <= innerHeight + 1)
          );
        }),
      ).toBe(true);

      await page.getByRole("button", {name: /^profile$/i}).first().click();
      await page.getByRole("heading", {name: /^profile$/i}).waitFor();
      await page.locator(".tooltip-card").getByRole("heading", {name: /^profile$/i}).waitFor();
      for (let step = 0; step < 8; step += 1) {
        await page.locator(".tooltip-card").getByRole("button", {name: /got it/i}).click();
      }
      for (const name of [/statistics/i, /achievements/i, /ranks/i, /leaderboard/i, /treasure/i]) {
        expect(await page.getByRole("button", {name}).isVisible()).toBe(true);
      }
      await page.getByRole("button", {name: /^ranks$/i}).evaluate((button) => (button as HTMLButtonElement).click());
      await page.locator(".modal-ranks").waitFor();
      const rankIconNames = await page.locator(".modal-ranks [data-rank-icon]").evaluateAll(
        (icons) => icons.map((icon) => icon.getAttribute("data-rank-icon")),
      );
      expect(rankIconNames).toHaveLength(8);
      expect(new Set(rankIconNames).size).toBe(8);
      await page.keyboard.press("Escape");
      await page.getByRole("button", {name: /^profile$/i}).first().click();
      await page.locator(".modal-profile").waitFor();
      const loadingLeaderboard = await page.getByRole("button", {name: /^leaderboard$/i}).evaluate(
        async (button) => {
          (button as HTMLButtonElement).click();
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const list = document.querySelector(".leaderboard-list");
          return {
            busy: list?.getAttribute("aria-busy"),
            text: list?.textContent?.trim() ?? "",
          };
        },
      );
      expect(loadingLeaderboard).toEqual({busy: "true", text: ""});
      const leaderboardList = page.locator(".leaderboard-list");
      await leaderboardList.waitFor();
      const leaderboardOffsets = await page.locator(".modal-leaderboard").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          horizontal: Math.abs(rect.left + rect.width / 2 - innerWidth / 2),
          vertical: Math.abs(rect.top + rect.height / 2 - innerHeight / 2),
        };
      });
      expect(leaderboardOffsets.horizontal).toBeLessThanOrEqual(0.5);
      expect(leaderboardOffsets.vertical).toBeLessThanOrEqual(0.5);
      await page.waitForFunction(
        () => document.querySelector(".leaderboard-list")?.getAttribute("aria-busy") === "false",
      );
      expect((await leaderboardList.innerText()).trim()).not.toBe("");
      expect(await leaderboardList.locator("li").count()).toBe(10);
      expect(await leaderboardList.locator(".leaderboard-avatar").count()).toBeGreaterThan(0);
      expect(await leaderboardList.locator(".leaderboard-avatar-fallback").count()).toBeGreaterThan(0);
      const firstPageFits = await leaderboardList.evaluate((list) => {
        const lastRow = list.lastElementChild?.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        return Boolean(lastRow && lastRow.bottom <= listRect.bottom + 1);
      });
      expect(firstPageFits).toBe(true);
      await page.getByRole("button", {name: /next page/i}).click();
      expect(await leaderboardList.locator("li").count()).toBe(10);
      expect(await leaderboardList.locator("li").first().locator("b").textContent()).toBe("11");
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
      const activeGuessRow = page.locator(".guess-row").first();
      expect(await activeGuessRow.getByRole("button", {name: /^letter 1$/i}).isVisible()).toBe(true);
      expect(await activeGuessRow.getByRole("button", {name: /^letter 3$/i}).isVisible()).toBe(true);

      await page.locator(".keyboard").getByRole("button", {name: /^P$/}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^I$/}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^A$/}).click();
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
      await page.waitForFunction(
        () => (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <= innerHeight + 1,
      );
      expect(
        await page.evaluate(() => {
          const navigation = document.querySelector(".game-bottom-navigation")?.getBoundingClientRect();
          return (
            document.documentElement.scrollWidth <= innerWidth + 1 &&
            document.documentElement.scrollHeight <= innerHeight + 1 &&
            Boolean(navigation && navigation.bottom <= innerHeight + 1)
          );
        }),
      ).toBe(true);
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

      const registeredPage = await browser.newPage({viewport: {width: 390, height: 844}});
      await registeredPage.goto("http://127.0.0.1:4178/?harness=jest&registered=1");
      await registeredPage.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15000});
      await completeOnboardingAndTours(registeredPage);
      await registeredPage.getByRole("button", {name: /^profile$/i}).first().click();
      const avatarButton = registeredPage.getByRole("button", {name: /upload from photo library/i});
      await avatarButton.waitFor();
      const avatarPng = await registeredPage.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");
        context.fillStyle = "#8c5dbe";
        context.fillRect(0, 0, 8, 8);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      const fileChooserPromise = registeredPage.waitForEvent("filechooser");
      await avatarButton.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: Buffer.from(avatarPng, "base64"),
      });
      await registeredPage.locator(".profile-avatar-button img").waitFor({timeout: 15000});
      expect(await registeredPage.locator(".profile-avatar-button img").getAttribute("src")).toMatch(
        /^data:image\/webp;base64,/,
      );
      await registeredPage.close();
    } finally {
      await browser.close();
      server.close();
    }
  }, 120000);
});
