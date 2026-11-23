import {type Browser} from "@playwright/test";
import {installJestSdkHarness} from "./authentication.jest-sdk-harness";
import {installJestSdkRequestRoute} from "./authentication.jest-playwright.support";
import {createFakeRaceServices} from "../../../../../src/web/play/race/testing/fakeRaceServices";
import {projectRaceOutcome} from "../../../../../src/web/play/race/logic/racePresentation";
import type {RaceRunView} from "../../../../../src/core/race";

/** Creates an isolated authenticated page with optional race authority fixtures. */
export const openAuthenticationHarness = async (
  browser: Browser,
  baseUrl: string,
  options: {
    /** Stores registered. */
    registered?: boolean;
    /** Stores scenario. */
    scenario?: string;
    /** Stores custom name. */
    customName?: string;
    /** Stores invite kind. */
    inviteKind?: string;
    /** Stores campaign. */
    campaign?: string;
    /** Stores reference. */
    reference?: string;
    /** Stores inviter name. */
    inviterName?: string;
    /** Stores game mode. */
    gameMode?: string;
    /** Real load lifecycle with absent Daily supplied by the trusted fake authority. */
    dailyUnavailable?: boolean;
    /** Trusted fake authority confirms Daily completion before Classic entry. */
    dailyCompleted?: boolean;
    /** Stores riddle id. */
    riddleId?: string;
    /** Stores challenge id. */
    challengeId?: string;
    /** Stores challenge destination. */
    challengeDestination?: string;
    /** Stores harness. */
    harness?: "jest-auth" | "race-auth";
    /** Stores player id. */
    playerId?: string;
    /** Stores shared race. */
    sharedRace?: boolean;
    /** Stores race start delay ms. */
    raceStartDelayMs?: number;
    /** Stores race outcome delay ms. */
    raceOutcomeDelayMs?: number;
    /** Number of outcome requests that fail before the harness recovers. */
    raceOutcomeFailures?: number;
    /** Stores race guess delay ms. */
    raceGuessDelayMs?: number;
    /** Stores race skip delay ms. */
    raceSkipDelayMs?: number;
    /** Whether late ghost guesses reproduce the production rejection. */
    raceRejectLateGuess?: boolean;
    /** Typed invitation adapter scenario injected before the game mounts. */
    existingCompletedRun?: boolean;
    /** Injected creator/recipient entry behavior for the browser invitation scenarios. */
    invitationRole?: "creator" | "recipient" | "unavailable" | "public-creator" | "public-recipient";
  } = {},
) => {
  /** Provides context behavior. */
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  /** Provides page behavior. */
  const page = await context.newPage();
  /** Captures uncaught startup failures, including asynchronous translation errors. */
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installJestSdkRequestRoute(page, options.scenario);
  await installJestSdkHarness(page, options.scenario);
  /** Observe entry commands before application scripts can dispatch an automatic deep-link action. */
  await page.addInitScript(() => {
    Object.assign(window, {__pvpEntryCommands: []});
    window.addEventListener("riddle-quest:game-to-host", event => {
      (Reflect.get(window, "__pvpEntryCommands") as string[]).push((event as CustomEvent).detail.type);
    });
  });
  if (options.existingCompletedRun) {
    /** Canonical fake authority run used to construct completed-entry recovery evidence. */
    const initial = (await createFakeRaceServices().startRace({locale: "en", categoryId: "mixed", requestId: "played-fixture"})).run;
    /** Canonical run fixture retains identity and competitive facts for recovery assertions. */
    const run: RaceRunView = {...initial, challengeId: "played-entry", role: "challenger", status: "completed", correctCount: 10,
      currentRiddle: null, wallElapsedMs: 60000, adjustedElapsedMs: 60000, opponent: {displayName: "Nova", adjustedFinishMs: 90000, events: []}};
    /** Competitive result implied by the completed canonical fixture. */
    const outcome = projectRaceOutcome(run, run.adjustedElapsedMs)!;
    await page.addInitScript(({run, outcome}) => {
      /** Original browser event delivery retained while the harness intercepts authority receipts. */
      const dispatch = window.dispatchEvent.bind(window);
      /** Observed bridge operations used to assert recovery without a second start. */
      const calls: string[] = [];
      Object.defineProperty(window, "__PLAYED_ENTRY_COMMANDS__", {get: () => calls});
      window.dispatchEvent = event => {
        /** Bridge envelope received by the injected authority interception. */
        const detail = (event as CustomEvent).detail;
        if (event.type === "riddle-quest:game-to-host" && detail?.type) calls.push(detail.type);
        if (event.type === "riddle-quest:host-to-game") {
          /** Correlated authority operation selected from the bridge receipt. */
          const operation = detail?.payload?.operation;
          if (operation === "raceEntry") detail.payload = {operation, ok: true, data: {status: "ready", viewerRole: "recipient", existingRunId: run.runId,
            serverNowMs: Date.now(), challenge: {challengeId: "played-entry", locale: "en", creator: {displayName: "Nova"}, categoryId: "mixed", targetCorrect: 10,
              adjustedTimeToBeatMs: 90000, rulesVersion: "race10_v1", expiresAtMs: Date.now() + 60000, status: "active"}}};
          else if (operation === "raceResume") detail.payload = {operation, ok: true, data: {run}};
          else if (operation === "raceOutcome") detail.payload = {operation, ok: true, data: outcome};
        }
        return dispatch(event);
      };
    }, {run, outcome});
  }
  if (options.invitationRole) await page.addInitScript(role => {
    /** Authority adapter emits readiness facts for an opaque invitation. */
    const dispatch = window.dispatchEvent.bind(window);
    /** Durable terminal state owned by this injected authority adapter. */
    let cancelled = false;
    /** Visible read count exposes browser visibility suspension. */
    let reads = 0;
    Object.defineProperty(window, "__INVITATION_READS__", {get: () => reads});
    window.dispatchEvent = event => {
      /** Untrusted bridge envelope is replaced before any consumer parses it. */
      const detail = (event as CustomEvent).detail;
      if (event.type === "riddle-quest:host-to-game" && ["raceEntry", "raceInviteCancel"].includes(detail?.payload?.operation)) {
        if (role === "unavailable") {
          detail.payload = {operation: detail.payload.operation, ok: true, data: {
            status: "unavailable", reason: "missing", serverNowMs: Date.now(),
          }};
          return dispatch(event);
        }
        if (role === "public-creator" || role === "public-recipient") {
          detail.payload = {operation: detail.payload.operation, ok: true, data: {
            status: "ready", viewerRole: role === "public-creator" ? "creator" : "recipient", serverNowMs: Date.now(),
            challenge: {challengeId: "public-entry", locale: "en", creator: {displayName: "Nova"}, categoryId: "history",
              targetCorrect: 10, adjustedTimeToBeatMs: 45000, rulesVersion: "race10_v1", expiresAtMs: Date.now() + 60000, status: "active"},
          }};
          return dispatch(event);
        }
        if (detail.payload.operation === "raceEntry") reads++;
        else cancelled = true;
        detail.payload = {operation: detail.payload.operation, ok: true, data: {
          status: cancelled ? "cancelled" : "waiting", serverNowMs: Date.now(),
          invitation: {role, claimState: "claimed", publicationState: "pending", canCancel: role === "creator" && !cancelled, expiresAtMs: Date.now() + 60000},
        }};
      }
      return dispatch(event);
    };
  }, options.invitationRole);
  /** Provides query behavior. */
  const query = new URLSearchParams({harness: options.harness ?? "jest-auth"});
  if (options.registered) query.set("registered", "1");
  if (options.customName) query.set("customName", options.customName);
  if (options.inviteKind) query.set("inviteKind", options.inviteKind);
  if (options.campaign) query.set("campaign", options.campaign);
  if (options.reference) query.set("reference", options.reference);
  if (options.inviterName) query.set("inviterName", options.inviterName);
  if (options.gameMode) query.set("gameMode", options.gameMode);
  if (options.dailyUnavailable) query.set("dailyUnavailable", "1");
  // Classic authentication scenarios represent a player who completed today's Daily.
  if (options.dailyCompleted ?? options.gameMode !== "challenge") query.set("dailyCompleted", "1");
  if (options.riddleId) query.set("riddleId", options.riddleId);
  if (options.challengeId) query.set("challengeId", options.challengeId);
  if (options.challengeDestination) query.set("challengeDestination", options.challengeDestination);
  if (options.playerId) query.set("playerId", options.playerId);
  if (options.sharedRace) query.set("sharedRace", "1");
  if (options.raceStartDelayMs) query.set("raceStartDelayMs", String(options.raceStartDelayMs));
  if (options.raceOutcomeDelayMs) query.set("raceOutcomeDelayMs", String(options.raceOutcomeDelayMs));
  if (options.raceOutcomeFailures) query.set("raceOutcomeFailures", String(options.raceOutcomeFailures));
  if (options.raceGuessDelayMs) query.set("raceGuessDelayMs", String(options.raceGuessDelayMs));
  if (options.raceSkipDelayMs) query.set("raceSkipDelayMs", String(options.raceSkipDelayMs));
  if (options.raceRejectLateGuess) query.set("raceRejectLateGuess", "1");
  /** Provides navigation behavior. */
  const navigation = page.goto(`${baseUrl}/?${query}`);
  if (options.scenario === "sdk-request-delay") {
    await page.locator("#root > *").waitFor({timeout: 2_000});
  }
  await navigation;
  return {context, page, pageErrors};
};
