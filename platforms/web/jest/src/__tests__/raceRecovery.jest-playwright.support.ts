import {expect} from "@jest/globals";
import type {Page} from "@playwright/test";
import {mkdir} from "node:fs/promises";
import path from "node:path";
import {solveFakeRace} from "./authentication.jest-playwright.support.ts";

/** Completes real gameplay, corrupts only the outcome transport, and recovers without replaying answers. */
export async function verifyOutcomeConfirmationRecovery(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.assign(window, {__outcomeConfirmationRequests: [], __outcomeConfirmationDeliveries: 0});
    window.addEventListener("riddle-quest:game-to-host", event => {
      (Reflect.get(window, "__outcomeConfirmationRequests") as string[]).push((event as CustomEvent).detail.type);
    });
    /** The injected authority retains its genuine terminal run and canonical outcome. */
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = event => {
      /** A coherent five-second time replacement passes arithmetic validation but contradicts the confirmed run. */
      const detail = (event as CustomEvent).detail;
      if (event.type === "riddle-quest:host-to-game" && detail?.payload?.ok && detail.payload.operation === "raceOutcome") {
        /** Independent outgoing data never rewrites the saved authority record. */
        const data = structuredClone(detail.payload.data);
        if (Reflect.get(window, "__outcomeConfirmationDeliveries") === 0) {data.wallFinishMs += 5000; data.adjustedFinishMs += 5000;}
        Reflect.set(window, "__outcomeConfirmationDeliveries", Reflect.get(window, "__outcomeConfirmationDeliveries") + 1);
        detail.payload = {...detail.payload, data};
      }
      return dispatch(event);
    };
  });
  await solveFakeRace(page, {expectChainedSubmitLoader: true});
  await page.getByRole("alert").waitFor({state: "visible"});
  /** The projected result's exact visible timing stays stable across rejection and genuine read recovery. */
  const result = await page.locator(".race-result-grid").innerText();
  expect(await page.evaluate(() => (Reflect.get(window, "__outcomeConfirmationRequests") as string[]).filter(type => type === "game:publishRace"))).toEqual([]);
  await page.getByRole("button", {name: /^retry$/i}).click();
  await page.waitForFunction(() => Reflect.get(window, "__outcomeConfirmationDeliveries") === 2);
  await page.getByRole("alert").waitFor({state: "detached"});
  expect(await page.locator(".race-result-grid").innerText()).toBe(result);
  /** Recovery reads the canonical result without resubmitting or publishing corrupted timing. */
  const requests = await page.evaluate(() => Reflect.get(window, "__outcomeConfirmationRequests") as string[]);
  expect(requests.filter(type => type === "game:submitRaceGuess")).toHaveLength(10);
  expect(requests.filter(type => type === "game:getRaceOutcome")).toHaveLength(2);
  expect(requests.filter(type => type === "game:publishRace")).toHaveLength(0);
  await page.screenshot({path: "/tmp/race-outcome-confirmation-recovery.png"});
}

/** Captures optional durable evidence for the two-player race journey. */
export const captureMultiplayerEvidence = async (page: Page, filename: string): Promise<void> => {
  /** Directory selected only by an explicit evidence run. */
  const directory = process.env.JEST_MULTIPLAYER_EVIDENCE_DIR;
  if (!directory) return;
  await mkdir(directory, {recursive: true});
  await page.screenshot({path: path.join(directory, filename), fullPage: true});
};

/** Observes the rendered GO-to-gameplay handoff without reading session internals. */
export async function observeRaceCountdown(page: Page): Promise<void> {
  await page.evaluate(() => {
    /** Browser-rendered transition times are owned by this observer lifetime. */
    const timing: {
      /** First visible GO render. */ goAt?: number;
      /** First gameplay render after GO. */ gameplayAt?: number;
    } = {};
    Reflect.set(window, "__RIDDLE_QUEST_RACE_START_TIMING__", timing);
    /** Disconnects when the complete visual handoff has been observed. */
    const observer = new MutationObserver(() => {
      if (timing.goAt === undefined && document.querySelector(".race-countdown > span")?.textContent?.trim() === "GO!") timing.goAt = performance.now();
      if (timing.goAt !== undefined && document.querySelector(".race-gameplay")) {
        timing.gameplayAt = performance.now(); observer.disconnect();
      }
    });
    observer.observe(document.body, {subtree: true, childList: true, characterData: true});
  });
}

/** Requires both actual renders and a bounded GO display interval. */
export async function verifyRaceCountdownTiming(page: Page): Promise<void> {
  /** Observed times prove a real GO render rather than an inferred state transition. */
  const timing = await page.evaluate(() => Reflect.get(window, "__RIDDLE_QUEST_RACE_START_TIMING__"));
  expect(timing?.goAt).toBeDefined();
  expect(timing?.gameplayAt).toBeDefined();
  expect((timing?.gameplayAt ?? Infinity) - (timing?.goAt ?? 0)).toBeLessThan(600);
}

/** Verifies paid hints retain the original draft through local projection and authority confirmation. */
export async function verifyHintDraftPreservation(page: Page): Promise<void> {
  await page.getByRole("button", {name: /^multiplayer$/i}).click();
  await page.getByRole("button", {name: /^History /}).click();
  await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10000});
  await page.locator(".race-gameplay .guess-row .cell").first().click();
  await page.keyboard.type("pia");
  expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["p", "i", "a", "", ""]);
  await page.locator(".race-actions").getByRole("button", {name: /^Hint/i}).click();
  await page.locator(".race-gameplay .guess-row .cell.green").first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLButtonElement>(".race-actions button")]
    .some(button => button.textContent?.startsWith("Hint") && !button.disabled));
  expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["p", "i", "a", "", ""]);
  expect(await page.locator(".race-header-clock small").innerText()).toContain("0:15.0");
}

/** Verifies exhausted incorrect attempts advance once with the production skip score and penalty. */
export async function verifyAutomaticSkip(page: Page): Promise<void> {
  await page.getByRole("button", {name: /^multiplayer$/i}).click();
  await page.getByRole("button", {name: /^History /}).click();
  await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10000});
  await page.evaluate(() => {
    Reflect.set(window, "__automaticSkipViews", []);
    window.addEventListener("riddle-quest:host-to-game", event => {
      /** Observe real injected authority scoring without altering its response. */
      const detail = (event as CustomEvent).detail;
      if (detail?.payload?.ok && detail.payload.operation === "raceGuess") Reflect.get(window, "__automaticSkipViews").push(detail.payload.data);
    });
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.locator(".race-gameplay .guess-row .cell:not([disabled])").first().click();
    await page.keyboard.type("xxxxx");
    await page.locator(".race-actions .submit-action").click();
    await page.waitForFunction(count => Reflect.get(window, "__automaticSkipViews").length === count, attempt + 1);
  }
  await page.getByRole("heading", {name: /hands and a face/i}).waitFor();
  expect(await page.locator(".race-progress strong").first().innerText()).toMatch(/1\s*\/\s*10/);
  expect(await page.locator(".race-header-clock small").innerText()).toContain("0:45.0");
  expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["", "", "", "", ""]);
  expect(await page.getByRole("alert").count()).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, "__automaticSkipViews").at(-1))).toMatchObject({autoSkipped: true, isCorrect: false,
    run: {correctCount: 1, totalPenaltyMs: 45000, events: [{type: "skip", riddlePosition: 0, correctCount: 1, penaltyAddedMs: 45000}]}});
  await page.screenshot({path: "/tmp/race-automatic-skip-confirmation.png"});
}

/** Exercises confirmed hint merging and invalid-reveal rollback while successor typing is in flight. */
export async function verifyGuessDraftConfirmation(page: Page, invalid: boolean): Promise<void> {
  await page.getByRole("button", {name: /^multiplayer$/i}).click();
  await page.getByRole("button", {name: /^History /}).click();
  await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10000});
  await page.evaluate(corrupt => {
    Object.assign(window, {__guessDraftRequests: [], __guessDraftConfirmed: false, __guessDraftInvalidResume: 0});
    window.addEventListener("riddle-quest:game-to-host", event => {
      (Reflect.get(window, "__guessDraftRequests") as string[]).push((event as CustomEvent).detail.type);
    });
    /** Injects extra authority hint metadata into a genuine delayed guess confirmation. */
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = event => {
      /** Only the successful guess receipt is transformed; recovery reads remain genuine. */
      const detail = (event as CustomEvent).detail;
      if (event.type === "riddle-quest:host-to-game" && detail?.payload?.ok && detail.payload.operation === "raceGuess") {
        /** Transport payload is independent of the injected authority's stored run. */
        const data = structuredClone(detail.payload.data);
        data.run.currentRiddle.revealedLetters = corrupt ? [{index: 5, letter: "c"}] : [{index: 0, letter: "c"}, {index: 3, letter: "c"}];
        detail.payload = {...detail.payload, data};
        Reflect.set(window, "__guessDraftConfirmed", true);
      }
      if (corrupt && event.type === "riddle-quest:host-to-game" && detail?.payload?.ok && detail.payload.operation === "raceResume" && Reflect.get(window, "__guessDraftInvalidResume") < 2) {
        /** A failed recovery read must leave the private successor draft available for another read. */
        const data = structuredClone(detail.payload.data);
        if (Reflect.get(window, "__guessDraftInvalidResume") === 0) data.run.currentRiddle.revealedLetters = [{index: 0, letter: "c"}, {index: 0, letter: "l"}];
        else data.run.categoryId = "mixed";
        detail.payload = {...detail.payload, data};
        Reflect.set(window, "__guessDraftInvalidResume", Reflect.get(window, "__guessDraftInvalidResume") + 1);
      }
      return dispatch(event);
    };
  }, invalid);
  await page.locator(".race-gameplay .guess-row .cell").first().click();
  await page.keyboard.type("piano");
  await page.locator(".race-actions .submit-action").click();
  await page.getByRole("heading", {name: /hands and a face/i}).waitFor();
  await page.locator(".race-gameplay .guess-row .cell").first().click();
  await page.keyboard.type(invalid ? "clo" : "zlo");
  await page.locator(".race-gameplay .guess-row .cell").first().click();
  if (invalid) {
    await page.getByRole("alert").waitFor({state: "visible"});
    await page.getByRole("heading", {name: /keys but cannot open/i}).waitFor();
    expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual([..."piano"]);
    await page.getByRole("button", {name: /^retry$/i}).click();
    await page.waitForFunction(() => Reflect.get(window, "__guessDraftInvalidResume") === 1);
    await page.getByRole("alert").waitFor({state: "visible"});
    expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual([..."piano"]);
    await page.getByRole("button", {name: /^retry$/i}).click();
    await page.waitForFunction(() => Reflect.get(window, "__guessDraftInvalidResume") === 2);
    await page.getByRole("alert").waitFor({state: "visible"});
    expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual([..."piano"]);
    await page.getByRole("button", {name: /^retry$/i}).click();
    await page.getByRole("heading", {name: /hands and a face/i}).waitFor();
    expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["c", "l", "o", "", ""]);
  } else {
    await page.waitForFunction(() => Reflect.get(window, "__guessDraftConfirmed"));
    await page.locator(".race-gameplay .guess-row .cell.green").first().waitFor();
    expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["c", "l", "o", "c", ""]);
    expect(await page.locator(".race-gameplay .guess-row .cell.green").count()).toBe(2);
    await page.keyboard.type("k");
    expect((await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).map(letter => letter.toLocaleLowerCase())).toEqual(["c", "l", "o", "c", "k"]);
  }
  /** Confirmation and recovery never submit the original answer again. */
  const requests = await page.evaluate(() => Reflect.get(window, "__guessDraftRequests") as string[]);
  expect(requests).toEqual(invalid ? ["game:submitRaceGuess", "game:resumeRace", "game:resumeRace", "game:resumeRace"] : ["game:submitRaceGuess"]);
  expect(await page.getByRole("alert").count()).toBe(0);
  await page.screenshot({path: `/tmp/race-guess-draft-confirmation-${invalid ? "recovered" : "hinted"}.png`});
}

/** Verifies the final clearing penalty displays an opponent win before delayed outcome reconciliation. */
export async function verifyFinalSkipResult(page: Page): Promise<void> {
  await page.getByRole("button", {name: /accept challenge/i}).waitFor({timeout: 15000});
  await page.getByRole("button", {name: /accept challenge/i}).click();
  await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10000});
  await page.evaluate(() => {
    Object.assign(window, {__finalSkipGuesses: 0, __finalSkipView: null, __finalSkipOutcome: null});
    window.addEventListener("riddle-quest:host-to-game", event => {
      /** Only real authority receipts supply score and penalty assertions. */
      const detail = (event as CustomEvent).detail;
      if (!detail?.payload?.ok) return;
      if (detail.payload.operation === "raceGuess") Reflect.set(window, "__finalSkipGuesses", Reflect.get(window, "__finalSkipGuesses") + 1);
      if (detail.payload.operation === "raceSkip") Reflect.set(window, "__finalSkipView", detail.payload.data.run);
      if (detail.payload.operation === "raceOutcome") Reflect.set(window, "__finalSkipOutcome", detail.payload.data);
    });
  });
  for (const [index, answer] of ["piano", "clock", "towel", "bottle", "stamp", "needle", "name", "comb", "water"].entries()) {
    await page.locator(".race-gameplay .guess-row .cell:not([disabled])").first().click();
    await page.keyboard.type(answer);
    await page.locator(".race-actions .submit-action").click();
    await page.waitForFunction(count => Reflect.get(window, "__finalSkipGuesses") === count, index + 1);
  }
  await page.locator(".race-actions").getByRole("button", {name: /^Skip/i}).click();
  await page.getByRole("heading", {name: /opponent wins/i}).waitFor({timeout: 1000});
  expect(await page.evaluate(() => Reflect.get(window, "__finalSkipOutcome"))).toBeNull();
  expect(await page.evaluate(() => Reflect.get(window, "__finalSkipView"))).toMatchObject({status: "completed", currentRiddle: null, correctCount: 10, totalPenaltyMs: 45000});
  expect(await page.locator(".race-result-grid").innerText()).toContain("0:45.0");
  await page.screenshot({path: "/tmp/race-final-skip-result.png"});
  await page.waitForFunction(() => Reflect.get(window, "__finalSkipOutcome"));
  expect(await page.evaluate(() => Reflect.get(window, "__finalSkipOutcome"))).toMatchObject({result: "ghost_win", correctCount: 10, skipPenaltyMs: 45000});
  expect(await page.getByRole("alert").count()).toBe(0);
}

/** Verifies that a real authority hint crossing an opponent finish renders a confirmed result. */
export async function verifyTerminalHintResult(page: Page): Promise<void> {
  await injectRaceAnalyticsFailure(page, ["race_started", "race_hint_used", "race_completed"]);
  await page.evaluate(() => {
    Object.assign(window, {__terminalHintRequests: [], __terminalHintView: null, __terminalHintOutcome: null});
    window.addEventListener("riddle-quest:game-to-host", event => {
      (Reflect.get(window, "__terminalHintRequests") as string[]).push((event as CustomEvent).detail.type);
    });
    window.addEventListener("riddle-quest:host-to-game", event => {
      /** Authority response is observed without transforming its production-shaped envelope. */
      const detail = (event as CustomEvent).detail;
      if (!detail?.payload?.ok) return;
      if (detail.payload.operation === "raceHint") Reflect.set(window, "__terminalHintView", detail.payload.data.run);
      if (detail.payload.operation === "raceOutcome") Reflect.set(window, "__terminalHintOutcome", detail.payload.data);
    });
  });
  await page.getByRole("button", {name: /accept challenge/i}).waitFor({timeout: 15000});
  await page.getByRole("button", {name: /accept challenge/i}).click();
  await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10000});
  await page.locator(".race-actions").getByRole("button", {name: /^Hint/i}).click();
  await page.getByRole("heading", {name: /opponent wins/i}).waitFor();
  await page.waitForFunction(() => Reflect.get(window, "__terminalHintOutcome"));
  expect(await page.evaluate(() => Reflect.get(window, "__terminalHintView"))).toMatchObject({status: "completed", currentRiddle: null, correctCount: 0, totalPenaltyMs: 15000});
  expect(await page.evaluate(() => Reflect.get(window, "__terminalHintOutcome"))).toMatchObject({result: "ghost_win", correctCount: 0, hintPenaltyMs: 15000, totalPenaltyMs: 15000});
  /** Completion reads authority once, without issuing a resume or another paid hint. */
  const requests = await page.evaluate(() => Reflect.get(window, "__terminalHintRequests") as string[]);
  expect(requests.filter(type => type === "game:requestRaceHint")).toHaveLength(1);
  expect(requests.filter(type => type === "game:getRaceOutcome")).toHaveLength(1);
  expect(requests).not.toContain("game:resumeRace");
  expect(await page.getByRole("alert").count()).toBe(0);
  expect(await page.locator(".race-result-grid").innerText()).toContain("0:15.0");
  expect(await page.evaluate(() => Reflect.get(window, "__optionalAnalyticsFailures"))).toEqual(["race_started", "race_hint_used", "race_completed"]);
  await page.screenshot({path: "/tmp/race-terminal-hint-result.png"});
}

/** Optional telemetry may fail before transport without preventing a player action or accepted result. */
export async function injectRaceAnalyticsFailure(page: Page, events: string[]): Promise<void> {
  await page.evaluate(names => {
    Reflect.set(window, "__optionalAnalyticsFailures", []);
    /** Fault injection stays at the optional host transport seam. */
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = event => {
      /** Competitive commands and authoritative receipts pass through unchanged. */
      const detail = (event as CustomEvent).detail;
      if (event.type === "riddle-quest:game-to-host" && detail?.type === "game:analytics" && names.includes(detail.payload.eventName)) {
        Reflect.get(window, "__optionalAnalyticsFailures").push(detail.payload.eventName);
        throw new Error("injected-optional-analytics-failure");
      }
      return dispatch(event);
    };
  }, events);
}

/** Completing gameplay resets any horizontal offset created by the scaled answer surface. */
export async function verifyRecordedLayout(page: Page): Promise<void> {
  /** Final layout remains within the embedded game viewport. */
  const completedLayout = await page.locator(".race-screen").evaluate(screen => ({
    documentScrollLeft: document.scrollingElement?.scrollLeft ?? 0,
    screenScrollLeft: screen.scrollLeft,
    topbarLeft: screen.querySelector(".race-topbar")?.getBoundingClientRect().left ?? -1,
    contentLeft: screen.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(screen).paddingLeft),
  }));
  expect(completedLayout.documentScrollLeft).toBe(0);
  expect(completedLayout.screenScrollLeft).toBe(0);
  expect(Math.abs(completedLayout.topbarLeft - completedLayout.contentLeft)).toBeLessThanOrEqual(0.5);
}

/** Verifies paid-action rollback retains solving time and draft after a foreign-run response. */
export async function verifyWrongRunPaidRollback(page: Page, selectedAction: "Hint" | "Skip"): Promise<void> {
  await page.getByRole("button", {name: /^multiplayer$/i}).click();
  await page.getByRole("button", {name: /^History /}).click();
  await page.locator(".race-gameplay").waitFor({state: "visible", timeout: 10_000});
  /** Original clue restored after each rejected action. */
  const clue = await page.locator(".race-riddle-surface h2").innerText();
  await page.locator(".race-gameplay .guess-row .cell").first().click();
  await page.keyboard.type("pi");
  await page.waitForFunction(() => Number(document.querySelector(".race-header-clock strong")?.textContent?.split(":")[1]) >= 2);
  await page.evaluate(() => {
    // Correlation and schema remain valid; only run ownership is incorrect.
    /** Intercepts transport before any game listener can consume its payload. */
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = event => {
      /** Transport data intercepted before the game parses it. */
      const detail = (event as CustomEvent).detail;
      if (event.type === "riddle-quest:host-to-game" && detail?.payload?.ok && ["raceHint", "raceSkip"].includes(detail.payload.operation)) {
        detail.payload.data = {...detail.payload.data, run: {...detail.payload.data.run, runId: "another-run"}};
      }
      return dispatch(event);
    };
  });
  for (const action of [selectedAction]) {
    /** Visible solving time before the provisional action. */
    const before = Number((await page.locator(".race-header-clock strong").innerText()).split(":")[1]);
    await page.locator(".race-actions").getByRole("button", {name: new RegExp(`^${action}`, "i")}).click();
    await page.getByRole("alert").waitFor({state: "visible"});
    expect(await page.locator(".race-riddle-surface h2").innerText()).toBe(clue);
    expect(await page.locator(".race-header-clock small").innerText()).toContain("0:00.0");
    expect(await page.locator(".race-gameplay .guess-row .cell.green").count()).toBe(0);
    expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["p", "i", "", "", ""]);
    /** Restored clock must retain all solving time since the original receipt. */
    const after = Number((await page.locator(".race-header-clock strong").innerText()).split(":")[1]);
    expect(after).toBeGreaterThanOrEqual(before);
    await page.screenshot({path: `/tmp/race-projection-recovery-${action.toLowerCase()}.png`});
  }
}

/** Exercises rollback and read recovery through the real embedded race UI. */
export async function verifyHintConfirmationRecovery(page: Page, mismatch: string): Promise<void> {
  await page.getByRole("button", {name: /^multiplayer$/i}).click();
  await page.getByRole("button", {name: /^History /}).click();
  await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10000});
  if (mismatch === "score") {
    await page.locator(".race-gameplay .guess-row .cell").first().click(); await page.keyboard.type("piano");
    await page.getByRole("button", {name: /^Submit$/i}).click();
    await page.locator(".race-riddle-surface").filter({hasText: /What has hands/i}).waitFor();
  }
  await page.locator(".race-gameplay .guess-row .cell").first().click();
  await page.keyboard.type("zi");
  await page.evaluate(kind => {
    Object.assign(window, {__hintConfirmationRequests: []});
    window.addEventListener("riddle-quest:game-to-host", event => {
      (Reflect.get(window, "__hintConfirmationRequests") as string[]).push((event as CustomEvent).detail.type);
    });
    /** Authority applies a real hint; only its outgoing confirmation is corrupted. */
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = event => {
      /** Correlated success envelope must pass schema parsing before semantic validation. */
      const detail = (event as CustomEvent).detail;
      if (event.type === "riddle-quest:host-to-game" && detail?.payload?.ok && detail.payload.operation === "raceHint") {
        /** Clone prevents corruption of the harness authority's saved state. */
        const data = structuredClone(detail.payload.data);
        if (kind === "letter") data.revealedLetter = "x";
        else if (kind === "deck") data.run.preloadedRiddles[1].text = "A changed deck clue";
        else if (kind === "schedule") data.run.startsAtMs += 1;
        else if (kind === "phase") data.run.status = "scheduled";
        else if (kind === "missing-prompt") data.run.currentRiddle = null;
        else if (kind === "score") data.run.correctCount = 0;
        else data.run.currentRiddle.riddleId = "another-question";
        detail.payload = {...detail.payload, data};
      }
      return dispatch(event);
    };
  }, mismatch);
  await page.locator(".race-actions").getByRole("button", {name: /^Hint/i}).click();
  await page.getByRole("alert").waitFor({state: "visible"});
  expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["z", "i", "", "", ""]);
  expect(await page.locator(".race-gameplay .guess-row .cell.green").count()).toBe(0);
  expect(await page.locator(".race-header-clock small").innerText()).toContain("0:00.0");
  await page.getByRole("button", {name: /^retry$/i}).click();
  await page.locator(".race-gameplay .guess-row .cell.green").first().waitFor();
  expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual([mismatch === "score" ? "c" : "p", "i", "", "", ""]);
  expect(await page.locator(".race-header-clock small").innerText()).toContain("0:15.0");
  /** One authority read recovers the original paid action without replaying it. */
  const requests = await page.evaluate(() => Reflect.get(window, "__hintConfirmationRequests") as string[]);
  expect(requests.filter(type => type === "game:requestRaceHint")).toHaveLength(1);
  expect(requests.filter(type => type === "game:resumeRace")).toHaveLength(1);
  expect(await page.getByRole("alert").count()).toBe(0);
  expect(await page.evaluate(() => performance.getEntriesByType("resource").some(entry => /\/sentry-[^/]+\.js/.test(entry.name)))).toBe(false);
}

/** Captures accepted authority before the recipient starts its countdown. */
export async function observeAcceptedRaceRecording(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.assign(window, {__acceptedInviteRecording: null});
    window.addEventListener("riddle-quest:host-to-game", event => {
      /** Correlated start confirmation supplies the recording actually accepted. */
      const detail = (event as CustomEvent).detail;
      if (detail?.payload?.operation === "raceStart" && detail.payload.ok)
        Object.assign(window, {__acceptedInviteRecording: detail.payload.data.run});
    });
  });
}

/** Confirms the recipient actually received the immutable creator recording selected by its shared link. */
export async function verifyAcceptedRaceRecording(page: Page, challengeId: string, publicationJson: string): Promise<void> {
  /** Accepted authority payload captured before the recipient's countdown. */
  const accepted = await page.evaluate(() => Reflect.get(window, "__acceptedInviteRecording")) as {
    /** Exact challenge selected by the recipient. */ challengeId: string;
    /** Server-issued playback of the creator's recording. */ opponent: {
      /** Immutable creator event timeline. */ events: unknown[];
      /** Server-issued adjusted finish. */ adjustedFinishMs: number;
    };
  };
  /** Published authority record must match the recipient's accepted opponent. */
  const published = JSON.parse(publicationJson) as {
    /** Immutable events persisted under the shared challenge ID. */ events: unknown[];
    /** Time advertised before the recipient accepted the invite. */ preview: {
      /** Immutable creator finish shown before acceptance. */ adjustedTimeToBeatMs: number;
    };
  };
  expect(accepted.challengeId).toBe(challengeId);
  expect(accepted.opponent.events).toEqual(published.events);
  expect(accepted.opponent.adjustedFinishMs).toBe(published.preview.adjustedTimeToBeatMs);
}

/** Drops a successful bridge event entirely and exercises the production delivery deadline. */
export async function verifyLostHintDeliveryRecovery(page: Page): Promise<void> {
  await page.getByRole("button", {name: /^multiplayer$/i}).click();
  await page.getByRole("button", {name: /^History /}).click();
  await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10000});
  await page.locator(".race-gameplay .guess-row .cell").first().click();
  await page.keyboard.type("zi");
  await page.evaluate(() => {
    Object.assign(window, {__lostHintRequests: [], __lostHintResponse: null});
    window.addEventListener("riddle-quest:game-to-host", event => {
      (Reflect.get(window, "__lostHintRequests") as string[]).push((event as CustomEvent).detail.type);
    });
    /** Retains the server-applied success for a deliberately late replay. */
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = event => {
      /** Genuine response is dropped before the game listener can receive any envelope. */
      const detail = (event as CustomEvent).detail;
      if (event.type === "riddle-quest:host-to-game" && detail?.payload?.ok && detail.payload.operation === "raceHint" && !Reflect.get(window, "__lostHintResponse")) {
        Reflect.set(window, "__lostHintResponse", structuredClone(detail));
        return true;
      }
      return dispatch(event);
    };
  });
  await page.locator(".race-actions").getByRole("button", {name: /^Hint/i}).click();
  await page.waitForFunction(() => Reflect.get(window, "__lostHintResponse"));
  await page.locator(".race-gameplay .guess-row .cell.green").first().waitFor();
  await page.getByRole("alert").waitFor({state: "visible", timeout: 35000});
  expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["z", "i", "", "", ""]);
  expect(await page.locator(".race-gameplay .guess-row .cell.green").count()).toBe(0);
  expect(await page.locator(".race-header-clock small").innerText()).toContain("0:00.0");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("riddle-quest:host-to-game", {detail: Reflect.get(window, "__lostHintResponse")})));
  expect(await page.getByRole("alert").count()).toBe(1);
  expect(await page.locator(".race-gameplay .guess-row .cell.green").count()).toBe(0);
  await page.getByRole("button", {name: /^retry$/i}).click();
  await page.locator(".race-gameplay .guess-row .cell.green").first().waitFor();
  expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["p", "i", "", "", ""]);
  expect(await page.locator(".race-header-clock small").innerText()).toContain("0:15.0");
  /** Transport recovery must never issue a second paid hint or restart the race. */
  const requests = await page.evaluate(() => Reflect.get(window, "__lostHintRequests") as string[]);
  expect(requests).toEqual(["game:requestRaceHint", "game:resumeRace"]);
  expect(await page.getByRole("alert").count()).toBe(0);
  await page.screenshot({path: "/tmp/race-lost-delivery-recovery.png"});
}

/** Preserves typing into a projected successor until recovery confirms that exact question. */
export async function verifySuccessorDraftRecovery(page: Page, malformed: boolean): Promise<void> {
  await page.getByRole("button", {name: /^multiplayer$/i}).click();
  await page.getByRole("button", {name: /^History /}).click();
  await page.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 10000});
  await page.evaluate(corrupt => {
    Object.assign(window, {__successorRecoveryRequests: []});
    window.addEventListener("riddle-quest:game-to-host", event => {
      (Reflect.get(window, "__successorRecoveryRequests") as string[]).push((event as CustomEvent).detail.type);
    });
    /** Authority applies a genuine correct guess before transport loses or corrupts its response. */
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = event => {
      /** Correlated guess response remains separate from the saved authority view. */
      const detail = (event as CustomEvent).detail;
      if (event.type === "riddle-quest:host-to-game" && detail?.payload?.ok && detail.payload.operation === "raceGuess") {
        detail.payload = corrupt
          ? {...detail.payload, data: {...detail.payload.data, run: {...detail.payload.data.run, runId: "foreign-run"}}}
          : {...detail.payload, ok: false, error: "RaceTo10.ERROR_GENERIC"};
      }
      return dispatch(event);
    };
  }, malformed);
  await page.locator(".race-gameplay .guess-row .cell").first().click();
  await page.keyboard.type("piano");
  await page.locator(".race-actions .submit-action").click();
  await page.getByRole("heading", {name: /hands and a face/i}).waitFor();
  await page.locator(".race-gameplay .guess-row .cell").first().click();
  await page.keyboard.type("clo");
  expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["c", "l", "o", "", ""]);
  await page.getByRole("alert").waitFor({state: "visible"});
  await page.getByRole("heading", {name: /keys but cannot open/i}).waitFor();
  expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["p", "i", "a", "n", "o"]);
  await page.getByRole("button", {name: /^retry$/i}).click();
  await page.getByRole("heading", {name: /hands and a face/i}).waitFor();
  expect(await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents()).toEqual(["c", "l", "o", "", ""]);
  await page.keyboard.type("ck");
  expect((await page.locator(".race-gameplay .guess-row").first().locator(".cell").allTextContents())
    .map(letter => letter.toLocaleLowerCase())).toEqual(["c", "l", "o", "c", "k"]);
  /** Recovery restores input through one authority read without resubmitting the original guess. */
  const requests = await page.evaluate(() => Reflect.get(window, "__successorRecoveryRequests") as string[]);
  expect(requests).toEqual(["game:submitRaceGuess", "game:resumeRace"]);
  expect(await page.getByRole("alert").count()).toBe(0);
  await page.screenshot({path: `/tmp/race-successor-draft-recovery-${malformed ? "malformed" : "lost"}.png`});
}
