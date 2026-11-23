/** Recorded scenarios retained from 6ee7da15e, bound to the current host and controller through a private test artifact. */
import {openAuthenticationHarness} from "./authenticationHarness.jest-playwright.support";
import {afterAll, afterEach, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type Page} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import type {GameToHostMessage, HostToGameMessage} from "../../../../../src/core/bridge";
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
    if (server?.listening) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it("renders the preloaded next riddle before a delayed skip response returns", async () => {
    /** Registered race harness with deliberately slow authoritative skip transport. */
    const {context, page} = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-instant-skip",
      raceSkipDelayMs: 2_000,
    });
    await enterRegisteredGame(page);
    await page.getByRole("button", {name: /^multiplayer$/i}).click();
    await page.getByRole("button", {name: /^History /}).click();
    await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    /** First clue shown after the full deck has loaded and the countdown has completed. */
    const firstRiddle = await page.locator(".race-riddle-surface h2").innerText();
    /** Skip control whose cooldown state is exercised by this flow. */
    const skipButton = page.getByRole("button", {name: /^Skip/});
    await skipButton.click();
    await page.waitForFunction(
      (previous) => document.querySelector(".race-riddle-surface h2")?.textContent !== previous,
      firstRiddle,
    );
    expect(await page.locator(".race-riddle-surface h2").innerText()).toContain("hands and a face");
    expect(await skipButton.isDisabled()).toBe(true);
    await page.waitForFunction(() => {
      /** Current skip control discovered inside the browser page. */
      const button = [...document.querySelectorAll<HTMLButtonElement>(".race-actions button")].find((candidate) =>
        candidate.textContent?.includes("Skip"),
      );
      return button?.disabled === false;
    });
    await context.close();
  });

  it("recovers lost hint and skip confirmations by resuming the current race", async () => {
    for (const action of ["Hint", "Skip"]) {
      /** Independent authenticated player for each lost mutation confirmation. */
      const {context, page, pageErrors} = await openHarness(browser, {
        registered: true, harness: "race-auth", playerId: `race-recovery-${action.toLowerCase()}`,
      });
      try {
        await enterRegisteredGame(page);
        await page.getByRole("button", {name: /^multiplayer$/i}).click();
        await page.getByRole("button", {name: /^History /}).click();
        await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10000});
        await page.locator(".race-gameplay .guess-row .cell").first().click();
        await page.keyboard.type("pi");
        /** Original clue restored by the rejected local confirmation. */
        const clue = await page.locator(".race-riddle-surface h2").innerText();
        await page.evaluate(() => {
          Object.assign(window, {__raceRecoveryRequests: []});
          /** Records commands to distinguish read recovery from another paid mutation. */
          window.addEventListener("riddle-quest:game-to-host", event => {
            (Reflect.get(window, "__raceRecoveryRequests") as string[]).push((event as CustomEvent).detail.type);
          });
          /** The server applies the action, but transport loses its successful confirmation. */
          const dispatch = window.dispatchEvent.bind(window);
          window.dispatchEvent = event => {
            /** Correlated response remains a valid failure envelope. */
            const detail = (event as CustomEvent).detail;
            if (event.type === "riddle-quest:host-to-game" && detail?.payload?.ok &&
              ["raceHint", "raceSkip"].includes(detail.payload.operation)) {
              detail.payload = {...detail.payload, ok: false, error: "RaceTo10.ERROR_GENERIC"};
            }
            return dispatch(event);
          };
        });
        await page.locator(".race-actions").getByRole("button", {name: new RegExp(`^${action}`, "i")}).click();
        await page.getByRole("alert").waitFor({state: "visible"});
        expect(await page.locator(".race-riddle-surface h2").innerText()).toBe(clue);
        await page.getByRole("button", {name: /^retry$/i}).click();
        if (action === "Hint") {
          await page.locator(".race-gameplay .guess-row .cell.green").first().waitFor();
          expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["p", "i", "", "", ""]);
          expect(await page.locator(".race-header-clock small").innerText()).toContain("0:15.0");
        } else {
          await page.waitForFunction(previous => document.querySelector(".race-riddle-surface h2")?.textContent !== previous, clue);
          expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["", "", "", "", ""]);
          expect(await page.locator(".race-header-clock small").innerText()).toContain("0:45.0");
          expect(Number((await page.locator(".race-header-clock strong").innerText()).split(":")[1])).toBeGreaterThanOrEqual(45);
        }
        /** Recovery must not charge or apply the paid action again. */
        const requests = await page.evaluate(() => Reflect.get(window, "__raceRecoveryRequests") as string[]);
        expect(requests.filter(type => type === "game:resumeRace")).toHaveLength(1);
        expect(requests.filter(type => type === (action === "Hint" ? "game:requestRaceHint" : "game:skipRaceRiddle"))).toHaveLength(1);
        expect(await page.getByRole("alert").count()).toBe(0);
        expect(pageErrors).toEqual([]);
        await page.screenshot({path: `/tmp/race-resume-recovery-${action.toLowerCase()}.png`});
      } finally {await context.close();}
    }
  });

  it("confirms an automatic skip once after the fifth incorrect guess", async () => {
    /** Injected authority exercises the same clearing count and event contract as production. */
    const {context, page, pageErrors} = await openHarness(browser, {registered: true, harness: "race-auth", playerId: "automatic-skip-player"});
    try {await enterRegisteredGame(page); await verifyAutomaticSkip(page); expect(pageErrors).toEqual([]);}
    finally {await context.close();}
  });

  it("merges guess confirmation hints and recovers an invalid reveal without losing successor typing", async () => {
    for (const invalid of [false, true]) {
      /** Delayed authority leaves the projected successor editable before confirmation. */
      const {context, page, pageErrors} = await openHarness(browser, {registered: true, harness: "race-auth", playerId: `guess-draft-${invalid}`, raceGuessDelayMs: 2500});
      try {await enterRegisteredGame(page); await verifyGuessDraftConfirmation(page, invalid); expect(pageErrors).toEqual([]);}
      finally {await context.close();}
    }
  });

  it("confirms the result when a hint penalty or final skip ends the challenger race", async () => {
    for (const action of ["hint", "skip"]) {
      sharedRaceChallenges.clear();
      /** Recording is slower than initial play but faster than the terminal penalty. */
      const challengeId = `jest-invite-${"c".repeat(64)}-${"d".repeat(32)}`;
      sharedRaceChallenges.set(challengeId, JSON.stringify({preview: {challengeId, creator: {displayName: "Nova"}, categoryId: "mixed", locale: "en",
        targetCorrect: 10, adjustedTimeToBeatMs: action === "hint" ? 10000 : 30000, rulesVersion: "race10_v1", expiresAtMs: Date.now() + 60000, status: "active"}, runId: "hint-opponent", events: []}));
      /** Injected authority supplies the unmodified terminal view before outcome reconciliation. */
      const {context, page, pageErrors} = await openHarness(browser, {registered: true, harness: "race-auth", playerId: `terminal-penalty-${action}`,
        challengeId, inviteKind: "race", campaign: "race_to_10_v1", sharedRace: true, raceOutcomeDelayMs: action === "skip" ? 2500 : 0});
      try {if (action === "hint") await verifyTerminalHintResult(page); else await verifyFinalSkipResult(page); expect(pageErrors).toEqual([]);}
      finally {await context.close();}
    }
  });

  it("restores successor typing after a lost or malformed guess confirmation", async () => {
    for (const malformed of [false, true]) {
      /** Delayed authority gives the player time to type into the projected successor. */
      const {context, page, pageErrors} = await openHarness(browser, {
        registered: true, harness: "race-auth", playerId: `race-successor-recovery-${malformed}`, raceGuessDelayMs: 2500,
      });
      try {
        await enterRegisteredGame(page);
        await verifySuccessorDraftRecovery(page, malformed);
        expect(pageErrors).toEqual([]);
      } finally {await context.close();}
    }
  });

  it("recovers a completely lost hint response after the delivery deadline", async () => {
    /** Real delivery timeout is exercised through the injected authority and browser bridge. */
    const {context, page, pageErrors} = await openHarness(browser, {
      registered: true, harness: "race-auth", playerId: "race-lost-hint-delivery",
    });
    try {
      await enterRegisteredGame(page);
      await verifyLostHintDeliveryRecovery(page);
      expect(pageErrors).toEqual([]);
    } finally {await context.close();}
  });

  it("rejects inconsistent hint confirmations and recovers authoritative reveals", async () => {
    for (const mismatch of ["letter", "question", "deck", "schedule", "phase", "missing-prompt", "score"]) {
      /** Independent authenticated player for each corrupted successful hint. */
      const {context, page, pageErrors} = await openHarness(browser, {
        registered: true, harness: "race-auth", playerId: `race-hint-confirmation-${mismatch}`,
      });
      try {
        await enterRegisteredGame(page);
        await verifyHintConfirmationRecovery(page, mismatch);
        expect(pageErrors).toEqual([]);
        await page.screenshot({path: `/tmp/race-hint-confirmation-recovery-${mismatch}.png`});
      } finally {await context.close();}
    }
  });

  it("preserves the player's draft through projected and confirmed hints", async () => {
    /** Registered player exercises real input/rendering against the injected authority adapter. */
    const {context, page, pageErrors} = await openHarness(browser, {
      registered: true, harness: "race-auth", playerId: "race-hint-draft",
    });
    try {
      await enterRegisteredGame(page);
      await verifyHintDraftPreservation(page);
      expect(pageErrors).toEqual([]);
      await captureMultiplayerEvidence(page, "hint-draft-preserved.png");
    } finally {await context.close();}
  });

  it("preserves solving time when hint and skip confirmations belong to another run", async () => {
    /** Registered player using the injected authoritative race adapter. */
    for (const action of ["Hint", "Skip"] as const) {
      /** Each paid action uses a fresh accepted run, leaving failed recovery pending in its own lifetime. */
      const {context,page}=await openHarness(browser,{registered:true,harness:"race-auth",playerId:"race-paid-rollback-"+action});
      try {await enterRegisteredGame(page);await verifyWrongRunPaidRollback(page,action);} finally {await context.close();}
    }
  });

  it("publishes a completed score before reusable Jest invites reach recipients", async () => {
    sharedRaceChallenges.clear();
    /** Provides creator behavior. */
    const creator = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-creator",
      sharedRace: true,
      raceStartDelayMs: 2_500,
      raceOutcomeDelayMs: 500,
      scenario: "race-share-delay",
    });
    await enterRegisteredGame(creator.page);
    await injectRaceAnalyticsFailure(creator.page, ["race_share_dialog_opened"]);
    /** Provides multiplayer button behavior. */
    const multiplayerButton = creator.page.getByRole("button", {name: /^multiplayer$/i});
    await multiplayerButton.waitFor({timeout: 5_000});
    expect(await creator.page.locator(".race-mode-launcher").count()).toBe(0);
    /** Provides action labels behavior. */
    const actionLabels = await creator.page.locator(".game-input-actions > button").allInnerTexts();
    expect(actionLabels).toEqual(["Hint", "SUBMIT", "Skip"]);
    /** Provides navigation labels behavior. */
    const navigationLabels = await creator.page
      .locator(".game-bottom-navigation > button")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    expect(navigationLabels).toEqual(["Settings", "Multiplayer", "Profile"]);
    await creator.page.setViewportSize({width: 390, height: 667});
    await multiplayerButton.click();
    await creator.page.getByRole("button", {name: /^History /}).waitFor();
    await creator.page.getByTestId("server-activity-loader").waitFor({state: "detached"});
    await captureMultiplayerEvidence(creator.page, "01-player-1-multiplayer-lobby.png");
    expect(await creator.page.locator('[data-testid="server-activity-loader"]').count()).toBe(0);
    /** Every lobby surface stays inside the narrow embedded game viewport. */
    const lobbyBounds = await creator.page
      .locator(".race-topbar, .race-hub-tabs, .race-panel")
      .evaluateAll((elements) =>
        elements.map((element) => {
          /** Element bounds relative to the embedded game viewport. */
          const bounds = element.getBoundingClientRect();
          return {left: bounds.left, right: bounds.right};
        }),
      );
    expect(lobbyBounds).toHaveLength(3);
    for (const bounds of lobbyBounds) {
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(390);
    }
    /** The game dialog itself cannot retain a horizontal offset after transient child layout. */
    const lobbyOverflow = await creator.page.locator(".race-screen").evaluate((screen) => ({
      overflowX: getComputedStyle(screen).overflowX,
      scrollLeft: screen.scrollLeft,
      scrollWidth: screen.scrollWidth,
      clientWidth: screen.clientWidth,
    }));
    expect(lobbyOverflow).toEqual({
      overflowX: "hidden",
      scrollLeft: 0,
      scrollWidth: lobbyOverflow.clientWidth,
      clientWidth: lobbyOverflow.clientWidth,
    });
    await observeRaceCountdown(creator.page);
    expect(await creator.page.getByRole("button", {name: /challenge a player/i}).count()).toBe(0);
    expect((await getHarnessState(creator.page)).referralShares).toHaveLength(0);
    await creator.page.getByRole("button", {name: /^History /}).click();
    /** Provides countdown rail behavior. */
    const countdownRail = creator.page.locator(".race-countdown-rail");
    await countdownRail.waitFor();
    await creator.page.waitForTimeout(1_200);
    expect(await creator.page.locator(".race-countdown > span").count()).toBe(0);
    expect(await creator.page.locator(".race-countdown > p").innerText()).toMatch(/loading/i);
    expect(await creator.page.locator(".race-topbar").count()).toBe(0);
    expect(await countdownRail.getByText(/live pvp/i).isVisible()).toBe(true);
    expect(await countdownRail.locator(".race-coin-balance").count()).toBe(0);
    expect(await countdownRail.getByRole("button", {name: /close race to 10/i}).isVisible()).toBe(true);
    await creator.page.locator(".race-countdown > span").waitFor();
    /** Provides countdown center offset behavior. */
    const countdownCenterOffset = await creator.page.locator(".race-countdown > span").evaluate((element) => {
      /** Provides rect behavior. */
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - innerWidth / 2);
    });
    expect(countdownCenterOffset).toBeLessThanOrEqual(0.5);
    await creator.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    expect((await creator.page.locator(".race-progress strong").allInnerTexts()).map(text=>text.replace(/\s+/g," "))).toEqual(["Riddles completed: 0 / 10"]);
    await captureMultiplayerEvidence(creator.page, "02-player-1-race-started.png");
    /** Horizontal coverage of the multiplayer keyboard within its viewport. */
    const keyboardCoverage = await creator.page.locator(".race-gameplay-viewport").evaluate((viewport) => {
      /** Available viewport width. */
      const surface = viewport.querySelector(".race-gameplay")!.getBoundingClientRect();
      /** Rendered keyboard width. */
      const keyboard = viewport.querySelector(".keyboard")!.getBoundingClientRect();
      return keyboard.width / surface.width;
    });
    expect(keyboardCoverage).toBeGreaterThan(0.98);
    /** Visual styles shared with the main-game keyboard at phone widths. */
    const multiplayerKeyboardStyle = await creator.page.locator(".race-gameplay .keyboard").evaluate((keyboard) => {
      /** Backspace key. */
      const utilityKey = keyboard.querySelector<HTMLElement>(".key.utility")!;
      /** A letter in the same row shares Backspace's available flex width. */
      const letterKey = utilityKey.parentElement!.querySelector<HTMLElement>(".key:not(.utility)")!;
      /** Rendered letter-key style. */
      const letterStyle = getComputedStyle(letterKey);
      return {
        backgroundColor: letterStyle.backgroundColor,
        borderWidth: letterStyle.borderWidth,
        borderRadius: letterStyle.borderRadius,
        height: letterStyle.height,
        utilityWidth: getComputedStyle(utilityKey).width,
        letterWidth: letterStyle.width,
      };
    });
    expect(multiplayerKeyboardStyle).toEqual({
      backgroundColor: "rgba(255, 255, 255, 0.12)",
      borderWidth: "1px",
      borderRadius: "9px",
      height: "48px",
      utilityWidth: multiplayerKeyboardStyle.letterWidth,
      letterWidth: multiplayerKeyboardStyle.letterWidth,
    });
    await verifyRaceCountdownTiming(creator.page);
    /** Gets multiplayer layout. */
    const getMultiplayerLayout = () =>
      creator.page.locator(".race-gameplay").evaluate((gameplay) => {
        /** Provides rail behavior. */
        const rail = gameplay.closest(".race-screen")?.querySelector(".race-scoreboard")?.getBoundingClientRect();
        /** Provides riddle behavior. */
        const riddle = gameplay.querySelector(".race-riddle-surface")?.getBoundingClientRect();
        return {
          redundantRemainingCount: Boolean(gameplay.querySelector(".race-rail-status")),
          railIsAboveRiddle: Boolean(rail && riddle && rail.bottom <= riddle.top),
        };
      });
    /** Provides expected multiplayer layout behavior. */
    const expectedMultiplayerLayout = {
      redundantRemainingCount: false,
      railIsAboveRiddle: true,
    };
    expect(await getMultiplayerLayout()).toEqual(expectedMultiplayerLayout);
    await creator.page.setViewportSize({width: 900, height: 844});
    expect(await getMultiplayerLayout()).toEqual(expectedMultiplayerLayout);
    await creator.page.setViewportSize({width: 390, height: 667});
    await creator.page.waitForFunction(() =>
      Boolean(document.querySelector(".race-gameplay-viewport")?.getAttribute("data-viewport-scale")),
    );
    /** Captures use of the available portrait multiplayer height. */
    const portraitRaceLayout = await creator.page.locator(".race-gameplay-viewport").evaluate((viewport) => {
      /** Captures the multiplayer screen bounds. */
      const screen = viewport.closest(".race-screen")!;
      /** Captures the screen's usable lower edge. */
      const usableBottom =
        screen.getBoundingClientRect().bottom - Number.parseFloat(getComputedStyle(screen).paddingBottom);
      /** Captures every rendered multiplayer answer cell. */
      const answerCells = [...viewport.querySelectorAll<HTMLElement>(".guess-board .cell")].map((cell) =>
        cell.getBoundingClientRect(),
      );
      return {
        bottomGap: usableBottom - viewport.getBoundingClientRect().bottom,
        minimumCellHeight: Math.min(...answerCells.map(({height}) => height)),
        minimumCellWidth: Math.min(...answerCells.map(({width}) => width)),
      };
    });
    expect(portraitRaceLayout.bottomGap).toBeLessThanOrEqual(1);
    expect(portraitRaceLayout.minimumCellHeight).toBeGreaterThanOrEqual(44);
    expect(portraitRaceLayout.minimumCellWidth).toBeGreaterThanOrEqual(44);
    await creator.page.screenshot({path: "/tmp/riddle-multiplayer-portrait.png"});
    await creator.page.waitForFunction(() => {
      /** Provides screen behavior. */
      const screen = document.querySelector(".race-screen");
      return Boolean(screen && screen.scrollHeight <= screen.clientHeight + 1);
    });
    await verifyOutcomeConfirmationRecovery(creator.page);
    await creator.page.getByText("Run recorded!", {exact: true}).waitFor();
    await verifyRecordedLayout(creator.page);
    expect((await getHarnessState(creator.page)).referralShares).toHaveLength(0);
    await captureMultiplayerEvidence(creator.page, "03-player-1-run-recorded.png");
    await creator.page.getByRole("button", {name: /send challenge/i}).click();
    /** Share control inspected while the Jest provider call remains in flight. */
    const sharingButton = creator.page.getByRole("button", {name: /challenge a friend/i});
    await sharingButton.waitFor({timeout: 10_000});
    expect(await sharingButton.getAttribute("aria-busy")).toBe("true");
    expect(await sharingButton.isDisabled()).toBe(true);
    await creator.page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Captured referral shares from the injected Jest SDK. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 1,
    );
    /** First post-result share contains an already-published immutable score. */
    const firstInvite = (await getHarnessState(creator.page)).referralShares[0]!;
    expect(await sharingButton.getAttribute("aria-busy")).toBe("false");
    expect(await sharingButton.isEnabled()).toBe(true);
    /** Immutable challenge selected from the creator's first invite payload. */
    const invitedChallengeId = firstInvite.entryPayload?.challengeId;
    expect(firstInvite.shareTitle).toBe("Race to 10");
    expect(firstInvite.shareText).toContain("Time to beat");
    expect(invitedChallengeId).toMatch(/^fake-challenge-/);
    expect(sharedRaceChallenges.has(invitedChallengeId!)).toBe(true);
    await creator.page.getByRole("button", {name: /challenge a friend/i}).waitFor({timeout: 10_000});
    await captureMultiplayerEvidence(creator.page, "04-player-1-challenge-ready.png");
    /** The same completed challenge may be sent to as many Jest recipients as desired. */
    await creator.page.getByRole("button", {name: /challenge a friend/i}).click();
    await creator.page.getByRole("button", {name: /challenge a friend/i}).click();
    await creator.page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Captured referral shares from the injected Jest SDK. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 3,
    );
    /** All repeated sends made from the same completed result. */
    const repeatedInvites = (await getHarnessState(creator.page)).referralShares;
    expect(await creator.page.evaluate(() => Reflect.get(window, "__optionalAnalyticsFailures"))).toEqual(Array(3).fill("race_share_dialog_opened"));
    expect(repeatedInvites.map((invite) => invite.entryPayload?.challengeId)).toEqual([
      invitedChallengeId,
      invitedChallengeId,
      invitedChallengeId,
    ]);
    expect(new Set(repeatedInvites.map((invite) => invite.reference)).size).toBe(3);
    /** Recipient opens only after the creator's score and challenge both exist. */
    const recipient = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "race-recipient",
      challengeId: invitedChallengeId,
      inviteKind: "race",
      campaign: "race_to_10_v1",
      sharedRace: true,
    });

    await recipient.page.getByRole("heading", {name: /Guest Solver challenged you/i}).waitFor({timeout: 20_000});
    await captureMultiplayerEvidence(recipient.page, "05-player-2-invite-ready.png");
    await observeAcceptedRaceRecording(recipient.page);
    await recipient.page.getByRole("button", {name: /accept challenge/i}).click();
    await recipient.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    await verifyAcceptedRaceRecording(recipient.page, invitedChallengeId!, sharedRaceChallenges.get(invitedChallengeId!)!);
    /** Progress can race with the creator's first server-confirmed automatic clear. */
    const initialProgress = await recipient.page.locator(".race-progress strong").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("aria-label")));
    expect(initialProgress[0]).toBe("Riddles completed: 0 / 10");
    expect(initialProgress[1]).toMatch(/^Riddles completed: [01] \/ 10$/);
    await captureMultiplayerEvidence(recipient.page, "06-player-2-race-started.png");
    await recipient.page.getByRole("heading", {name: /opponent wins/i}).waitFor({timeout: 30_000});
    /** Final score makes the exact opponent replay explicit after automatic completion. */
    const finalScore = recipient.page.locator(".race-result-score");
    expect(await finalScore.innerText()).toContain("You\n0/10");
    expect(await finalScore.innerText()).toContain("Guest Solver\n10/10");
    await captureMultiplayerEvidence(recipient.page, "07-player-2-automatic-result.png");
    expect(await recipient.page.locator(".race-result-grid").innerText()).toContain("Adjusted time");
    expect(await recipient.page.locator(".race-result h2").innerText()).toMatch(/Opponent wins/i);
    await captureMultiplayerEvidence(recipient.page, "08-player-2-final-result.png");

    await Promise.all([creator.context.close(), recipient.context.close()]);
  });

  it("shows an opponent win immediately and keeps category navigation ahead of delayed outcome work", async () => {
    sharedRaceChallenges.clear();
    /** Deterministic challenge whose ghost finishes just after the gameplay countdown. */
    const challengeId = `jest-invite-${"a".repeat(64)}-${"b".repeat(32)}`;
    /** Server-issued ghost score replayed by the recipient. */
    const events = Array.from({length: 10}, (_, index) => ({
      sequence: index,
      type: "correct" as const,
      riddlePosition: index,
      wallElapsedMs: (index + 1) * 300,
      penaltyAddedMs: 0 as const,
      totalPenaltyMs: 0,
      adjustedElapsedMs: (index + 1) * 300,
      correctCount: index + 1,
    }));
    sharedRaceChallenges.set(
      challengeId,
      JSON.stringify({
        preview: {
          challengeId,
          creator: {displayName: "Fast Opponent"},
          categoryId: "mixed",
          locale: "en",
          targetCorrect: 10,
          adjustedTimeToBeatMs: 3_000,
          rulesVersion: "race10_v1",
          expiresAtMs: Date.now() + 60_000,
          status: "active",
        },
        runId: "fast-opponent-run",
        events,
      }),
    );
    /** Recipient whose outcome response is deliberately slower than the local result presentation. */
    const recipient = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "automatic-loss-recipient",
      challengeId,
      inviteKind: "race",
      campaign: "race_to_10_v1",
      sharedRace: true,
      raceOutcomeDelayMs: 2_000,
    });
    await recipient.page.evaluate(() => {
      Object.assign(window, {__raceOutcomeResultCount: 0});
      window.addEventListener("riddle-quest:host-to-game", (event) => {
        if ((event as CustomEvent).detail?.payload?.operation === "raceOutcome") {
          Object.assign(window, {
            __raceOutcomeResultCount:
              Number(
                (
                  window as typeof window & {
                    /** Counts authoritative race-outcome responses received by the game. */
                    __raceOutcomeResultCount?: number;
                  }
                ).__raceOutcomeResultCount ?? 0,
              ) + 1,
          });
        }
      });
    });
    await recipient.page.getByRole("button", {name: /accept challenge/i}).waitFor({state: "visible"});
    await recipient.page.getByRole("button", {name: /accept challenge/i}).click();
    await recipient.page.locator(".race-countdown").waitFor({state: "visible", timeout: 10_000});
    // Preparation and the synchronized countdown precede the ghost's solving time.
    await recipient.page.getByRole("heading", {name: /opponent wins/i}).waitFor({timeout: 8_000});
    expect(
      await recipient.page.evaluate(
        () =>
          (
            window as typeof window & {
              /** Counts authoritative race-outcome responses received by the game. */
              __raceOutcomeResultCount?: number;
            }
          ).__raceOutcomeResultCount,
      ),
    ).toBe(0);
    expect(await recipient.page.getByRole("alert").count()).toBe(0);
    /** Cached category navigation must invalidate obsolete outcome presentation without a replacement request. */
    await recipient.page.getByRole("button", {name: /choose your category/i}).click();
    await recipient.page.locator(".race-category-grid").waitFor({state: "visible", timeout: 1_000});
    await recipient.page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Counts authoritative race-outcome responses received by the game. */
            __raceOutcomeResultCount?: number;
          }
        ).__raceOutcomeResultCount === 1,
      undefined,
      {timeout: 5_000},
    );
    expect(await recipient.page.getByRole("heading", {name: /opponent wins/i}).count()).toBe(0);
    expect(await recipient.page.locator(".race-category-grid").isVisible()).toBe(true);
    await recipient.context.close();
  });

  it("replays an opponent skip milestone after the player's penalty clock advances", async () => {
    sharedRaceChallenges.clear();
    /** Reusable challenge containing an authoritative skip before the next correct answer. */
    const challengeId = "ghost-skipped-milestone";
    sharedRaceChallenges.set(challengeId, JSON.stringify({
      preview: {challengeId, creator: {displayName: "Recorded Skipper"}, categoryId: "mixed", locale: "en",
        targetCorrect: 10, adjustedTimeToBeatMs: 120_000, rulesVersion: "race10_v1",
        expiresAtMs: Date.now() + 60_000, status: "active"},
      runId: "skipped-milestone-recording",
      events: [
        {sequence: 0, type: "skip", riddlePosition: 0, wallElapsedMs: 1_000, penaltyAddedMs: 45_000,
          totalPenaltyMs: 45_000, adjustedElapsedMs: 46_000, correctCount: 1},
        {sequence: 1, type: "correct", riddlePosition: 1, wallElapsedMs: 45_000, penaltyAddedMs: 0,
          totalPenaltyMs: 45_000, adjustedElapsedMs: 90_000, correctCount: 2},
      ],
    }));
    /** Authenticated challenger sees a fixed ghost, independent of local actions. */
    const {context, page} = await openHarness(browser, {
      registered: true, harness: "race-auth", playerId: "ghost-skip-challenger", challengeId,
      inviteKind: "race", campaign: "race_to_10_v1", sharedRace: true,
    });
    await page.getByRole("button", {name: /accept challenge/i}).click();
    await page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});
    expect(await page.locator(".race-progress progress").nth(1).getAttribute("value")).toBe("0");
    await page.locator(".race-actions").getByRole("button", {name: /^hint/i}).click();
    await page.locator(".race-actions").getByRole("button", {name: /^skip/i}).click();
    await page.waitForFunction(() => document.querySelectorAll(".race-progress progress")[1]?.getAttribute("value") === "1");
    expect(await page.locator(".race-progress progress").nth(0).getAttribute("value")).toBe("1");
    expect(await page.locator(".race-header-clock small").innerText()).toContain("1:00.0");
    expect(await page.getByRole("alert").count()).toBe(0);
    await page.screenshot({path: "/tmp/race-ghost-skip-progress.png"});
    await context.close();
  });

  it("recovers lost publication confirmations without creating another challenge", async () => {
    for (const failure of ["lost", "malformed"]) {
      sharedRaceChallenges.clear();
      /** Registered creator with a server publication that survives a lost confirmation. */
      const {context, page, pageErrors} = await openHarness(browser, {
        registered: true, harness: "race-auth", playerId: `publication-retry-${failure}`, sharedRace: true,
      });
      try {
        await enterRegisteredGame(page);
        await page.getByRole("button", {name: /^multiplayer$/i}).click();
        await page.getByRole("button", {name: /^History /}).click();
        await page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10000});
        await solveFakeRace(page);
        await page.evaluate(mode => {
          Object.assign(window, {__publicationCommands: [], __publishedChallengeId: null});
          window.addEventListener("riddle-quest:game-to-host", event => {
            /** Real bridge command preserves envelope and payload receipts. */
            const detail = (event as CustomEvent).detail;
            if (detail?.type === "game:publishRace") (Reflect.get(window, "__publicationCommands") as unknown[]).push(detail);
          });
          /** Lose the first confirmation only after the authority persisted the challenge. */
          const dispatch = window.dispatchEvent.bind(window);
          window.dispatchEvent = event => {
            /** Publication remains an otherwise correlated host response. */
            const detail = (event as CustomEvent).detail;
            if (event.type === "riddle-quest:host-to-game" && detail?.payload?.operation === "racePublish" &&
              detail.payload.ok && !Reflect.get(window, "__publishedChallengeId")) {
              Object.assign(window, {__publishedChallengeId: detail.payload.data.challengeId});
              if (mode === "lost") detail.payload = {...detail.payload, ok: false, error: "RaceTo10.ERROR_GENERIC"};
              else detail.payload.data = {...detail.payload.data, preview: {...detail.payload.data.preview, locale: "fr"}};
            }
            return dispatch(event);
          };
        }, failure);
        await page.getByRole("button", {name: /send challenge/i}).click();
        await page.getByRole("alert").waitFor();
        expect((await getHarnessState(page)).referralShares).toHaveLength(0);
        expect(sharedRaceChallenges.size).toBe(1);
        await page.getByRole("button", {name: /^retry$/i}).click();
        await page.waitForFunction(() => (Reflect.get(window, "__RIDDLE_QUEST_JEST_AUTH_TEST__") as AuthHarnessState).referralShares.length === 1);
        /** Retried publication is exactly the original run, correlation and mutation receipt. */
        const commands = await page.evaluate(() => Reflect.get(window, "__publicationCommands") as GameToHostMessage[]);
        expect(commands).toHaveLength(2);
        expect(commands[1]).toMatchObject({type: commands[0].type, requestId: commands[0].requestId, payload: commands[0].payload});
        expect(sharedRaceChallenges.size).toBe(1);
        expect((await getHarnessState(page)).referralShares[0].entryPayload?.challengeId).toBe(
          await page.evaluate(() => Reflect.get(window, "__publishedChallengeId")),
        );
        expect(await page.getByRole("heading", {name: /run recorded/i}).isVisible()).toBe(true);
        expect(await page.getByRole("alert").count()).toBe(0);
        expect(pageErrors).toEqual([]);
        await page.screenshot({path: `/tmp/race-publication-retry-${failure}.png`});
      } finally {await context.close();}
    }
  });

  it("shows a completed creator result while authoritative completion work continues in the background", async () => {
    /** Creator with deliberately delayed outcome reconciliation. */
    const creator = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "instant-result-creator",
      raceOutcomeDelayMs: 2_000,
    });
    await enterRegisteredGame(creator.page);
    await creator.page.getByRole("button", {name: /^multiplayer$/i}).click();
    await creator.page.getByRole("button", {name: /^History /}).click();
    await creator.page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});
    await creator.page.evaluate(() => {
      Object.assign(window, {__raceOutcomeResultCount: 0});
      window.addEventListener("riddle-quest:host-to-game", (event) => {
        if ((event as CustomEvent).detail?.payload?.operation === "raceOutcome") {
          Object.assign(window, {
            __raceOutcomeResultCount:
              Number(
                (
                  window as typeof window & {
                    /** Counts authoritative race-outcome responses received by the game. */
                    __raceOutcomeResultCount?: number;
                  }
                ).__raceOutcomeResultCount ?? 0,
              ) + 1,
          });
        }
      });
    });
    await solveFakeRace(creator.page, {
      expectChainedSubmitLoader: true,
      onFinalSubmitted: async () => {
        await creator.page.getByRole("heading", {name: /run recorded/i}).waitFor({timeout: 1_000});
        expect(
          await creator.page.evaluate(
            () =>
              (
                window as typeof window & {
                  /** Counts authoritative race-outcome responses received by the game. */
                  __raceOutcomeResultCount?: number;
                }
              ).__raceOutcomeResultCount,
          ),
        ).toBe(0);
        /** The player's next intent is accepted immediately while outcome confirmation remains in flight. */
        const sendChallenge = creator.page.getByRole("button", {name: /send challenge/i});
        await sendChallenge.click({timeout: 1_000});
        expect(await sendChallenge.getAttribute("aria-busy")).toBe("true");
        expect(await sendChallenge.isDisabled()).toBe(true);
      },
    });
    await creator.page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Counts authoritative race-outcome responses received by the game. */
            __raceOutcomeResultCount?: number;
          }
        ).__raceOutcomeResultCount === 1,
      undefined,
      {timeout: 5_000},
    );
    expect(await creator.page.getByRole("heading", {name: /run recorded/i}).isVisible()).toBe(true);
    await creator.page.waitForFunction(
      () =>
        (
          window as typeof window & {
            /** Captured referral shares from the injected Jest SDK. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__: AuthHarnessState;
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__.referralShares.length === 1,
    );
    await creator.page.getByRole("button", {name: /challenge a friend/i}).waitFor({timeout: 5_000});
    await creator.context.close();
  });

  it("recovers a guess rejected after the ghost deadline without exposing a retry dead-end", async () => {
    sharedRaceChallenges.clear();
    /** Challenge long enough for the first guess to begin before, but finish after, the ghost deadline. */
    const challengeId = `jest-invite-${"c".repeat(64)}-${"d".repeat(32)}`;
    sharedRaceChallenges.set(
      challengeId,
      JSON.stringify({
        preview: {
          challengeId,
          creator: {displayName: "Deadline Opponent"},
          categoryId: "mixed",
          locale: "en",
          targetCorrect: 10,
          adjustedTimeToBeatMs: 5_000,
          rulesVersion: "race10_v1",
          expiresAtMs: Date.now() + 60_000,
          status: "active",
        },
        runId: "deadline-opponent-run",
        events: [],
      }),
    );
    /** Recipient whose in-flight guess crosses the authoritative opponent deadline. */
    const recipient = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "late-guess-recipient",
      challengeId,
      inviteKind: "race",
      campaign: "race_to_10_v1",
      sharedRace: true,
      raceGuessDelayMs: 2_500,
      raceRejectLateGuess: true,
    });
    await recipient.page.getByRole("button", {name: /accept challenge/i}).waitFor({state: "visible"});
    await recipient.page.getByRole("button", {name: /accept challenge/i}).click();
    await recipient.page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10_000});
    await recipient.page.locator(".race-gameplay .guess-board").click();
    await recipient.page.keyboard.type("piano");
    await recipient.page.locator(".race-actions .submit-action").click();
    await recipient.page.getByRole("heading", {name: /opponent wins/i}).waitFor({timeout: 6_000});
    expect(await recipient.page.getByRole("alert").count()).toBe(0);
    expect(await recipient.page.getByRole("button", {name: /^retry$/i}).count()).toBe(0);
    await recipient.context.close();
  });

  it("keeps the immediate result visible and retries failed background reconciliation", async () => {
    /** Creator whose first background outcome request fails transiently. */
    const creator = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "outcome-retry-creator",
      raceOutcomeFailures: 1,
    });
    await enterRegisteredGame(creator.page);
    await creator.page.getByRole("button", {name: /^multiplayer$/i}).click();
    await creator.page.getByRole("button", {name: /^History /}).click();
    await creator.page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});
    await solveFakeRace(creator.page);
    await creator.page.getByRole("heading", {name: /run recorded/i}).waitFor({timeout: 1_000});
    await creator.page.getByRole("alert").waitFor({state: "visible", timeout: 5_000});
    expect(await creator.page.getByRole("heading", {name: /run recorded/i}).isVisible()).toBe(true);
    await creator.page.getByRole("button", {name: /^retry$/i}).click();
    await creator.page.getByRole("alert").waitFor({state: "hidden", timeout: 5_000});
    expect(await creator.page.getByRole("heading", {name: /run recorded/i}).isVisible()).toBe(true);
    expect(creator.pageErrors).toEqual([]);
    await creator.context.close();
  });

  it("acknowledges close during a delayed start and abandons the created run before exiting", async () => {
    /** Player whose authoritative start deliberately resolves after the close intent. */
    const player = await openHarness(browser, {
      registered: true,
      harness: "race-auth",
      playerId: "close-during-start-player",
      raceStartDelayMs: 2_000,
    });
    await enterRegisteredGame(player.page);
    await player.page.getByRole("button", {name: /^multiplayer$/i}).click();
    await player.page.getByRole("button", {name: /^History /}).click();
    await player.page.locator(".race-countdown").waitFor({state: "visible", timeout: 5_000});
    /** Close control inspected while the delayed authoritative start is reconciled. */
    const closeButton = player.page.locator(".race-close");
    await closeButton.click();
    expect(await closeButton.getAttribute("aria-busy")).toBe("true");
    expect(await closeButton.isDisabled()).toBe(true);
    expect(await player.page.locator(".race-screen").isVisible()).toBe(true);
    await player.page.locator(".race-screen").waitFor({state: "detached", timeout: 7_000});
    /** A subsequent race starts normally instead of inheriting an unknown active run. */
    await player.page.getByRole("button", {name: /^multiplayer$/i}).click();
    await player.page.getByRole("button", {name: /^History /}).click();
    await player.page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});
    await player.context.close();
  });

  it("recovers rejected race preparation without creating a second run", async () => {
    for (const failure of ["lost", "wrong-category"]) {
      /** Registered player whose first prepared-run confirmation is rejected. */
      const {context, page, pageErrors} = await openHarness(browser, {
        registered: true, harness: "race-auth", playerId: `start-recovery-${failure}`,
      });
      try {
        await enterRegisteredGame(page);
        await page.getByRole("button", {name: /^multiplayer$/i}).click();
        await page.evaluate(mode => {
          Object.assign(window, {__startCommands: [], __originalPreparedRun: null});
          window.addEventListener("riddle-quest:game-to-host", event => {
            (Reflect.get(window, "__startCommands") as unknown[]).push((event as CustomEvent).detail);
          });
          /** Corrupt delivery only after authority has created the requested run. */
          const dispatch = window.dispatchEvent.bind(window);
          window.dispatchEvent = event => {
            /** Confirmation keeps the original receipt while losing its valid payload. */
            const detail = (event as CustomEvent).detail;
            if (event.type === "riddle-quest:host-to-game" && detail?.payload?.operation === "raceStart" &&
              detail.payload.ok && !Reflect.get(window, "__originalPreparedRun")) {
              Object.assign(window, {__originalPreparedRun: detail.payload.data.run.runId});
              if (mode === "lost") detail.payload = {...detail.payload, ok: false, error: "RaceTo10.ERROR_GENERIC"};
              else detail.payload.data = {...detail.payload.data, run: {...detail.payload.data.run, categoryId: "mixed"}};
            }
            return dispatch(event);
          };
        }, failure);
        await page.getByRole("button", {name: /^History /}).click();
        await page.locator(".race-error").waitFor();
        expect(await page.locator(".race-gameplay").count()).toBe(0);
        expect(await page.evaluate(() => localStorage.getItem("riddleQuest:activeRaceRun"))).toBeNull();
        await page.getByRole("button", {name: /^retry$/i}).click();
        await page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10000});
        /** Recovery dispatches the exact original start and readies only that same run. */
        const commands = await page.evaluate(() => Reflect.get(window, "__startCommands") as GameToHostMessage[]);
        /** Start receipts retain their identity while transport timestamps change. */
        const starts = commands.filter(command => command.type === "game:startRace");
        expect(starts).toHaveLength(2);
        expect(starts[1]).toMatchObject({type: starts[0].type, requestId: starts[0].requestId, payload: starts[0].payload});
        /** Authority preparation recovered by the replayed receipt. */
        const originalRunId = await page.evaluate(() => Reflect.get(window, "__originalPreparedRun") as string);
        expect(commands.filter(command => command.type === "game:readyRace")).toMatchObject([{payload: {runId: originalRunId}}]);
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("riddleQuest:activeRaceRun")!).runId)).toBe(originalRunId);
        expect(commands.some(command => ["game:getRaceOutcome", "game:publishRace"].includes(command.type))).toBe(false);
        expect(await page.locator(".race-error").count()).toBe(0);
        expect(pageErrors).toEqual([]);
        await page.screenshot({path: `/tmp/race-start-recovery-${failure}.png`});
      } finally {await context.close();}
    }
  });
});
jest.setTimeout(180_000);
