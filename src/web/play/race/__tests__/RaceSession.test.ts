import {describe, expect, it, jest} from "@jest/globals";
import {raceMatchFailure} from "../../../../core/race";
import type {GameToHostMessage} from "../../../../core/bridge";
import type {RaceChallengePreview, RaceOutcome, RaceRunView} from "../../../../core/race";
import type {MatchmakingCapability} from "../../../platform/types";
import {RaceSession} from "../RaceSession";
import type {RaceSessionEffect, RaceSessionEntry, RaceSessionOptions} from "../RaceSession.types";
import {parseRaceRecovery, type RaceRecovery, type RaceRecoveryPersistence} from "../logic/raceRecoveryStorage";
import {createFakeRaceServices} from "../testing/fakeRaceServices";
import {projectInstantRaceSkip, projectRaceOutcome} from "../logic/racePresentation";

import {harness, catalog, fixture, racing, recorded, preview, settleMatch, withCorrectHistory} from "./raceSession.support";

/** Authors an authority sample for a deliberately advanced local projection fixture. */
const authorityClock = (view: RaceRunView): RaceRunView => ({
  ...view,
  ...(view.status === "active" && view.startsAtMs !== undefined
    ? {serverNowMs: view.startsAtMs + view.wallElapsedMs} : {}),
});

describe("Race Session ownership and authority orchestration", () => {
  it("recovers the existing recipient run directly from authoritative entry facts", async () => {
    /** Public Race Session harness records correlated entry and recovery commands. */
    const h = harness({challengeId: "played"});
    /** Canonical run fixture retains identity and competitive facts for recovery assertions. */
    const run = {...await fixture(true), challengeId: "played", role: "challenger" as const};
    h.respond("raceEntry", {status: "ready", challenge: preview("played"), viewerRole: "recipient", existingRunId: run.runId, serverNowMs: 1000});
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: run.runId, includeEvaluation: true}});
    h.respond("raceResume", {run});
    expect(h.session.getSnapshot().run?.runId).toBe(run.runId);
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(0);
  });
  it("routes creator acceptance to Activity without issuing a race start", () => {
    /** Public Race Session harness records correlated entry and recovery commands. */
    const h = harness({challengeId: "own-public"});
    h.respond("raceEntry", {status: "ready", challenge: preview("own-public"), viewerRole: "creator", serverNowMs: 1000});
    expect(h.session.getSnapshot().entryStatus).toMatchObject({viewerRole: "creator"});
    h.session.begin("mixed");
    expect(h.session.getSnapshot()).toMatchObject({stage: "inbox", error: null});
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(0);
    expect(h.last().type).toBe("game:listRaceInbox");
  });

  it.each(["navigation", "rematch", "entry", "dispose", "begin"])("invalidates optional dialog ownership after %s even on the same screen", async transition => {
    /** Optional dialog originates in a fully loaded category visit. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Adapter checks exact visit ownership without knowing private generations. */
    const current = h.session.captureJourney();
    h.advance(1000); h.session.reportError(null);
    expect(current()).toBe(true);
    if (transition === "navigation") {h.session.navigate("inbox"); h.session.navigate("categories");}
    else if (transition === "rematch") h.session.rematch();
    else if (transition === "entry") {h.session.enter({locale: "en", ownerId: "owner-1"}); h.respond("raceCategories", await catalog());}
    else if (transition === "dispose") h.session.dispose();
    else {h.session.begin("mixed"); h.reject("raceStart", "not-started");}
    expect(current()).toBe(false);
    if (transition !== "dispose") expect(h.session.getSnapshot().stage).toBe("categories");
  });
  it("retains optional dialog ownership across racing ticks but expires it on authority completion", async () => {
    /** Real gameplay refreshes must not be confused with navigation. */
    const h = await racing();
    /** Ownership belongs to the actual active screen/run. */
    const current = h.session.captureJourney();
    h.advance(100); h.session.input("text", "piano"); expect(current()).toBe(true);
    h.session.submit();
    /** Terminal authority changes the screen without a fresh navigation generation. */
    const run = withCorrectHistory({...h.run, status: "completed", correctCount: 10, currentRiddle: null});
    h.respond("raceGuess", {run, isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))});
    expect(current()).toBe(false);
  });
  it.each(["sync", "async"])("keeps accepted completion and publication when optional effects fail %s", async failure => {
    /** Every optional effect fails, while canonical receipts still drive the whole journey. */
    const h = await recorded(() => {
      if (failure === "sync") throw new Error("optional-provider-failure");
      return Promise.reject(new Error("optional-provider-failure"));
    });
    await Promise.resolve();
    expect(h.session.getSnapshot()).toMatchObject({stage: "result", error: null, pending: null, outcome: {correctCount: 10}});
    expect(h.effects.filter(effect => effect.kind === "analytics" && effect.event === "race_started")).toHaveLength(1);
    expect(h.effects.filter(effect => effect.kind === "analytics" && effect.event === "race_attempt_completed")).toHaveLength(1);
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
    h.session.publish();
    /** Duplicate transport delivery must not replay the failed publication effect. */
    const command = h.last();
    /** Publication belongs to the confirmed creator score. */
    const publication = {challengeId: "published", preview: preview("published")};
    h.respond("racePublish", publication, command); h.respond("racePublish", publication, command);
    await Promise.resolve();
    expect(h.session.getSnapshot()).toMatchObject({stage: "result", error: null, pending: null, published: publication});
    expect(h.effects.filter(effect => effect.kind === "publication")).toEqual([{kind: "publication", publication: h.session.getSnapshot().published, share: true}]);
    expect(h.commands.filter(command => command.type === "game:getRaceOutcome")).toHaveLength(1);
    expect(h.commands.filter(command => command.type === "game:publishRace")).toHaveLength(1);
  });
  it("keeps confirmed paid actions when their analytics adapter throws", async () => {
    /** Optional telemetry cannot consume or roll back a paid action's receipt. */
    const h = await racing(effect => {if (effect.kind === "analytics") throw new Error("telemetry-offline");});
    /** Real authority retains the same run identity and complete paid-action history. */
    const authority = h.authority;
    await authority.startRace({locale: "en", categoryId: "mixed", requestId: "fixture-start", includeEvaluation: true});
    h.session.input("text", "zzzzz"); h.session.hint();
    h.respond("raceHint", await authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "paid-hint"}));
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, currentLetters: ["p", "z", "z", "z", "z"], run: {totalPenaltyMs: 15000}});
    h.session.skip();
    h.respond("raceSkip", await authority.skipRaceRiddle({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "paid-skip"}));
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, run: {correctCount: 1, totalPenaltyMs: 60000}});
  });
  it("disposes the journey even when its optional close adapter throws", () => {
    /** Closing remains final before rendering callbacks run. */
    const h = harness({}, null, {effect: () => {throw new Error("close-adapter-failure");}});
    expect(() => h.session.requestClose()).not.toThrow();
    h.session.begin("mixed"); h.session.retry();
    expect(h.commands).toHaveLength(1); expect(h.timers.size).toBe(0);
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
  });
  it.each(["guess", "hint", "skip", "resume"] as const)("keeps immutable run context and recovery input after a corrupted %s response", async operation => {
    for (const mismatch of [{role: "challenger"}, {categoryId: "history"}, {challengeId: "foreign"}, {rivalryChallengeId: "foreign"}]) {
      /** Every operation crosses the public session seam with an owned draft and clock. */
      const h = await racing(); h.session.input("text", "piano"); h.session.input("slot", 1);
      /** Original context is retained even when a projection has already advanced. */
      const before = h.session.getSnapshot();
      if (operation === "guess" || operation === "resume") h.session.submit();
      else h.session[operation]();
      if (operation === "resume") {h.reject("raceGuess", "Lost confirmation."); h.session.retry();}
      /** Schema-valid metadata for a different competitive context must not consume a checkpoint. */
      const invalid = authorityClock(structuredClone(h.session.getSnapshot().run!));
      if (invalid.currentRiddle) Reflect.deleteProperty(invalid.currentRiddle, "hint");
      Object.assign(invalid, mismatch);
      h.respond(operation === "guess" ? "raceGuess" : operation === "hint" ? "raceHint" : operation === "skip" ? "raceSkip" : "raceResume",
        operation === "guess" ? {run: invalid, isCorrect: true, autoSkipped: false, feedback: []} :
          operation === "hint" ? {run: invalid, index: 0, revealedLetter: "p"} :
            operation === "skip" ? {run: invalid, penaltyAddedMs: 45000} : {run: invalid});
      expect(h.session.getSnapshot()).toMatchObject({run: before.run, receivedAtMs: before.receivedAtMs,
        currentLetters: before.currentLetters, activeSlotIndex: operation === "hint" || operation === "skip" ? 1 : 0, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
      expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
      h.session.retry(); h.respond("raceResume", {run: before.run});
      expect(h.session.getSnapshot()).toMatchObject({run: before.run, currentLetters: before.currentLetters, error: null});
    }
  });
  it.each([{role: "challenger"}, {categoryId: "history"}, {challengeId: "foreign"}, {rivalryChallengeId: "foreign"}])("rejects readiness that changes immutable run context: %j", async mismatch => {
    /** Prepared ownership must survive a malformed readiness response and retry. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Genuine prepared run is the authority-issued owner of readiness. */
    const run = await fixture(true); h.respond("raceStart", {run});
    h.respond("raceReady", {run: {...run, status: "scheduled", ...mismatch}});
    expect(h.session.getSnapshot()).toMatchObject({run, error: "RaceTo10.ERROR_INVALID_RESPONSE", pending: null});
    h.session.retry(); h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: run.serverNowMs! + 3000}});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {status: "scheduled", role: "creator", categoryId: "mixed"}});
  });
  it.each([
    {challengeId: "foreign"}, {hintPenaltyMs: 1}, {totalPenaltyMs: 1}, {adjustedFinishMs: 1},
    {result: "player_win"}, {correctCount: 9}, {rematchEligible: true},
  ])("rejects incoherent final scoring before provider effects and permits recovery: %j", async mismatch => {
    /** Terminal authority response initiates its own outcome read. */
    const h = await racing(); h.session.input("text", "piano"); h.session.submit();
    /** Valid canonical result stays available after malformed delivery. */
    const run = withCorrectHistory({...h.run, status: "completed", correctCount: 10, currentRiddle: null});
    h.respond("raceGuess", {run, isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))});
    /** Projected presentation is retained until a coherent scoring result arrives. */
    const before = h.session.getSnapshot();
    /** Consistent canonical score for the run's original context. */
    const outcome = projectRaceOutcome(run, run.adjustedElapsedMs)!;
    h.respond("raceOutcome", {...outcome, ...mismatch,
      ...("adjustedFinishMs" in mismatch ? {adjustedFinishMs: outcome.adjustedFinishMs + 1} : {})});
    expect(h.session.getSnapshot()).toMatchObject({run: before.run, outcome: before.outcome, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
    h.session.retry(); h.respond("raceOutcome", outcome);
    expect(h.session.getSnapshot()).toMatchObject({outcome, error: null});
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
  it("expires a missing start response and retries the original preparation receipt", async () => {
    /** Lost preparation confirmation must not leave the countdown blocked forever. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Server receipt remains stable through bounded transport recovery. */
    const original = h.last();
    h.advance(29999);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceStart", error: null});
    h.advance(1);
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", pending: null, error: "RaceTo10.ERROR_GENERIC"});
    h.session.retry();
    expect(h.last()).toEqual(original);
    h.respond("raceStart", {run: await fixture(true)});
    expect(h.last().type).toBe("game:readyRace");
  });
  it("rolls back a missing hint confirmation and ignores its late response during read recovery", async () => {
    /** Original question and selected draft survive a completely lost bridge event. */
    const h = await racing();
    /** Matching authority has already charged the original hint once. */
    const authority = h.authority;
    await authority.startRace({locale: "en", categoryId: "mixed", requestId: "fixture-start", includeEvaluation: true});
    h.session.input("text", "zzzzz"); h.session.input("slot", 0);
    /** Full checkpoint retained before projection. */
    const before = h.session.getSnapshot();
    h.session.hint();
    /** Original event arrives only after its delivery deadline. */
    const command = h.last();
    /** Genuine response was applied by the server before transport lost it. */
    const hint = await authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "authority-hint"});
    h.advance(30000);
    expect(h.session.getSnapshot()).toMatchObject({run: before.run, receivedAtMs: before.receivedAtMs, currentLetters: before.currentLetters,
      activeSlotIndex: 0, penaltyFlash: null, pending: null, error: "RaceTo10.ERROR_GENERIC"});
    h.session.retry();
    /** Old success must not cancel the newer resume deadline or mutate its draft. */
    const recovering = h.session.getSnapshot();
    h.respond("raceHint", hint, command);
    expect(h.session.getSnapshot()).toBe(recovering);
    h.respond("raceResume", await authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, currentLetters: [..."pzzzz"], run: {totalPenaltyMs: 15000}});
    expect(h.commands.filter(command => command.type === "game:requestRaceHint")).toHaveLength(1);
    h.advance(30000);
    expect(h.session.getSnapshot().error).toBeNull();
  });
  it("expires a lost guess confirmation and releases its loader with the submitted draft restored", async () => {
    /** Provisional successor typing cannot strand the player after delivery is lost. */
    const h = await racing();
    h.session.input("text", "piano");
    /** Original solving clock belongs to the submitted question. */
    const before = h.session.getSnapshot();
    h.session.submit(); h.session.input("text", "clock"); h.advance(30000);
    expect(h.session.getSnapshot()).toMatchObject({run: before.run, receivedAtMs: before.receivedAtMs, currentLetters: [..."piano"],
      raceGuesses: [], allowTypingWhilePending: false, pending: null, error: "RaceTo10.ERROR_GENERIC"});
    h.advance(180);
    expect(h.session.getSnapshot().raceGuessLoading).toBe(false);
    h.session.retry();
    expect(h.last().type).toBe("game:resumeRace");
  });
  it("gives chained readiness its own deadline and retries a missing confirmation", async () => {
    /** Readiness may start near the preparation response's original deadline. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.advance(25000);
    /** Authority-issued prepared attempt remains the readiness owner across retry. */
    const run = await fixture(true);
    h.respond("raceStart", {run});
    h.advance(5000);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceReady", error: null});
    h.advance(25000);
    expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", pending: null, error: "RaceTo10.ERROR_GENERIC"});
    h.session.retry();
    expect(h.last()).toMatchObject({type: "game:readyRace", payload: {runId: run.runId}});
    h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: run.serverNowMs + 3000}});
    h.advance(3480);
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", pending: null, error: null});
  });
  it("keeps the original delivery deadline when unrelated or malformed traffic arrives", () => {
    /** Untrusted events cannot keep a lost read alive or consume its timeout. */
    const h = harness();
    h.advance(15000);
    h.session.receive({type: "host:operationResult", requestId: "unrelated", payload: {operation: "raceCategories", ok: true, data: {categories: []}}});
    h.session.receive({type: "host:operationResult", requestId: h.last().requestId, payload: {operation: "raceCategories", ok: "invalid"}});
    h.advance(15000);
    expect(h.session.getSnapshot()).toMatchObject({pending: null, error: "RaceTo10.ERROR_GENERIC"});
    h.session.retry();
    expect(h.last().type).toBe("game:listRaceCategories");
  });
  it.each(["quit", "publication"])("reuses the original %s receipt after its response never arrives", async kind => {
    /** Existing authority mutations recover with their original idempotency identity. */
    const h = kind === "quit" ? await racing() : await recorded();
    if (kind === "quit") {h.session.requestClose(); h.session.abandon();}
    else h.session.publish();
    /** Exact mutation receipt must survive delivery expiry. */
    const original = h.last();
    h.advance(30000);
    expect(h.session.getSnapshot()).toMatchObject({pending: null, error: "RaceTo10.ERROR_GENERIC"});
    h.session.retry();
    expect(h.last()).toEqual(original);
  });
  it("cancels delivery deadlines when account ownership changes or the session closes", () => {
    /** Original account's pending read must never fail a later account's session. */
    const h = harness();
    h.advance(25000); h.session.enter({ownerId: "owner-2", locale: "en"}); h.advance(5000);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceCategories", error: null});
    h.session.dispose();
    expect(h.timers.size).toBe(0);
    h.advance(30000);
    expect(h.session.getSnapshot().error).toBeNull();
  });
  it.each([false, true])("retries rejected start confirmation with the original receipt (challenge=%s)", async challenge => {
    /** Player's exact start selection remains recoverable after failed confirmation. */
    const h = harness();
    h.respond("raceCategories", await catalog());
    h.session.begin("mixed", challenge ? "original-challenge" : undefined);
    /** Original category/challenge and mutation identity. */
    const original = h.last();
    h.reject("raceStart", "Temporary service failure.");
    h.session.retry();
    expect(h.last()).toEqual(original);
    expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", error: null, pending: "raceStart"});
    h.session.retry();
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(2);
    /** Prepared run recovered from the original server request. */
    const run = {...await fixture(true), ...(challenge ? {role: "challenger" as const, challengeId: "original-challenge",
      opponent: {displayName: "Nova", adjustedFinishMs: 60000, events: []}} : {})};
    h.respond("raceStart", {run});
    expect(h.last()).toMatchObject({type: "game:readyRace", payload: {runId: run.runId}});
    expect(h.saved).toEqual([{ownerId: "owner-1", runId: run.runId}]);
  });
  it.each([{categoryId: "history"}, {role: "challenger"}, {locale: "fr"}])("rejects a start response for a different selection and recovers the original receipt: %j", async mismatch => {
    /** Correlated payload must still match the category, role and language requested. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Owned original start receipt and expected prepared response. */
    const original = h.last();
    /** Original prepared run, before a corrupted confirmation changes its metadata. */
    const run = await fixture(true);
    h.respond("raceStart", {run: {...run, ...mismatch}});
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.saved).toEqual([]);
    expect(h.commands.some(command => command.type === "game:readyRace")).toBe(false);
    h.session.retry();
    expect(h.last()).toEqual(original);
    h.respond("raceStart", {run});
    expect(h.last().type).toBe("game:readyRace");
  });
  it("drops failed start recovery when the player deliberately chooses a different race", async () => {
    /** A fresh category choice creates a fresh attempt rather than replaying the old selection. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Receipt from the superseded attempt. */
    const original = h.last();
    h.reject("raceStart", "Temporary service failure.");
    h.session.begin("history");
    expect(h.last()).toMatchObject({type: "game:startRace", payload: {categoryId: "history"}});
    expect(h.last().requestId).not.toBe(original.requestId);
    h.respond("raceStart", {run: await fixture(true)}, original);
    expect(h.session.getSnapshot().run).toBeNull();
  });
  it("invalidates start recovery across account changes and lobby navigation", async () => {
    /** Failed start must not run later under another account or entry intent. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    h.reject("raceStart", "Temporary service failure.");
    h.session.navigate("inbox"); h.respond("raceInbox", {items: []});
    h.session.retry();
    expect(h.last().type).toBe("game:listRaceInbox");
    h.session.enter({ownerId: "owner-2", locale: "en"});
    h.session.retry();
    expect(h.last().type).toBe("game:listRaceCategories");
  });
  it.each(["temporarily-unavailable", "projection-unavailable"] as const)("retries %s with the same receipt after monotonic backoff", async reason => {
    /** Session with controlled transport and monotonic time. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Provider response sequence for this search lifetime. */
    const find = jest.fn<MatchmakingCapability["find"]>()
      .mockResolvedValueOnce({status: "retryable-failure", message: "ignored provider text", failure: raceMatchFailure(reason, 500)})
      .mockResolvedValue({status: "success", value: {status: "matched", challenge: preview(), offerId: "a".repeat(64)}});
    await h.session.findOpponent({find});
    expect(h.session.getSnapshot()).toMatchObject({matchSearchStatus: "failed", matchRetryReady: false, error: "RaceTo10.MATCH_TEMPORARY"});
    h.session.retry(); h.advance(499); h.session.retry();
    expect(find).toHaveBeenCalledTimes(1);
    h.advance(1); h.session.retry(); await settleMatch(h.session);
    expect(find.mock.calls[1][0]).toEqual(find.mock.calls[0][0]);
    expect(h.commands).toHaveLength(1);
    expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", matchSearchStatus: "matched", findingOpponent: false});
    h.session.begin("mixed"); expect(h.last().payload).toMatchObject({offerId: "a".repeat(64)});
  });

  it.each(["intent-expired", "intent-consumed", "search-budget-exceeded", "eligibility-changed"] as const)("rotates a search receipt only when recovery requires it: %s", async reason => {
    /** Session with controlled transport and monotonic time. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Provider response sequence for this search lifetime. */
    const find = jest.fn<MatchmakingCapability["find"]>()
      .mockResolvedValueOnce({status: "retryable-failure", message: "ignored", failure: raceMatchFailure(reason)})
      .mockResolvedValue({status: "success", value: {status: "empty", locale: "en"}});
    await h.session.findOpponent({find}); h.session.retry(); await settleMatch(h.session);
    expect(find.mock.calls[1][0]).not.toEqual(find.mock.calls[0][0]);
    expect(h.session.getSnapshot()).toMatchObject({matchSearchStatus: "empty", error: "RaceTo10.MATCH_EMPTY"});
  });

  it("retries an empty pool with a new intent rather than refreshing the catalog", async () => {
    /** Session with controlled transport and monotonic time. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Provider response sequence for this search lifetime. */
    const find = jest.fn<MatchmakingCapability["find"]>().mockResolvedValue({status: "success", value: {status: "empty", locale: "en"}});
    await h.session.findOpponent({find}); h.session.retry(); await settleMatch(h.session);
    expect(find).toHaveBeenCalledTimes(2);
    expect(find.mock.calls[1][0]).not.toEqual(find.mock.calls[0][0]);
    expect(h.commands).toHaveLength(1);
  });

  it.each(["access-denied", "invalid-request"] as const)("does not replay a terminal matchmaking failure: %s", async reason => {
    /** Session with controlled transport and monotonic time. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Provider response sequence for this search lifetime. */
    const find = jest.fn<MatchmakingCapability["find"]>().mockResolvedValue({status: "terminal-failure", message: "ignored", failure: raceMatchFailure(reason)});
    await h.session.findOpponent({find}); h.advance(60000); h.session.retry();
    expect(find).toHaveBeenCalledTimes(1);
    expect(h.session.getSnapshot()).toMatchObject({matchRetryReady: false, error: "RaceTo10.MATCH_UNAVAILABLE"});
    await h.session.findOpponent({find}); expect(find.mock.calls[1][0]).not.toEqual(find.mock.calls[0][0]);
  });

  it("invalidates search retries on navigation, account and language changes", async () => {
    /** Session with controlled transport and monotonic time. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Provider response sequence for this search lifetime. */
    const find = jest.fn<MatchmakingCapability["find"]>().mockResolvedValue({status: "retryable-failure", message: "legacy failure"});
    await h.session.findOpponent({find}); h.session.navigate("inbox"); h.respond("raceInbox", {items: []});
    await h.session.findOpponent({find}); expect(find.mock.calls[1][0]).not.toEqual(find.mock.calls[0][0]);
    h.session.enter({ownerId: "owner-2", locale: "es", initialCategories: (await catalog()).categories});
    await h.session.findOpponent({find}, "history");
    expect(find.mock.calls[2][0]).toMatchObject({locale: "es", categoryId: "history"});
    expect(find.mock.calls[2][0]).not.toEqual(find.mock.calls[1][0]);
  });

  it.each(["malformed", "wrong-language", "wrong-category", "wrong-empty-language"])("rejects a matchmaking response outside its search contract: %s", async kind => {
    /** Session with controlled transport and monotonic time. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Untrusted candidate response supplied to the session. */
    const value = kind === "malformed" ? {status: "matched"} : kind === "wrong-empty-language" ? {status: "empty", locale: "es"} :
      {status: "matched", offerId: "a".repeat(64), challenge: {...preview(), categoryId: kind === "wrong-category" ? "mixed" : "history", locale: kind === "wrong-language" ? "es" : "en"}};
    /** Provider response sequence for this search lifetime. */
    const find = jest.fn<MatchmakingCapability["find"]>().mockResolvedValue({status: "success", value} as never);
    await h.session.findOpponent({find}, "history");
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", challenge: null, matchFailure: {reason: "invalid-response"}, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    h.session.begin("history"); expect(h.last().payload).not.toHaveProperty("offerId");
  });

  it("recovers thrown provider failures and clears cancelled search intent", async () => {
    /** Session with controlled transport and monotonic time. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Provider response sequence for this search lifetime. */
    const find = jest.fn<MatchmakingCapability["find"]>()
      .mockRejectedValueOnce(Object.assign(new Error("untranslated provider failure"), {code: "unavailable"}))
      .mockResolvedValueOnce({status: "cancelled"})
      .mockResolvedValue({status: "success", value: {status: "empty", locale: "en"}});
    await h.session.findOpponent({find}); h.advance(1000); h.session.retry(); await settleMatch(h.session);
    expect(find.mock.calls[1][0]).toEqual(find.mock.calls[0][0]);
    expect(h.session.getSnapshot()).toMatchObject({error: null, matchSearchStatus: "idle"});
    await h.session.findOpponent({find}); expect(find.mock.calls[2][0]).not.toEqual(find.mock.calls[1][0]);
  });
  it.each(["success", "failure"])("expires an unresolved search, retries the same intent and ignores its late %s", async late => {
    /** Provider can lose a response after the backend has created a replayable offer. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Original adapter callbacks are deliberately retained beyond the client deadline. */
    let resolve!: (value: Awaited<ReturnType<MatchmakingCapability["find"]>>) => void, reject!: (error: Error) => void;
    /** A second provider call recovers the same owned server intent. */
    const find = jest.fn<MatchmakingCapability["find"]>().mockReturnValueOnce(new Promise((yes, no) => {resolve = yes; reject = no;}))
      .mockResolvedValue({status: "success", value: {status: "matched", challenge: preview("recovered-offer"), offerId: "b".repeat(64)}});
    /** Search promises settle even if the provider transport never does. */
    const search = h.session.findOpponent({find}, "mixed");
    h.advance(29999);
    expect(h.session.getSnapshot()).toMatchObject({findingOpponent: true, matchSearchStatus: "searching"});
    h.advance(1); await search;
    expect(h.session.getSnapshot()).toMatchObject({findingOpponent: false, matchSearchStatus: "failed", error: "RaceTo10.MATCH_TEMPORARY", matchRetryReady: false});
    expect(h.timers.size).toBe(0);
    h.session.retry(); h.advance(999); h.session.retry(); expect(find).toHaveBeenCalledTimes(1);
    h.advance(1); h.session.retry(); await settleMatch(h.session);
    expect(find.mock.calls[1][0]).toEqual(find.mock.calls[0][0]);
    expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "recovered-offer", error: null});
    if (late === "success") resolve({status: "success", value: {status: "matched", challenge: preview("stale-offer"), offerId: "a".repeat(64)}});
    else reject(new Error("late provider failure"));
    await Promise.resolve(); await Promise.resolve();
    expect(h.session.getSnapshot()).toMatchObject({activeChallengeId: "recovered-offer", error: null});
    h.session.begin("mixed"); expect(h.last().payload).toMatchObject({offerId: "b".repeat(64)});
  });
  it.each(["navigation", "rematch", "account", "dispose"])("settles and cancels an unresolved search on %s", async ending => {
    /** Lifetime changes must release a wait without needing a provider reply. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Late provider reply still cannot enter another player journey. */
    let resolve!: (value: Awaited<ReturnType<MatchmakingCapability["find"]>>) => void;
    /** In-flight provider adapter deliberately never completes before navigation. */
    const find = jest.fn<MatchmakingCapability["find"]>().mockReturnValue(new Promise(yes => {resolve = yes;}));
    /** Observable search wait is cancelled together with its owned timer. */
    const search = h.session.findOpponent({find});
    if (ending === "navigation") {h.session.navigate("inbox"); h.respond("raceInbox", {items: []});}
    if (ending === "rematch") h.session.rematch();
    if (ending === "account") {h.session.enter({ownerId: "owner-2", locale: "en"}); h.respond("raceCategories", await catalog());}
    if (ending === "dispose") h.session.dispose();
    await search;
    expect(h.timers.size).toBe(0);
    expect(h.session.getSnapshot()).toMatchObject({findingOpponent: false, matchSearchStatus: "idle"});
    resolve({status: "success", value: {status: "matched", challenge: preview("stale-offer")}});
    await Promise.resolve(); await Promise.resolve(); h.advance(60000);
    expect(h.session.getSnapshot()).toMatchObject({findingOpponent: false, challenge: null, error: null});
  });
  it("cancels the discovery deadline when the provider responds normally", async () => {
    /** Normal success must never later become a timeout error. */
    const h = harness(); h.respond("raceCategories", await catalog());
    await h.session.findOpponent({find: async () => ({status: "success", value: {status: "matched", challenge: preview()}})});
    expect(h.timers.size).toBe(0); h.advance(60000);
    expect(h.session.getSnapshot()).toMatchObject({findingOpponent: false, stage: "challenge", error: null});
  });
  it("retains failed startup-resume selection until deliberate reset", () => {
    /** Stale startup hint may already have been replaced by another tab. */
    const h = harness({}, "older-run");
    h.reject("raceResume", "Run no longer exists.");
    expect(h.clearCalls).toEqual([]);
    h.session.retry();
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: "older-run"}});
  });
  it("binds abandonment and completion cleanup to the exact owned run", async () => {
    /** Abandoned authority view must clear only its own hint. */
    const abandoned = await racing();
    abandoned.session.abandon();
    abandoned.respond("raceAbandon", {run: {...abandoned.run, status: "abandoned", currentRiddle: null}, result: null});
    expect(abandoned.clearCalls).toEqual([{ownerId: "owner-1", runId: abandoned.run.runId}]);
    /** Completed authority view remains recoverable until explicitly dismissed. */
    const completed = await racing();
    completed.session.input("text", "piano");
    completed.session.submit();
    completed.respond("raceGuess", {run: withCorrectHistory({...completed.run, status: "completed", correctCount: 10, currentRiddle: null}),
      isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))});
    expect(completed.clearCalls).toEqual([]);
    completed.session.rematch();
    expect(completed.clearCalls).toEqual([{ownerId: "owner-1", runId: completed.run.runId}]);
  });
  it("retries a rejected paid action by refreshing the owned run and merging authoritative hints into the draft", async () => {
    /** Owned active race with a draft at the selected hint slot. */
    const h = await racing();
    h.session.input("text", "zzzzz");
    h.session.input("slot", 0);
    /** Player input before the lost confirmation. */
    const original = h.session.getSnapshot();
    h.session.hint();
    /** Server-applied hint returned by the subsequent recovery read. */
    const applied = authorityClock(structuredClone(h.session.getSnapshot().run!));
    h.reject("raceHint", "Temporary service failure.");
    h.session.retry();
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: h.run.runId, includeEvaluation: true}});
    h.respond("raceResume", {run: applied});
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", run: applied, error: null,
      currentLetters: [applied.currentRiddle!.revealedLetters[0].letter, ...original.currentLetters.slice(1)],
      activeSlotIndex: 1, raceGuesses: original.raceGuesses, pending: null});
  });
  it("keeps the current race and draft when recovery fails, and permits another recovery attempt", async () => {
    /** Owned active race whose recovery transport is unavailable. */
    const h = await racing();
    h.session.input("text", "zzzzz");
    h.session.skip();
    h.reject("raceSkip", "Temporary service failure.");
    /** Restored attempt retained across failed recovery. */
    const before = h.session.getSnapshot();
    /** Persistence writes before the temporary recovery failure. */
    const cleared = h.cleared.length;
    h.session.retry();
    h.reject("raceResume", "Still unavailable.");
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", run: before.run,
      currentLetters: before.currentLetters, receivedAtMs: before.receivedAtMs,
      error: "RaceTo10.ERROR_GENERIC", pending: null});
    expect(h.cleared).toHaveLength(cleared);
    h.session.retry();
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: h.run.runId}});
  });
  it("replaces the attempt when recovery confirms that a lost skip response advanced the question", async () => {
    /** Owned race whose skip was applied before its confirmation was lost. */
    const h = await racing();
    h.session.input("text", "zzzzz");
    h.session.skip();
    /** Complete successor view provided by recovery. */
    const advanced = authorityClock(structuredClone(h.session.getSnapshot().run!));
    // Authority prompts omit the preloaded deck's local-only hint metadata.
    Reflect.deleteProperty(advanced.currentRiddle!, "hint");
    h.reject("raceSkip", "Temporary service failure.");
    h.session.retry();
    h.respond("raceResume", {run: advanced});
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", run: advanced, adjustedNow: advanced.adjustedElapsedMs,
      currentLetters: ["", "", "", "", ""], raceGuesses: [], activeSlotIndex: 0, pending: null, error: null});
  });
  it("carries discovery attribution only into the exact offered challenge and clears it on rematch", async () => {
    /** Provides h behavior. */
    const h = harness();
    h.respond("raceCategories", await catalog());
    /** Provides offer id behavior. */
    const offerId = "a".repeat(64);
    /** Provides adapter behavior. */
    const adapter: MatchmakingCapability = {find: async () => ({status: "success", value: {status: "matched", challenge: preview(), offerId}})};
    await h.session.findOpponent(adapter);
    h.session.begin("mixed");
    expect(h.last().payload).toMatchObject({challengeId: "challenge-1", offerId});
    h.session.rematch();
    h.session.begin("mixed");
    expect(h.last().payload).not.toHaveProperty("offerId");
  });
  it("polls typed waiting readiness with backoff, hidden suspension and immediate visible recovery", () => {
    /** Invitation lifetime independent of provider-specific identifiers. */
    const h = harness({challengeId: "opaque-seat"});
    /** Privacy-safe authority facts anchored to the response clock. */
    const waiting = {status: "waiting", invitation: {claimState: "claimed", publicationState: "pending", role: "recipient", canCancel: false, expiresAtMs: 1000000}, serverNowMs: 10000};
    h.respond("raceEntry", waiting);
    h.advance(999);
    expect(h.commands).toHaveLength(1);
    h.advance(1);
    expect(h.commands).toHaveLength(2);
    h.respond("raceEntry", waiting);
    h.advance(1999);
    expect(h.commands).toHaveLength(2);
    h.advance(1);
    h.respond("raceEntry", waiting);
    h.session.setVisible(false);
    h.advance(10000);
    expect(h.commands).toHaveLength(3);
    h.session.setVisible(true);
    expect(h.commands).toHaveLength(4);
    h.respond("raceEntry", {status: "ready", challenge: preview("opaque-seat"), serverNowMs: 20000});
    h.advance(60000);
    expect(h.commands).toHaveLength(4);
    expect(h.session.getSnapshot().challenge?.challengeId).toBe("opaque-seat");
  });
  it("expires waiting from authority time and cancels only an explicit creator capability", () => {
    /** Creator recovery exposes cancellation while publication is pending. */
    const h = harness({challengeId: "opaque-seat"});
    /** Server deadline is unrelated to the browser wall clock. */
    const invitation = {claimState: "unclaimed", publicationState: "pending", role: "creator", canCancel: true, expiresAtMs: 11000};
    h.respond("raceEntry", {status: "waiting", invitation, serverNowMs: 10000});
    h.session.cancelInvitation();
    expect(h.last().type).toBe("game:cancelRaceInvite");
    expect(h.last().payload).toMatchObject({challengeId: "opaque-seat", requestId: expect.any(String)});
    h.respond("raceInviteCancel", {status: "cancelled", invitation: {...invitation, canCancel: false}, serverNowMs: 10500});
    h.advance(60000);
    expect(h.commands).toHaveLength(2);
    h.session.cancelInvitation();
    expect(h.commands).toHaveLength(2);
    h.session.enter({ownerId: "owner-2", locale: "en", challengeId: "another-seat"});
    h.respond("raceEntry", {status: "waiting", invitation: {...invitation, role: "recipient", canCancel: false}, serverNowMs: 10000});
    h.session.cancelInvitation();
    expect(h.commands).toHaveLength(3);
    h.advance(1000);
    expect(h.session.getSnapshot().entryStatus?.status).toBe("expired");
    expect(h.commands).toHaveLength(3);
  });
  it("does not revive an expired invitation when an earlier polling response arrives late", () => {
    /** Short invitation deadline expires while the next read is in flight. */
    const h = harness({challengeId: "opaque-seat"});
    /** Original authority response remains valid only until its fixed deadline. */
    const waiting = {status: "waiting", invitation: {claimState: "claimed", publicationState: "pending", role: "recipient", canCancel: false, expiresAtMs: 12000}, serverNowMs: 10000};
    h.respond("raceEntry", waiting);
    h.advance(1000);
    expect(h.commands).toHaveLength(2);
    h.advance(1000);
    expect(h.session.getSnapshot().entryStatus?.status).toBe("expired");
    h.respond("raceEntry", {status: "ready", challenge: preview("opaque-seat"), serverNowMs: 11000});
    expect(h.session.getSnapshot()).toMatchObject({entryStatus: {status: "expired"}, challenge: null, pending: null});
    h.advance(60000);
    expect(h.commands).toHaveLength(2);
  });
  it("maps authority diagnostics and provider failures to existing translated errors", () => {
    /** Public session harness for this player journey. */
    const h = harness({challengeId: "challenge-1"});
    h.reject("raceEntry", "Temporary outcome service failure.");
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_GENERIC");
    h.session.retry();
    h.reject("raceEntry", "RaceTo10.ERROR_LOCALE_MISMATCH");
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_LOCALE_MISMATCH");
    h.session.reportError("provider unavailable");
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_GENERIC");
    h.session.reportError(null);
    expect(h.session.getSnapshot().error).toBeNull();
  });
  it("replaces account, locale and deep-link ownership before accepting new receipts", async () => {
    /** Public session harness for this player journey. */
    const h = harness({challengeId: "first"});
    /** Receipt issued by the previous account and entry. */
    const first = h.last();
    h.session.enter({ownerId: "owner-2", locale: "es", challengeId: "second"});
    expect(h.session.getSnapshot()).toMatchObject({activeChallengeId: "second", challenge: null, run: null, outcome: null});
    h.respond("raceEntry", {status: "ready", challenge: preview("first"), serverNowMs: 1000}, first);
    expect(h.session.getSnapshot().challenge).toBeNull();
    h.respond("raceEntry", {status: "ready", challenge: {...preview("second"), locale: "es"}, serverNowMs: 1000});
    expect(h.session.getSnapshot().challenge?.challengeId).toBe("second");
  });
  it("rejects a start receipt whose opponent differs from the invited recording", async () => {
    /** Invitation owns the exact recording expected during preparation. */
    const h = harness({challengeId: "invited-recording"});
    /** Answer-free preview pins the opponent's immutable finish. */
    const invited = preview("invited-recording");
    h.respond("raceEntry", {status: "ready", challenge: invited, serverNowMs: 1000});
    h.session.begin(invited.categoryId);
    /** Matching prepared challenger snapshot supplied after an invalid receipt. */
    const run = {...await fixture(true), role: "challenger" as const, challengeId: invited.challengeId,
      opponent: {displayName: invited.creator.displayName, adjustedFinishMs: invited.adjustedTimeToBeatMs, events: []}};
    h.respond("raceStart", {run: {...run, opponent: {...run.opponent, adjustedFinishMs: invited.adjustedTimeToBeatMs + 1}}});
    expect(h.session.getSnapshot()).toMatchObject({run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    h.session.retry();
    h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({run: {challengeId: invited.challengeId,
      opponent: {adjustedFinishMs: invited.adjustedTimeToBeatMs}}, error: null});
  });
  it("ignores delayed discovery after navigation, disposal and a newer search", async () => {
    /** Public session harness for this player journey. */
    const h = harness();
    h.respond("raceCategories", await catalog());
    /** Deferred provider completions released in a controlled order. */
    const resolutions: Array<(result: Awaited<ReturnType<MatchmakingCapability["find"]>>) => void> = [];
    /** Number of accepted provider discovery requests. */
    let searches = 0;
    /** Provider discovery adapter with manually released results. */
    const adapter: MatchmakingCapability = {find: () => {searches++; return new Promise(resolve => resolutions.push(resolve));}};
    /** Discovery pending before the player navigates away. */
    const old = h.session.findOpponent(adapter);
    await h.session.findOpponent(adapter);
    expect(searches).toBe(1);
    h.session.navigate("inbox");
    h.respond("raceInbox", {items: []});
    h.session.navigate("categories");
    /** Discovery belonging to the current screen. */
    const latest = h.session.findOpponent(adapter);
    resolutions[0]({status: "success", value: {status: "matched", challenge: preview("old")}});
    await old;
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", findingOpponent: true, challenge: null});
    resolutions[1]({status: "success", value: {status: "matched", challenge: preview("new")}});
    await latest;
    expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "new", findingOpponent: false});
    h.session.navigate("categories");
    /** Discovery pending when the player leaves the session. */
    const closed = h.session.findOpponent(adapter);
    h.session.dispose();
    resolutions[2]({status: "success", value: {status: "matched", challenge: preview("closed")}});
    await closed;
    expect(h.session.getSnapshot().challenge).toBeNull();
  });
  it("sequences prepare then ready, rejects pre-start input and recovers a late/background schedule", async () => {
    /** Public session harness for this player journey. */
    const h = harness();
    h.respond("raceCategories", await catalog());
    h.session.begin("mixed");
    /** Complete authority-issued run fixture. */
    const run = await fixture(true);
    h.respond("raceStart", {run});
    expect(h.last().type).toBe("game:readyRace");
    h.session.submit(); h.session.hint(); h.session.skip(); h.session.input("text", "piano");
    expect(h.last().type).toBe("game:readyRace");
    expect(h.session.getSnapshot().currentLetters.join("")).toBe("");
    h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: 13000, serverNowMs: 10000}});
    h.advance(1000);
    expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", countdown: 2, loadingProgress: 100});
    h.advance(3500);
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", run: {status: "active", wallElapsedMs: 1500}, adjustedNow: 1500});
  });
  it("shows the scheduled GO interval without restarting or delaying the authority clock", async () => {
    /** Prepared run receives an immutable scored start from readiness. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Full question deck is loaded before the countdown starts. */
    const run = await fixture(true); h.respond("raceStart", {run});
    h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: 13000, serverNowMs: 10000}});
    h.advance(2999);
    expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", countdown: 1, run: {status: "scheduled"}});
    h.advance(1);
    expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", countdown: 0, run: {status: "active", wallElapsedMs: 0, startsAtMs: 13000}});
    h.advance(179);
    expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", countdown: 0});
    h.session.input("text", "piano"); expect(h.session.getSnapshot().currentLetters.join("")).toBe("");
    h.advance(1);
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", adjustedNow: 180, run: {startsAtMs: 13000}});
    h.session.input("text", "piano"); expect(h.session.getSnapshot().currentLetters.join("")).toBe("piano");
  });
  it("abandons close intent arriving before start without issuing ready or a result", async () => {
    /** Public session harness for this player journey. */
    const h = harness();
    h.respond("raceCategories", await catalog());
    h.session.begin("mixed");
    h.session.requestClose();
    expect(h.session.getSnapshot().closeAfterStart).toBe(true);
    /** Complete authority-issued run fixture. */
    const run = await fixture(true);
    h.respond("raceStart", {run});
    expect(h.last().type).toBe("game:abandonRace");
    expect(h.commands.some(command => command.type === "game:readyRace")).toBe(false);
    h.respond("raceAbandon", {run: {...run, status: "abandoned", currentRiddle: null}, result: null});
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
  });
  it.each([false, true])("recovers lost quit confirmation with its original receipt (prepared=%s)", async prepared => {
    /** Quit can fail while an owned run is prepared or already racing. */
    const h = prepared ? harness() : await racing();
    /** Original authority-issued run, before abandonment is applied. */
    const run = prepared ? await fixture(true) : h.session.getSnapshot().run!;
    if (prepared) {
      h.respond("raceCategories", await catalog());
      h.session.begin("mixed"); h.session.requestClose();
      h.respond("raceStart", {run});
    } else {h.session.requestClose(); h.session.abandon();}
    /** Lost transport confirmation must not generate a new mutation. */
    const original = h.last();
    h.session.dismissQuit();
    if (!prepared) expect(h.session.getSnapshot().quitConfirmationOpen).toBe(true);
    h.reject("raceAbandon", "Temporary service failure.");
    h.advance(10000);
    if (prepared) expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", closeAfterStart: true});
    h.session.retry();
    expect(h.last()).toEqual(original);
    h.session.retry(); h.session.abandon();
    expect(h.commands.filter(command => command.type === "game:abandonRace")).toHaveLength(2);
    h.reject("raceAbandon", "Still unavailable.");
    h.session.retry();
    expect(h.last()).toEqual(original);
    h.respond("raceAbandon", {run: {...run, status: "abandoned", currentRiddle: null}, result: null});
    h.respond("raceAbandon", {run: {...run, status: "abandoned", currentRiddle: null}, result: null}, original);
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
    expect(h.clearCalls).toEqual([{ownerId: "owner-1", runId: run.runId}]);
    expect(h.commands.some(command => command.type === "game:readyRace")).toBe(false);
  });
  it("retains a close request through failed readiness and abandons instead of scheduling again", async () => {
    /** Preparation already owns a run while the ready confirmation is unavailable. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Prepared authority snapshot immediately issues its first readiness command. */
    const run = await fixture(true);
    h.respond("raceStart", {run});
    h.session.requestClose();
    h.reject("raceReady", "Temporary service failure.");
    expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", closeAfterStart: true});
    h.session.retry();
    expect(h.last()).toMatchObject({type: "game:abandonRace", payload: {runId: run.runId}});
    expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(1);
    h.respond("raceAbandon", {run: {...run, status: "abandoned", currentRiddle: null}, result: null});
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
  });
  it("recovers malformed abandonment without consuming the run or emitting a result", async () => {
    /** Correlated receipt carrying an abandoned run for another player journey. */
    const h = await racing();
    h.session.requestClose(); h.session.abandon();
    /** Original mutation identity remains private until recovery is confirmed. */
    const original = h.last();
    h.respond("raceAbandon", {run: {...h.run, runId: "foreign", status: "abandoned", currentRiddle: null}, result: null});
    expect(h.session.getSnapshot()).toMatchObject({run: h.run, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.effects.some(effect => effect.kind === "close")).toBe(false);
    h.session.retry();
    expect(h.last()).toEqual(original);
    h.respond("raceAbandon", {run: {...h.run, status: "abandoned", currentRiddle: null}, result: null});
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
  });
  it.each(["active", "abandoned"] as const)("reads the authoritative %s run when the player withdraws a failed quit", async status => {
    /** Keep playing cannot reverse a quit already applied by the authority. */
    const h = await racing();
    h.session.requestClose(); h.session.abandon();
    h.reject("raceAbandon", "Temporary service failure.");
    h.session.dismissQuit();
    expect(h.session.getSnapshot()).toMatchObject({quitConfirmationOpen: false, closeAfterStart: false, error: null});
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: h.run.runId}});
    expect(h.session.getSnapshot().pending).toBe("raceResume");
    h.respond("raceResume", {run: {...h.run, status, ...(status === "abandoned" ? {currentRiddle: null} : {})}});
    expect(h.session.getSnapshot()).toMatchObject({stage: status === "active" ? "racing" : "categories", pending: null, error: null});
    expect(h.commands.filter(command => command.type === "game:abandonRace")).toHaveLength(1);
    expect(h.effects.some(effect => effect.kind === "close")).toBe(false);
  });
  it("retries failed Keep playing recovery as a read and defers the ghost result until state is known", async () => {
    /** Uncertain abandonment crosses an opponent deadline while read recovery is unavailable. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed", "ghost-challenge");
    /** Challenger whose original quit may already have succeeded. */
    const run = {...await fixture(), challengeId: "ghost-challenge", role: "challenger" as const, opponent: {displayName: "Nova", adjustedFinishMs: 5000, events: []}};
    h.respond("raceStart", {run: authorityClock(run)}); h.advance(3480);
    h.session.requestClose(); h.session.abandon();
    h.reject("raceAbandon", "Temporary service failure.");
    h.session.dismissQuit();
    h.reject("raceResume", "Read recovery unavailable.");
    h.advance(10000);
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", pending: null, outcome: null});
    h.session.retry();
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: run.runId}});
    h.respond("raceResume", {run: {...run, status: "abandoned", currentRiddle: null}});
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", run: null, pending: null});
    expect(h.commands.filter(command => command.type === "game:abandonRace")).toHaveLength(1);
    expect(h.commands.some(command => command.type === "game:getRaceOutcome")).toBe(false);
    expect(h.effects.some(effect => effect.kind === "close" || effect.kind === "outcome")).toBe(false);
  });
  it("invalidates failed abandonment across a changed account lifetime", async () => {
    /** Failed quit remains bound to its original account and run. */
    const h = await racing();
    h.session.abandon();
    /** Late confirmation belongs to the disposed player journey. */
    const original = h.last();
    h.reject("raceAbandon", "Temporary service failure.");
    h.session.enter({ownerId: "owner-2", locale: "en"});
    h.respond("raceAbandon", {run: {...h.run, status: "abandoned", currentRiddle: null}, result: null}, original);
    h.session.retry();
    expect(h.last().type).toBe("game:listRaceCategories");
    expect(h.effects.some(effect => effect.kind === "close")).toBe(false);
  });
  it("keeps a failed quit recoverable when the opponent deadline passes", async () => {
    /** Challenger is quitting while its recorded opponent approaches the deadline. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed", "ghost-challenge");
    /** Authority-issued challenger snapshot whose ghost finishes after five seconds. */
    const run = {...await fixture(), challengeId: "ghost-challenge", role: "challenger" as const, opponent: {displayName: "Nova", adjustedFinishMs: 5000, events: []}};
    h.respond("raceStart", {run: authorityClock(run)}); h.advance(3480);
    h.session.requestClose(); h.session.abandon();
    /** Abandonment may already be applied despite this lost confirmation. */
    const original = h.last();
    h.reject("raceAbandon", "Temporary service failure.");
    h.advance(10000);
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", outcome: null, error: "RaceTo10.ERROR_GENERIC", pending: null});
    expect(h.commands.some(command => command.type === "game:getRaceOutcome")).toBe(false);
    h.session.retry();
    expect(h.last()).toEqual(original);
    h.respond("raceAbandon", {run: {...run, status: "abandoned", currentRiddle: null}, result: null});
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
  });
  it.each([false, true])("restores successor typing after authority confirms a lost correct guess (hint=%s)", async hinted => {
    /** Player has started answering the locally projected successor. */
    const h = await racing();
    /** Independent authority applies the guess before its confirmation is lost. */
    const authority = h.authority;
    await authority.startRace({locale: "en", categoryId: "mixed", requestId: "fixture-start", includeEvaluation: true});
    h.session.input("text", "piano"); h.session.submit();
    h.session.input("text", "zlo"); h.session.input("slot", 0);
    /** Authoritative successor is retained only as proof of question identity. */
    const guessed = await authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "piano", requestId: "authority-guess"});
    if (hinted) await authority.requestRaceHint({runId: h.run.runId, riddleId: guessed.run.currentRiddle!.riddleId, requestId: "other-tab-hint"});
    h.reject("raceGuess", "Temporary service failure.");
    expect(h.session.getSnapshot()).toMatchObject({currentLetters: [..."piano"], run: h.run});
    h.session.retry(); h.reject("raceResume", "Still unavailable."); h.session.retry();
    h.respond("raceResume", await authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, currentLetters: [hinted ? "c" : "z", "l", "o", "", ""],
      activeSlotIndex: hinted ? 3 : 0, raceGuesses: [], run: {correctCount: 1, totalPenaltyMs: hinted ? 15000 : 0}});
    expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(1);
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
  });
  it("retains successor typing across delivery expiry and rejected foreign recovery", async () => {
    /** A deadline can expire after the player has typed into the provisional successor. */
    const h = await racing();
    /** Authority applies the original guess exactly once. */
    const authority = h.authority;
    await authority.startRace({locale: "en", categoryId: "mixed", requestId: "fixture-start", includeEvaluation: true});
    h.session.input("text", "piano"); h.session.submit(); h.session.input("text", "clo");
    await authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "piano", requestId: "authority-guess"});
    h.advance(30000);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_GENERIC", currentLetters: [..."piano"]});
    h.session.retry();
    /** A foreign view cannot consume this run-bound input candidate. */
    const resumed = await authority.resumeRace(h.run.runId);
    h.respond("raceResume", {run: {...resumed.run, runId: "foreign-run"}});
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    h.session.retry(); h.respond("raceResume", resumed);
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: ["c", "l", "o", "", ""], activeSlotIndex: 3, run: {correctCount: 1}});
    expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(1);
  });
  it("distinguishes successor input by position even when a deck repeats a riddle identity", async () => {
    /** Repeated content identity must not confuse the original and projected answer attempts. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Full deck intentionally reuses an identity at the next position. */
    const run = await fixture();
    run.preloadedRiddles![1].riddleId = run.currentRiddle!.riddleId;
    h.respond("raceStart", {run: authorityClock(run)}); h.advance(3480);
    h.session.input("text", "piano"); h.session.submit(); h.session.input("text", "clo");
    /** Server confirms the projected position without relying on content identity alone. */
    const successor = authorityClock(structuredClone(h.session.getSnapshot().run!));
    Reflect.deleteProperty(successor.currentRiddle!, "hint");
    h.reject("raceGuess", "Temporary service failure."); h.session.retry(); h.respond("raceResume", {run: successor});
    expect(h.session.getSnapshot()).toMatchObject({currentLetters: ["c", "l", "o", "", ""], run: {currentRiddle: {position: 1}}});
  });
  it.each(["riddle", "position", "length"])("rejects a resumed successor that conflicts with the immutable deck: %s", async mismatch => {
    /** A provisional successor draft must never attach to a different confirmed question. */
    const h = await racing();
    h.session.input("text", "piano"); h.session.submit(); h.session.input("text", "clo");
    /** Complete projected view, with local-only hint metadata removed for authority transport. */
    const successor = authorityClock(structuredClone(h.session.getSnapshot().run!));
    Reflect.deleteProperty(successor.currentRiddle!, "hint");
    h.reject("raceGuess", "Temporary service failure."); h.session.retry();
    if (mismatch === "riddle") successor.currentRiddle!.riddleId = "different-question";
    if (mismatch === "position") successor.currentRiddle!.position += 1;
    if (mismatch === "length") successor.currentRiddle!.answerLength += 1;
    h.respond("raceResume", {run: successor});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", currentLetters: [..."piano"]});
  });
  it.each(["range", "duplicate"])("retains successor recovery when resume returns %s reveal metadata", async mismatch => {
    /** A failed recovery read must not consume the original input candidate. */
    const h = await racing();
    h.session.input("text", "piano"); h.session.submit(); h.session.input("text", "clo");
    /** Genuine successor context will be available on a later valid authority read. */
    const confirmed = authorityClock(structuredClone(h.session.getSnapshot().run!));
    Reflect.deleteProperty(confirmed.currentRiddle!, "hint");
    h.reject("raceGuess", "Response lost."); h.session.retry();
    /** Structurally valid but incoherent reveals cannot extend or overwrite the draft. */
    const invalid = structuredClone(confirmed);
    invalid.currentRiddle!.revealedLetters = mismatch === "range" ? [{index: 5, letter: "c"}] : [{index: 0, letter: "c"}, {index: 0, letter: "l"}];
    h.respond("raceResume", {run: invalid});
    expect(h.session.getSnapshot()).toMatchObject({currentLetters: [..."piano"], run: h.run, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    h.session.retry(); h.respond("raceResume", {run: confirmed});
    expect(h.session.getSnapshot()).toMatchObject({currentLetters: ["c", "l", "o", "", ""], error: null});
  });
  it.each(["range", "duplicate"])("rolls back a skip before consuming its checkpoint when successor reveals are %s", async mismatch => {
    /** Paid-action input must survive a malformed successor snapshot. */
    const h = await racing(); h.session.input("text", "zi"); h.session.input("slot", 1);
    /** Original authority clock and player input are the rollback checkpoint. */
    const before = h.session.getSnapshot();
    h.session.skip();
    /** Authority advancement is independent of corrupt transport metadata. */
    const confirmed = authorityClock(structuredClone(h.session.getSnapshot().run!));
    Reflect.deleteProperty(confirmed.currentRiddle!, "hint");
    /** Schema-valid reveal set that must be rejected contextually. */
    const invalid = structuredClone(confirmed);
    invalid.currentRiddle!.revealedLetters = mismatch === "range" ? [{index: 5, letter: "c"}] : [{index: 0, letter: "c"}, {index: 0, letter: "l"}];
    h.respond("raceSkip", {run: invalid, penaltyAddedMs: 45000});
    expect(h.session.getSnapshot()).toMatchObject({run: before.run, receivedAtMs: before.receivedAtMs, currentLetters: before.currentLetters,
      activeSlotIndex: 1, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    h.session.retry(); h.respond("raceResume", {run: confirmed});
    expect(h.session.getSnapshot()).toMatchObject({currentLetters: ["", "", "", "", ""], error: null, run: {totalPenaltyMs: 45000}});
    expect(h.commands.filter(command => command.type === "game:skipRaceRiddle")).toHaveLength(1);
  });
  it.each(["start", "ready"])("rejects incoherent reveals before accepting a %s snapshot", async operation => {
    /** Prepared authority views must be coherent before the player can spend a countdown. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Authoritative prepared deck is independent of its corrupted confirmation. */
    const run = await fixture(true);
    if (operation === "ready") h.respond("raceStart", {run});
    /** Original command identity allows recovery of the same owned preparation. */
    const original = h.last();
    /** Out-of-range slots otherwise pass the public transport schema. */
    const invalid = structuredClone(run); invalid.currentRiddle!.revealedLetters = [{index: 5, letter: "p"}];
    h.respond(operation === "start" ? "raceStart" : "raceReady", {run: invalid});
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    expect(h.session.getSnapshot().run).toEqual(operation === "start" ? null : run);
    h.session.retry();
    if (operation === "start") expect(h.last()).toEqual(original);
    else expect(h.last().payload).toMatchObject({runId: run.runId});
  });
  it("keeps the original draft when recovery confirms no advancement and consumes the provisional candidate", async () => {
    /** The original guess may genuinely have failed before authority changed the question. */
    const h = await racing();
    h.session.input("text", "piano"); h.session.submit(); h.session.input("text", "clo");
    /** Later authority view must not resurrect a draft from an earlier recovery lifetime. */
    const successor = authorityClock(structuredClone(h.session.getSnapshot().run!));
    Reflect.deleteProperty(successor.currentRiddle!, "hint");
    h.reject("raceGuess", "Temporary service failure."); h.session.retry(); h.respond("raceResume", {run: h.run});
    expect(h.session.getSnapshot().currentLetters).toEqual([..."piano"]);
    h.session.retry(); h.respond("raceResume", {run: successor});
    expect(h.session.getSnapshot().currentLetters).toEqual(["", "", "", "", ""]);
  });
  it.each(["input", "hint", "rematch", "account"])("invalidates successor recovery after a fresh %s intent", async intent => {
    /** Private successor typing belongs only to the rejected guess's recovery lifetime. */
    const h = await racing();
    h.session.input("text", "piano"); h.session.submit(); h.session.input("text", "clo");
    /** Owned successor returned after the player supersedes the old recovery intent. */
    const successor = authorityClock(structuredClone(h.session.getSnapshot().run!));
    Reflect.deleteProperty(successor.currentRiddle!, "hint");
    h.reject("raceGuess", "Temporary service failure.");
    if (intent === "input") h.session.input("letter", "z");
    if (intent === "hint") {h.session.retry(); h.respond("raceResume", {run: h.run}); h.session.hint(); h.reject("raceHint", "Temporary service failure.");}
    if (intent === "rematch" || intent === "account") {
      if (intent === "account") {h.session.enter({ownerId: "owner-2", locale: "en"}); h.respond("raceCategories", await catalog());}
      else h.session.rematch();
      h.session.begin("mixed"); h.respond("raceStart", {run: h.run}); h.advance(3480);
    }
    h.session.retry(); h.respond("raceResume", {run: successor});
    expect(h.session.getSnapshot().currentLetters).toEqual(["", "", "", "", ""]);
  });
  it("restores submitted input and the original receipt anchor on malformed guess confirmation", async () => {
    /** Public session harness for this player journey. */
    const h = await racing();
    h.session.input("text", "piano");
    /** Rollback checkpoint before the provisional guess. */
    const before = h.session.getSnapshot();
    h.session.submit();
    expect(h.session.getSnapshot().run?.currentRiddle?.position).toBe(1);
    h.session.input("text", "clock");
    h.respond("raceGuess", {run: {invalid: true}});
    expect(h.session.getSnapshot()).toMatchObject({run: before.run, currentLetters: [..."piano"], raceGuesses: [], receivedAtMs: before.receivedAtMs, error: "RaceTo10.ERROR_INVALID_RESPONSE", pending: null});
    h.advance(180);
    expect(h.session.getSnapshot().raceGuessLoading).toBe(false);
  });
  it.each(["successor", "current"])("merges confirmed hints into the %s draft without losing typing or selection", async question => {
    /** Both projected successor input and renewed input on an incorrect attempt are editable. */
    const h = await racing();
    h.session.input("text", question === "successor" ? "piano" : "zzzzz"); h.session.submit();
    h.session.input("text", "zlo"); h.session.input("slot", 0);
    /** Complete server reveal set overrides only the slots fixed by authoritative hints. */
    const confirmed = authorityClock(structuredClone(h.session.getSnapshot().run!));
    if (question === "successor") confirmed.events = withCorrectHistory(confirmed).events;
    else Object.assign(confirmed.currentRiddle!, {guessesUsed: 1, guessesRemaining: 4});
    Reflect.deleteProperty(confirmed.currentRiddle!, "hint");
    confirmed.currentRiddle!.revealedLetters = [{index: 0, letter: question === "successor" ? "c" : "p"}, {index: 3, letter: question === "successor" ? "c" : "n"}];
    h.respond("raceGuess", {run: confirmed, isCorrect: question === "successor", autoSkipped: false,
      feedback: [...(question === "successor" ? "piano" : "zzzzz")].map(letter => ({letter, status: question === "successor" ? "green" : "red"}))});
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: [question === "successor" ? "c" : "p", "l", "o", question === "successor" ? "c" : "n", ""], activeSlotIndex: 4});
    expect(h.session.getSnapshot().raceGuesses).toHaveLength(question === "successor" ? 0 : 1);
    expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(1);
  });
  it("starts a clean attempt when an automatic skip reaches a repeated riddle identity", async () => {
    /** Content identity repeats while the deck position and answer attempt advance. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Final incorrect attempt cannot be locally advanced before its authority confirmation. */
    const run = await fixture();
    run.preloadedRiddles![1].riddleId = run.currentRiddle!.riddleId;
    run.currentRiddle!.guessesUsed = 4; run.currentRiddle!.guessesRemaining = 1;
    h.respond("raceStart", {run: authorityClock(run)}); h.advance(3480);
    h.session.input("text", "zzzzz"); h.session.submit(); h.session.input("text", "abc");
    /** Authority confirms a different attempt even though its content ID is unchanged. */
    const confirmed = projectInstantRaceSkip(run)!;
    confirmed.events = [{sequence: 0, type: "skip", riddlePosition: 0, wallElapsedMs: confirmed.wallElapsedMs,
      penaltyAddedMs: 45000, totalPenaltyMs: 45000, adjustedElapsedMs: confirmed.adjustedElapsedMs, correctCount: 1}];
    Reflect.deleteProperty(confirmed.currentRiddle!, "hint");
    h.respond("raceGuess", {run: confirmed, isCorrect: false, autoSkipped: true, feedback: [..."zzzzz"].map(letter => ({letter, status: "red"}))});
    expect(h.session.getSnapshot()).toMatchObject({currentLetters: ["", "", "", "", ""], activeSlotIndex: 0, raceGuesses: [],
      run: {currentRiddle: {position: 1}, correctCount: 1}, penaltyFlash: "RaceTo10.SKIP_PENALTY", error: null});
  });
  it.each(["position", "length", "riddle"])("rejects guess authority that changes the owned deck prompt: %s", async mismatch => {
    /** Input typed ahead must never attach to a differently shaped authority question. */
    const h = await racing();
    h.session.input("text", "piano"); h.session.submit(); h.session.input("text", "clo");
    /** Confirmed authority question supersedes the local deck prediction. */
    const confirmed = authorityClock(structuredClone(h.session.getSnapshot().run!));
    Reflect.deleteProperty(confirmed.currentRiddle!, "hint");
    if (mismatch === "position") confirmed.currentRiddle!.position += 1;
    if (mismatch === "length") confirmed.currentRiddle!.answerLength += 1;
    if (mismatch === "riddle") confirmed.currentRiddle!.riddleId = "different-riddle";
    h.respond("raceGuess", {run: confirmed, isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", currentLetters: [..."piano"], raceGuesses: []});
  });
  it.each(["range", "duplicate"])("rejects %s guess reveals before consuming the submission checkpoint", async mismatch => {
    /** Malformed authority hints must preserve both rollback and owned successor recovery. */
    const h = await racing();
    h.session.input("text", "piano"); h.session.submit(); h.session.input("text", "clo");
    /** Original valid successor survives transport corruption independently. */
    const confirmed = authorityClock(structuredClone(h.session.getSnapshot().run!));
    Reflect.deleteProperty(confirmed.currentRiddle!, "hint");
    /** Corrupt reveal metadata remains schema-valid but cannot define an editable answer. */
    const invalid = structuredClone(confirmed);
    invalid.currentRiddle!.revealedLetters = mismatch === "range" ? [{index: 5, letter: "c"}] : [{index: 0, letter: "c"}, {index: 0, letter: "l"}];
    h.respond("raceGuess", {run: invalid, isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))});
    expect(h.session.getSnapshot()).toMatchObject({currentLetters: [..."piano"], run: h.run, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    h.session.retry(); h.respond("raceResume", {run: confirmed});
    expect(h.session.getSnapshot()).toMatchObject({currentLetters: ["c", "l", "o", "", ""], error: null});
    expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(1);
  });
  it("keeps successor typing on confirmation and consumes duplicate receipts only once", async () => {
    /** Public session harness for this player journey. */
    const h = await racing();
    h.session.input("text", "piano"); h.session.submit();
    /** Original receipt retained for duplicate and late-response checks. */
    const command = h.last();
    /** Provisional successor used to construct an authority confirmation. */
    const projected = withCorrectHistory(authorityClock(structuredClone(h.session.getSnapshot().run!)));
    // Authority responses omit preloaded-only metadata from the current prompt.
    Reflect.deleteProperty(projected.currentRiddle!, "hint");
    h.session.input("text", "clock");
    /** Authority response confirming the submitted guess. */
    const result = {run: projected, isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))};
    h.respond("raceGuess", result, command);
    expect(h.session.getSnapshot().currentLetters.join("")).toBe("clock");
    /** Accepted immutable snapshot before replaying the receipt. */
    const snapshot = h.session.getSnapshot();
    h.respond("raceGuess", {...result, run: {...projected, correctCount: 9}}, command);
    expect(h.session.getSnapshot()).toBe(snapshot);
  });
  it("rolls paid actions back with the original clock on authority rejection or a wrong-run payload", async () => {
    for (const kind of ["hint", "skip"] as const) {
      /** Public session harness for this player journey. */
      const h = await racing();
      h.session.input("text", "pi");
      h.session.input("slot", 1);
      /** Original authoritative run and receipt-clock checkpoint. */
      const original = h.session.getSnapshot();
      h.session[kind]();
      h.advance(1000);
      if (kind === "hint") h.reject("raceHint", "Rejected");
      else h.respond("raceSkip", {run: {...h.session.getSnapshot().run!, runId: "wrong"}, penaltyAddedMs: 45000});
      expect(h.session.getSnapshot()).toMatchObject({run: original.run, receivedAtMs: original.receivedAtMs, penaltyFlash: null,
        currentLetters: original.currentLetters, activeSlotIndex: original.activeSlotIndex, raceGuesses: original.raceGuesses});
    }
  });
  it.each(["ghost", "timeout"])("accepts a terminal hint receipt and reconciles the %s result once", async ending => {
    /** Challenger remains active until its hint penalty crosses the relevant finish boundary. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed", "ghost-challenge");
    /** Production-shaped owned view near its competitive deadline. */
    const run = {...await fixture(), role: "challenger" as const, challengeId: "ghost-challenge",
      opponent: {displayName: "Nova", adjustedFinishMs: ending === "ghost" ? 10000 : 1800000, events: []}};
    if (ending === "timeout") {
      run.wallElapsedMs = run.rules.maxAdjustedTimeMs - 10000; run.adjustedElapsedMs = run.wallElapsedMs;
      run.opponent.adjustedFinishMs = run.rules.maxAdjustedTimeMs + 60000;
    }
    h.respond("raceStart", {run: authorityClock(run)}); h.advance(3480); h.session.hint();
    /** Correlation remains owned even after a chained outcome command is sent. */
    const hintCommand = h.last();
    /** Terminal views omit the active prompt after the paid event is recorded. */
    const terminal = authorityClock(structuredClone(h.session.getSnapshot().run!));
    terminal.events.push({sequence: terminal.events.length, type: "hint", riddlePosition: run.currentRiddle!.position,
      wallElapsedMs: terminal.wallElapsedMs, adjustedElapsedMs: terminal.adjustedElapsedMs, totalPenaltyMs: terminal.totalPenaltyMs,
      correctCount: terminal.correctCount, penaltyAddedMs: 15000});
    terminal.status = ending === "ghost" ? "completed" : "timed_out"; terminal.currentRiddle = null;
    terminal.wallElapsedMs = Math.max(0, (ending === "ghost" ? run.opponent.adjustedFinishMs : run.rules.maxAdjustedTimeMs) - terminal.totalPenaltyMs);
    terminal.adjustedElapsedMs = terminal.wallElapsedMs + terminal.totalPenaltyMs;
    h.respond("raceHint", {run: terminal, index: 0, revealedLetter: "p"});
    expect(h.session.getSnapshot()).toMatchObject({stage: "result", error: null, run: terminal, pending: "raceOutcome"});
    expect(h.last()).toMatchObject({type: "game:getRaceOutcome", payload: {runId: run.runId}});
    expect(h.effects.filter(effect => effect.kind === "analytics" && effect.event === "race_hint_used")).toHaveLength(1);
    h.respond("raceOutcome", projectRaceOutcome(terminal, terminal.adjustedElapsedMs)!);
    expect(h.session.getSnapshot().outcome?.result).toBe(ending === "ghost" ? "ghost_win" : "timed_out");
    h.respond("raceHint", {run: terminal, index: 0, revealedLetter: "p"}, hintCommand);
    expect(h.commands.filter(command => command.type === "game:getRaceOutcome")).toHaveLength(1);
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
  it.each(["active", "creator", "event", "position", "penalty", "deadline", "index", "count"])("rejects an invalid terminal hint without consuming its rollback: %s", async mismatch => {
    /** A null question is valid only when this owned hint really ended competitive play. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed", "ghost-challenge");
    /** Owned challenger remains safely before its opponent finish until the hint. */
    const run = {...await fixture(), role: "challenger" as const, challengeId: "ghost-challenge",
      opponent: {displayName: "Nova", adjustedFinishMs: 10000, events: []}};
    h.respond("raceStart", {run: authorityClock(run)}); h.advance(3480); h.session.input("text", "zi");
    /** Original authoritative clock and draft must remain recoverable after rejection. */
    const before = h.session.getSnapshot();
    h.session.hint();
    /** Structurally valid receipt that will be corrupted in one contextual invariant. */
    const terminal = authorityClock(structuredClone(h.session.getSnapshot().run!));
    terminal.status = "completed"; terminal.currentRiddle = null;
    terminal.events.push({sequence: 0, type: "hint", riddlePosition: 0, wallElapsedMs: terminal.wallElapsedMs,
      adjustedElapsedMs: terminal.adjustedElapsedMs, totalPenaltyMs: terminal.totalPenaltyMs, correctCount: 0, penaltyAddedMs: 15000});
    if (mismatch === "active") terminal.status = "active";
    if (mismatch === "creator") terminal.role = "creator";
    if (mismatch === "event") terminal.events[0].type = "correct";
    if (mismatch === "position") terminal.events[0].riddlePosition = 1;
    if (mismatch === "penalty") terminal.events[0].penaltyAddedMs = 0;
    if (mismatch === "deadline") terminal.events[0].adjustedElapsedMs = 1000;
    if (mismatch === "count") terminal.events[0].correctCount = 1;
    h.respond("raceHint", {run: terminal, index: mismatch === "index" ? 5 : 0, revealedLetter: "p"});
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", run: before.run, receivedAtMs: before.receivedAtMs,
      currentLetters: before.currentLetters, penaltyFlash: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.commands.some(command => command.type === "game:getRaceOutcome")).toBe(false);
    expect(h.effects.some(effect => effect.kind === "analytics" && effect.event === "race_hint_used")).toBe(false);
  });
  it.each(["letter", "missing", "duplicate", "range", "question", "position", "length"])("rejects an inconsistent hint confirmation and recovers without another charge: %s", async mismatch => {
    /** Public session retains its original draft until a complete receipt validates. */
    const h = await racing();
    /** Matching authority applies one hint before its confirmation is corrupted. */
    const authority = h.authority;
    await authority.startRace({locale: "en", categoryId: "mixed", requestId: "fixture-start", includeEvaluation: true});
    h.session.input("text", "zzzzz"); h.session.input("slot", 0);
    /** Original input and receipt clock must survive rejection. */
    const original = h.session.getSnapshot();
    h.session.hint(); h.advance(1000);
    /** Genuine response remains available for read recovery. */
    const hint = await authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "authority-hint"});
    /** Independent transport payload must not alter the authority's stored view. */
    const corrupted = structuredClone(hint);
    /** Each corruption retains a valid response schema but contradicts the pending question or reveal. */
    const prompt = corrupted.run.currentRiddle!;
    if (mismatch === "letter") corrupted.revealedLetter = "x";
    if (mismatch === "missing") prompt.revealedLetters = [];
    if (mismatch === "duplicate") prompt.revealedLetters.push({...prompt.revealedLetters[0]});
    if (mismatch === "range") prompt.revealedLetters.push({index: prompt.answerLength, letter: "x"});
    if (mismatch === "question") prompt.riddleId = "another-question";
    if (mismatch === "position") prompt.position += 1;
    if (mismatch === "length") prompt.answerLength += 1;
    h.respond("raceHint", corrupted);
    expect(h.session.getSnapshot()).toMatchObject({run: original.run, receivedAtMs: original.receivedAtMs,
      currentLetters: original.currentLetters, activeSlotIndex: original.activeSlotIndex, penaltyFlash: null,
      error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.effects.some(effect => effect.kind === "analytics" && effect.event === "race_hint_used")).toBe(false);
    h.session.retry();
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: h.run.runId}});
    h.respond("raceResume", await authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, currentLetters: [..."pzzzz"], activeSlotIndex: 1,
      run: {totalPenaltyMs: 15000}});
    expect(h.commands.filter(command => command.type === "game:requestRaceHint")).toHaveLength(1);
  });
  it("merges hints confirmed by another tab and moves selection past every revealed slot", async () => {
    /** Public draft is projected against an older authority view. */
    const h = await racing();
    /** Independent authority models hints applied from another tab. */
    const authority = h.authority;
    await authority.startRace({locale: "en", categoryId: "mixed", requestId: "fixture-start", includeEvaluation: true});
    h.session.input("text", "zzzzz"); h.session.input("slot", 0); h.session.hint();
    for (const requestId of ["other-tab-1", "other-tab-2"]) {
      await authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId});
    }
    /** Current receipt contains all three authority-owned reveals. */
    const hint = await authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "current-tab"});
    h.respond("raceHint", hint);
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: [..."piazz"], activeSlotIndex: 3,
      run: {totalPenaltyMs: 45000}});
    h.session.input("letter", "n");
    expect(h.session.getSnapshot().currentLetters).toEqual([..."pianz"]);
  });
  it("validates the hint question when the authority has not supplied a local projection deck", async () => {
    /** Legacy authority view still belongs to a specific question and attempt. */
    const authority = createFakeRaceServices();
    /** No evaluation data means the local hint cannot project a reveal. */
    const {run} = await authority.startRace({locale: "en", categoryId: "mixed", requestId: "legacy-start", includeEvaluation: false});
    /** Public session uses the legacy response without a rollback checkpoint. */
    const h = harness();
    h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.respond("raceStart", {run}); h.advance(3480);
    h.session.input("text", "zzzzz"); h.session.input("slot", 0); h.session.hint();
    expect(h.session.getSnapshot().currentLetters).toEqual([..."zzzzz"]);
    /** Real hint has succeeded, but its confirmation names a different question. */
    const hint = await authority.requestRaceHint({runId: run.runId, riddleId: run.currentRiddle!.riddleId, requestId: "legacy-hint"});
    h.respond("raceHint", {...hint, run: {...hint.run, currentRiddle: {...hint.run.currentRiddle!, riddleId: "another-question"}}});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", currentLetters: [..."zzzzz"], activeSlotIndex: 0});
    h.session.retry(); h.respond("raceResume", await authority.resumeRace(run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: [..."pzzzz"], activeSlotIndex: 1, run: {totalPenaltyMs: 15000}});
  });
  it("confirms a hint without losing unrevealed draft letters, then confirms a skip into a fresh question", async () => {
    /** Public session journey and a matching independent authority adapter. */
    const h = await racing();
    /** Deterministic authority fixture uses the same first owned run as the session harness. */
    const authority = h.authority;
    /** Complete immutable evaluation deck for hint and skip confirmations. */
    const started = await authority.startRace({locale: "en", categoryId: "mixed", requestId: "fixture-start", includeEvaluation: true});
    expect(started.run.runId).toBe(h.run.runId);
    h.session.input("text", "piano");
    h.session.input("slot", 0);
    h.session.hint();
    /** Genuine typed hint response confirms the pending projection. */
    const hint = await authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "authority-hint"});
    h.respond("raceHint", hint);
    expect(h.session.getSnapshot()).toMatchObject({pending: null, currentLetters: [..."piano"], activeSlotIndex: 1,
      penaltyFlash: "RaceTo10.HINT_PENALTY", run: {totalPenaltyMs: 15000}});
    h.session.skip();
    /** Genuine skip response advances the same authority-owned recording. */
    const skip = await authority.skipRaceRiddle({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "authority-skip"});
    h.respond("raceSkip", skip);
    expect(h.session.getSnapshot()).toMatchObject({pending: null, raceGuesses: [], penaltyFlash: "RaceTo10.SKIP_PENALTY",
      run: {currentRiddle: {position: 1}, correctCount: 1, totalPenaltyMs: 60000}});
    expect(h.session.getSnapshot().currentLetters.every(letter => letter === "")).toBe(true);
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
  });
  it("invalidates outcome receipts even when a rematch uses the cached catalog", async () => {
    /** Public session harness for this player journey. */
    const h = await racing();
    /** Complete authority-issued run fixture. */
    const run = withCorrectHistory({...h.run, status: "completed", correctCount: 10, currentRiddle: null});
    h.session.input("text", "piano"); h.session.submit();
    h.respond("raceGuess", {run, isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))});
    expect(h.last().type).toBe("game:getRaceOutcome");
    /** Original receipt retained for duplicate and late-response checks. */
    const command = h.last();
    /** Authority completion for this run. */
    const outcome = projectRaceOutcome(run, run.adjustedElapsedMs)!;
    h.session.rematch();
    h.respond("raceOutcome", outcome, command);
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", run: null, outcome: null, pending: null, raceGuessLoading: false});
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
    expect(h.timers.size).toBe(0);
  });
  it("defers publication until a confirmed outcome and emits downstream completion once", async () => {
    /** Public session harness for this player journey. */
    const h = await racing();
    h.session.input("text", "piano"); h.session.submit();
    /** Complete authority-issued run fixture. */
    const run = withCorrectHistory({...h.run, status: "completed", correctCount: 10, currentRiddle: null});
    h.respond("raceGuess", {run, isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))});
    h.session.publish();
    expect(h.last().type).toBe("game:getRaceOutcome");
    /** Authority completion for this run. */
    const outcome: RaceOutcome = projectRaceOutcome(run, run.adjustedElapsedMs)!;
    h.respond("raceOutcome", outcome);
    expect(h.last().type).toBe("game:publishRace");
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
    h.respond("racePublish", {challengeId: "published", preview: {...preview("published"), adjustedTimeToBeatMs: outcome.adjustedFinishMs}});
    expect(h.effects.filter(effect => effect.kind === "publication")).toEqual([{kind: "publication", publication: h.session.getSnapshot().published, share: true}]);
    h.session.retry(); h.respond("raceOutcome", outcome);
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
  it("retries publication with the original mutation receipt and emits sharing once", async () => {
    /** Recorded result whose server publication succeeded before transport lost confirmation. */
    const h = await recorded();
    h.session.publish();
    /** Original receipt must be reused for authoritative idempotency. */
    const original = h.last();
    h.reject("racePublish", "Temporary service failure.");
    expect(h.session.getSnapshot()).toMatchObject({stage: "result", published: null, publishRequested: false});
    h.session.retry();
    expect(h.last()).toEqual(original);
    h.session.retry(); h.session.publish();
    expect(h.commands.filter(command => command.type === "game:publishRace")).toHaveLength(2);
    h.respond("racePublish", {challengeId: "published", preview: preview("published")}, original);
    h.respond("racePublish", {challengeId: "published", preview: preview("published")}, original);
    expect(h.session.getSnapshot()).toMatchObject({stage: "result", error: null, pending: null, published: {challengeId: "published"}});
    expect(h.effects.filter(effect => effect.kind === "publication")).toEqual([{kind: "publication", publication: h.session.getSnapshot().published, share: true}]);
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
  it.each([
    {challengeId: "foreign"}, {locale: "fr"}, {adjustedTimeToBeatMs: 1}, {categoryId: "history"},
  ])("rejects mismatched publication metadata and permits receipt recovery: %j", async mismatch => {
    /** Valid result must survive malformed publication confirmations. */
    const h = await recorded();
    h.session.publish();
    /** Original command remains owned by this result. */
    const original = h.last();
    h.respond("racePublish", {challengeId: "published", preview: {...preview("published"), ...mismatch}});
    expect(h.session.getSnapshot()).toMatchObject({stage: "result", published: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.effects.some(effect => effect.kind === "publication")).toBe(false);
    h.session.retry();
    expect(h.last()).toEqual(original);
    h.respond("racePublish", {challengeId: "published", preview: preview("published")});
    expect(h.effects.filter(effect => effect.kind === "publication")).toHaveLength(1);
  });
  it.each(["rematch", "dispose"] as const)("invalidates publication recovery and late sharing after %s", async transition => {
    /** Old publication must not escape into a new player journey. */
    const h = await recorded();
    h.session.publish();
    /** Delayed publication receipt. */
    const original = h.last();
    h.reject("racePublish", "Temporary service failure.");
    h.session[transition]();
    h.respond("racePublish", {challengeId: "published", preview: preview("published")}, original);
    h.session.enter();
    h.session.retry();
    expect(h.last().type).toBe("game:listRaceCategories");
    expect(h.effects.some(effect => effect.kind === "publication")).toBe(false);
  });
  it("rejects wrong-run outcomes before presentation and provider effects change", async () => {
    /** Public session harness for this player journey. */
    const h = await racing();
    h.session.input("text", "piano"); h.session.submit();
    /** Completed creator fixture before outcome reconciliation. */
    const completed = withCorrectHistory({...h.run, status: "completed", correctCount: 10, currentRiddle: null});
    h.respond("raceGuess", {run: completed, isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))});
    /** Receipt belonging to the run before rematch. */
    const prior = h.session.getSnapshot().outcome;
    h.respond("raceOutcome", {...prior, runId: "foreign"});
    expect(h.session.getSnapshot().outcome).toEqual(prior);
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
  });
  it("resumes prepared state through ready and refuses foreign resume responses", async () => {
    /** Complete authority-issued run fixture. */
    const run = await fixture(true);
    /** Public session harness for this player journey. */
    const h = harness({}, run.runId);
    h.respond("raceResume", {run});
    expect(h.last().type).toBe("game:readyRace");
    expect(h.saved).toContainEqual({ownerId: "owner-1", runId: run.runId});
    /** Different authority run that must be rejected. */
    const other = harness({}, "owned-run");
    other.respond("raceResume", {run});
    expect(other.session.getSnapshot()).toMatchObject({run: null, stage: "categories", pending: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    other.session.retry();
    expect(other.last()).toMatchObject({type: "game:resumeRace", payload: {runId: "owned-run"}});
  });
});

/** A persisted hint survives replacement sessions while owner/language validation remains active. */
const recoveryHarness = () => {
  /** Journal revision shared across otherwise independent session instances. */
  let record: RaceRecovery | null = null;
  /** Persistence implements owner-bound reads and exact-revision cleanup. */
  const recovery: RaceRecoveryPersistence = {
    read: (owner, locale, now) => parseRaceRecovery(record, owner, locale, now),
    save: value => {record = value;},
    clear: (owner, id) => {if (record?.ownerId === owner && record.id === id) record = null;},
  };
  return {recovery, read: () => record};
};

it("replays the original preparation receipt after reload loses its start confirmation", async () => {
  /** Durable pointer surviving both browser lifetimes. */
  const journal = recoveryHarness();
  /** Fixed wall time prevents retention expiry from obscuring receipt replay. */
  const options = {recovery: journal.recovery, wallNow: () => 1000};
  /** Initial session issues the preparation whose confirmation will be lost. */
  const first = harness({}, null, options);
  first.respond("raceCategories", await catalog());
  first.session.begin("mixed");
  /** Exact original mutation command retained for idempotent replay. */
  const original = first.last();
  expect(journal.read()?.intent.kind).toBe("start");
  first.session.dispose();
  /** Replacement session must recover through the original authority receipt. */
  const reloaded = harness({}, null, options);
  expect(reloaded.last()).toEqual(original);
  reloaded.respond("raceStart", {run: await fixture(true)});
  expect(reloaded.last().type).toBe("game:readyRace");
  expect(journal.read()).toBeNull();
  expect(reloaded.saved).toHaveLength(1);
});

it("restores an invitation only through an authoritative entry read", () => {
  /** Invitation selection persists without storing its authority response. */
  const journal = recoveryHarness();
  /** Shared journal and stable retention clock for the reload. */
  const options = {recovery: journal.recovery, wallNow: () => 1000};
  /** Original invitation visit writes only its selection. */
  const first = harness({challengeId: "invitation"}, null, options);
  first.session.dispose();
  /** Reload obtains readiness exclusively from the authoritative entry read. */
  const reloaded = harness({}, null, options);
  expect(reloaded.last().type).toBe("game:getRaceEntry");
  expect(reloaded.session.getSnapshot().challenge).toBeNull();
  reloaded.respond("raceEntry", {status: "cancelled", serverNowMs: 1000});
  expect(journal.read()).toBeNull();
});

it("retains exact search preferences and remaining retry delay across reload", async () => {
  /** Search receipt and backoff survive replacement sessions. */
  const journal = recoveryHarness();
  /** Wall time advances during browser reload while the session timer restarts. */
  let wall = 1000;
  /** Provider rejects the owned search with explicit same-intent backoff. */
  const find = jest.fn<MatchmakingCapability["find"]>().mockResolvedValue({status: "retryable-failure", failure: raceMatchFailure("temporarily-unavailable", 5000)});
  /** Target adapter remains authenticated across this simulated reload. */
  const adapter = {find};
  /** Reload resolves the current provider and elapsed wall time from adapters. */
  const options = {recovery: journal.recovery, wallNow: () => wall, getMatchmaking: () => adapter};
  /** First session begins the exact category-scoped search. */
  const first = harness({initialCategories: (await catalog()).categories}, null, options);
  await first.session.findOpponent(adapter, "mixed");
  /** Original request identity and preferences cannot change during recovery. */
  const request = find.mock.calls[0][0];
  first.session.dispose();
  wall = 3000;
  /** New monotonic clock honors only the remaining persisted backoff. */
  const reloaded = harness({}, null, options);
  expect(reloaded.last().type).toBe("game:listRaceCategories");
  reloaded.respond("raceCategories", await catalog());
  expect(reloaded.session.getSnapshot().matchRetryReady).toBe(false);
  reloaded.session.retry();
  expect(find).toHaveBeenCalledTimes(1);
  reloaded.advance(3000);
  reloaded.session.retry();
  await settleMatch(reloaded.session);
  expect(find.mock.calls[1][0]).toEqual(request);
});

it("keeps a newer tab's recovery pointer when an older session navigates away", async () => {
  /** Both tabs share one browser journal, with exact-revision cleanup. */
  const journal = recoveryHarness();
  /** Owner, locale and retention clock remain stable across the two tabs. */
  const options = {recovery: journal.recovery, wallNow: () => 1000};
  /** Older tab retains the revision it originally observed. */
  const first = harness({challengeId: "first"}, null, options);
  /** Newer tab owns the replacement invitation pointer. */
  const newer = harness({challengeId: "newer"}, null, options);
  first.session.rematch();
  expect(journal.read()?.intent).toEqual({kind: "challenge", challengeId: "newer"});
  newer.session.dispose();
  expect(harness({ownerId: "different-owner"}, null, options).last().type).toBe("game:listRaceCategories");
  expect(harness({locale: "fr"}, null, options).last().type).toBe("game:listRaceCategories");
});

it("restores an interrupted search and carries its offer through a fresh challenge read", async () => {
  /** Persistent search intent survives a lost provider delivery. */
  const journal = recoveryHarness();
  /** Original provider never returns its owned search result. */
  const originalAdapter = {find: jest.fn<MatchmakingCapability["find"]>().mockImplementation(() => new Promise(() => {}))};
  /** Journal lifetime is independent of either provider adapter. */
  const options = {recovery: journal.recovery, wallNow: () => 1000};
  /** Initial session issues the recorded-match search. */
  const first = harness({initialCategories: (await catalog()).categories}, null, options);
  /** Disposal must settle the caller despite the provider promise remaining unresolved. */
  const pending = first.session.findOpponent(originalAdapter, "mixed");
  /** Idempotent replay retains the entire original request. */
  const originalRequest = originalAdapter.find.mock.calls[0][0];
  first.session.dispose();
  await pending;
  /** Authority-issued offer attribution travels with the recovered selection. */
  const offerId = "a".repeat(64);
  /** Replacement authenticated adapter confirms the original search receipt. */
  const adapter = {find: jest.fn<MatchmakingCapability["find"]>().mockResolvedValue({status: "success", value: {status: "matched", offerId, challenge: preview()}})};
  /** Reload recovers discovery before relying on an authority challenge preview. */
  const reloaded = harness({}, null, {...options, getMatchmaking: () => adapter});
  await settleMatch(reloaded.session);
  expect(adapter.find.mock.calls[0][0]).toEqual(originalRequest);
  reloaded.session.dispose();
  /** Another reload revalidates challenge readiness while preserving the original offer. */
  const offered = harness({}, null, options);
  expect(offered.last().type).toBe("game:getRaceEntry");
  offered.respond("raceEntry", {status: "ready", challenge: preview(), serverNowMs: 1000});
  offered.session.begin("mixed");
  expect(offered.last().payload).toMatchObject({challengeId: "challenge-1", offerId});
});
