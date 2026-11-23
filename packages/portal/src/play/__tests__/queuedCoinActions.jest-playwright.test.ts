import {installCompletedMockGameTour, completeMockOnboarding} from "./mockOnboarding.jest-playwright.support";
import {afterAll, beforeAll, describe, it, jest} from "@jest/globals";
import {chromium, expect, type Browser, type Page} from "@playwright/test";
import {createServer, type Server} from "node:http";
import {mkdir, readFile} from "node:fs/promises";
import path from "node:path";
/** Runs against the injected Jest harness in the built artifact. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
jest.setTimeout(30_000);

describeBrowser("queued coin actions", () => {
  /** HTTP server serving the injected browser harness. */
  let server: Server;
  /** Headless browser shared by the walkthrough checks. */
  let browser: Browser;
  /** Local origin assigned to the harness server. */
  let origin: string;

  beforeAll(async () => {
    /** Directory containing the built Jest artifact. */
    const dist = process.env.PORTAL_JEST_BUILD_DIR
      ? path.resolve(process.env.PORTAL_JEST_BUILD_DIR)
      : path.resolve(__dirname, "../../../../../builds/jest");
    /** Content types used to serve artifact resources. */
    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
    };
    server = createServer(async (request, response) => {
      /** Requested path within the artifact. */
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      /** Artifact file corresponding to the request. */
      const file = path.join(dist, pathname === "/" ? "index.html" : pathname);
      try {
        /** Resource bytes returned to the browser. */
        const body = await readFile(file);
        response.writeHead(200, {"Content-Type": types[path.extname(file)] ?? "application/octet-stream"});
        response.end(body);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    /** Bound server address used to construct the harness origin. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({headless: true});
  });

  it.each([false, true])("keeps the final visible draft letter through immediate reload (hinted=%s)", async hinted => {
    /** Touch input and navigation exercise the exact built artifact's save boundary. */
    const page = await browser.newPage({viewport: {width: 320, height: 568}, hasTouch: true});
    await page.route("https://cdn.jest.com/**", route => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(page);
      if (hinted) {
        await page.getByRole("button", {name: /^hint$/i}).tap();
        await page.locator(".modal-hint .play-primary").tap();
        await expect(page.locator(".modal-hint")).toHaveCount(0);
        await expect(page.locator("[data-coin-meter] strong")).toHaveText("275");
      } else {
        await page.locator(".keyboard").getByRole("button", {name: "P", exact: true}).tap();
      }
      await page.locator(".keyboard").getByRole("button", {name: "I", exact: true}).tap();
      /** A visible letter must have reached the checkpoint before navigation begins. */
      const draft = page.locator(".guess-row").first();
      for (let lap = 0; lap < 6; lap += 1) {
        await expect(draft).toHaveText("PI");
        if (!hinted && lap === 5) {
          await page.locator(".game-header .coin-pill").tap();
          await page.locator(".game-shop-grid article:not(.shop-subscription-card)").first().getByRole("button").tap();
          await expect(page.locator(".fanfare-tabs")).toBeVisible();
          await page.locator(".fanfare-tabs").waitFor({state: "hidden"});
          await expect(page.locator("[data-coin-meter] strong")).toHaveText("550");
        }
        await page.locator(".keyboard").getByRole("button", {name: "A", exact: true}).tap();
        await expect(draft).toHaveText("PIA");
        // Keep navigation adjacent to the visible-letter assertion; storage reads or waits hide the race.
        await page.reload();
        await completeMockOnboarding(page);
        await expect(draft).toHaveText("PIA");
        await expect(draft.locator(".cell").nth(3)).toHaveAttribute("aria-current", "true");
        if (hinted) await expect(draft.locator(".cell").first()).toBeDisabled();
        await page.locator(".keyboard").getByRole("button", {name: "Backspace", exact: true}).tap();
      }
      await expect(draft).toHaveText("PI");
      await page.locator(".keyboard").getByRole("button", {name: "Backspace", exact: true}).tap();
      await page.locator(".keyboard").getByRole("button", {name: "Backspace", exact: true}).tap();
      await expect(draft).toHaveText(hinted ? "P" : "");
      await page.reload();
      await completeMockOnboarding(page);
      await expect(draft).toHaveText(hinted ? "P" : "");
      await expect(draft.locator(".cell").nth(hinted ? 1 : 0)).toHaveAttribute("aria-current", "true");
      if (hinted) await expect(draft.locator(".cell").first()).toBeDisabled();
      await expect(page.locator("[data-coin-meter] strong")).toHaveText("300");
    } finally {await page.close();}
  });

  it.each([390, 1280])("warns before leaving Daily through Skip without spending coins at %ipx", async (width) => {
    /** Isolated viewport runs the real built game with the injected provider. */
    const page = await browser.newPage({viewport: {width, height: 844}});
    await page.route("https://cdn.jest.com/**", route => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest&gameMode=challenge`);
      await completeMockOnboarding(page);
      await expect(page.locator(".game-mode-label")).toHaveText("Daily");
      /** Mode switching must preserve the displayed wallet. */
      const balance = await page.locator("[data-coin-meter] strong").innerText();
      /** Cancellation must leave the same Daily question visible. */
      const riddle = await page.locator(".riddle-card h1").innerText();
      await page.evaluate(() => {
        /** Records commands after startup to detect unintended charges or completion. */
        const messages: string[] = [];
        Reflect.set(window, "__dailySkipMessages", messages);
        window.addEventListener("riddle-quest:game-to-host", event => {
          if (event instanceof CustomEvent && typeof event.detail?.type === "string") messages.push(event.detail.type);
        });
      });
      /** The restored control stays beside Submit in both modes. */
      const skip = page.getByRole("button", {name: /^skip$/i});
      await expect(skip).toBeInViewport();
      await skip.click();
      /** A named modal must require an explicit mode-change choice. */
      const warning = page.getByRole("dialog", {name: "Leave the Daily riddle?"});
      await expect(warning).toContainText("Your Daily riddle will stay unfinished. Switch to Classic mode?");
      await expect(warning).not.toContainText("Cost:");
      /** Keeps mobile and desktop evidence of the rendered warning. */
      const output = path.resolve(__dirname, "../../../../../builds/test-evidence/daily-skip-warning");
      await mkdir(output, {recursive: true});
      await page.screenshot({path: path.join(output, `warning-${width}.png`)});
      await warning.getByRole("button", {name: "Cancel", exact: true}).click();
      await expect(page.locator(".game-mode-label")).toHaveText("Daily");
      await expect(page.locator(".riddle-card h1")).toHaveText(riddle);
      await expect(skip).toBeFocused();
      await skip.click();
      await page.keyboard.press("Escape");
      await expect(warning).toBeHidden();
      await expect(page.locator(".game-mode-label")).toHaveText("Daily");
      await skip.click();
      await warning.getByRole("button", {name: "Play Classic", exact: true}).click();
      await expect(page.locator(".game-mode-label")).toHaveText("Classic");
      await expect(page.locator("[data-coin-meter] strong")).toHaveText(balance);
      /** Confirming the warning may load content but cannot spend or grant rewards. */
      const messages = await page.evaluate(() => Reflect.get(window, "__dailySkipMessages"));
      expect(messages).toContain("game:loadRiddle");
      for (const type of ["game:skipRiddle", "game:spendCoins", "game:completeGame"]) expect(messages).not.toContain(type);
      await skip.click();
      await expect(page.locator(".modal-skip")).toContainText("100");
    } finally { await page.close(); }
  });

  it.each([390, 1280])("shows shop buying power and correct action costs at %ipx", async (width) => {
    /** Injected game page at the viewport under verification. */
    const page = await browser.newPage({viewport: {width, height: 844}});
    page.setDefaultTimeout(8_000);
    /** Uncaught browser errors from the actual shop flow. */
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(page);
      await page.getByText(/what has keys/i).waitFor();
      await page.getByRole("button", {name: /^hint$/i}).click();
      await expect(page.locator(".modal-hint")).toContainText("25");
      await page.keyboard.press("Escape");
      await page.getByRole("button", {name: /^skip$/i}).click();
      await expect(page.locator(".modal-skip")).toContainText("100");
      await page.keyboard.press("Escape");
      await page.locator(".game-header .coin-pill").click();
      /** Consumable offers rendered from the injected provider catalog. */
      const cards = page.locator(".game-shop-grid article:not(.shop-subscription-card)");
      await expect(cards).toHaveCount(6);
      /** Server-owned bundle amounts used for the expected buying power. */
      const grants = [250, 550, 900, 1600, 3400, 7000];
      for (let index = 0; index < grants.length; index += 1) {
        await expect(cards.nth(index)).toContainText(`Up to ${(grants[index] / 25).toLocaleString()} hints or ${(grants[index] / 50).toLocaleString()} extra attempts.`);
      }
      /** Directory retaining mobile and desktop shop screenshots. */
      const evidence = path.resolve(__dirname, "../../../../../builds/test-evidence/coin-economy");
      await mkdir(evidence, {recursive: true});
      await page.screenshot({path: path.join(evidence, `shop-${width}.png`), fullPage: true});
      await cards.last().getByRole("button").scrollIntoViewIfNeeded();
      await expect(cards.last().getByRole("button")).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it("restores a draft cursor after a wrong guess is interrupted by reload", async () => {
    /** Isolated browser page exercises the real hosted interface. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSeen:hintAfterWrongGuess:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
        /** Captured actions expose reducer transitions without changing authority. */
        const dispatch = window.dispatchEvent.bind(window);
        window.dispatchEvent = (event: Event) => {
          /** Correlated bridge envelope exposes the authoritative operation. */
          const message = (event as CustomEvent).detail;
          if (event.type === "riddle-quest:game-to-host" && message?.type === "game:submitGuess") return true;
          return dispatch(event);
        };
      });
      await page.goto(`${origin}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(page);
      await page.getByText(/what has keys/i).waitFor();
      for (const letter of "AAAAA") await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      await page.locator(".submit-action").click();
      for (const letter of "PI") await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      await expect(page.locator(".guess-row").nth(1)).toHaveText("PI");
      await page.reload();
      await completeMockOnboarding(page);
      await page.getByText(/what has keys/i).waitFor();
      await expect(page.locator(".guess-row").nth(1)).toHaveText("PI");
      await expect(page.locator(".guess-row").nth(1).locator(".cell").nth(2)).toHaveAttribute("aria-current", "true");
      for (const letter of "ANO") await page.locator(".keyboard").getByRole("button", {name: letter, exact: true}).click();
      await expect(page.locator(".guess-row").nth(1)).toHaveText("PIANO");
      await expect(page.locator(".submit-action")).toBeEnabled();
    } finally {
      await page.close();
    }
  });

  it("disables Submit when the draft repeats the previous wrong answer", async () => {
    /** Mounted game used to verify duplicate-draft submission behavior. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSeen:hintAfterWrongGuess:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(page);
      await page.getByText(/what has keys/i).waitFor();
      await page.locator(".guess-row button:not([disabled])").first().click();
      await page.keyboard.type("ZZZZZ");
      await page.locator(".submit-action").click();
      await page.locator(".guess-row .cell.red").last().waitFor();
      await page.locator(".guess-row button:not([disabled])").first().click();
      await page.keyboard.type("ZZZZZ");
      await expect(page.locator(".submit-action")).toBeDisabled();
      await page.locator(".guess-row button:not([disabled])").first().click();
      await page.keyboard.type("X");
      await expect(page.locator(".submit-action")).toBeEnabled();
    } finally {
      await page.close();
    }
  });

  it("recovers an unaccepted Continue and its typed draft after reload", async () => {
    /** Exercises the real frame, durable paid-action journal and host acknowledgement. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    page.setDefaultTimeout(8_000);
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSeen:hintAfterWrongGuess:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
        /** Interrupt delivery before authority, then allow journal recovery on reload. */
        const dispatch = window.dispatchEvent.bind(window);
        window.dispatchEvent = (event: Event) => {
          /** Bridge request intercepted until the reload permits recovery. */
          const message = (event as CustomEvent).detail;
          if (event.type === "riddle-quest:game-to-host" && message?.type === "game:spendCoins" &&
              sessionStorage.getItem("allowContinueRecovery") !== "yes") return true;
          return dispatch(event);
        };
      });
      await page.goto(`${origin}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(page);
      await page.getByText(/what has keys/i).waitFor();
      for (const wrongLetter of ["X", "Z", "Q", "V", "B"]) {
        await page.locator(".guess-row button:not([disabled])").first().click();
        await page.keyboard.type(wrongLetter.repeat(5));
        await page.locator(".submit-action").click();
        await page.locator(".guess-row .cell.red").last().waitFor();
      }
      await page.locator(".modal-continue").waitFor();
      /** Displayed balance before the interrupted Continue purchase. */
      const coinsBefore = Number((await page.locator("[data-coin-meter] strong").innerText()).replaceAll(",", ""));
      await page.getByRole("button", {name: /Coins to Try Again/i}).click();
      await expect(page.locator(".modal-continue")).toHaveCount(0);
      await page.locator(".guess-row button:not([disabled])").first().click();
      await page.keyboard.type("PI");
      await expect(page.locator(".guess-row").first()).toHaveText("PI");
      /** The recovery checkpoint must belong to the original paid question. */
      const paidQuestion = await page.evaluate(() => {
        /** Unaccepted delivery record captured before the page reloads. */
        const key = Object.keys(localStorage).find(key => key.includes("pendingPlay:v1:"));
        if (!key) throw new Error("Missing unaccepted Continue journal");
        /** Issued question identity remains independent of the saved checkpoint. */
        const journal = JSON.parse(localStorage.getItem(key)!);
        return {riddleId: journal.riddle.riddleId, sessionToken: journal.riddle.sessionToken};
      });
      await page.evaluate(() => sessionStorage.setItem("allowContinueRecovery", "yes"));
      await page.reload();
      await completeMockOnboarding(page);
      await page.getByText(/what has keys/i).waitFor();
      await page.waitForFunction(() => Object.keys(localStorage).filter(key => key.includes("pendingPlay:v1:")).every(key => {
        /** Settled Continue retains its current draft without retaining any paid or guess delivery. */
        const journal = JSON.parse(localStorage.getItem(key)!);
        return journal.queue.length === 0 && !journal.coinAction && !journal.skipPreview && journal.successors.length === 0;
      }));
      await expect.poll(() => page.evaluate(() => {
        /** Settled input is durable in provider player data after its delivery journal retires. */
        const game = JSON.parse(localStorage.getItem("riddleQuest:mockJestPlayerData") ?? "{}").activeGame;
        return game ? {riddleId: game.riddleId, sessionToken: game.sessionToken, gameMode: game.gameMode,
          draft: game.currentLetters, slot: game.activeSlotIndex, continued: game.engineSnapshot.hasUsedContinue} : null;
      })).toEqual({...paidQuestion, gameMode: "classic", draft: ["P", "I", "", "", ""], slot: 2, continued: true});
      await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.includes("pendingPlay:v1:")).length)).toBe(0);
      await expect(page.locator(".modal-continue")).toHaveCount(0);
      await expect(page.locator(".guess-row:has(button:not([disabled]))")).toHaveText("PI");
      await expect(page.locator("[data-coin-meter] strong")).toHaveText(String(coinsBefore - 50));
      await expect(page.locator("main.game-app")).not.toHaveAttribute("aria-hidden", "true");
    } finally {
      await page.close();
    }
  });

  it("skips and charges directly from the loss modal", async () => {
    /** Browser page used to exhaust attempts and exercise the loss action. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    // The SDK is injected by this mock harness; avoid an unrelated external startup request.
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      // Paid Skip is Classic-only; start after the Daily challenge has been completed.
      await page.goto(`${origin}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(page);
      await page.getByText(/what has keys/i).waitFor();
      for (const wrongLetter of ["X", "Z", "Q", "V", "B"]) {
        for (let letter = 0; letter < 5; letter += 1) {
          await page.locator(".keyboard").getByRole("button", {name: wrongLetter, exact: true}).click();
        }
        await page.getByRole("button", {name: /^submit$/i}).click();
        await page.locator(".guess-row .cell.red").last().waitFor();
        if (wrongLetter === "X") await page.getByRole("button", {name: /got it/i}).click();
      }
      await page.locator(".modal-continue").waitFor();
      /** Balance before the direct loss-modal skip. */
      const coinsBefore = Number((await page.locator("[data-coin-meter] strong").innerText()).replaceAll(",", ""));
      await page.locator(".loss-skip-action").click();
      expect(await page.locator(".modal-skip").count()).toBe(0);
      await expect(page.locator("[data-coin-meter] strong")).toHaveText(String(coinsBefore - 100));
      await page.getByText(/face and hands/i).waitFor();
    } finally {
      await page.close();
    }
  });

  it("shows a purchased hint and the buffered Skip successor before server confirmation", async () => {
    /** Browser page used to exercise immediate coin actions. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    page.setDefaultTimeout(8_000);
    // The SDK is injected by this mock harness; avoid an unrelated external startup request.
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(page);
      await page.getByText(/what has keys/i).waitFor();
      await page.evaluate(() => {
        /** Original bridge event dispatcher retained for confirmation. */
        const dispatch = window.dispatchEvent.bind(window);
        window.dispatchEvent = (event: Event) => {
          /** Bridge message intercepted by the browser test. */
          const message = (event as CustomEvent).detail;
          if (
            event.type === "riddle-quest:host-to-game" &&
            (message?.payload?.operation === "hint" || message?.payload?.operation === "skip")
          ) {
            Reflect.set(window, `__held_${message.payload.operation}`, message);
            return true;
          }
          return dispatch(event);
        };
        Reflect.set(window, "__releaseCoinAction", (operation: string) =>
          dispatch(new CustomEvent("riddle-quest:host-to-game", {detail: Reflect.get(window, `__held_${operation}`)})),
        );
      });
      await page.getByRole("button", {name: /^hint$/i}).click();
      /** Elapsed time until the hint appears. */
      const hintMs = await page
        .locator(".modal-hint .play-primary")
        .first()
        .evaluate(async (button) => {
          /** Timestamp when the button was clicked. */
          const started = performance.now();
          (button as HTMLButtonElement).click();
          while (document.querySelector(".guess-row:first-child .cell")?.textContent !== "P") {
            if (performance.now() - started > 1_000) throw new Error("Hint waited for server confirmation");
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return performance.now() - started;
        });
      expect(hintMs).toBeLessThan(250);
      await page.waitForFunction(() => Reflect.has(window, "__held_hint"));
      await page.evaluate(() => Reflect.get(window, "__releaseCoinAction")("hint"));
      await page.waitForFunction(() => !Object.keys(localStorage).some((key) => key.includes("pendingPlay:v1:")));

      await page.getByRole("button", {name: /^skip$/i}).click();
      /** Balance before the held server charge. */
      const coinsBeforeSkip = Number((await page.locator("[data-coin-meter] strong").innerText()).replaceAll(",", ""));
      /** Elapsed time until the successor appears. */
      const skipMs = await page
        .locator(".modal-skip .play-primary")
        .first()
        .evaluate(async (button) => {
          /** Timestamp when the button was clicked. */
          const started = performance.now();
          (button as HTMLButtonElement).click();
          while (!document.querySelector(".riddle-card h1")?.textContent?.includes("face and hands")) {
            if (performance.now() - started > 1_000) throw new Error("Skip waited for server confirmation");
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return performance.now() - started;
        });
      expect(skipMs).toBeLessThan(250);
      await expect(page.locator("[data-coin-meter] strong")).toHaveText(String(coinsBeforeSkip - 100));
      await page.waitForFunction(() => Reflect.has(window, "__held_skip"));
      await page.evaluate(() => Reflect.get(window, "__releaseCoinAction")("skip"));
      // A settled Skip retains its successor draft while retiring the paid request and preview ownership.
      await page.waitForFunction(() => Object.keys(localStorage)
        .filter(key => key.includes("pendingPlay:v1:"))
        .every(key => {
          /** Remaining durable gameplay draft after the paid receipt settles. */
          const journal = JSON.parse(localStorage.getItem(key)!);
          return !journal.coinAction && !journal.skipPreview;
        }));
      await expect(page.locator("[data-coin-meter] strong")).toHaveText(String(coinsBeforeSkip - 100));
      expect(await page.locator(".riddle-card h1").innerText()).toMatch(/face and hands/i);
    } finally {
      await page.close();
    }
  });

  it("hides the skipped question until an unavailable successor recovers", async () => {
    /** Isolated page exercising the real paid Skip and question-loading bridge. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    page.setDefaultTimeout(4_000);
    await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
    try {
      await installCompletedMockGameTour(page);
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest&dailyCompleted=1`);
      await completeMockOnboarding(page);
      await page.getByText(/what has keys/i).waitFor();
      await page.evaluate(() => {
        /** Original dispatcher retained to deliver the recovered successor. */
        const dispatch = window.dispatchEvent.bind(window);
        window.dispatchEvent = (event: Event) => {
          /** Correlated bridge message intercepted at the failed question-load boundary. */
          const message = (event as CustomEvent).detail;
          if (event.type === "riddle-quest:host-to-game" && message?.type === "host:riddleLoaded" && message.requestId?.startsWith("skip-")) {
            if (!message.requestId.startsWith("skip-preview-")) {
              Reflect.set(window, "__heldSkipSuccessor", message);
              dispatch(new CustomEvent("riddle-quest:host-to-game", {detail: {
                type: "host:operationResult", requestId: message.requestId,
                payload: {operation: "loadRiddle", ok: false, error: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"},
              }}));
            }
            return true;
          }
          return dispatch(event);
        };
        Reflect.set(window, "__releaseSkipSuccessor", () => dispatch(new CustomEvent("riddle-quest:host-to-game", {
          detail: Reflect.get(window, "__heldSkipSuccessor"),
        })));
      });
      /** Confirmed initial balance before the single Skip purchase. */
      const coinsBefore = Number((await page.locator("[data-coin-meter] strong").innerText()).replaceAll(",", ""));
      await page.getByRole("button", {name: /^skip$/i}).click();
      await page.locator(".modal-skip .play-primary").first().click();
      await page.waitForFunction(() => Reflect.has(window, "__heldSkipSuccessor"));
      await expect(page.getByRole("status")).toContainText("Service temporarily unavailable");
      await expect(page.locator(".keyboard")).toHaveCount(0);
      await expect(page.locator(".riddle-card")).toHaveCount(0);
      await expect(page.getByRole("button", {name: /^settings$/i})).toBeEnabled();
      await expect(page.locator("[data-coin-meter] strong")).toHaveText(String(coinsBefore - 100));
      await page.evaluate(() => Reflect.get(window, "__releaseSkipSuccessor")());
      await page.getByText(/face and hands/i).waitFor();
      await expect(page.locator(".keyboard")).toBeVisible();
      await expect(page.locator("[data-coin-meter] strong")).toHaveText(String(coinsBefore - 100));
    } finally {
      await page.close();
    }
  });

  it.each([
    {action: "hint", recovery: "confirm"},
    {action: "skip", recovery: "confirm"},
    {action: "hint", recovery: "reload"},
    {action: "skip", recovery: "reload"},
    {action: "hint", recovery: "reject"},
    {action: "skip", recovery: "reject"},
  ])(
    "keeps $action usable with $recovery recovery",
    async ({action, recovery}) => {
      /** Isolated mobile page with the injected platform harness. */
      const page = await browser.newPage({viewport: {width: 459, height: 591}});
      // The SDK is injected by this mock harness; avoid an unrelated external startup request.
      await page.route("https://cdn.jest.com/**", (route) => route.fulfill({status: 200, contentType: "application/javascript", body: ""}));
      page.setDefaultTimeout(4_000);
      try {
        await installCompletedMockGameTour(page);
        await page.addInitScript(() => {
          Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
          window.addEventListener("riddle-quest:host-to-game", (event) => {
            /** Retains accepted paid results for duplicate-delivery verification. */
            const message = (event as CustomEvent).detail;
            if (message.type === "host:riddleLoaded" && message.requestId?.startsWith("skip-"))
              Reflect.set(window, "__skipLoad", message);
            if (message.type === "host:operationResult" && message.payload.operation === "hint")
              Reflect.set(window, "__hintResult", message);
          });
          localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
          localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:jest-guest", "seen");
          localStorage.setItem("riddleQuest:tooltipSeen:hintAfterWrongGuess:jest-guest", "seen");
          sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
        });
        await page.goto(`${origin}/?harness=jest&dailyCompleted=1`);
        await completeMockOnboarding(page);
        await page.locator(".keyboard").getByRole("button", {name: /^C$/}).waitFor();
        await page.evaluate(() => {
          /** Original bridge dispatcher, retained to release the held answer. */
          const dispatch = window.dispatchEvent.bind(window);
          /** Captured outgoing paid requests. */
          const paid: unknown[] = [];
          Reflect.set(window, "__paidRequests", paid);
          window.dispatchEvent = (event: Event) => {
            if (event.type === "riddle-quest:game-to-host") {
              /** Outgoing request observed before the host receives it. */
              const message = (event as CustomEvent).detail;
              if (message.type === "game:submitGuess") {
                Reflect.set(window, "__heldGuess", message);
                Reflect.set(window, "__releaseGuess", () => dispatch(event));
                return true;
              }
              if (message.type === "game:requestHint" || message.type === "game:skipRiddle") paid.push(message);
            }
            return dispatch(event);
          };
        });
        for (const letter of "CRANE")
          await page
            .locator(".keyboard")
            .getByRole("button", {name: new RegExp(`^${letter}$`)})
            .click();
        await page.locator(".submit-action").click();
        /** Optional wrong-answer guidance must not obscure the controls under test. */
        const tooltip = page.locator("[data-tooltip-id=hintAfterWrongGuess] button");
        if (await tooltip.isVisible()) await tooltip.click();
        if (recovery === "reject") {
          for (const letter of "CL") await page.locator(".keyboard").getByRole("button", {name: new RegExp(`^${letter}$`)}).click();
          await expect(page.locator(".guess-row").nth(1)).toHaveText(/^C\s*L$/i);
        }
        await expect(page.locator("[data-tooltip=gameHint]")).toBeEnabled();
        await expect(page.locator("[data-tooltip=gameSkip]")).toBeEnabled();
        await page.locator(`[data-tooltip=${action === "hint" ? "gameHint" : "gameSkip"}]`).click();
        await page
          .locator(".game-modal .play-primary")
          .first()
          .evaluate((button) => {
            (button as HTMLButtonElement).click();
            (button as HTMLButtonElement).click();
          });
        await page.waitForFunction(() =>
          Object.keys(localStorage).some(
            (key) => key.includes("pendingPlay:v1:") && JSON.parse(localStorage.getItem(key)!).coinAction,
          ),
        );
        expect(await page.evaluate(() => Reflect.get(window, "__paidRequests").length)).toBe(0);
        if (recovery === "reject") {
          await page.evaluate(() =>
            window.dispatchEvent(
              new CustomEvent("riddle-quest:host-to-game", {
                detail: {
                  type: "host:operationResult",
                  requestId: Reflect.get(window, "__heldGuess").requestId,
                  payload: {operation: "guess", ok: false, errorKind: "rejected", error: "Rejected answer"},
                },
              }),
            ),
          );
          await page.waitForFunction(() => {
            /** Retained input must contain no rejected answer or paid delivery. */
            const key = Object.keys(localStorage).find(key => key.includes("pendingPlay:v1:"));
            if (!key) return false;
            /** Draft-only checkpoint remains owned by the rejected question. */
            const journal = JSON.parse(localStorage.getItem(key)!);
            return journal.queue.length === 0 && !journal.coinAction && journal.successors.length === 0;
          });
          expect(await page.evaluate(() => {
            /** Draft checkpoint and original rejected request share the same round. */
            const key = Object.keys(localStorage).find(key => key.includes("pendingPlay:v1:"))!;
            /** Only user input may survive the rejection of its dependent hint or Skip. */
            const journal = JSON.parse(localStorage.getItem(key)!);
            return {draft: journal.draft,slot: journal.draftActiveSlotIndex,
              sameSession: journal.riddle.sessionToken === Reflect.get(window, "__heldGuess").payload.sessionToken};
          })).toEqual({draft: ["C", "L", "", "", ""],slot: 2,sameSession: true});
          expect(await page.evaluate(() => Reflect.get(window, "__paidRequests").length)).toBe(0);
          await expect(page.locator(".guess-row").first()).toHaveText(/^C\s*L$/i);
          expect(await page.locator(".guess-row").first().locator("button[disabled]").count()).toBe(0);
          await page.locator(".keyboard").getByRole("button", {name: /^O$/}).click();
          await expect(page.locator(".guess-row").first()).toHaveText(/^C\s*L\s*O$/i);
          return;
        }
        /** Original paid identity must survive replay without a second charge request. */
        const paidRequest = await page.evaluate(() => {
          /** Durable record binds the original action and question before recovery. */
          const key = Object.keys(localStorage).find((key) => key.includes("pendingPlay:v1:"))!;
          /** Original delivery supplies the expected request and question identity. */
          const journal = JSON.parse(localStorage.getItem(key)!);
          return {requestId: journal.coinAction.requestId, riddleId: journal.riddle.riddleId,
            sessionToken: journal.riddle.sessionToken};
        });
        /** Compare payment identity separately from the provider checkpoint. */
        const {requestId, ...paidQuestion} = paidRequest;
        if (recovery === "reload") {
          await page.addInitScript(() => {
            Reflect.set(window, "__paidRequests", []);
            window.addEventListener("riddle-quest:game-to-host", (event) => {
              /** Replayed message observed by the restored harness. */
              const message = (event as CustomEvent).detail;
              if (message.type === "game:requestHint" || message.type === "game:skipRiddle")
                Reflect.get(window, "__paidRequests").push(message);
            });
          });
          await page.reload();
          await completeMockOnboarding(page);
        } else await page.evaluate(() => Reflect.get(window, "__releaseGuess")());
        await page.waitForFunction(() => Reflect.get(window, "__paidRequests").length === 1);
        await page.waitForFunction(() => Object.keys(localStorage)
          .filter(key => key.includes("pendingPlay:v1:"))
          .every(key => {
            /** Settled paid work may retain a confirmed hint or successor draft without pending delivery. */
            const journal = JSON.parse(localStorage.getItem(key)!);
            return journal.queue.length === 0 && !journal.coinAction && !journal.skipPreview;
          }));
        if (action === "hint") {
          await expect(page.locator(".guess-row").nth(1).locator(".cell").first()).toHaveText("P");
          await expect(page.locator(".guess-row").nth(1).locator(".cell").first()).toBeDisabled();
          await expect.poll(() => page.evaluate(() => {
            /** Settled input is durable in provider player data after its delivery journal retires. */
            const game = JSON.parse(localStorage.getItem("riddleQuest:mockJestPlayerData") ?? "{}").activeGame;
            return game ? {riddleId: game.riddleId, sessionToken: game.sessionToken, gameMode: game.gameMode,
              draft: game.currentLetters, slot: game.activeSlotIndex, hints: game.hintRevealedIndices} : null;
          })).toEqual({...paidQuestion, gameMode: "classic", draft: ["P", "", "", "", ""], slot: 1, hints: [0]});
          await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.includes("pendingPlay:v1:")).length)).toBe(0);
          await page.evaluate(() => {
            /** Duplicate result must not overwrite the accepted hint or coin balance. */
            const message = Reflect.get(window, "__hintResult");
            window.dispatchEvent(
              new CustomEvent("riddle-quest:host-to-game", {
                detail: {
                  ...message,
                  payload: {...message.payload, data: {...message.payload.data, revealedLetter: "Z", newCoins: 0}},
                },
              }),
            );
          });
          await expect(page.locator(".guess-row").nth(1).locator(".cell").first()).toHaveText("P");
          await expect(page.locator("[data-coin-meter] strong")).toHaveText("275");
        } else {
          await expect(page.locator(".riddle-surface h1")).not.toContainText("What has keys");
          await page.waitForFunction(() => Reflect.has(window, "__skipLoad"));
          await page.evaluate(() => {
            /** A repeated Skip delivery must not replace a subsequently loaded question. */
            const message = Reflect.get(window, "__skipLoad");
            window.dispatchEvent(
              new CustomEvent("riddle-quest:host-to-game", {
                detail: {
                  ...message,
                  payload: {...message.payload, riddle: {...message.payload.riddle, text: "STALE SKIP"}},
                },
              }),
            );
          });
          await expect(page.locator(".riddle-surface h1")).not.toHaveText("STALE SKIP");
        }
        expect(await page.evaluate(() => Reflect.get(window, "__paidRequests").length)).toBe(1);
        expect(await page.evaluate(() => Reflect.get(window, "__paidRequests")[0].requestId)).toBe(requestId);
      } finally {
        await page.close();
      }
    },
    20_000,
  );
});
