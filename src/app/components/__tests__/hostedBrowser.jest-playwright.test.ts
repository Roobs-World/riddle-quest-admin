import {describe, expect, it} from "@jest/globals";
import {installCompletedMockGameTour, completeMockOnboarding, prepareProvisionalNextLevel} from "../../testing/browser/__tests__/mockOnboarding.jest-playwright.support.ts";
import AxeBuilder from "@axe-core/playwright";
import {expectConformingHtml} from "../../testing/browser/__tests__/webStandards.jest-playwright.support.ts";
import {chromium, type Page} from "@playwright/test";
import {version as reactVersion} from "react";
import {SOLO_COIN_COSTS} from "../../../progression/economy/rewardRules";
import {getProfileTour} from "../../../onboarding/browser/guidanceConfig";
/** Provides describe browser behavior. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
/** Provides hosted browser port behavior. */
const hostedBrowserPort = Number(process.env.PORTAL_BROWSER_PORT ?? "0");
/** Provides wcag tags behavior. */
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** Checks the rendered modal is vertically centered within the Jest viewport. */
const expectModalCentered = async (page: Page) => {
  /** Distance between the modal center and the viewport center. */
  const offset = await page.locator(".game-modal").evaluate((element) => {
    /** Rendered modal bounds in viewport coordinates. */
    const rect = element.getBoundingClientRect();
    return Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
  });
  expect(offset).toBeLessThanOrEqual(1);
};
/** Checks a chest reward fanfare fits the viewport without scrolling and keeps its action visible. */
const expectRewardModalFits = async (page: Page) => {
  expect(
    await page.locator(".game-modal").evaluate((modal) => {
      /** Backdrop that would otherwise scroll an oversized modal. */
      const backdrop = modal.parentElement!;
      /** Primary action that advances the fanfare. */
      const action = modal.querySelector(".reward-continue")!.getBoundingClientRect();
      /** Chest that must remain on screen and tappable. */
      const chest = modal.querySelector(".reward-chest")?.getBoundingClientRect();
      /** Rendered modal bounds in viewport coordinates. */
      const rect = modal.getBoundingClientRect();
      return {
        modalOverflowHidden: getComputedStyle(modal).overflowY === "hidden",
        backdropOverflowHidden: getComputedStyle(backdrop).overflowY === "hidden",
        modalContentFits: modal.scrollHeight <= modal.clientHeight + 1,
        backdropContentFits: backdrop.scrollHeight <= backdrop.clientHeight + 1,
        modalInViewport: rect.top >= -1 && rect.bottom <= innerHeight + 1,
        actionVisible: action.top >= rect.top - 1 && action.bottom <= Math.min(rect.bottom, innerHeight) + 1,
        chestVisible: Boolean(chest && chest.height >= 40 && chest.top >= rect.top - 1 && chest.bottom <= action.top),
      };
    }),
  ).toEqual({
    modalOverflowHidden: true,
    backdropOverflowHidden: true,
    modalContentFits: true,
    backdropContentFits: true,
    modalInViewport: true,
    actionVisible: true,
    chestVisible: true,
  });
};
/** Provides expect accessible behavior. */
const expectAccessible = async (page: Page, state: string) => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Audit settled colors, not the intermediate opacity of entrance animations.
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await expectConformingHtml(page, `jest ${state}`);
  /** Provides {violations} behavior. */
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
/** Completes onboarding and tours. */
const completeOnboardingAndTours = async (page: Page, checkTooltipAccessibility = false) => {
  await page.getByTestId("server-activity-loader").waitFor({state: "hidden"});
  /** Provides lets play behavior. */
  const letsPlay = page.getByRole("button", {name: /let's play/i});
  await letsPlay.waitFor();
  await page.waitForFunction(() => document.activeElement?.matches(".onboarding-card .play-primary"));
  expect(await letsPlay.evaluate((button) => document.activeElement === button)).toBe(true);
  expect(
    await page.locator(".onboarding-card-welcome").evaluate((card) => {
      /** Captures the welcome title bounds. */
      const title = card.querySelector(".onboarding-logo")!.getBoundingClientRect();
      /** Provides description paragraphs behavior. */
      const paragraphs = card.querySelectorAll("p");
      /** Captures the first description bounds. */
      const first = paragraphs[0].getBoundingClientRect();
      /** Captures the last description bounds. */
      const last = paragraphs[paragraphs.length - 1].getBoundingClientRect();
      /** Captures the welcome button bounds. */
      const button = card.querySelector(".play-primary")!.getBoundingClientRect();
      return Math.abs(first.top - title.bottom - (button.top - last.bottom));
    }),
  ).toBeLessThanOrEqual(1);
  await letsPlay.click();
  expect(await page.locator(".guidance-backdrop").evaluate((element) => getComputedStyle(element).backdropFilter)).toBe(
    "none",
  );
  await page.getByRole("button", {name: /got it/i}).click();
  /** Provides guest continue behavior. */
  const guestContinue = page.getByRole("button", {name: /play as guest/i});
  if (await guestContinue.isVisible()) {
    await guestContinue.click();
  }
  /** The seeded profile already has five wins, so its tour begins with the coin shop. */
  const coinTooltip = page.locator(".tooltip-backdrop[data-tooltip-id='gameCoins']");
  await coinTooltip.waitFor();
  expect(await coinTooltip.getByText(/tap this button to buy coins to fuel your adventure/i).isVisible()).toBe(true);
  await coinTooltip.getByRole("button", {name: /got it/i}).click();
  /** Gameplay guidance follows the experienced player's coin-shop introduction. */
  const hintTooltip = page.locator(".tooltip-card");
  await hintTooltip.getByRole("heading", {name: /use a hint/i}).waitFor();
  expect(await hintTooltip.getAttribute("aria-labelledby")).toBe("guidance-tooltip-gameHint-title");
  /** Provides tooltip continue behavior. */
  const tooltipContinue = hintTooltip.getByRole("button", {name: /got it/i});
  await page.waitForFunction(() => document.activeElement?.matches(".tooltip-card .play-primary"));
  expect(await tooltipContinue.evaluate((button) => document.activeElement === button)).toBe(true);
  await page.keyboard.press("Tab");
  expect(await tooltipContinue.evaluate((button) => document.activeElement === button)).toBe(true);
  await page.keyboard.press("Escape");
  expect(await hintTooltip.isVisible()).toBe(true);
  if (checkTooltipAccessibility) await expectAccessible(page, "guided tooltip");
  /** Provides [hint button box, spotlight box] behavior. */
  const [hintButtonBox, spotlightBox] = await Promise.all([
    page.locator("[data-tooltip='gameHint']").boundingBox(),
    page.locator(".tooltip-spotlight").boundingBox(),
  ]);
  expect(hintButtonBox).not.toBeNull();
  expect(spotlightBox).not.toBeNull();
  expect(spotlightBox!.x).toBeLessThan(hintButtonBox!.x);
  expect(spotlightBox!.x + spotlightBox!.width).toBeGreaterThan(hintButtonBox!.x + hintButtonBox!.width);
  /** Keeps the game fixed while each tour target is highlighted. */
  const headerTop = await page.locator(".game-header").evaluate((element) => element.getBoundingClientRect().top);
  for (const tooltipId of ["gameHint", "submitAnswer", "gameSkip", "gameMultiplayer"]) {
    await page.locator(`.tooltip-backdrop[data-tooltip-id='${tooltipId}']`).waitFor();
    expect(await page.locator("[data-tooltip-id='gameCoins']").count()).toBe(0);
    await page.waitForTimeout(180);
    expect(await page.locator(".game-app").evaluate((element) => element.scrollTop)).toBe(0);
    expect(await page.locator(".game-header").evaluate((element) => element.getBoundingClientRect().top)).toBe(
      headerTop,
    );
    expect(
      await page.locator(".tooltip-backdrop").evaluate((element) => {
        /** Captures the walkthrough backdrop style. */
        const style = getComputedStyle(element);
        return {filter: style.backdropFilter, background: style.backgroundColor, image: style.backgroundImage};
      }),
    ).toEqual({filter: "none", background: "rgba(0, 0, 0, 0)", image: "none"});
    await page.getByRole("button", {name: /got it/i}).click();
  }
  await page.locator(".tooltip-backdrop").waitFor({state: "detached"});
};

describeBrowser("standalone Jest browser game", () => {
  it("covers onboarding, navigation, guest progress preservation, gameplay, rewards and responsive layouts", async () => {
    /** Provides {exec file sync} behavior. */
    const {execFileSync} = await import("node:child_process");
    /** Provides {create server} behavior. */
    const {createServer} = await import("node:http");
    /** Provides {read file} behavior. */
    const {readFile} = await import("node:fs/promises");
    /** Provides path behavior. */
    const path = await import("node:path");
    /** Provides package root behavior. */
    const packageRoot = path.resolve(__dirname, "../../../web/..");
    if (process.env.PORTAL_USE_EXISTING_BUILD !== "1") {
      execFileSync("pnpm", ["--filter", "@riddle-quest/portal", "build:jest"], {
        cwd: path.resolve(packageRoot, "../.."),
        stdio: "inherit",
      });
    }
    /** Provides dist dir behavior. */
    const distDir = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.join(packageRoot, "../../builds/jest");
    /** Provides content types behavior. */
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
    /** Provides server behavior. */
    const server = createServer(async (request, response) => {
      /** Requests url. */
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      /** Provides candidate behavior. */
      const candidate = path.join(distDir, requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname);
      /** Provides file path behavior. */
      const filePath = path.extname(candidate) ? candidate : path.join(distDir, "index.html");
      try {
        /** Provides body behavior. */
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

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(hostedBrowserPort, "127.0.0.1", resolve);
    });
    /** The bound ephemeral port isolates this journey from overlapping browser checks. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("hosted-browser-server-address-missing");
    /** Every navigation and iframe uses this fixture's actual bound origin. */
    const hostedBrowserUrl = `http://127.0.0.1:${address.port}`;
    /** Provides browser behavior. */
    const browser = await chromium.launch({headless: true, args: ["--renderer-process-limit=4"]});
    try {
      /** Provides context behavior. */
      const context = await browser.newContext({viewport: {width: 390, height: 844}});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await context.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      /** Provides page behavior. */
      const page = await context.newPage();
      /** Provides console errors behavior. */
      const consoleErrors: string[] = [];
      /** Provides layout warnings behavior. */
      const layoutWarnings: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
        if (/Layout was forced before|destination rect smaller than the viewport rect/i.test(message.text())) {
          layoutWarnings.push(message.text());
        }
      });
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        window.addEventListener("riddle-quest:host-to-game", event => {
          /** The mock authority's latest identity/profile projection. */
          const message = (event as CustomEvent).detail;
          if (message?.type === "host:init" || message?.type === "host:authState")
            Reflect.set(window, "__latestHostAuthState", message.payload);
        });
        Object.defineProperty(navigator, "hardwareConcurrency", {configurable: true, value: 8});
        Object.defineProperty(navigator, "deviceMemory", {configurable: true, value: 8});
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: {effectiveType: "4g", saveData: false},
        });
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:jest-guest", "seen");
      });
      // Classic scenarios start after Daily completion; the dedicated Daily page below stays unseeded.
      await page.goto(`${hostedBrowserUrl}/?harness=jest&dailyCompleted=1`);
      await page.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15000});
      expect(await page.locator("main").count()).toBe(1);
      expect(await page.locator("main main").count()).toBe(0);
      await expectAccessible(page, "onboarding");
      /** Provides welcome card behavior. */
      const welcomeCard = await page.locator(".onboarding-card-welcome").boundingBox();
      /** Provides welcome logo behavior. */
      const welcomeLogo = await page.locator(".onboarding-card-welcome .onboarding-logo").boundingBox();
      /** Provides welcome action behavior. */
      const welcomeAction = await page.getByRole("button", {name: /let's play/i}).boundingBox();
      expect(welcomeCard).not.toBeNull();
      expect(welcomeLogo).not.toBeNull();
      expect(welcomeAction).not.toBeNull();
      expect(welcomeLogo!.width / welcomeCard!.width).toBeGreaterThan(0.85);
      expect(
        await page
          .locator(".onboarding-card-welcome p")
          .first()
          .evaluate((element) => getComputedStyle(element).textAlign),
      ).toBe("center");
      expect(welcomeAction!.width).toBeGreaterThanOrEqual(200);
      expect(welcomeAction!.y + welcomeAction!.height).toBeLessThanOrEqual(welcomeCard!.y + welcomeCard!.height);
      await page.setViewportSize({width: 390, height: 600});
      /** Captures compact welcome spacing against the visible logo crop. */
      const compactWelcomeLayout = await page.locator(".onboarding-card-welcome").evaluate((card) => {
        /** Captures the welcome logo bounds in the compact Jest viewport. */
        const logo = card.querySelector(".onboarding-logo")!.getBoundingClientRect();
        /** Captures the compact welcome description paragraphs. */
        const paragraphs = card.querySelectorAll("p");
        /** Captures the first compact description bounds. */
        const first = paragraphs[0].getBoundingClientRect();
        /** Captures the last compact description bounds. */
        const last = paragraphs[paragraphs.length - 1].getBoundingClientRect();
        /** Captures the compact welcome action bounds. */
        const action = card.querySelector(".play-primary")!.getBoundingClientRect();
        return {
          gapDifference: Math.abs(first.top - logo.bottom - (action.top - last.bottom)),
          logoAspectRatio: logo.width / logo.height,
        };
      });
      expect(compactWelcomeLayout.gapDifference).toBeLessThanOrEqual(1);
      expect(compactWelcomeLayout.logoAspectRatio).toBeGreaterThanOrEqual(5.16);
      expect(compactWelcomeLayout.logoAspectRatio).toBeLessThanOrEqual(5.27);
      await page.setViewportSize({width: 390, height: 844});
      await page.keyboard.press("Tab");
      /** Provides focused onboarding action behavior. */
      const focusedOnboardingAction = page.locator(":focus");
      await expect(focusedOnboardingAction.getAttribute("class")).resolves.toContain("play-primary");
      expect(await focusedOnboardingAction.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe("3px");
      await page.setViewportSize({width: 459, height: 591});
      await completeOnboardingAndTours(page, true);
      expect(await page.locator(".game-app").evaluate((element) => element.scrollTop)).toBe(0);
      await page.setViewportSize({width: 390, height: 844});
      await expectAccessible(page, "game");
      /** Provides first guess cell behavior. */
      const firstGuessCell = page.locator(".guess-row .cell").first();
      /** Provides guess before offline behavior. */
      const guessBeforeOffline = await firstGuessCell.textContent();
      await context.setOffline(true);
      /** Provides offline dialog behavior. */
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
      await context.setOffline(false);
      await offlineDialog.waitFor({state: "detached"});

      expect(await page.locator(".solar-system").count()).toBe(1);
      await page.locator(".solar-system canvas").waitFor();
      expect(
        await page.locator(".solar-system canvas").evaluate((canvas: HTMLCanvasElement) => {
          /** Provides context behavior. */
          const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
          if (!context) return true;
          /** Provides viewport behavior. */
          const viewport = context.getParameter(context.VIEWPORT) as Int32Array;
          return (
            viewport[0] >= 0 &&
            viewport[1] >= 0 &&
            viewport[0] + viewport[2] <= context.drawingBufferWidth &&
            viewport[1] + viewport[3] <= context.drawingBufferHeight
          );
        }),
      ).toBe(true);
      await page.waitForFunction(() =>
        performance.getEntriesByType("resource").some((entry) => entry.name.includes("tex_sun_corona")),
      );
      /** Provides solar frame before behavior. */
      const solarFrameBefore = await page.locator(".solar-system canvas").screenshot();
      await page.waitForTimeout(500);
      /** Provides solar frame after behavior. */
      const solarFrameAfter = await page.locator(".solar-system canvas").screenshot();
      expect(solarFrameBefore.equals(solarFrameAfter)).toBe(false);
      expect(await page.locator(".guess-row").count()).toBe(5);
      expect(await page.locator(".keyboard").isVisible()).toBe(true);
      expect((await page.locator("[data-tooltip='gameSkip']").innerText()).trim()).toBe("Skip");
      /** Captures the portrait game stack's use of the available height. */
      const portraitGameLayout = await page.evaluate(() => {
        /** Captures the bottom navigation bounds. */
        const navigation = document.querySelector(".game-bottom-navigation")?.getBoundingClientRect();
        /** Captures the answer board bounds. */
        const guessBoard = document.querySelector(".guess-board")?.getBoundingClientRect();
        /** Captures the fitted game content. */
        const content = document.querySelector<HTMLElement>(".game-content");
        return {
          bottomGap: navigation ? innerHeight - navigation.bottom : Infinity,
          guessBoardWidth: guessBoard?.width ?? 0,
          scale: Number(content?.dataset.viewportScale ?? 0),
        };
      });
      expect(portraitGameLayout.bottomGap).toBeLessThanOrEqual(1);
      expect(portraitGameLayout.guessBoardWidth).toBeGreaterThan(300);
      expect(portraitGameLayout.scale).toBe(1);
      /** Captures key height for this regression check. */
      const keyHeight = await page
        .locator(".game-content .key")
        .first()
        .evaluate((element) => element.getBoundingClientRect().height);
      expect(keyHeight).toBeGreaterThanOrEqual(44);
      expect(await page.locator(".riddle-card .riddle-sound-button").count()).toBe(0);
      expect(await page.locator(".game-header .riddle-sound-button").isVisible()).toBe(true);
      await page.screenshot({path: "/tmp/jest-feedback-solo.png"});
      /** Provides main game coin balance behavior. */
      const mainGameCoinBalance = (await page.locator(".game-header .coin-pill strong").innerText()).trim();
      /** The current navigation design keeps PvP visible and large enough to tap. */
      const multiplayerEntry = page.getByRole("button", {name: /^multiplayer$/i});
      expect(await multiplayerEntry.isVisible()).toBe(true);
      /** Rendered touch target replaces assertions about literal CSS declarations. */
      const multiplayerEntryBox = await multiplayerEntry.boundingBox();
      expect(multiplayerEntryBox?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(multiplayerEntryBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      await page.evaluate(() => {
        localStorage.setItem("riddleQuest:activeRaceRun", "expired-run-from-previous-session");
        Object.assign(window, {__multiplayerCommands: [] as string[]});
        window.addEventListener("riddle-quest:game-to-host", event => {
          /** Current multiplayer entry may load categories but cannot start a retired recorded race. */
          const type = (event as CustomEvent).detail?.type;
          if (typeof type === "string" && /race/i.test(type))
            Reflect.get(window, "__multiplayerCommands").push(type);
        });
      });
      /** Measures rendered entry latency without waiting for optional transport work. */
      const multiplayerOpenDurationMs = await page.getByRole("button", {name: /^multiplayer$/i}).evaluate(
        (button) => new Promise<number>(resolve => {
          /** Monotonic start before the player's click. */
          const openedAt = performance.now();
          /** First rendered live intro ends the latency measurement. */
          const observer = new MutationObserver(() => {
            if (!document.querySelector(".race-screen")) return;
            observer.disconnect();resolve(performance.now() - openedAt);
          });
          observer.observe(document.body, {childList: true, subtree: true});
          (button as HTMLButtonElement).click();
        }),
      );
      expect(multiplayerOpenDurationMs).toBeLessThan(100);
      expect(await page.locator('[data-testid="server-activity-loader"]').count()).toBe(0);
      await page.locator(".race-category-grid button").first().waitFor();
      // This generic host has no live matchmaking capability. Its live intro must explain
      // that limitation and must never fall back to the retired recorded-race protocol.
      expect(await page.getByRole("button", {name: "Start PvP match", exact: true}).isDisabled()).toBe(true);
      expect(await page.locator(".race-category-grid button").evaluateAll(buttons =>
        buttons.length > 0 && buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true);
      expect(await page.locator(".race-screen [role=alert]").innerText()).toMatch(/unavailable/i);
      expect(await page.locator(".race-gameplay,.race-inbox,.race-hub-tabs").count()).toBe(0);
      expect((await page.locator(".race-coin-balance strong").innerText()).trim()).toBe(mainGameCoinBalance);
      await expectAccessible(page, "live multiplayer capability unavailable");
      expect(await page.evaluate(() => Reflect.get(window, "__multiplayerCommands")
        .every((type: string) => type === "game:listRaceCategories"))).toBe(true);
      await page.screenshot({path: "/tmp/jest-feedback-multiplayer-unavailable.png"});

      await page.evaluate((newCoins) => {
        /** Real multiplayer supplies the refreshed profile as well as its reward receipt. */
        const current = Reflect.get(window, "__latestHostAuthState");
        if (!current?.profile || !current?.user) throw new Error("Mock authority profile unavailable");
        window.dispatchEvent(new CustomEvent("riddle-quest:host-to-game", {
          detail: {type: "host:authState", payload: {user: current.user, profile: {...current.profile, coins: newCoins}}},
        }));
        window.dispatchEvent(
          new CustomEvent("riddle-quest:host-to-game", {
            detail: {
              type: "host:operationResult",
              requestId: "race-outcome-achievement-test",
              payload: {
                operation: "raceOutcome",
                ok: true,
                data: {
                  newlyUnlockedAchievementIds: ["race_debut"],
                  achievementCoinsAwarded: 25,
                  newCoins,
                },
              },
            },
          }),
        );
      }, Number(mainGameCoinBalance) + 25);
      /** Automatic achievement tabs must leave gameplay available. */
      const multiplayerAchievementTabs = page.locator(".fanfare-tabs");
      // Live multiplayer keeps its own focus and interaction surface. Ancillary rewards
      // remain queued until the player returns to the single-player surface.
      expect(await multiplayerAchievementTabs.count()).toBe(0);
      await page.locator(".race-close").click();
      await page.locator(".race-screen").waitFor({state: "detached"});
      await multiplayerAchievementTabs.getByText("Race Debut", {exact: true}).waitFor();
      expect(await page.locator(".modal-reward").count()).toBe(0);
      expect(await page.locator(".game-content").evaluate(element => (element as HTMLElement).inert)).toBe(false);
      expect(await multiplayerAchievementTabs.getByRole("button").count()).toBe(0);
      await expectAccessible(page, "automatic achievement reward");
      await page.waitForFunction(
        (expected) => document.querySelector(".game-header .coin-pill strong")?.textContent?.trim() === expected,
        String(Number(mainGameCoinBalance) + 25),
      );
      await multiplayerAchievementTabs.waitFor({state: "detached"});
      /** Provides daily page behavior. */
      const dailyPage = await browser.newPage({viewport: {width: 390, height: 844}});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await dailyPage.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      await installCompletedMockGameTour(dailyPage);
      await dailyPage.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await dailyPage.goto(`${hostedBrowserUrl}/?harness=jest&gameMode=challenge`);
      await completeMockOnboarding(dailyPage);
      await dailyPage.locator(".game-mode-label").getByText(/daily/i).waitFor({timeout: 15_000});
      await dailyPage.getByRole("button", {name: /^multiplayer$/i}).click();
      await dailyPage.locator('.race-screen[role="dialog"]').waitFor();
      await dailyPage.locator(".race-close").click();
      expect(await dailyPage.locator(".game-mode-label").innerText()).toBe("Daily");
      expect(await dailyPage.getByRole("button", {name: /^skip$/i}).isVisible()).toBe(true);
      await dailyPage.getByRole("button", {name: /^skip$/i}).click();
      await dailyPage.getByRole("dialog", {name: "Leave the Daily riddle?"}).waitFor();
      expect(await dailyPage.locator(".modal-skip").innerText()).toContain("Your Daily riddle will stay unfinished.");
      await dailyPage.getByRole("button", {name: "Cancel", exact: true}).click();
      expect(await dailyPage.locator(".game-mode-label").innerText()).toBe("Daily");
      await dailyPage.getByRole("button", {name: /^skip$/i}).click();
      await dailyPage.getByRole("button", {name: "Play Classic", exact: true}).click();
      await dailyPage.locator(".game-mode-label").getByText(/classic/i).waitFor();
      await dailyPage.close();
      /** Provides release modal chunk behavior. */
      let releaseModalChunk: () => void = () => undefined;
      /** Provides modal chunk gate behavior. */
      const modalChunkGate = new Promise<void>((resolve) => {
        releaseModalChunk = () => resolve();
      });
      /** Provides modal chunk requested behavior. */
      let modalChunkRequested = false;
      /** Provides compact page behavior. */
      const compactPage = await browser.newPage({viewport: {width: 320, height: 568}});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await compactPage.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      await compactPage.route("**/assets/GameModalView-*.js", async (route) => {
        modalChunkRequested = true;
        await modalChunkGate;
        await route.continue();
      });
      await installCompletedMockGameTour(compactPage);
      await compactPage.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:v2:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await compactPage.goto(`${hostedBrowserUrl}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(compactPage);
      await compactPage.locator(".game-bottom-navigation").waitFor({timeout: 15_000});
      await compactPage.waitForFunction(
        () =>
          (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <=
          innerHeight + 1,
      );
      /** Provides compact layout behavior. */
      const compactLayout = await compactPage.evaluate(() => {
        /** Provides navigation behavior. */
        const navigation = document.querySelector(".game-bottom-navigation")?.getBoundingClientRect();
        /** Provides keyboard key behavior. */
        const keyboardKey = document.querySelector(".keyboard .key")?.getBoundingClientRect();
        /** Provides keyboard behavior. */
        const keyboard = document.querySelector(".keyboard")?.getBoundingClientRect();
        /** Provides guess board behavior. */
        const guessBoard = document.querySelector(".guess-board")?.getBoundingClientRect();
        /** Provides game area behavior. */
        const gameArea = document.querySelector(".riddle-surface")?.getBoundingClientRect();
        /** Provides content behavior. */
        const content = document.querySelector<HTMLElement>(".game-content");
        /** Rendered answer cell supplies exact hint and feedback assertions. */
        const cell = document.querySelector<HTMLElement>(".cell");
        /** Cell geometry verifies that restored letters occupy visible slots. */
        const cellBounds = cell?.getBoundingClientRect();
        return {
          documentHeight: document.documentElement.scrollHeight,
          keyHeight: keyboardKey?.height ?? 0,
          keyboardHeight: keyboard?.height ?? Infinity,
          keyboardWidth: keyboard?.width ?? Infinity,
          guessBoardWidth: guessBoard?.width ?? 0,
          gameAreaWidth: gameArea?.width ?? 0,
          navigationBottom: navigation?.bottom ?? Infinity,
          contentBottom: content?.getBoundingClientRect().bottom ?? Infinity,
          cellDistortion: cellBounds ? Math.abs(cellBounds.width - cellBounds.height) : Infinity,
          cellRadius: cell ? getComputedStyle(cell).borderRadius : "",
          scale: Number(content?.dataset.viewportScale ?? 0),
        };
      });
      expect(compactLayout.documentHeight).toBeLessThanOrEqual(569);
      expect(compactLayout.navigationBottom).toBeLessThanOrEqual(569);
      expect(compactLayout.keyHeight).toBeGreaterThanOrEqual(44);
      expect(compactLayout.keyHeight).toBeLessThanOrEqual(48);
      expect(compactLayout.keyboardHeight).toBeLessThanOrEqual(152);
      expect(compactLayout.keyboardWidth).toBeLessThanOrEqual(compactLayout.gameAreaWidth + 1);
      expect(compactLayout.guessBoardWidth).toBeLessThanOrEqual(compactLayout.gameAreaWidth + 1);
      expect(compactLayout.cellDistortion).toBeLessThanOrEqual(1);
      expect(compactLayout.cellRadius).toBe("50%");
      expect(Math.abs(compactLayout.contentBottom - 568)).toBeLessThanOrEqual(1);
      expect(compactLayout.navigationBottom).toBeGreaterThanOrEqual(567);
      expect(compactLayout.scale).toBeGreaterThanOrEqual(0.92);
      // Onboarding hands focus back to the board on a later frame; slow machines can sample while it is still inert.
      await compactPage.waitForFunction(() => !document.querySelector(".game-content")?.closest("[inert],[aria-hidden=true]"));
      expect(await compactPage.getByRole("region", {name: /virtual keyboard/i}).isVisible()).toBe(true);

      await compactPage.getByRole("button", {name: /^settings$/i}).click();
      /** Provides modal loading fallback behavior. */
      const modalLoadingFallback = compactPage.getByRole("status", {name: /^loading$/i});
      await modalLoadingFallback.waitFor();
      expect(modalChunkRequested).toBe(true);
      releaseModalChunk();
      await compactPage.getByRole("heading", {name: /^settings$/i}).waitFor();
      await expectModalCentered(compactPage);
      await compactPage.getByRole("button", {name: /^about/i}).click();
      await compactPage.getByRole("heading", {name: /about \/ legal/i}).waitFor();
      await expectModalCentered(compactPage);
      /** Provides about list behavior. */
      const aboutList = compactPage.locator(".about-list");
      /** Provides about rows behavior. */
      const aboutRows = aboutList.locator(".about-list-row");
      expect(await aboutList.locator("a[href^='http'], a[href^='mailto:']").count()).toBe(0);
      expect(await aboutList.getByRole("link").count()).toBe(1);
      expect(await aboutList.innerText()).not.toMatch(/riddle quest website|privacy policy|terms of use/i);
      for (const label of [/support/i, /data export/i]) {
        expect(
          await aboutList
            .locator("div.about-list-row")
            .filter({hasText: label})
            .getByText(/grindheadgames@gmail\.com/i)
            .isVisible(),
        ).toBe(true);
      }
      expect(await aboutRows.count()).toBe(4);
      /** Provides licenses link behavior. */
      const licensesLink = compactPage.getByRole("link", {name: /third-party licenses/i});
      expect(await licensesLink.getAttribute("href")).toBe("./third-party-licenses.txt");
      expect(await licensesLink.getAttribute("target")).toBeNull();
      /** Provides licenses response behavior. */
      const licensesResponse = await compactPage.request.get(
        new URL((await licensesLink.getAttribute("href")) ?? "", compactPage.url()).toString(),
      );
      expect(licensesResponse.status()).toBe(200);
      expect(await licensesResponse.text()).toContain(`react@${reactVersion}`);
      await compactPage.getByRole("button", {name: /account deletion/i}).click();
      await compactPage.locator(".modal-profile").waitFor();
      await compactPage.keyboard.press("Escape");
      for (const letter of "CRANE")
        await compactPage
          .locator(".keyboard")
          .getByRole("button", {name: new RegExp(`^${letter}$`)})
          .click();
      await compactPage.evaluate(() => {
        /** Withholds confirmation so the browser can only use preloaded feedback. */
        const dispatch = window.dispatchEvent.bind(window);
        window.dispatchEvent = (event: Event) => {
          if (
            event.type === "riddle-quest:host-to-game" &&
            (event as CustomEvent).detail?.payload?.operation === "guess"
          )
            return true;
          return dispatch(event);
        };
      });
      await compactPage.locator("audio").evaluate((audio: HTMLAudioElement) => {
        audio.dataset.volumeChanged = "false";
        audio.addEventListener("volumechange", () => {
          audio.dataset.volumeChanged = "true";
        });
      });
      /** Measures immediate wrong-answer rendering with the response withheld. */
      const wrongFeedbackLatency = await compactPage
        .getByRole("button", {name: /^submit$/i})
        .evaluate(async (button) => {
          /** Submission time on the browser's monotonic clock. */
          const started = performance.now();
          (button as HTMLButtonElement).click();
          while (document.querySelectorAll(".guess-row:first-child .cell.red").length !== 3) {
            if (performance.now() - started > 1000) throw new Error("Wrong-answer feedback waited for the server");
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return performance.now() - started;
        });
      expect(wrongFeedbackLatency).toBeLessThan(250);
      expect(await compactPage.locator(".guess-row:first-child .cell.green").count()).toBe(2);
      await compactPage.locator("[data-tooltip-id=hintAfterWrongGuess] button").click();
      await compactPage.locator(".keyboard").getByRole("button", {name: /^P$/}).click();
      expect(await compactPage.locator(".guess-row").nth(1).locator(".cell").first().textContent()).toBe("P");
      await compactPage.waitForTimeout(1100);
      expect(await compactPage.locator("audio").getAttribute("data-volume-changed")).toBe("false");
      console.info(`Immediate wrong-answer feedback: ${wrongFeedbackLatency.toFixed(1)}ms with server response held`);
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
      await page
        .getByRole("button", {name: /buy coins/i})
        .first()
        .click();
      await page.getByRole("heading", {name: /coin shop/i}).waitFor();
      expect(await page.locator(".tooltip-card").count()).toBe(0);
      await expectModalCentered(page);
      await expectAccessible(page, "coin shop");
      expect(
        await page.locator(".game-shop-grid article:not(.shop-subscription-card) button").allTextContents(),
      ).toEqual(["$0.99", "$1.99", "$2.99", "$4.99", "$9.99", "$19.99"].map((price) => `PURCHASE ${price}`));
      await page.keyboard.press("Escape");
      await page.setViewportSize({width: 390, height: 667});
      await page.waitForFunction(
        () =>
          (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <=
          innerHeight + 1,
      );
      expect(
        await page.evaluate(() => {
          /** Provides shell behavior. */
          const shell = document.querySelector<HTMLElement>(".game-app");
          /** Provides content behavior. */
          const content = document.querySelector<HTMLElement>(".game-content");
          /** Provides navigation behavior. */
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
          () =>
            (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <=
            innerHeight + 1,
        );
      }
      await page.setViewportSize({width: 390, height: 667});

      await page
        .getByRole("button", {name: /^profile$/i})
        .first()
        .click();
      await page.getByRole("heading", {name: /^profile$/i}).waitFor();
      await page
        .locator(".tooltip-card")
        .getByRole("heading", {name: /^profile$/i})
        .waitFor();
      /** Provides profile tour headings behavior. */
      const profileTourHeadings: string[] = [];
      for (let step = 0; step < 9; step += 1) {
        expect(await page.locator(".modal-profile").getAttribute("inert")).toBeNull();
        expect(
          await page.locator(".tooltip-backdrop").evaluate((element) => {
            /** Captures all overlay effects that could obscure the profile page. */
            const style = getComputedStyle(element);
            /** Provides spotlight behavior. */
            const spotlight = element.querySelector(".tooltip-spotlight");
            return {
              filter: style.backdropFilter,
              background: style.backgroundColor,
              image: style.backgroundImage,
              dimsOutsideSpotlight: spotlight ? getComputedStyle(spotlight).boxShadow.includes("9999px") : false,
            };
          }),
        ).toEqual({filter: "none", background: "rgba(0, 0, 0, 0)", image: "none", dimsOutsideSpotlight: false});
        profileTourHeadings.push(await page.locator(".tooltip-card h2").innerText());
        await page
          .locator(".tooltip-card")
          .getByRole("button", {name: /got it/i})
          .click();
      }
      expect(profileTourHeadings).toContain("User progression");
      expect(profileTourHeadings).toContain("Your Treasure Chest");
      await page.locator(".tooltip-card").waitFor({state: "detached"});
      await page.waitForFunction(() => document.querySelector(".game-modal")?.contains(document.activeElement));
      await expectAccessible(page, "profile");
      await expectModalCentered(page);
      for (const name of [/statistics/i, /achievements/i, /ranks/i, /leaderboard/i, /buy coins/i]) {
        expect(await page.locator(".modal-profile").getByRole("button", {name}).isVisible()).toBe(true);
      }
      await page.getByRole("button", {name: /^statistics$/i}).click();
      await page.locator(".modal-statistics").waitFor();
      await expectModalCentered(page);
      await expectAccessible(page, "statistics");
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", {name: /^profile$/i})
        .first()
        .click();
      await page.locator(".modal-profile").waitFor();
      await page.locator(".modal-profile").getByRole("button", {name: /buy coins/i}).click();
      await page.locator(".modal-shop").waitFor();
      await expectAccessible(page, "shop");
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", {name: /^profile$/i})
        .first()
        .click();
      await page.locator(".modal-profile").waitFor();
      await page.getByRole("button", {name: /^achievements$/i}).click();
      await page.locator(".modal-achievements").waitFor();
      await expectAccessible(page, "achievements");
      await page.getByText("Race Debut", {exact: true}).waitFor();
      await page.getByText("Challenge Issued", {exact: true}).waitFor();
      await page.getByText("Clean Run", {exact: true}).waitFor();
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", {name: /^profile$/i})
        .first()
        .click();
      await page.locator(".modal-profile").waitFor();
      await page.getByRole("button", {name: /^ranks$/i}).evaluate((button) => (button as HTMLButtonElement).click());
      await page.locator(".modal-ranks").waitFor();
      await expectAccessible(page, "ranks");
      /** Provides rank icon names behavior. */
      const rankIconNames = await page
        .locator(".modal-ranks .rank-list [data-rank-icon]")
        .evaluateAll((icons) => icons.map((icon) => icon.getAttribute("data-rank-icon")));
      expect(rankIconNames).toHaveLength(35);
      expect(new Set(rankIconNames).size).toBe(35);
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", {name: /^profile$/i})
        .first()
        .click();
      await page.locator(".modal-profile").waitFor();
      /** Loads ing leaderboard. */
      const loadingLeaderboard = await page.getByRole("button", {name: /^leaderboard$/i}).evaluate(async (button) => {
        (button as HTMLButtonElement).click();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        /** Provides list behavior. */
        const list = document.querySelector(".leaderboard-list");
        return {
          busy: list?.getAttribute("aria-busy"),
          text: list?.textContent?.trim() ?? "",
        };
      });
      expect(loadingLeaderboard).toEqual({busy: "true", text: ""});
      /** Provides leaderboard list behavior. */
      const leaderboardList = page.locator(".leaderboard-list");
      await leaderboardList.waitFor();
      /** Provides leaderboard offsets behavior. */
      const leaderboardOffsets = await page.locator(".modal-leaderboard").evaluate((element) => {
        /** Provides rect behavior. */
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
      /** Provides first page fits behavior. */
      const firstPageFits = await leaderboardList.evaluate((list) => {
        /** Provides last row behavior. */
        const lastRow = list.lastElementChild?.getBoundingClientRect();
        /** Lists rect. */
        const listRect = list.getBoundingClientRect();
        return Boolean(lastRow && lastRow.bottom <= listRect.bottom + 1);
      });
      if (!firstPageFits) {
        await page.screenshot({path: "/tmp/riddle-leaderboard-clipped.png"});
        console.info("Clipped leaderboard bounds", await leaderboardList.evaluate(list => ({
          list: list.getBoundingClientRect().toJSON(),
          rows: [...list.children].map(row => ({bounds: row.getBoundingClientRect().toJSON(), text: row.textContent})),
        })));
      }
      expect(firstPageFits).toBe(true);
      await page.screenshot({path: "/tmp/riddle-leaderboard-fixed.png"});
      await page.getByRole("button", {name: /next page/i}).click();
      expect(await leaderboardList.locator("li").count()).toBe(10);
      expect(await leaderboardList.locator("li").first().locator("b").textContent()).toBe("11");
      // Changing measurements returns to page one and survives the runtime-validated bridge.
      await page.getByRole("button", {name: /^multiplayer wins$/i}).click();
      await page.waitForFunction(() => document.querySelector(".leaderboard-list")?.getAttribute("aria-busy") === "false");
      expect(await page.getByRole("button", {name: /^multiplayer wins$/i}).getAttribute("aria-pressed")).toBe("true");
      expect(await leaderboardList.locator("li").first().locator("b").textContent()).toBe("1");
      expect(await leaderboardList.locator("li").first().locator("strong").textContent()).toBe("20");
      expect(await leaderboardList.locator("li").first().innerText()).toContain("Solver 20");
      await expectAccessible(page, "multiplayer wins leaderboard");
      await page.getByRole("button", {name: /^wins$/i}).click();
      await page.waitForFunction(() => document.querySelector(".leaderboard-list")?.getAttribute("aria-busy") === "false");
      expect(await leaderboardList.locator("li").first().locator("strong").textContent()).toBe("29");
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", {name: /^settings$/i})
        .first()
        .click();
      await page.getByRole("heading", {name: /^settings$/i}).waitFor();
      /** Provides modal close box behavior. */
      const modalCloseBox = await page.locator(".modal-x").boundingBox();
      expect(modalCloseBox?.width).toBe(44);
      expect(modalCloseBox?.height).toBe(44);
      for (const text of [/sound/i, /reduced motion/i, /help/i, /credits/i, /about/i, /buy coins/i]) {
        expect(await page.getByText(text).first().isVisible()).toBe(true);
      }
      expect(await page.getByRole("combobox", {name: "Language", exact: true}).count()).toBe(0);
      expect(await page.getByRole("button", {name: /high contrast/i}).count()).toBe(0);
      expect(await page.getByText(/show activity to rivals/i).count()).toBe(0);
      await expectAccessible(page, "settings");
      await expectModalCentered(page);
      await page.keyboard.press("Escape");

      await page.locator(".keyboard").getByRole("button", {name: /^P$/}).click();
      await page
        .locator(".guess-row")
        .first()
        .getByRole("button", {name: /^letter 3$/i})
        .click();
      await page.locator(".keyboard").getByRole("button", {name: /^A$/}).click();
      // Jest player-data writes are queued and durable only after the adapter flushes.
      // Wait for the mock platform's persisted snapshot rather than racing reload
      // against React's passive checkpoint effect or relying on a fixed delay.
      await page.waitForFunction(() => {
        /** Provides raw behavior. */
        const raw = localStorage.getItem("riddleQuest:mockJestPlayerData");
        if (!raw) return false;
        try {
          /** Provides value behavior. */
          const value = JSON.parse(raw) as {
            /** Stores active game. */
            activeGame?: {
              /** Stores current letters. */
              currentLetters?: unknown[];
            };
          };
          /** Provides letters behavior. */
          const letters = value.activeGame?.currentLetters;
          return (
            Array.isArray(letters) &&
            String(letters[0] ?? "").toLowerCase() === "p" &&
            String(letters[2] ?? "").toLowerCase() === "a"
          );
        } catch {
          return false;
        }
      });
      await page.reload();
      await completeMockOnboarding(page);
      await page.getByText(/what has keys/i).waitFor({timeout: 15000});
      /** Provides active guess row behavior. */
      const activeGuessRow = page.locator(".guess-row").first();
      expect(await activeGuessRow.locator(".cell").nth(0).innerText()).toMatch(/^p$/i);
      expect(await activeGuessRow.locator(".cell").nth(2).innerText()).toMatch(/^a$/i);

      await activeGuessRow.getByRole("button", {name: /^letter 2$/i}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^I$/}).click();
      await activeGuessRow
        .getByRole("button", {name: /^letter 4$/i})
        .evaluate((button) => (button as HTMLButtonElement).click());
      await page.locator(".keyboard").getByRole("button", {name: /^N$/}).click();
      await page.locator(".keyboard").getByRole("button", {name: /^O$/}).click();
      await page.evaluate(() => {
        /** Original transport, restored when the harness releases the response. */
        const dispatch = window.dispatchEvent.bind(window);
        Object.assign(window, {__completionBeforeGuess: false});
        window.addEventListener("riddle-quest:host-to-game", event => {
          /** Canonical reward receipt survives release of the delayed-guess transport wrapper. */
          const message = (event as CustomEvent).detail;
          if (message?.payload?.operation === "completeGame" && message.payload.ok)
            Object.assign(window, {__confirmedVictoryCoins: message.payload.data.coinsEarned});
        });
        window.dispatchEvent = (event: Event) => {
          if (
            event.type === "riddle-quest:host-to-game" &&
            (event as CustomEvent).detail?.payload?.operation === "guess"
          ) {
            Object.assign(window, {__heldGuess: (event as CustomEvent).detail});
            return true;
          }
          if (
            event.type === "riddle-quest:game-to-host" &&
            (event as CustomEvent).detail?.type === "game:completeGame"
          ) {
            Object.assign(window, {__completionBeforeGuess: true});
          }
          return dispatch(event);
        };
        Object.assign(window, {
          __releaseGuess: () => {
            window.dispatchEvent = dispatch;
            dispatch(new CustomEvent("riddle-quest:host-to-game", {detail: Reflect.get(window, "__heldGuess")}));
          },
        });
      });
      /** Elapsed time from submission to rendered letter feedback. */
      const winsBeforeGuess = await page.evaluate(() => JSON.parse(localStorage.getItem("riddleQuest:mockJestPlayerData") ?? "{}").profile?.wins ?? 0);
      /** Time until provisional correct-answer feedback is displayed. */
      const feedbackLatency = await page
        .locator(".game-input-actions")
        .getByRole("button", {name: /submit/i})
        .evaluate(async (button) => {
          /** Monotonic timestamp immediately before submission. */
          const started = performance.now();
          (button as HTMLButtonElement).click();
          while (document.querySelectorAll(".guess-row:first-child .cell.green").length !== 5) {
            if (performance.now() - started > 1000) throw new Error("Guess feedback waited for the server");
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return performance.now() - started;
        });
      expect(feedbackLatency).toBeLessThan(250);
      await page.waitForFunction(() => "__heldGuess" in window);
      await page.locator(".modal-victory").waitFor({timeout: 2000});
      expect(await page.locator(".modal-victory .reward-continue").innerText()).toMatch(/^next(?: level)?$/i);
      await page.waitForFunction((previousWins) => {
        /** Replaying this saved riddle retains earned progress until authority confirms it. */
        const raw = localStorage.getItem("riddleQuest:mockJestPlayerData");
        if (!raw) return false;
        try {
          /** Locally projected profile data. */
          const profile = (
            JSON.parse(raw) as {
              /** Stores profile. */
              profile?: {
                /** Confirmed or locally projected victory count. */
                wins?: number;
                /** Stores achievements. */
                achievements?: unknown[];
              };
            }
          ).profile;
          return (
            profile?.wins === previousWins
          );
        } catch {
          return false;
        }
      }, winsBeforeGuess);
      expect(await page.getByRole("button", {name: /tap the chest/i}).count()).toBe(0);
      await page.evaluate(() => {
        if (Reflect.get(window, "__completionBeforeGuess")) throw new Error("Completion ran before guess confirmation");
        Reflect.get(window, "__releaseGuess")();
      });
      console.info(`Immediate correct-answer feedback: ${feedbackLatency.toFixed(1)}ms with server response held`);
      expect(await page.locator(".game-content").evaluate((element) => (element as HTMLElement).inert)).toBe(true);
      await page.getByRole("heading", {name: /nice job/i}).waitFor();
      // The victory result is the only surface for the reward: no coin notice is layered under it.
      expect(await page.locator(".game-notice").count()).toBe(0);
      expect(await page.locator("#game-modal-title").evaluate((heading) => getComputedStyle(heading).textAlign)).toBe(
        "center",
      );
      await page.screenshot({path: "/tmp/jest-feedback-victory.png"});
      await expectAccessible(page, "victory reward");
      /** Provides victory continue behavior. */
      const victoryContinue = page.locator(".modal-victory .reward-continue");
      await victoryContinue.waitFor();
      // Coins are granted with the popup: no chest tap exists and Next never waits on collection.
      expect(await page.getByRole("button", {name: /tap the chest/i}).count()).toBe(0);
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".modal-victory .reward-continue")?.disabled);
      /** Next is the dominant CTA, above the secondary share action. */
      const victoryContinueBox = await victoryContinue.boundingBox();
      /** Provides victory share box behavior. */
      const victoryShareBox = await page.getByRole("button", {name: /invite a friend/i}).boundingBox();
      expect(victoryContinueBox?.height ?? 0).toBeGreaterThanOrEqual(60);
      expect(victoryContinueBox?.y ?? Infinity).toBeLessThan(victoryShareBox?.y ?? 0);
      await page.keyboard.press("Escape");
      expect(await page.locator(".modal-victory").count()).toBe(1);
      /** Displayed collection must match the authority receipt rather than a retired fixed reward. */
      const confirmedVictoryCoins = await page.evaluate(() => Number(Reflect.get(window, "__confirmedVictoryCoins")));
      expect(confirmedVictoryCoins).toBeGreaterThan(0);
      expect(Number((await page.locator(".modal-victory .coin-award > strong").innerText()).replace(/[^\d]/g, ""))).toBe(
        confirmedVictoryCoins,
      );
      /** Granted total announced by the popup. */
      const victoryAwardBalance = Number(
        (await page.locator(".modal-victory .coin-award > span").innerText()).replace(/[^\d]/g, ""),
      );
      await page.locator(".modal-victory .reward-chest img[src*='chest-open']").waitFor();
      await page.waitForFunction(
        (finalBalance) =>
          Number(document.querySelector(".game-header .coin-pill strong")?.textContent?.replace(/,/g, "") ?? "0") ===
          finalBalance,
        victoryAwardBalance,
      );
      await page.getByRole("button", {name: /invite a friend/i}).click();
      await page.locator('[data-testid="server-activity-loader"]').waitFor({state: "detached"});
      expect(await page.locator(".modal-victory").count()).toBe(1);
      await page.waitForTimeout(2800);
      expect(await page.locator(".modal-victory").count()).toBe(1);

      for (const viewport of [
        {width: 390, height: 844},
        {width: 360, height: 640},
        {width: 320, height: 568},
        {width: 640, height: 360},
        {width: 844, height: 390},
      ]) {
        await page.setViewportSize(viewport);
        await expectRewardModalFits(page);
      }
      // One primary action returns to gameplay without stepping through milestone dialogs.
      await victoryContinue.click();
      await page.locator(".modal-victory").waitFor({state: "detached"});
      // Dismiss any remaining guidance; the coin shop tip only appears at the start of a riddle after a win,
      // never at the stage transition, and this harness profile already met it after the gameplay tour.
      /** Post-win guidance card. */
      const postWinTooltip = page.locator(".tooltip-card");
      await postWinTooltip.waitFor({state: "visible", timeout: 2_000}).catch(() => undefined);
      for (let step = 0; step < 5 && (await postWinTooltip.isVisible()); step += 1) {
        await postWinTooltip.getByRole("button", {name: /got it/i}).click();
        await page.waitForTimeout(250);
      }
      expect(
        await page.evaluate(() =>
          Object.keys(localStorage).some(
            (key) => key.startsWith("riddleQuest:tooltipSeen:gameCoins:") && localStorage.getItem(key) === "seen",
          ),
        ),
      ).toBe(true);
      await page.waitForFunction(
        () =>
          (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <=
          innerHeight + 1,
      );
      expect(
        await page.evaluate(() => {
          /** Provides shell behavior. */
          const shell = document.querySelector<HTMLElement>(".game-app");
          /** Provides content behavior. */
          const content = document.querySelector<HTMLElement>(".game-content");
          /** Provides navigation behavior. */
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
      // No reward notice follows the victory result between riddles.
      expect(await page.locator(".game-notice").count()).toBe(0);
      await page.keyboard.press("a");
      for (const viewport of [
        {width: 390, height: 844},
        {width: 390, height: 600},
        {width: 844, height: 390},
        {width: 280, height: 480},
        {width: 768, height: 1024},
        {width: 844, height: 501},
        {width: 1024, height: 600},
        {width: 1920, height: 1080},
        {width: 2560, height: 1080},
      ]) {
        await page.setViewportSize(viewport);
        await page.waitForFunction(
          () =>
            (document.querySelector(".game-bottom-navigation")?.getBoundingClientRect().bottom ?? Infinity) <=
            innerHeight + 1,
        );
        expect(
          await page.evaluate(() => {
            /** Collects the primary surfaces that must remain visible. */
            const visibleSurfaces = [
              document.querySelector(".game-header"),
              document.querySelector(".riddle-card"),
              document.querySelector(".guess-board"),
              document.querySelector(".keyboard"),
              document.querySelector(".game-bottom-navigation"),
            ].filter((element): element is Element => element !== null);
            return {
              documentFits:
                document.documentElement.scrollWidth <= innerWidth + 1 &&
                document.documentElement.scrollHeight <= innerHeight + 1,
              surfacesFit: visibleSurfaces.every((element) => {
                /** Captures this surface's viewport-relative bounds. */
                const rect = element.getBoundingClientRect();
                return (
                  rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1
                );
              }),
            };
          }),
        ).toEqual({documentFits: true, surfacesFit: true});
        /** Captures the font-relative optical offset after pixel rounding. */
        const riddleOpticalOffset = await page.locator(".riddle-card h1").evaluate((heading) => {
          /** Captures the riddle text bounds. */
          const text = heading.getBoundingClientRect();
          /** Captures the background card bounds. */
          const card = heading.parentElement!.getBoundingClientRect();
          /** Captures the rendered riddle font size. */
          const fontSize = Number.parseFloat(getComputedStyle(heading).fontSize);
          return (text.top + text.height / 2 - (card.top + card.height / 2)) / fontSize;
        });
        expect(riddleOpticalOffset).toBeGreaterThanOrEqual(-0.3);
        expect(riddleOpticalOffset).toBeLessThanOrEqual(-0.18);
      }
      await page.setViewportSize({width: 1280, height: 800});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.setViewportSize({width: 2560, height: 1080});
      expect(
        await page.locator(".game-header").evaluate((element) => element.getBoundingClientRect().width),
      ).toBeLessThanOrEqual(1201);

      expect(await page.locator("body").innerText()).not.toMatch(
        /Clerk|Auth0|sign in with Google|rewarded ad|install the app/i,
      );
      expect(consoleErrors).toEqual([]);
      expect(layoutWarnings).toEqual([]);

      // The primary journey retains a broad DOM and WebGL history. Release it
      // before isolated low-end/iframe checks so a constrained release host
      // cannot starve a later renderer process.
      await context.close();
      /** Isolates low-end device settings while allowing accessibility analysis pages. */
      const lowEndContext = await browser.newContext({
        viewport: {width: 360, height: 740},
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 11; Pixel 3a) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
      });
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await lowEndContext.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      /** Exercises the low-end gameplay and loss screens. */
      const lowEndPage = await lowEndContext.newPage();
      await installCompletedMockGameTour(lowEndPage);
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
      await lowEndPage.goto(`${hostedBrowserUrl}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(lowEndPage);
      await lowEndPage.getByText(/what has keys/i).waitFor({timeout: 15_000});
      await lowEndPage.waitForTimeout(3_000);
      expect(await lowEndPage.locator(".solar-system").count()).toBe(0);
      /** Provides low end resources behavior. */
      const lowEndResources = await lowEndPage.evaluate(() =>
        performance.getEntriesByType("resource").map((entry) => entry.name),
      );
      // The onboarding Play gesture unlocks music even when decorative WebGL is suppressed.
      expect(lowEndResources.some((resource) => /music-.*\.webm/.test(resource))).toBe(true);
      expect(lowEndResources.some((resource) => /vendor-three|SolarSystem/.test(resource))).toBe(false);
      expect(await lowEndPage.locator(".keyboard").isVisible()).toBe(true);
      // Exhaust attempts to verify the loss panel's shared palette without the victory wheel.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (attempt === 4) {
          await lowEndPage.waitForFunction(
            () => !Object.keys(localStorage).some((key) => key.includes("pendingPlay:v1:")),
          );
          await lowEndPage.evaluate(() => {
            /** Original host dispatcher retained until the final result is released. */
            const dispatch = window.dispatchEvent.bind(window);
            window.dispatchEvent = (event: Event) => {
              /** Host reply delayed to prove the panel is locally predicted. */
              const message = (event as CustomEvent).detail;
              if (
                event.type === "riddle-quest:host-to-game" &&
                message?.type === "host:operationResult" &&
                message.payload?.operation === "guess"
              ) {
                Reflect.set(window, "__heldFinalGuess", message);
                return true;
              }
              return dispatch(event);
            };
            Reflect.set(window, "__releaseFinalGuess", () =>
              dispatch(new CustomEvent("riddle-quest:host-to-game", {detail: Reflect.get(window, "__heldFinalGuess")})),
            );
          });
        }
        /** The wrong letter used by this regression scenario. */
        const wrongLetter = ["X", "Z", "Q", "V", "B"][attempt];
        for (let letter = 0; letter < 5; letter += 1) {
          await lowEndPage.locator(".keyboard").getByRole("button", {name: wrongLetter, exact: true}).click();
        }
        if (attempt === 4) {
          /** Time from final Submit to the visible out of attempts panel. */
          const panelMs = await lowEndPage
            .locator(".game-input-actions")
            .getByRole("button", {name: /submit/i})
            .evaluate(async (button) => {
              /** Clock sampled immediately before the click. */
              const started = performance.now();
              (button as HTMLButtonElement).click();
              while (!document.querySelector(".modal-continue")) {
                if (performance.now() - started > 1_000) throw new Error("Out of attempts waited for the server");
                await new Promise((resolve) => requestAnimationFrame(resolve));
              }
              return performance.now() - started;
            });
          expect(panelMs).toBeLessThan(250);
          await lowEndPage.waitForFunction(() => Reflect.has(window, "__heldFinalGuess"));
          expect(await lowEndPage.locator(".continue-actions button:not(:disabled)").count()).toBe(3);
          await lowEndPage.locator(".loss-shop-action").click();
          await lowEndPage.locator(".modal-shop").waitFor();
          await lowEndPage.evaluate(() => Reflect.get(window, "__releaseFinalGuess")());
          await lowEndPage.locator(".modal-continue").waitFor();
          await lowEndPage.locator(".continue-actions button").last().waitFor({state: "visible"});
          await lowEndPage.waitForFunction(
            () => document.querySelector(".continue-actions button:last-child")?.hasAttribute("disabled") === false,
          );
        } else
          await lowEndPage
            .locator(".game-input-actions")
            .getByRole("button", {name: /submit/i})
            .click();
        await lowEndPage.locator(".guess-row").nth(attempt).locator(".cell.red").first().waitFor();
        if (attempt === 0) await lowEndPage.getByRole("button", {name: /got it/i}).click();
      }
      await lowEndPage.locator(".modal-continue").waitFor();
      expect(
        await lowEndPage.locator(".modal-continue").evaluate((panel) => getComputedStyle(panel).backgroundImage),
      ).toMatch(/(?:\.svg\b|data:image\/svg\+xml[,;])/);
      expect(await lowEndPage.locator(".game-modal-backdrop > .spinning-wheel-graphic").count()).toBe(0);
      expect(await lowEndPage.locator(".continue-balance img").count()).toBe(0);
      expect(
        await lowEndPage
          .locator(".continue-actions .play-primary")
          .first()
          .evaluate((button) => getComputedStyle(button).backgroundColor),
      ).toBe("rgb(244, 184, 63)");
      await expectAccessible(lowEndPage, "out of attempts");
      await lowEndPage.screenshot({path: "/tmp/jest-feedback-loss.png"});
      /** Hold the paid Skip result to verify the loss prompt acts directly and previews its charge. */
      await lowEndPage.evaluate(() => {
        /** Native event dispatcher bypassing the temporary result hold. */
        const dispatch = window.dispatchEvent.bind(window);
        Reflect.set(window, "__releaseLossSkip", () =>
          dispatch(
            new CustomEvent("riddle-quest:host-to-game", {
              detail: Reflect.get(window, "__heldLossSkip"),
            }),
          ),
        );
        window.dispatchEvent = (event: Event) => {
          /** Operation result intercepted until after the immediate balance check. */
          const message = (event as CustomEvent).detail;
          if (event.type === "riddle-quest:host-to-game" && message?.payload?.operation === "skip") {
            Reflect.set(window, "__heldLossSkip", message);
            return true;
          }
          return dispatch(event);
        };
      });
      /** Balance displayed before Skip is purchased. */
      const coinsBeforeLossSkip = Number(
        (await lowEndPage.locator("[data-coin-meter] strong").innerText()).replaceAll(",", ""),
      );
      await lowEndPage.locator(".loss-skip-action").click();
      expect(await lowEndPage.locator(".modal-skip").count()).toBe(0);
      await lowEndPage.waitForFunction(
        (expected) => document.querySelector("[data-coin-meter] strong")?.textContent === String(expected),
        coinsBeforeLossSkip - SOLO_COIN_COSTS.skip,
      );
      expect(Number((await lowEndPage.locator("[data-coin-meter] strong").innerText()).replaceAll(",", ""))).toBe(
        coinsBeforeLossSkip - SOLO_COIN_COSTS.skip,
      );
      await lowEndPage.waitForFunction(() => Reflect.has(window, "__heldLossSkip"));
      await lowEndPage.evaluate(() => Reflect.get(window, "__releaseLossSkip")());
      await lowEndContext.close();
      /** Opens the prefetched Classic question while the previous win is still unconfirmed. */
      const bufferedContext = await browser.newContext({viewport: {width: 390, height: 844}});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await bufferedContext.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      /** The buffered page used by this regression scenario. */
      const bufferedPage = await bufferedContext.newPage();
      await installCompletedMockGameTour(bufferedPage);
      await bufferedPage.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      // Recovery is tested for an existing account; the guest registration flow has its own scenarios.
      await bufferedPage.goto(`${hostedBrowserUrl}/?harness=jest&registered=1&dailyCompleted=1`);
      await completeMockOnboarding(bufferedPage);
      await bufferedPage.getByText(/what has keys/i).waitFor({timeout: 15_000});
      await bufferedPage.evaluate(() => {
        /** The original used by this regression scenario. */
        const original = window.dispatchEvent.bind(window);
        /** The held used by this regression scenario. */
        let held = false;
        window.dispatchEvent = (event: Event) => {
          if (
            !held &&
            event.type === "riddle-quest:host-to-game" &&
            (event as CustomEvent).detail?.payload?.operation === "guess"
          ) {
            held = true;
            Object.assign(window, {
              __heldClassicGuess: (event as CustomEvent).detail,
              __releaseClassicGuess: () =>
                original(
                  new CustomEvent("riddle-quest:host-to-game", {
                    detail: Reflect.get(window, "__heldClassicGuess"),
                  }),
                ),
            });
            return true;
          }
          return original(event);
        };
      });
      for (const letter of "PIANO")
        await bufferedPage.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      await bufferedPage.getByRole("button", {name: /^submit$/i}).click();
      await prepareProvisionalNextLevel(bufferedPage);
      /** Time from the Next action to the already-issued question appearing. */
      const bufferedTransitionMs = await bufferedPage
        .getByRole("button", {name: /next level/i})
        .evaluate(async (button) => {
          /** Browser start time of the actual player action. */
          const started = performance.now();
          (button as HTMLButtonElement).click();
          while (!document.querySelector(".riddle-card h1")?.textContent?.includes("face and hands")) {
            if (performance.now() - started > 1_000) throw new Error("Buffered transition waited for the server");
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return performance.now() - started;
        });
      expect(bufferedTransitionMs).toBeLessThan(100);
      await bufferedPage.getByText(/face and hands/i).waitFor({timeout: 2_000});
      await bufferedPage.getByRole("button", {name: /got it/i}).click();
      for (const letter of "CLOCK")
        await bufferedPage.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      await bufferedPage.getByRole("button", {name: /^submit$/i}).click();
      await bufferedPage.locator(".guess-row:first-child .cell.green").first().waitFor({timeout: 2_000});
      await bufferedPage.evaluate(() => Reflect.get(window, "__releaseClassicGuess")());
      await bufferedPage.waitForFunction(
        () => !Object.keys(localStorage).some((key) => key.includes("pendingPlay:v1:")),
        null,
        {timeout: 5_000},
      );
      await bufferedContext.close();
      /** A definitive rejection restores the confirmed question and explains the discarded play. */
      const rejectedContext = await browser.newContext({viewport: {width: 390, height: 844}});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await rejectedContext.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      /** The rejected page used by this regression scenario. */
      const rejectedPage = await rejectedContext.newPage();
      await installCompletedMockGameTour(rejectedPage);
      await rejectedPage.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      // Recovery is tested for an existing account; the guest registration flow has its own scenarios.
      await rejectedPage.goto(`${hostedBrowserUrl}/?harness=jest&registered=1&dailyCompleted=1`);
      await completeMockOnboarding(rejectedPage);
      await rejectedPage.getByText(/what has keys/i).waitFor({timeout: 15_000});
      await rejectedPage.evaluate(() => {
        /** The original used by this regression scenario. */
        const original = window.dispatchEvent.bind(window);
        /** The held used by this regression scenario. */
        let held = false;
        window.dispatchEvent = (event: Event) => {
          if (
            !held &&
            event.type === "riddle-quest:host-to-game" &&
            (event as CustomEvent).detail?.payload?.operation === "guess"
          ) {
            held = true;
            Object.assign(window, {__heldRejectedGuess: (event as CustomEvent).detail});
            return true;
          }
          return original(event);
        };
      });
      for (const letter of "PIANO")
        await rejectedPage.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      await rejectedPage.getByRole("button", {name: /^submit$/i}).click();
      await prepareProvisionalNextLevel(rejectedPage);
      await rejectedPage.getByRole("button", {name: /next level/i}).click();
      await rejectedPage.getByText(/face and hands/i).waitFor({timeout: 2_000});
      await rejectedPage.getByRole("button", {name: /got it/i}).click();
      await rejectedPage.waitForFunction(() => Reflect.has(window, "__heldRejectedGuess"));
      await rejectedPage.evaluate(() => {
        /** The held used by this regression scenario. */
        const held = Reflect.get(window, "__heldRejectedGuess");
        window.dispatchEvent(
          new CustomEvent("riddle-quest:host-to-game", {
            detail: {
              ...held,
              payload: {operation: "guess", ok: false, errorKind: "rejected", error: "Session expired"},
            },
          }),
        );
      });
      await rejectedPage.getByText(/last confirmed progress has been restored/i).waitFor({timeout: 3_000});
      expect(await rejectedPage.locator(".game-content > .game-notice").innerText()).toMatch(
        /last confirmed progress has been restored/i,
      );
      expect(await rejectedPage.locator(".riddle-surface .game-notice").count()).toBe(0);
      await rejectedPage.getByText(/what has keys/i).waitFor({timeout: 3_000});
      expect(await rejectedPage.getByText(/face and hands/i).count()).toBe(0);
      await rejectedContext.close();
      /** Reload replays the exact pending request and restores its local feedback. */
      const reloadContext = await browser.newContext({viewport: {width: 390, height: 844}});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await reloadContext.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      /** Page used to verify journal recovery after navigation. */
      const reloadPage = await reloadContext.newPage();
      await installCompletedMockGameTour(reloadPage);
      await reloadPage.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
        window.addEventListener(
          "riddle-quest:game-to-host",
          (event: Event) => {
            if ((event as CustomEvent).detail?.type === "game:submitGuess")
              sessionStorage.setItem("replayedGuessId", (event as CustomEvent).detail.requestId);
          },
          true,
        );
      });
      await reloadPage.goto(`${hostedBrowserUrl}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(reloadPage);
      await reloadPage.getByText(/what has keys/i).waitFor({timeout: 15_000});
      await reloadPage.evaluate(() => {
        /** Holds the original response without stopping its host request. */
        const original = window.dispatchEvent.bind(window);
        window.dispatchEvent = (event: Event) => {
          if (
            event.type === "riddle-quest:host-to-game" &&
            (event as CustomEvent).detail?.payload?.operation === "guess"
          )
            return true;
          return original(event);
        };
      });
      for (const letter of "CRANE")
        await reloadPage.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      await reloadPage.getByRole("button", {name: /^submit$/i}).click();
      await reloadPage.locator(".guess-row:first-child .cell.red").first().waitFor({timeout: 2_000});
      /** Request identifier durably written before the first response. */
      const pendingId = await reloadPage.evaluate(() => {
        /** Storage record for the authenticated harness player. */
        const key = Object.keys(localStorage).find((item) => item.includes("pendingPlay:v1:"));
        return key ? (JSON.parse(localStorage.getItem(key)!).queue[0].message.requestId as string) : null;
      });
      expect(pendingId).toMatch(/^guess-/);
      await reloadPage.evaluate(() => sessionStorage.removeItem("replayedGuessId"));
      await reloadPage.reload();
      await reloadPage.locator(".guess-row:first-child .cell.red").first().waitFor({timeout: 5_000});
      await reloadPage.waitForFunction(() => sessionStorage.getItem("replayedGuessId") !== null, null, {
        timeout: 5_000,
      });
      expect(await reloadPage.evaluate(() => sessionStorage.getItem("replayedGuessId"))).toBe(pendingId);
      await reloadPage.waitForFunction(
        () => !Object.keys(localStorage).some((key) => key.includes("pendingPlay:v1:")),
        null,
        {timeout: 5_000},
      );
      await reloadContext.close();
      /** Provides iframe page behavior. */
      const iframePage = await browser.newPage({viewport: {width: 390, height: 844}});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await iframePage.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      await iframePage.addInitScript(() => Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true}));
      await iframePage.setContent(
        `<iframe title="Jest host" style="width:390px;height:844px;border:0" src="${hostedBrowserUrl}/?harness=jest&dailyCompleted=1"></iframe>`,
      );
      await iframePage
        .frameLocator('iframe[title="Jest host"]')
        .getByText(/what has keys/i)
        .waitFor({timeout: 15000});
      await iframePage.close();
      /** Provides registered page behavior. */
      const registeredPage = await browser.newPage({viewport: {width: 390, height: 844}});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await registeredPage.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      await registeredPage.addInitScript(() => Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true}));
      await registeredPage.goto(`${hostedBrowserUrl}/?harness=jest&registered=1&dailyCompleted=1`);
      await registeredPage.getByRole("button", {name: /let's play/i}).waitFor({timeout: 15000});
      await completeOnboardingAndTours(registeredPage);
      await registeredPage
        .getByRole("button", {name: /buy coins/i})
        .first()
        .click();
      await registeredPage.locator(".shop-subscription-card").waitFor();
      expect(await registeredPage.locator(".game-shop-grid").innerText()).toMatch(/riddle quest premium/i);
      await registeredPage
        .locator(".shop-subscription-card")
        .getByRole("button", {name: /start free trial/i})
        .click();
      await registeredPage.locator(".game-modal").waitFor({state: "detached"});
      await registeredPage
        .getByRole("button", {name: /buy coins/i})
        .first()
        .click();
      expect(await registeredPage.getByText("Premium active", {exact: true}).isVisible()).toBe(true);
      expect(await registeredPage.getByRole("button", {name: /start free trial|^subscribe$/i}).count()).toBe(0);
      expect(await registeredPage.getByRole("button", {name: /cancel subscription/i}).count()).toBe(0);
      await registeredPage.getByRole("button", {name: "Close", exact: true}).click();
      await registeredPage.getByRole("button", {name: "Settings", exact: true}).click();
      await registeredPage.getByRole("button", {name: /cancel subscription/i}).waitFor();
      expect(await registeredPage.getByText("Premium active", {exact: true}).isVisible()).toBe(true);
      await registeredPage.getByRole("button", {name: "Close", exact: true}).click();
      await registeredPage.getByRole("button", {name: "Profile", exact: true}).click();
      await registeredPage.locator(".tooltip-card").getByRole("heading", {name: /^profile$/i}).waitFor();
      // This registered player opens Profile for the first time in the subscription scenario.
      for (let step = 0; step < getProfileTour().length; step += 1) {
        await registeredPage.locator(".tooltip-card").getByRole("button", {name: /got it/i}).click();
      }
      await registeredPage.locator(".tooltip-card").waitFor({state: "detached"});
      await registeredPage.getByRole("button", {name: /cancel subscription/i}).click();
      await registeredPage.getByText(/renewal cancelled/i).waitFor();
      expect(await registeredPage.getByText("Premium active", {exact: true}).isVisible()).toBe(true);
      await registeredPage.getByRole("button", {name: "Close", exact: true}).click();
      await registeredPage.getByRole("button", {name: /buy coins/i}).first().click();
      await registeredPage
        .locator(".game-shop-grid article:not(.shop-subscription-card)")
        .first()
        .getByRole("button")
        .click();
      /** Purchased coins appear automatically without blocking the puzzle or asking for another tap. */
      const purchaseTab = registeredPage.locator('.fanfare-tab.current[data-kind="purchase"]');
      await purchaseTab.waitFor();
      expect(await purchaseTab.innerText()).toMatch(/\+250/);
      expect(await registeredPage.locator(".modal-reward").count()).toBe(0);
      expect(await registeredPage.locator(".game-content").evaluate(element => (element as HTMLElement).inert)).toBe(false);
      expect(await registeredPage.getByRole("button", {name: /tap the chest/i}).count()).toBe(0);
      await registeredPage.locator(".fanfare-tabs").waitFor({state: "detached"});
      await registeredPage.locator(".game-shell-alert").waitFor({state: "detached", timeout: 5_000});
      await registeredPage
        .getByRole("button", {name: /^profile$/i})
        .first()
        .click();
      expect(await registeredPage.locator(".profile-avatar-fallback").isVisible()).toBe(true);
      expect(await registeredPage.getByRole("button", {name: /upload from photo library/i}).count()).toBe(0);
      expect(await registeredPage.locator(".profile-treasure-button img").isVisible()).toBe(true);
      await registeredPage.screenshot({path: "/tmp/jest-feedback-profile.png"});
      await registeredPage.close();
    } finally {
      await browser.close();
      server.close();
    }
  // One long journey with axe and W3C checks at many states; leave headroom for slower CI machines.
  }, 300_000);
});
