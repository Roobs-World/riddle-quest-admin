/** Recorded scenarios retained from 6ee7da15e, bound to the current host and controller through a private test artifact. */
import {openAuthenticationHarness} from "./authenticationHarness.jest-playwright.support";
import {afterAll, afterEach, beforeAll, describe, expect, it, jest} from "@jest/globals";
import {chromium, type Browser, type Page} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import type {GameToHostMessage, HostToGameMessage} from "@riddle-quest/core/bridge";
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

  it("renders typed invitation waiting and cancellation for an opaque creator entry", async () => {
    /** Injected browser authority exposes recovery before publication. */
    const {context, page, pageErrors} = await openHarness(browser, {
      registered: true, harness: "race-auth", playerId: "invitation-creator", challengeId: "opaque-seat", invitationRole: "creator", inviteKind: "race", campaign: "race_to_10_v1",
    });
    await page.getByText(/waiting for the creator to finish and publish/i).waitFor({timeout: 15000});
    await page.getByRole("button", {name: /^cancel invitation$/i}).click();
    await page.getByText(/this invitation was cancelled/i).waitFor();
    expect(await page.getByRole("button", {name: /^cancel invitation$/i}).count()).toBe(0);
    expect(pageErrors).toEqual([]);
    await captureMultiplayerEvidence(page, "invitation-cancelled.png");
    await context.close();
  });

  it("recovers a waiting invitation from a local pointer after reloading without an incoming link", async () => {
    /** Actual browser lifetime, transport and uncaught errors for invitation reload recovery. */
    const {context, page, pageErrors} = await openHarness(browser, {
      registered: true, harness: "race-auth", playerId: "invitation-reload-player", challengeId: "reload-seat", invitationRole: "creator", inviteKind: "race", campaign: "race_to_10_v1",
    });
    await page.getByText(/waiting for the creator to finish and publish/i).waitFor({timeout: 15000});
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("riddleQuest:raceRecovery")!).intent)).toEqual({kind: "challenge", challengeId: "reload-seat"});
    /** Reload URL deliberately removes incoming-link attribution while retaining the injected account. */
    const url = new URL(page.url());
    for (const key of ["challengeId", "inviteKind", "campaign"]) url.searchParams.delete(key);
    await page.goto(url.toString());
    await enterRegisteredGame(page);
    await page.getByRole("button", {name: /^multiplayer$/i}).click();
    await page.getByText(/waiting for the creator to finish and publish/i).waitFor({timeout: 15000});
    expect(await page.evaluate(() => Reflect.get(window, "__INVITATION_READS__"))).toBeGreaterThan(0);
    await page.getByRole("button", {name: /^cancel invitation$/i}).click();
    await page.getByText(/this invitation was cancelled/i).waitFor();
    expect(await page.evaluate(() => localStorage.getItem("riddleQuest:raceRecovery"))).toBeNull();
    expect(pageErrors).toEqual([]);
    await context.close();
  });

  it("consumes an unavailable challenge on Close so Multiplayer reopens the normal lobby", async () => {
    /** Isolated browser context and captured page errors for this player pathway. */
    const {page, pageErrors} = await openHarness(browser, {
      registered: true, dailyCompleted: true, harness: "race-auth", challengeId: "missing-entry", invitationRole: "unavailable",
      inviteKind: "race", campaign: "race_to_10_v1",
    });
    await page.getByText("The race could not continue.", {exact: true}).waitFor();
    await page.locator(".race-topbar").getByRole("button", {name: "Close Race to 10", exact: true}).click();
    await enterRegisteredGame(page);
    await page.locator(".game-mode-label").getByText(/classic/i).waitFor();
    await page.getByRole("button", {name: "Multiplayer", exact: true}).click();
    await page.getByRole("button", {name: /^History /}).waitFor();
    expect(await page.getByText("The race could not continue.", {exact: true}).count()).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  it("reopens a completed recipient challenge to its result without a second start", async () => {
    /** Isolated browser context and captured page errors for this player pathway. */
    const {context, page, pageErrors} = await openHarness(browser, {registered: true, harness: "race-auth", challengeId: "played-entry", existingCompletedRun: true, inviteKind: "race"});
    try {
      await page.getByRole("heading", {name: "You win!", exact: true}).waitFor();
      expect(await page.getByRole("button", {name: "Accept challenge", exact: true}).count()).toBe(0);
      /** Observed bridge operations used to assert recovery without a second start. */
      const calls = await page.evaluate(() => (window as typeof window & {
        /** Observed completed-entry bridge operations retained for browser assertions. */
      __PLAYED_ENTRY_COMMANDS__: string[]}).__PLAYED_ENTRY_COMMANDS__);
      expect(calls).toContain("game:resumeRace");
      expect(calls).not.toContain("game:startRace");
      expect(pageErrors).toEqual([]);
    } finally {await context.close();}
  });

  it("opens a public creator entry as recorded and routes Check results to Activity", async () => {
    /** Isolated browser context and captured page errors for this player pathway. */
    const {context, page, pageErrors} = await openHarness(browser, {
      registered: true, harness: "race-auth", challengeId: "public-entry", invitationRole: "public-creator", inviteKind: "race",
    });
    try {
      await page.getByRole("heading", {name: "Run recorded!", exact: true}).waitFor();
      expect(await page.getByRole("button", {name: "Accept challenge", exact: true}).count()).toBe(0);
      expect(await page.getByRole("button", {name: "Cancel invitation", exact: true}).count()).toBe(0);
      await page.getByRole("button", {name: "Check results", exact: true}).click();
      await page.getByRole("tab", {name: "Activity", exact: true}).waitFor();
      expect(await page.getByRole("heading", {name: "Run recorded!", exact: true}).count()).toBe(0);
      expect(pageErrors).toEqual([]);
    } finally {await context.close();}
  });

  it("retains public recipient acceptance without exposing creator controls", async () => {
    /** Isolated browser context and captured page errors for this player pathway. */
    const {context, page} = await openHarness(browser, {
      registered: true, harness: "race-auth", challengeId: "public-entry", invitationRole: "public-recipient", inviteKind: "race",
    });
    try {
      await page.getByRole("button", {name: "Accept challenge", exact: true}).waitFor();
      expect(await page.getByRole("button", {name: "Check results", exact: true}).count()).toBe(0);
      expect(await page.getByRole("button", {name: "Cancel invitation", exact: true}).count()).toBe(0);
    } finally {await context.close();}
  });

  it("suspends typed invitation polling while hidden and refreshes on visible recovery", async () => {
    /** Recipient waiting without any creator cancellation capability. */
    const {context, page, pageErrors} = await openHarness(browser, {
      registered: true, harness: "race-auth", playerId: "invitation-recipient", challengeId: "another-opaque-seat", invitationRole: "recipient", inviteKind: "race", campaign: "race_to_10_v1",
    });
    await page.getByText(/waiting for the creator to finish and publish/i).waitFor({timeout: 15000});
    expect(await page.getByRole("button", {name: /^cancel invitation$/i}).count()).toBe(0);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {configurable: true, value: "hidden"});
      document.dispatchEvent(new Event("visibilitychange"));
    });
    /** Read count after the browser signals background visibility. */
    const before = await page.evaluate(() => Reflect.get(window, "__INVITATION_READS__"));
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => Reflect.get(window, "__INVITATION_READS__"))).toBe(before);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {configurable: true, value: "visible"});
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(previous => Reflect.get(window, "__INVITATION_READS__") > previous, before);
    expect(pageErrors).toEqual([]);
    await captureMultiplayerEvidence(page, "invitation-waiting.png");
    await context.close();
  });
});
jest.setTimeout(180_000);
