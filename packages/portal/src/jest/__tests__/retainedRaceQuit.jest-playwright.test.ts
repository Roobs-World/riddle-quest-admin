/** Recorded scenarios retained from 6ee7da15e, bound to the current host and controller through a private test artifact. */
import {openAuthenticationHarness} from "./authenticationHarness.jest-playwright.support";
import {afterAll, afterEach, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type Page} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import type {GameToHostMessage, HostToGameMessage} from "@qwordly/core/bridge";
import {injectRaceAnalyticsFailure, observeRaceCountdown, verifyRecordedLayout, verifyRaceCountdownTiming, verifyAutomaticSkip, verifyFinalSkipResult, verifyGuessDraftConfirmation, verifyHintDraftPreservation, verifyHintConfirmationRecovery, verifyLostHintDeliveryRecovery, verifySuccessorDraftRecovery, verifyWrongRunPaidRollback, verifyTerminalHintResult, verifyAcceptedRaceRecording, observeAcceptedRaceRecording, captureMultiplayerEvidence, verifyOutcomeConfirmationRecovery} from "./raceRecovery.jest-playwright.support";

import {
  type AuthHarnessState,
  advanceToRegistration,
  enterRegisteredGame,
  verifyShortJestPreview,
  verifySlowStartupWatchdog,
  verifyDelayedHostHandshake,
  verifyOptionalProfileFailure,
  verifyRetryableStartupScreen,
  retryFailedStartup,
  dismissDailyCompletionGuidance,
  verifyGuestStartupIdentity,
  openProfileAfterGuidance,
  solveFakeRace,
} from "./authentication.jest-playwright.support";
import {PLAYER_NOTIFICATION_IDS} from "../notifications/engagement";
/** Provides describe browser behavior. */
const describeBrowser = process.env.PORTAL_BROWSER_TESTS === "1" ? describe : describe.skip;
/** Provides base url behavior. */
let baseUrl: string;
/** Provides shared race challenges behavior. */
const sharedRaceChallenges = new Map<string, string>();
/** Gets harness state. */
const getHarnessState = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as typeof window & {
          /** Stores riddle quest jest auth test. */
          __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
        }
      ).__RIDDLE_QUEST_JEST_AUTH_TEST__,
  );
/** Binds each isolated page to the suite-owned local server. */
const openHarness = (browser: Browser, options: Parameters<typeof openAuthenticationHarness>[2] = {}) =>
  openAuthenticationHarness(browser, baseUrl, options);

describeBrowser("Jest authentication integration", () => {
  /** Provides browser behavior. */
  let browser: Browser;
  /** Provides server behavior. */
  let server: Server;

  beforeAll(async () => {
    /** Provides package root behavior. */
    const packageRoot = path.resolve(__dirname, "../../..");
    /** Current-source test artifact retains the real host and recorded controller in an isolated output. */
    const artifact = JSON.parse(execFileSync("node", ["scripts/build-retained-race-test-artifact.mjs"], {
      cwd: packageRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
    }));
    /** Every server response comes from this exact test artifact. */
    const distDir = artifact.directory;
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
    server = createServer(async (request, response) => {
      /** Requests url. */
      const requestUrl = new URL(request.url ?? "/", baseUrl);
      /** Provides shared race match behavior. */
      const sharedRaceMatch = requestUrl.pathname.match(/^\/__race-harness\/challenges\/([^/]+)$/);
      if (sharedRaceMatch) {
        /** Provides challenge id behavior. */
        const challengeId = decodeURIComponent(sharedRaceMatch[1]);
        if (request.method === "PUT") {
          /** Provides chunks behavior. */
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          sharedRaceChallenges.set(challengeId, Buffer.concat(chunks).toString("utf8"));
          response.writeHead(204).end();
          return;
        }
        /** Provides challenge behavior. */
        const challenge = sharedRaceChallenges.get(challengeId);
        response.writeHead(challenge ? 200 : 404, {"Content-Type": "application/json; charset=utf-8"});
        response.end(challenge ?? JSON.stringify({error: "not_found"}));
        return;
      }
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
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    /** OS-assigned port avoids collisions with concurrent browser harnesses. */
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Browser harness TCP address unavailable");
    baseUrl = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({headless: true, args: ["--renderer-process-limit=4"]});
  });

  afterEach(async () =>
    Promise.all(browser?.contexts().map((context) => context.close().catch(() => undefined)) ?? []),
  );

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
  });

  it("recovers lost quit confirmations during preparation and active play", async () => {
    for (const scenario of ["prepared", "active", "keep-playing"]) {
      /** Preparation closes without a quit dialog; Keep playing withdraws an active quit. */
      const prepared = scenario === "prepared";
      /** Registered player whose authority abandons before the first confirmation is lost. */
      const {context, page, pageErrors} = await openHarness(browser, {
        registered: true, harness: "race-auth", playerId: `quit-recovery-${scenario}`,
        ...(prepared ? {raceStartDelayMs: 2000} : {}),
      });
      try {
        await enterRegisteredGame(page);
        await page.getByRole("button", {name: /^multiplayer$/i}).click();
        await page.evaluate(withdrawQuit => {
          Object.assign(window, {__quitCommands: [], __lostQuit: false, __lostQuitRead: false});
          window.addEventListener("riddle-quest:game-to-host", event => {
            (Reflect.get(window, "__quitCommands") as unknown[]).push((event as CustomEvent).detail);
          });
          /** Server persists abandonment, but transport loses its first confirmation. */
          const dispatch = window.dispatchEvent.bind(window);
          window.dispatchEvent = event => {
            /** Preserve the original correlation while rejecting delivery. */
            const detail = (event as CustomEvent).detail;
            if (event.type === "riddle-quest:host-to-game" && detail?.payload?.operation === "raceAbandon" &&
              detail.payload.ok && !Reflect.get(window, "__lostQuit")) {
              Object.assign(window, {__lostQuit: true});
              detail.payload = {...detail.payload, ok: false, error: "RaceTo10.ERROR_GENERIC"};
            }
            if (withdrawQuit && event.type === "riddle-quest:host-to-game" && detail?.payload?.operation === "raceResume" &&
              detail.payload.ok && !Reflect.get(window, "__lostQuitRead")) {
              Object.assign(window, {__lostQuitRead: true});
              detail.payload = {...detail.payload, ok: false, error: "RaceTo10.ERROR_GENERIC"};
            }
            return dispatch(event);
          };
        }, scenario === "keep-playing");
        await page.getByRole("button", {name: /^History /}).click();
        if (prepared) await page.locator(".race-countdown-rail").waitFor();
        else await page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10000});
        await page.getByRole("button", {name: /close race to 10/i}).click();
        if (!prepared) await page.getByRole("alertdialog").getByRole("button", {name: /^quit race$/i}).click();
        await page.locator(".race-error").waitFor();
        expect(await page.evaluate(() => localStorage.getItem("riddleQuest:activeRaceRun"))).not.toBeNull();
        await page.screenshot({path: `/tmp/race-quit-recovery-${scenario}.png`});
        if (scenario === "keep-playing") {
          await page.getByRole("alertdialog").getByRole("button", {name: /keep playing/i}).click();
          await page.waitForFunction(() => Reflect.get(window, "__lostQuitRead") === true);
          await page.getByRole("alertdialog").waitFor({state: "detached"});
          await page.getByRole("button", {name: /^retry$/i}).click();
          await page.getByRole("button", {name: /^History /}).waitFor();
          expect(await page.locator(".race-gameplay").count()).toBe(0);
        } else if (prepared) {
          expect(await page.locator(".race-gameplay").count()).toBe(0);
          await page.getByRole("button", {name: /^retry$/i}).click();
        } else await page.getByRole("alertdialog").getByRole("button", {name: /^quit race$/i}).click();
        if (scenario !== "keep-playing") await page.locator(".race-screen").waitFor({state: "detached", timeout: 10000});
        /** Both attempts use the same abandonment mutation instead of readiness or resume. */
        const commands = await page.evaluate(() => Reflect.get(window, "__quitCommands") as GameToHostMessage[]);
        /** Mutation receipts must match even though transport timestamps advance. */
        const quitCommands = commands.filter(command => command.type === "game:abandonRace");
        expect(quitCommands).toHaveLength(scenario === "keep-playing" ? 1 : 2);
        if (scenario !== "keep-playing") expect(quitCommands[1]).toMatchObject({type: quitCommands[0].type, requestId: quitCommands[0].requestId, payload: quitCommands[0].payload});
        expect(commands.filter(command => command.type === "game:resumeRace")).toHaveLength(scenario === "keep-playing" ? 2 : 0);
        expect(commands.some(command => ["game:getRaceOutcome", "game:publishRace"].includes(command.type))).toBe(false);
        if (prepared) expect(commands.some(command => command.type === "game:readyRace")).toBe(false);
        expect(await page.evaluate(() => localStorage.getItem("riddleQuest:activeRaceRun"))).toBeNull();
        expect((await getHarnessState(page)).referralShares).toHaveLength(0);
        if (scenario !== "keep-playing") await page.getByRole("button", {name: /^multiplayer$/i}).click();
        await page.getByRole("button", {name: /^History /}).waitFor();
        expect(await page.locator(".race-gameplay").count()).toBe(0);
        expect(pageErrors).toEqual([]);
      } finally {await context.close();}
    }
  });

  it("confirms quitting an active race and abandons it with no result", async () => {
    /** Provides {context, page} behavior. */
    const {context, page} = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-quitter",
    });
    await enterRegisteredGame(page);
    await page.getByRole("button", {name: /^multiplayer$/i}).click();
    await page.getByRole("button", {name: /^History /}).click();
    await page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});

    await page.locator(".race-actions").getByRole("button", {name: /^hint/i}).click();
    /** Provides server selected hint behavior. */
    const serverSelectedHint = page.locator(".race-gameplay .guess-row .cell.green").first();
    await serverSelectedHint.waitFor({state: "visible", timeout: 5_000});
    expect((await serverSelectedHint.innerText()).trim()).not.toBe("");
    expect(await page.locator(".race-header-clock small").innerText()).toContain("0:15.0");
    /** Hint control stays usable after each confirmed reveal. */
    const hintButton = page.locator(".race-actions").getByRole("button", {name: /^hint/i});
    await page.waitForFunction(() => {
      /** Current multiplayer hint control. */
      const button = document.querySelector<HTMLButtonElement>(".race-actions button:first-child");
      return button?.disabled === false;
    });
    expect(await hintButton.isEnabled()).toBe(true);
    await hintButton.click();
    await page.waitForFunction(() => document.querySelectorAll(".race-gameplay .guess-row .cell.green").length === 2);
    expect(await page.locator(".race-header-clock small").innerText()).toMatch(/0:30\./);
    await page.waitForFunction(() => {
      /** Current multiplayer hint control after the second reveal. */
      const button = document.querySelector<HTMLButtonElement>(".race-actions button:first-child");
      return button?.disabled === false;
    });
    expect(await hintButton.isEnabled()).toBe(true);

    await page.getByRole("button", {name: /close race to 10/i}).click();
    /** Provides confirmation behavior. */
    const confirmation = page.getByRole("alertdialog", {name: /quit this race/i});
    await confirmation.waitFor();
    expect(await confirmation.innerText()).toMatch(/result for this session will be null/i);
    await confirmation.getByRole("button", {name: /keep playing/i}).click();
    await confirmation.waitFor({state: "detached"});
    expect(await page.locator(".race-gameplay").isVisible()).toBe(true);

    await page.getByRole("button", {name: /close race to 10/i}).click();
    await confirmation.getByRole("button", {name: /quit race/i}).click();
    await page.locator(".race-screen").waitFor({state: "detached", timeout: 10_000});
    expect(await page.evaluate(() => localStorage.getItem("riddleQuest:activeRaceRun"))).toBeNull();

    await page.getByRole("button", {name: /^multiplayer$/i}).click();
    await page.getByRole("button", {name: /^History /}).waitFor();
    expect(await page.locator(".race-gameplay").count()).toBe(0);
    await context.close();
  });
});
jest.setTimeout(180_000);
