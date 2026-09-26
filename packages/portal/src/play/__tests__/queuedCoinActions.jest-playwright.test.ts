import {afterAll, beforeAll, describe, it} from "@jest/globals";
import {chromium, expect, type Browser, type Page} from "@playwright/test";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";

/** Runs against the injected Jest harness in the built artifact. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;

describeBrowser("queued coin actions", () => {
  /** HTTP server serving the injected browser harness. */
  let server: Server;
  /** Headless browser shared by the walkthrough checks. */
  let browser: Browser;
  /** Local origin assigned to the harness server. */
  let origin: string;

  beforeAll(async () => {
    /** Directory containing the built Jest artifact. */
    const dist = path.resolve(__dirname, "../../../dist-jest");
    /** Content types used to serve artifact resources. */
    const types: Record<string, string> = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml"};
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
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    /** Bound server address used to construct the harness origin. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({headless: true});
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>(resolve => server?.close(() => resolve()));
  });

  it("shows a purchased hint and the buffered Skip successor before server confirmation", async () => {
    /** Browser page used to exercise immediate coin actions. */
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    try {
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest`);
      await page.getByText(/what has keys/i).waitFor();
      await page.evaluate(() => {
        /** Original bridge event dispatcher retained for confirmation. */
        const dispatch = window.dispatchEvent.bind(window);
        window.dispatchEvent = (event: Event) => {
          /** Bridge message intercepted by the browser test. */
          const message = (event as CustomEvent).detail;
          if (event.type === "riddle-quest:host-to-game" &&
            (message?.payload?.operation === "hint" || message?.payload?.operation === "skip")) {
            Reflect.set(window, `__held_${message.payload.operation}`, message);
            return true;
          }
          return dispatch(event);
        };
        Reflect.set(window, "__releaseCoinAction", (operation: string) =>
          dispatch(new CustomEvent("riddle-quest:host-to-game", {detail: Reflect.get(window, `__held_${operation}`)})));
      });
      await page.getByRole("button", {name: /^hint$/i}).click();
      /** Elapsed time until the hint appears. */
      const hintMs = await page.locator(".modal-hint .play-primary").first().evaluate(async (button) => {
        /** Timestamp when the button was clicked. */
        const started = performance.now();
        (button as HTMLButtonElement).click();
        while (document.querySelector(".guess-row:first-child .cell")?.textContent !== "P") {
          if (performance.now() - started > 1_000) throw new Error("Hint waited for server confirmation");
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
        return performance.now() - started;
      });
      expect(hintMs).toBeLessThan(250);
      await page.waitForFunction(() => Reflect.has(window, "__held_hint"));
      await page.evaluate(() => Reflect.get(window, "__releaseCoinAction")("hint"));
      await page.waitForFunction(() => !Object.keys(localStorage).some(key => key.includes("pendingPlay:v1:")));

      await page.getByRole("button", {name: /^skip$/i}).click();
      /** Elapsed time until the successor appears. */
      const skipMs = await page.locator(".modal-skip .play-primary").first().evaluate(async (button) => {
        /** Timestamp when the button was clicked. */
        const started = performance.now();
        (button as HTMLButtonElement).click();
        while (!document.querySelector(".riddle-card h1")?.textContent?.includes("face and hands")) {
          if (performance.now() - started > 1_000) throw new Error("Skip waited for server confirmation");
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
        return performance.now() - started;
      });
      expect(skipMs).toBeLessThan(250);
      await page.waitForFunction(() => Reflect.has(window, "__held_skip"));
      await page.evaluate(() => Reflect.get(window, "__releaseCoinAction")("skip"));
      await page.waitForFunction(() => !Object.keys(localStorage).some(key => key.includes("pendingPlay:v1:")));
      expect(await page.locator(".riddle-card h1").innerText()).toMatch(/face and hands/i);
    } finally {
      await page.close();
    }
  });

  it.each([
    {action: "hint", recovery: "confirm"}, {action: "skip", recovery: "confirm"},
    {action: "hint", recovery: "reload"}, {action: "skip", recovery: "reload"},
    {action: "hint", recovery: "reject"}, {action: "skip", recovery: "reject"},
  ])("keeps $action usable with $recovery recovery", async ({action, recovery}) => {
    /** Isolated mobile page with the injected platform harness. */
    const page = await browser.newPage({viewport: {width: 459, height: 591}});
    page.setDefaultTimeout(4_000);
    try {
      await page.addInitScript(() => {
        Object.assign(window, {__RIDDLE_QUEST_BROWSER_TEST__: true});
        window.addEventListener("riddle-quest:host-to-game", event => {
          /** Retains accepted paid results for duplicate-delivery verification. */
          const message = (event as CustomEvent).detail;
          if (message.type === "host:riddleLoaded" && message.requestId?.startsWith("skip-"))
            Reflect.set(window, "__skipLoad", message);
          if (message.type === "host:operationResult" && message.payload.operation === "hint")
            Reflect.set(window, "__hintResult", message);
        });
        localStorage.setItem("riddleQuest:onboarding:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSequenceSeen:profileTour:jest-guest", "seen");
        localStorage.setItem("riddleQuest:tooltipSeen:hintAfterWrongGuess:jest-guest", "seen");
        sessionStorage.setItem("riddleQuest:welcomeSession:jest-guest", "seen");
      });
      await page.goto(`${origin}/?harness=jest`);
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
      for (const letter of "CRANE") await page.locator(".keyboard").getByRole("button", {name: new RegExp(`^${letter}$`)}).click();
      await page.locator(".submit-action").click();
      /** Optional wrong-answer guidance must not obscure the controls under test. */
      const tooltip = page.locator("[data-tooltip-id=hintAfterWrongGuess] button");
      if (await tooltip.isVisible()) await tooltip.click();
      await expect(page.locator("[data-tooltip=gameHint]")).toBeEnabled();
      await expect(page.locator("[data-tooltip=gameSkip]")).toBeEnabled();
      await page.locator(`[data-tooltip=${action === "hint" ? "gameHint" : "gameSkip"}]`).click();
      await page.locator(".game-modal .play-primary").first().evaluate(button => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
      });
      await page.waitForFunction(() => Object.keys(localStorage).some(key =>
        key.includes("pendingPlay:v1:") && JSON.parse(localStorage.getItem(key)!).coinAction));
      expect(await page.evaluate(() => Reflect.get(window, "__paidRequests").length)).toBe(0);
      if (recovery === "reject") {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent("riddle-quest:host-to-game", {detail: {
          type: "host:operationResult", requestId: Reflect.get(window, "__heldGuess").requestId,
          payload: {operation: "guess", ok: false, errorKind: "rejected", error: "Rejected answer"},
        }})));
        await page.waitForFunction(() => !Object.keys(localStorage).some(key => key.includes("pendingPlay:v1:")));
        expect(await page.evaluate(() => Reflect.get(window, "__paidRequests").length)).toBe(0);
        return;
      }
      /** Original paid identity must survive replay without a second charge request. */
      const requestId = await page.evaluate(() => {
        /** Durable record containing the confirmed action. */
        const key = Object.keys(localStorage).find(key => key.includes("pendingPlay:v1:"))!;
        return JSON.parse(localStorage.getItem(key)!).coinAction.requestId;
      });
      if (recovery === "reload") {
        await page.addInitScript(() => {
          Reflect.set(window, "__paidRequests", []);
          window.addEventListener("riddle-quest:game-to-host", event => {
            /** Replayed message observed by the restored harness. */
            const message = (event as CustomEvent).detail;
            if (message.type === "game:requestHint" || message.type === "game:skipRiddle")
              Reflect.get(window, "__paidRequests").push(message);
          });
        });
        await page.reload();
      } else await page.evaluate(() => Reflect.get(window, "__releaseGuess")());
      await page.waitForFunction(() => Reflect.get(window, "__paidRequests").length === 1);
      await page.waitForFunction(() => !Object.keys(localStorage).some(key => key.includes("pendingPlay:v1:")));
      if (action === "hint") {
        await expect(page.locator(".guess-row").nth(1).locator(".cell").first()).toHaveText("P");
        await page.evaluate(() => {
          /** Duplicate result must not overwrite the accepted hint or coin balance. */
          const message = Reflect.get(window, "__hintResult");
          window.dispatchEvent(new CustomEvent("riddle-quest:host-to-game", {detail: {
            ...message, payload: {...message.payload, data: {...message.payload.data, revealedLetter: "Z", newCoins: 0}},
          }}));
        });
        await expect(page.locator(".guess-row").nth(1).locator(".cell").first()).toHaveText("P");
      } else {
        await expect(page.locator(".riddle-surface h1")).not.toContainText("What has keys");
        await page.waitForFunction(() => Reflect.has(window, "__skipLoad"));
        await page.evaluate(() => {
          /** A repeated Skip delivery must not replace a subsequently loaded question. */
          const message = Reflect.get(window, "__skipLoad");
          window.dispatchEvent(new CustomEvent("riddle-quest:host-to-game", {detail: {
            ...message, payload: {...message.payload, riddle: {...message.payload.riddle, text: "STALE SKIP"}},
          }}));
        });
        await expect(page.locator(".riddle-surface h1")).not.toHaveText("STALE SKIP");
      }
      expect(await page.evaluate(() => Reflect.get(window, "__paidRequests").length)).toBe(1);
      expect(await page.evaluate(() => Reflect.get(window, "__paidRequests")[0].requestId)).toBe(requestId);
    } finally {
      await page.close();
    }
  }, 20_000);
});
