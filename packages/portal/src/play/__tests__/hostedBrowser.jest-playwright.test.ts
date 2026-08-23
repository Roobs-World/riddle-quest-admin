import {describe, expect, it} from "@jest/globals";
import AxeBuilder from "@axe-core/playwright";
import {chromium, type Page} from "@playwright/test";

const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const expectAccessible = async (page: Page, state: string) => {
  const {violations} = await new AxeBuilder({page}).withTags(wcagTags).analyze();
  expect(
    violations.map(({help, id, impact, nodes}) => ({
      help,
      id,
      impact,
      state,
      targets: nodes.map(({target}) => target),
    })),
  ).toEqual([]);
};

const completeOnboardingAndTours = async (page: Page, checkTooltipAccessibility = false) => {
  await page.getByTestId("server-activity-loader").waitFor({state: "hidden"});
  const letsPlay = page.getByRole("button", {name: /let's play/i});
  await letsPlay.waitFor();
  await page.waitForFunction(() => document.activeElement?.matches(".onboarding-card .play-primary"));
  expect(await letsPlay.evaluate((button) => document.activeElement === button)).toBe(true);
  await letsPlay.click();
  await page.getByRole("button", {name: /got it/i}).click();
  const guestContinue = page.getByRole("button", {name: /play as guest/i});
  if (await guestContinue.isVisible()) {
    await guestContinue.click();
  }
  const coinTooltip = page.locator(".tooltip-card");
  await coinTooltip.getByRole("heading", {name: /open the coin shop/i}).waitFor();
  expect(await coinTooltip.getAttribute("aria-labelledby")).toBe("guidance-tooltip-gameCoins-title");
  const tooltipContinue = coinTooltip.getByRole("button", {name: /got it/i});
  await page.waitForFunction(() => document.activeElement?.matches(".tooltip-card .play-primary"));
  expect(await tooltipContinue.evaluate((button) => document.activeElement === button)).toBe(true);
  await page.keyboard.press("Tab");
  expect(await tooltipContinue.evaluate((button) => document.activeElement === button)).toBe(true);
  await page.keyboard.press("Escape");
  expect(await coinTooltip.isVisible()).toBe(true);
  if (checkTooltipAccessibility) await expectAccessible(page, "guided tooltip");
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
    if (process.env.PORTAL_USE_EXISTING_BUILD !== "1") {
      execFileSync("pnpm", ["--filter", "@qwordly/portal", "build:jest"], {
        cwd: path.resolve(packageRoot, "../.."),
        stdio: "inherit",
      });
    }

    const distDir = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.join(packageRoot, "dist-jest");
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
    const browser = await chromium.launch({headless: true, args: ["--renderer-process-limit=4"]});
    try {
      const context = await browser.newContext({viewport: {width: 390, height: 844}});
      const page = await context.newPage();
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
      expect(await page.locator("main").count()).toBe(1);
      expect(await page.locator("main main").count()).toBe(0);
      await expectAccessible(page, "onboarding");
      const welcomeCard = await page.locator(".onboarding-card-welcome").boundingBox();
      const welcomeLogo = await page.locator(".onboarding-card-welcome .onboarding-logo").boundingBox();
      const welcomeAction = await page.getByRole("button", {name: /let's play/i}).boundingBox();
      expect(welcomeCard).not.toBeNull();
      expect(welcomeLogo).not.toBeNull();
      expect(welcomeAction).not.toBeNull();
      expect(welcomeLogo!.width / welcomeCard!.width).toBeGreaterThan(0.85);
      expect(await page.locator(".onboarding-card-welcome p").first().evaluate((element) => (
        getComputedStyle(element).textAlign
      ))).toBe("left");
      expect(welcomeAction!.width).toBeGreaterThanOrEqual(200);
      expect(welcomeAction!.y + welcomeAction!.height).toBeLessThanOrEqual(welcomeCard!.y + welcomeCard!.height);
      await page.keyboard.press("Tab");
      const focusedOnboardingAction = page.locator(":focus");
      await expect(focusedOnboardingAction.getAttribute("class")).resolves.toContain("play-primary");
      expect(await focusedOnboardingAction.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe("3px");
      await completeOnboardingAndTours(page, true);
      await expectAccessible(page, "game");

      const firstGuessCell = page.locator(".guess-row .cell").first();
      const guessBeforeOffline = await firstGuessCell.textContent();
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      const offlineDialog = page.getByRole("alertdialog", {name: /no internet connection/i});
      await offlineDialog.waitFor();
      expect(await page.locator(".game-content").evaluate((element) => (element as HTMLElement).inert)).toBe(true);
      await page.waitForFunction(() => document.activeElement?.matches(".offline-backdrop"));
      expect(await offlineDialog.evaluate((dialog) => document.activeElement === dialog)).toBe(true);
      await expectAccessible(page, "offline recovery");
      await page.keyboard.press("A");
      expect(await firstGuessCell.textContent()).toBe(guessBeforeOffline);
      await page.keyboard.press("Tab");
      expect(await offlineDialog.evaluate((dialog) => document.activeElement === dialog)).toBe(true);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await offlineDialog.waitFor({state: "detached"});

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
      await expectAccessible(page, "multiplayer category selection");
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

      await page.locator(".race-category-grid button").first().click();
      const nativeAnswerInput = page.locator(".race-native-answer-input");
      await nativeAnswerInput.waitFor({state: "attached"});
      for (const {committed, rendered} of [
        {committed: "e\u0301", rendered: "é"},
        {committed: "نَ", rendered: "نَ"},
        {committed: "Ж", rendered: "Ж"},
        {committed: "क्ष", rendered: "क्ष"},
        {committed: "日", rendered: "日"},
        {committed: "한", rendered: "한"},
        {committed: "中", rendered: "中"},
      ]) {
        await nativeAnswerInput.evaluate((element, value) => {
          const input = element as HTMLInputElement;
          input.focus({preventScroll: true});
          input.dispatchEvent(new CompositionEvent("compositionstart", {bubbles: true, data: value}));
          input.value = value;
          input.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            data: value,
            inputType: "insertCompositionText",
            isComposing: true,
          }));
          input.dispatchEvent(new CompositionEvent("compositionend", {bubbles: true, data: value}));
        }, committed);
        await page.locator(".race-gameplay .guess-row .cell", {hasText: rendered}).waitFor();
        expect(await page.locator(".race-riddle-surface .guess-board").evaluate((element) =>
          getComputedStyle(element).outlineStyle)).not.toBe("none");
        await nativeAnswerInput.press("Backspace");
        await page.waitForFunction((value) =>
          !Array.from(document.querySelectorAll(".race-gameplay .guess-row .cell"))
            .some((cell) => cell.textContent === value), rendered);
      }
      await nativeAnswerInput.fill("日本語");
      await page.waitForFunction(() => {
        const values = Array.from(document.querySelectorAll(".race-gameplay .guess-row .cell"))
          .map((cell) => cell.textContent);
        return values.includes("日") && values.includes("本") && values.includes("語");
      });
      for (let index = 0; index < 3; index += 1) await nativeAnswerInput.press("Backspace");
      await page.waitForFunction(() =>
        !Array.from(document.querySelectorAll(".race-gameplay .guess-row .cell"))
          .some((cell) => ["日", "本", "語"].includes(cell.textContent ?? "")));
      await nativeAnswerInput.evaluate((element) => {
        const input = element as HTMLInputElement;
        input.dispatchEvent(new CompositionEvent("compositionstart", {bubbles: true, data: "한"}));
        input.value = "한";
        input.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          data: "한",
          inputType: "insertCompositionText",
          isComposing: true,
        }));
        input.dispatchEvent(new CompositionEvent("compositionend", {bubbles: true, data: "한"}));
        input.value = "한";
        input.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          data: "한",
          inputType: "insertCompositionText",
          isComposing: false,
        }));
      });
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll(".race-gameplay .guess-row .cell"))
          .filter((cell) => cell.textContent === "한").length === 1);
      await nativeAnswerInput.press("Backspace");
      await page.locator(".race-close").click();
      await page.getByRole("button", {name: /^quit race$/i}).click();
      await page.locator(".race-screen").waitFor({state: "detached"});
      await page.getByRole("button", {name: /^multiplayer$/i}).click();
      await page.locator(".race-category-grid button").first().waitFor();
      const hubTablist = page.locator('.race-hub-tabs [role="tablist"]');
      const playHubTab = hubTablist.getByRole("tab", {name: /^play$/i});
      const activityHubTab = hubTablist.getByRole("tab", {name: /^activity$/i});
      expect(await hubTablist.getByRole("tab").count()).toBe(2);
      await playHubTab.focus();
      await playHubTab.press("End");
      await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === "Activity");
      expect(await activityHubTab.getAttribute("aria-selected")).toBe("true");
      expect(await activityHubTab.evaluate((element) => element === document.activeElement)).toBe(true);
      await playHubTab.click();
      await playHubTab.focus();
      await playHubTab.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === "Activity");
      expect(await activityHubTab.getAttribute("aria-selected")).toBe("true");
      await page.getByText("Nova", {exact: true}).waitFor();
      await page.getByText("Safety options", {exact: true}).click();
      await expectAccessible(page, "multiplayer safety actions");
      await page.getByLabel("Reason for report").selectOption("spam");
      await page.getByRole("button", {name: /^report opponent$/i}).click();
      await page.getByRole("status").getByText("Report sent.", {exact: true}).waitFor();
      await page.getByRole("button", {name: /^block opponent$/i}).click();
      await page.getByRole("status").getByText("Opponent blocked.", {exact: true}).waitFor();
      expect(await page.getByText(/no results yet/i).isVisible()).toBe(true);

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
      await expectAccessible(page, "achievement reward");
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

      let releaseModalChunk: () => void = () => undefined;
      const modalChunkGate = new Promise<void>((resolve) => {
        releaseModalChunk = () => resolve();
      });
      let modalChunkRequested = false;
      const compactPage = await browser.newPage({viewport: {width: 320, height: 568}});
      await compactPage.route("**/assets/GameModalView-*.js", async (route) => {
        modalChunkRequested = true;
        await modalChunkGate;
        await route.continue();
      });
      await compactPage.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:v2:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await compactPage.goto("http://127.0.0.1:4178/?harness=jest");
      await compactPage.locator(".game-bottom-navigation").waitFor({timeout: 15_000});
      await compactPage.waitForFunction(
        () => (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <= innerHeight + 1,
      );
      const compactLayout = await compactPage.evaluate(() => {
        const navigation = document.querySelector(".game-bottom-navigation")?.getBoundingClientRect();
        const keyboardKey = document.querySelector(".keyboard .key")?.getBoundingClientRect();
        const content = document.querySelector<HTMLElement>(".game-content");
        return {
          documentHeight: document.documentElement.scrollHeight,
          keyHeight: keyboardKey?.height ?? 0,
          navigationBottom: navigation?.bottom ?? Infinity,
          scale: Number(content?.dataset.viewportScale ?? 0),
        };
      });
      expect(compactLayout.documentHeight).toBeLessThanOrEqual(569);
      expect(compactLayout.navigationBottom).toBeLessThanOrEqual(569);
      expect(compactLayout.keyHeight).toBeGreaterThanOrEqual(44);
      expect(compactLayout.scale).toBeGreaterThanOrEqual(0.92);
      expect(await compactPage.getByRole("region", {name: /virtual keyboard/i}).isVisible()).toBe(true);

      await compactPage.getByRole("button", {name: /^settings$/i}).click();
      const modalLoadingFallback = compactPage.getByRole("status", {name: /^loading$/i});
      await modalLoadingFallback.waitFor();
      expect(modalChunkRequested).toBe(true);
      releaseModalChunk();
      await compactPage.getByRole("heading", {name: /^settings$/i}).waitFor();
      await compactPage.getByRole("button", {name: /^about/i}).click();
      await compactPage.getByRole("heading", {name: /about \/ legal/i}).waitFor();
      const aboutList = compactPage.locator(".about-list");
      const aboutRows = aboutList.locator(".about-list-row");
      expect(await aboutList.locator("a[href^='http'], a[href^='mailto:']").count()).toBe(0);
      expect(await aboutList.getByRole("link").count()).toBe(1);
      expect(await aboutList.innerText()).not.toMatch(/riddle quest website|privacy policy|terms of use/i);
      for (const label of [/support/i, /data export/i]) {
        expect(await aboutList.locator("div.about-list-row").filter({hasText: label})
          .getByText(/grindheadgames@gmail\.com/i).isVisible()).toBe(true);
      }
      expect(await aboutRows.count()).toBe(4);
      const licensesLink = compactPage.getByRole("link", {name: /third-party licenses/i});
      expect(await licensesLink.getAttribute("href")).toBe("./third-party-licenses.txt");
      expect(await licensesLink.getAttribute("target")).toBeNull();
      const licensesResponse = await compactPage.request.get(new URL(
        await licensesLink.getAttribute("href") ?? "",
        compactPage.url(),
      ).toString());
      expect(licensesResponse.status()).toBe(200);
      expect(await licensesResponse.text()).toContain("react@19.2.8");
      await compactPage.getByRole("button", {name: /account deletion/i}).click();
      await compactPage.locator(".modal-profile").waitFor();
      await compactPage.close();

      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth + 1 &&
            document.documentElement.scrollHeight <= innerHeight + 1,
        ),
      ).toBe(true);
      await page.getByRole("button", {name: /^hint$/i}).click();
      await page.locator(".modal-hint").waitFor();
      await expectAccessible(page, "hint confirmation");
      await page.keyboard.press("Escape");
      await page.getByRole("button", {name: /^skip$/i}).click();
      await page.locator(".modal-skip").waitFor();
      await expectAccessible(page, "skip confirmation");
      await page.keyboard.press("Escape");
      await page.getByRole("button", {name: /buy coins/i}).first().click();
      await page.getByRole("heading", {name: /coin shop/i}).waitFor();
      await expectAccessible(page, "coin shop");
      await page.keyboard.press("Escape");
      await page.setViewportSize({width: 390, height: 667});
      await page.waitForFunction(
        () => (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <= innerHeight + 1,
      );
      expect(
        await page.evaluate(() => {
          const shell = document.querySelector<HTMLElement>(".game-app");
          const content = document.querySelector<HTMLElement>(".game-content");
          const navigation = document.querySelector(".game-bottom-navigation")?.getBoundingClientRect();
          return {
            documentWidthFits: document.documentElement.scrollWidth <= innerWidth + 1,
            documentHeightFits: document.documentElement.scrollHeight <= innerHeight + 1,
            shellOverflowHidden: getComputedStyle(shell!).overflowY === "hidden",
            contentFits: Boolean(content && content.getBoundingClientRect().bottom <= innerHeight + 1),
            navigationFits: Boolean(navigation && navigation.bottom <= innerHeight + 1),
          };
        }),
      ).toEqual({
        documentWidthFits: true,
        documentHeightFits: true,
        shellOverflowHidden: true,
        contentFits: true,
        navigationFits: true,
      });
      for (const height of [701, 736]) {
        await page.setViewportSize({width: 390, height});
        await page.waitForFunction(
          () => (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <= innerHeight + 1,
        );
      }
      await page.setViewportSize({width: 390, height: 667});

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
      await page.waitForFunction(() => document.querySelector(".game-modal")?.contains(document.activeElement));
      await expectAccessible(page, "profile");
      for (const name of [/statistics/i, /achievements/i, /ranks/i, /leaderboard/i, /treasure/i]) {
        expect(await page.getByRole("button", {name}).isVisible()).toBe(true);
      }
      await page.getByRole("button", {name: /^statistics$/i}).click();
      await page.locator(".modal-statistics").waitFor();
      await expectAccessible(page, "statistics");
      await page.keyboard.press("Escape");
      await page.getByRole("button", {name: /^profile$/i}).first().click();
      await page.locator(".modal-profile").waitFor();
      await page.getByRole("button", {name: /treasure/i}).click();
      await page.locator(".modal-treasure").waitFor();
      await expectAccessible(page, "treasure");
      await page.keyboard.press("Escape");
      await page.getByRole("button", {name: /^profile$/i}).first().click();
      await page.locator(".modal-profile").waitFor();
      await page.getByRole("button", {name: /^achievements$/i}).click();
      await page.locator(".modal-achievements").waitFor();
      await expectAccessible(page, "achievements");
      await page.getByText("Race Debut", {exact: true}).waitFor();
      await page.getByText("Challenge Issued", {exact: true}).waitFor();
      await page.getByText("Clean Run", {exact: true}).waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("button", {name: /^profile$/i}).first().click();
      await page.locator(".modal-profile").waitFor();
      await page.getByRole("button", {name: /^ranks$/i}).evaluate((button) => (button as HTMLButtonElement).click());
      await page.locator(".modal-ranks").waitFor();
      await expectAccessible(page, "ranks");
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
      await expectAccessible(page, "leaderboard");
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
      await expectAccessible(page, "settings");
      await page.keyboard.press("Escape");

      await page.locator(".keyboard").getByRole("button", {name: /^P$/}).click();
      await page.locator(".guess-row").first().getByRole("button", {name: /^letter 3$/i}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^A$/}).click();
      // Jest player-data writes are queued and durable only after the adapter flushes.
      // Wait for the mock platform's persisted snapshot rather than racing reload
      // against React's passive checkpoint effect or relying on a fixed delay.
      await page.waitForFunction(() => {
        const raw = localStorage.getItem("riddleQuest:mockJestPlayerData");
        if (!raw) return false;
        try {
          const value = JSON.parse(raw) as {activeGame?: {currentLetters?: unknown[]}};
          const letters = value.activeGame?.currentLetters;
          return Array.isArray(letters) &&
            String(letters[0] ?? "").toLowerCase() === "p" &&
            String(letters[2] ?? "").toLowerCase() === "a";
        } catch {
          return false;
        }
      });
      await page.reload();
      await page.getByText(/what has keys/i).waitFor({timeout: 15000});
      const activeGuessRow = page.locator(".guess-row").first();
      expect(await activeGuessRow.getByRole("button", {name: /^letter 1: p$/i}).isVisible()).toBe(true);
      expect(await activeGuessRow.getByRole("button", {name: /^letter 3: a$/i}).isVisible()).toBe(true);

      await activeGuessRow.getByRole("button", {name: /^letter 2$/i}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^I$/}).click();
      await activeGuessRow.getByRole("button", {name: /^letter 4$/i})
        .evaluate((button) => (button as HTMLButtonElement).click());
      await page.locator(".keyboard").getByRole("button", {name: /^N$/}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^O$/}).click();
      await page.locator(".game-input-actions").getByRole("button", {name: /submit/i}).click();

      await page.getByRole("heading", {name: /achievement unlocked/i}).waitFor({timeout: 15000});
      expect(await page.locator(".sequence-progress").textContent()).toBe("1/2");
      expect(await page.locator(".game-content").evaluate((element) => (element as HTMLElement).inert)).toBe(true);
      await page.getByRole("button", {name: /^next$/i}).click();
      await page.getByRole("heading", {name: /nice job/i}).waitFor();
      await expectAccessible(page, "victory reward");
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
      await page.getByRole("button", {name: /invite a friend/i}).click();
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
          const shell = document.querySelector<HTMLElement>(".game-app");
          const content = document.querySelector<HTMLElement>(".game-content");
          const navigation = document.querySelector(".game-bottom-navigation")?.getBoundingClientRect();
          return (
            document.documentElement.scrollWidth <= innerWidth + 1 &&
            document.documentElement.scrollHeight <= innerHeight + 1 &&
            getComputedStyle(shell!).overflowY === "hidden" &&
            Boolean(content && content.getBoundingClientRect().bottom <= innerHeight + 1) &&
            Boolean(navigation && navigation.bottom <= innerHeight + 1)
          );
        }),
      ).toBe(true);
      for (const viewport of [{width: 844, height: 501}, {width: 1024, height: 600}]) {
        await page.setViewportSize(viewport);
        await page.waitForFunction(
          () => (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <= innerHeight + 1,
        );
      }
      await page.setViewportSize({width: 1280, height: 800});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

      expect(await page.locator("body").innerText()).not.toMatch(
        /Clerk|Auth0|sign in with Google|rewarded ad|install the app/i,
      );
      expect(consoleErrors).toEqual([]);
      expect(layoutWarnings).toEqual([]);

      // The primary journey retains a broad DOM and WebGL history. Release it
      // before isolated low-end/iframe checks so a constrained release host
      // cannot starve a later renderer process.
      await context.close();

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
      expect(await registeredPage.locator(".shop-subscription-card").count()).toBe(0);
      expect(await registeredPage.locator(".game-shop-grid").innerText()).not.toMatch(/riddle quest premium/i);
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
