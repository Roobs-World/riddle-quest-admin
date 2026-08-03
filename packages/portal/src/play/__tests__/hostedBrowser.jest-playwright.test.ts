import {describe, expect, it} from "@jest/globals";
import {chromium, type Page} from "@playwright/test";

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

const completeOnboardingAndTours = async (page: Page) => {
  await page.getByRole("button", {name: /let's play/i}).click();
  await page.getByRole("button", {name: /got it/i}).click();
  const guestContinue = page.getByRole("button", {name: /play as guest/i});
  if (await guestContinue.isVisible()) {
    await guestContinue.click();
  }
  const coinTooltip = page.locator(".tooltip-card");
  await coinTooltip.getByRole("heading", {name: /open the coin shop/i}).waitFor();
  expect(await coinTooltip.getByText(/tap this button to buy coins to fuel your adventure/i).isVisible()).toBe(true);
  const [coinButtonBox, spotlightBox] = await Promise.all([
    page.locator(".coin-pill[data-tooltip='gameCoins']").boundingBox(),
    page.locator(".tooltip-spotlight").boundingBox(),
  ]);
  expect(coinButtonBox).not.toBeNull();
  expect(spotlightBox).not.toBeNull();
  expect(spotlightBox!.x).toBeLessThan(coinButtonBox!.x);
  expect(spotlightBox!.x + spotlightBox!.width).toBeGreaterThan(coinButtonBox!.x + coinButtonBox!.width);
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", {name: /got it/i}).click();
  }
};

describeBrowser("standalone Jest browser game", () => {
  it("covers onboarding, navigation, guest progress preservation, gameplay, rewards and responsive layouts", async () => {
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
      const layoutWarnings: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
        if (/Layout was forced before|destination rect smaller than the viewport rect/i.test(message.text())) {
          layoutWarnings.push(message.text());
        }
      });
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:jest-guest", "seen");
      });
      await page.goto("http://127.0.0.1:4178/?harness=jest");
      await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15000});
      const welcomeCard = await page.locator(".onboarding-card-welcome").boundingBox();
      const welcomeLogo = await page.locator(".onboarding-card-welcome .onboarding-logo").boundingBox();
      expect(welcomeCard).not.toBeNull();
      expect(welcomeLogo).not.toBeNull();
      expect(welcomeLogo!.width / welcomeCard!.width).toBeGreaterThan(0.85);
      await completeOnboardingAndTours(page);

      expect(await page.locator(".solar-system").count()).toBe(1);
      await page.locator(".solar-system canvas").waitFor();
      expect(
        await page.locator(".solar-system canvas").evaluate((canvas: HTMLCanvasElement) => {
          const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
          if (!context) return true;
          const viewport = context.getParameter(context.VIEWPORT) as Int32Array;
          return viewport[0] >= 0 && viewport[1] >= 0 &&
            viewport[0] + viewport[2] <= context.drawingBufferWidth &&
            viewport[1] + viewport[3] <= context.drawingBufferHeight;
        }),
      ).toBe(true);
      await page.waitForFunction(() =>
        performance.getEntriesByType("resource").some((entry) => entry.name.includes("tex_sun_corona")),
      );
      const solarFrameBefore = await page.locator(".solar-system canvas").screenshot();
      await page.waitForTimeout(500);
      const solarFrameAfter = await page.locator(".solar-system canvas").screenshot();
      expect(solarFrameBefore.equals(solarFrameAfter)).toBe(false);
      expect(await page.locator(".guess-row").count()).toBe(5);
      expect(await page.locator(".keyboard").isVisible()).toBe(true);
      expect((await page.locator("[data-tooltip='gameSkip']").innerText()).trim()).toBe("Skip");

      const mainGameCoinBalance = (await page.locator(".game-header .coin-pill strong").innerText()).trim();
      await page.evaluate(() => localStorage.setItem("riddleQuest:activeRaceRun", "expired-run-from-previous-session"));
      const multiplayerOpenDurationMs = await page.getByRole("button", {name: /^multiplayer$/i}).evaluate(
        (button) => new Promise<number>((resolve) => {
          const openedAt = performance.now();
          const observer = new MutationObserver(() => {
            if (!document.querySelector(".race-screen")) return;
            observer.disconnect();
            resolve(performance.now() - openedAt);
          });
          observer.observe(document.body, {childList: true, subtree: true});
          (button as HTMLButtonElement).click();
        }),
      );
      expect(multiplayerOpenDurationMs).toBeLessThan(100);
      expect(await page.locator('[data-testid="server-activity-loader"]').count()).toBe(0);
      expect(await page.locator(".race-category-grid button").count()).toBeGreaterThan(0);
      expect(await page.evaluate(() => localStorage.getItem("riddleQuest:activeRaceRun"))).toBeNull();
      expect((await page.locator(".race-coin-balance strong").innerText()).trim()).toBe(mainGameCoinBalance);
      expect(await page.locator(".race-coin-balance").isVisible()).toBe(true);
      const penaltyCenterOffset = await page.locator(".race-screen").evaluate((screen) => {
        const penalty = document.createElement("div");
        penalty.className = "race-penalty-flash";
        penalty.style.animation = "none";
        penalty.textContent = "+15s";
        screen.append(penalty);
        const rect = penalty.getBoundingClientRect();
        const offset = {
          horizontal: Math.abs(rect.left + rect.width / 2 - innerWidth / 2),
          vertical: Math.abs(rect.top + rect.height / 2 - innerHeight / 2),
        };
        penalty.remove();
        return offset;
      });
      expect(penaltyCenterOffset.horizontal).toBeLessThanOrEqual(0.5);
      expect(penaltyCenterOffset.vertical).toBeLessThanOrEqual(0.5);

      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("riddle-quest:host-to-game", {
          detail: {
            type: "host:operationResult",
            requestId: "race-outcome-achievement-test",
            payload: {
              operation: "raceOutcome",
              ok: true,
              data: {
                newlyUnlockedAchievementIds: ["race_debut"],
                achievementCoinsAwarded: 25,
                newCoins: 205,
              },
            },
          },
        }));
      });
      const multiplayerAchievementPopup = page.locator(".modal-reward");
      await multiplayerAchievementPopup.getByRole("heading", {name: /achievement unlocked/i}).waitFor();
      expect(await multiplayerAchievementPopup.getByText("Race Debut", {exact: true}).isVisible()).toBe(true);
      const [popupZIndex, raceZIndex] = await Promise.all([
        page.locator(".game-modal-backdrop").evaluate((element) => Number(getComputedStyle(element).zIndex)),
        page.locator(".race-screen").evaluate((element) => Number(getComputedStyle(element).zIndex)),
      ]);
      expect(popupZIndex).toBeGreaterThan(raceZIndex);
      await multiplayerAchievementPopup.getByRole("button", {name: /^next$/i}).click();
      const multiplayerChest = multiplayerAchievementPopup.getByRole("button", {name: /tap the chest/i});
      await multiplayerChest.waitFor();
      const multiplayerContinue = multiplayerAchievementPopup.getByRole("button", {name: /awesome/i});
      expect(await multiplayerContinue.isDisabled()).toBe(true);
      expect(await multiplayerChest.evaluate((element) => getComputedStyle(element).animationName)).toContain("reward-chest-wobble");
      expect(await multiplayerChest.locator("img").getAttribute("src")).toMatch(/chest-closed/);
      await multiplayerChest.click();
      expect(await multiplayerChest.locator("img").getAttribute("src")).toMatch(/chest-open/);
      expect(await page.locator(".reward-coin-particle").count()).toBeGreaterThan(0);
      await multiplayerContinue.waitFor({state: "visible"});
      await page.waitForFunction(() => !(document.querySelector(".reward-continue") as HTMLButtonElement)?.disabled);
      expect((await page.locator(".game-header .coin-pill strong").innerText()).trim()).toBe("205");
      await multiplayerContinue.click();
      expect(await page.locator(".race-screen").isVisible()).toBe(true);

      await page.locator(".race-close").click();
      await page.locator(".race-screen").waitFor({state: "detached"});

      const dailyPage = await browser.newPage({viewport: {width: 390, height: 844}});
      await dailyPage.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await dailyPage.goto("http://127.0.0.1:4178/?harness=jest&gameMode=challenge");
      await dailyPage.locator(".game-mode-label").getByText(/daily/i).waitFor({timeout: 15_000});
      expect(await dailyPage.locator("[data-tooltip='gameSkip']").count()).toBe(0);
      await dailyPage.close();

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
      const profileTourHeadings: string[] = [];
      for (let step = 0; step < 8; step += 1) {
        profileTourHeadings.push(await page.locator(".tooltip-card h3").innerText());
        await page.locator(".tooltip-card").getByRole("button", {name: /got it/i}).click();
      }
      expect(profileTourHeadings).toContain("Your Treasure Chest");
      await page.locator(".tooltip-card").waitFor({state: "detached"});
      for (const name of [/statistics/i, /achievements/i, /ranks/i, /leaderboard/i, /treasure/i]) {
        expect(await page.getByRole("button", {name}).isVisible()).toBe(true);
      }
      await page.getByRole("button", {name: /^achievements$/i}).click();
      await page.locator(".modal-achievements").waitFor();
      await page.getByText("Race Debut", {exact: true}).waitFor();
      await page.getByText("Challenge Issued", {exact: true}).waitFor();
      await page.getByText("Clean Run", {exact: true}).waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("button", {name: /^profile$/i}).first().click();
      await page.locator(".modal-profile").waitFor();
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
      const modalCloseBox = await page.locator(".modal-x").boundingBox();
      expect(modalCloseBox?.width).toBeGreaterThanOrEqual(60);
      expect(modalCloseBox?.height).toBeGreaterThanOrEqual(60);
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
      expect(await activeGuessRow.getByRole("button", {name: /^letter 1: p$/i}).isVisible()).toBe(true);
      expect(await activeGuessRow.getByRole("button", {name: /^letter 3: a$/i}).isVisible()).toBe(true);

      await activeGuessRow.getByRole("button", {name: /^letter 2$/i}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^I$/}).click();
      await activeGuessRow.getByRole("button", {name: /^letter 4$/i}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^N$/}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^O$/}).click();
      await page.locator(".game-input-actions").getByRole("button", {name: /submit/i}).click();

      await page.getByRole("heading", {name: /achievement unlocked/i}).waitFor({timeout: 15000});
      expect(await page.locator(".sequence-progress").textContent()).toBe("1/2");
      expect(await page.locator(".game-content").evaluate((element) => (element as HTMLElement).inert)).toBe(true);
      await page.getByRole("button", {name: /^next$/i}).click();
      await page.getByRole("heading", {name: /nice job/i}).waitFor();
      const victoryChest = page.getByRole("button", {name: /tap the chest/i});
      const victoryContinue = page.getByRole("button", {name: /next level/i});
      await victoryChest.waitFor();
      expect(await victoryContinue.isDisabled()).toBe(true);
      expect(await victoryChest.evaluate((element) => getComputedStyle(element).animationName)).toContain("reward-chest-wobble");
      await page.keyboard.press("Escape");
      expect(await page.locator(".modal-victory").count()).toBe(1);
      await page.waitForTimeout(50);
      const balanceBeforeVictoryCollection = Number(
        (await page.locator(".game-header .coin-pill strong").innerText()).replace(/,/g, ""),
      );
      await victoryChest.click();
      expect(await page.locator(".reward-coin-particle").count()).toBeGreaterThan(0);
      await page.waitForFunction(
        (startingBalance) => Number(
          document.querySelector(".game-header .coin-pill strong")?.textContent?.replace(/,/g, "") ?? "0",
        ) > startingBalance,
        balanceBeforeVictoryCollection,
      );
      await page.waitForFunction(() => !(document.querySelector(".reward-continue") as HTMLButtonElement)?.disabled);
      expect(Number((await page.locator(".game-header .coin-pill strong").innerText()).replace(/,/g, "")))
        .toBe(balanceBeforeVictoryCollection + 50);
      await page.getByRole("button", {name: /share your victory/i}).click();
      await page.locator('[data-testid="server-activity-loader"]').waitFor({state: "detached"});
      expect(await page.locator(".modal-victory").count()).toBe(1);
      await page.waitForTimeout(2800);
      expect(await page.locator(".modal-victory").count()).toBe(1);

      await page.setViewportSize({width: 844, height: 390});
      await victoryContinue.click();
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
      expect(layoutWarnings).toEqual([]);

      const lowEndPage = await browser.newPage({
        viewport: {width: 360, height: 740},
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 11; Pixel 3a) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
      });
      await lowEndPage.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        Object.defineProperty(navigator, "hardwareConcurrency", {configurable: true, value: 4});
        Object.defineProperty(navigator, "deviceMemory", {configurable: true, value: 4});
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: {effectiveType: "4g", saveData: false},
        });
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await lowEndPage.goto("http://127.0.0.1:4178/?harness=jest");
      await lowEndPage.getByText(/what has keys/i).waitFor({timeout: 15_000});
      await lowEndPage.waitForTimeout(3_000);
      expect(await lowEndPage.locator(".solar-system").count()).toBe(0);
      const lowEndResources = await lowEndPage.evaluate(() =>
        performance.getEntriesByType("resource").map((entry) => entry.name),
      );
      expect(lowEndResources.some((resource) => /music-.*\.webm/.test(resource))).toBe(false);
      expect(lowEndResources.some((resource) => /vendor-three|SolarSystem/.test(resource))).toBe(false);
      expect(await lowEndPage.locator(".keyboard").isVisible()).toBe(true);
      await lowEndPage.close();

      const iframePage = await browser.newPage({viewport: {width: 390, height: 844}});
      await iframePage.addInitScript(() => Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true}));
      await iframePage.setContent(
        '<iframe title="Jest host" style="width:390px;height:844px;border:0" src="http://127.0.0.1:4178/?harness=jest"></iframe>',
      );
      await iframePage
        .frameLocator('iframe[title="Jest host"]')
        .getByText(/what has keys/i)
        .waitFor({timeout: 15000});
      await iframePage.close();

      const registeredPage = await browser.newPage({viewport: {width: 390, height: 844}});
      await registeredPage.addInitScript(() => Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true}));
      await registeredPage.goto("http://127.0.0.1:4178/?harness=jest&registered=1");
      await registeredPage.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15000});
      await completeOnboardingAndTours(registeredPage);
      await registeredPage.getByRole("button", {name: /buy coins/i}).first().click();
      const subscriptionCard = registeredPage.locator(".shop-subscription-card");
      await subscriptionCard.getByText(/riddle quest premium/i).waitFor();
      await registeredPage
        .locator(".game-shop-grid article:not(.shop-subscription-card)")
        .first()
        .getByRole("button")
        .click();
      await registeredPage.locator(".modal-reward").waitFor();
      expect(await registeredPage.locator(".modal-reward").innerText()).toMatch(/\+250/);
      const purchaseContinue = registeredPage.getByRole("button", {name: /awesome/i});
      expect(await purchaseContinue.isDisabled()).toBe(true);
      await registeredPage.keyboard.press("Escape");
      expect(await registeredPage.locator(".modal-reward").count()).toBe(1);
      await registeredPage.getByRole("button", {name: /tap the chest/i}).click();
      expect(await registeredPage.locator(".reward-coin-particle").count()).toBeGreaterThan(0);
      await registeredPage.waitForFunction(() => !(document.querySelector(".reward-continue") as HTMLButtonElement)?.disabled);
      await purchaseContinue.click();
      await registeredPage.getByRole("button", {name: /buy coins/i}).first().click();
      await subscriptionCard.getByRole("button", {name: /start free trial/i}).click();
      await subscriptionCard.waitFor({state: "detached"});
      await registeredPage.getByRole("button", {name: /buy coins/i}).first().click();
      await registeredPage.locator(".shop-subscription-card").getByRole("button", {name: /subscribed/i}).waitFor();
      expect(
        await registeredPage.locator(".shop-subscription-card").getByRole("button", {name: /subscribed/i}).isDisabled(),
      ).toBe(true);
      await registeredPage.keyboard.press("Escape");
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
