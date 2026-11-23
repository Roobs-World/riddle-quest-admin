import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness, racing} from "./raceSession.support.ts";

describe("Race Session paid-action confirmation evidence", () => {
  it.each([["hint", "missing-charge"], ["skip", "missing-charge"], ["hint", "wrong-question"], ["skip", "wrong-question"], ["skip", "unchanged-question"], ["skip", "unchanged-score"]] as const)("rejects a %s confirmation with %s evidence", async (operation, corruption) => {
    /** A real authority checkpoint exists before the provisional paid action. */
    const h = await racing(), before = h.session.getSnapshot();h.session[operation]();
    /** Authority performs the mutation independently of the malformed transport response. */
    const input = {runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: `paid-${operation}-receipt`};
    /** Both genuine response variants retain their distinct result metadata. */
    const response = operation === "hint" ? await h.authority.requestRaceHint(input) : await h.authority.skipRaceRiddle(input);
    if (corruption === "missing-charge") {
      response.run.totalPenaltyMs = before.run!.totalPenaltyMs;
      response.run.adjustedElapsedMs = response.run.wallElapsedMs + response.run.totalPenaltyMs;
      response.run.events = [...before.run!.events];
    } else if (corruption === "unchanged-question") response.run.currentRiddle = structuredClone(before.run!.currentRiddle);
    else if (corruption === "unchanged-score") {
      response.run.correctCount = before.run!.correctCount;
      response.run.events = response.run.events.map(event => ({...event, correctCount: before.run!.correctCount}));
    } else response.run.events = response.run.events.map(event => ({...event, riddlePosition: 1}));
    h.respond(operation === "hint" ? "raceHint" : "raceSkip", response);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: before.run});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {totalPenaltyMs: operation === "hint" ? h.run.rules.hintPenaltyMs : h.run.rules.skipPenaltyMs}});
  });
  it.each(["completed", "timed_out"] as const)("accepts a charged skip that legitimately ends the run as %s", async status => {
    /** Challenger identity is established by its original direct challenge intent. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed", "paid-terminal");
    /** Ghost expiry and the adjusted-time cap provide distinct terminal boundaries. */
    const run = {...await fixture(), role: "challenger" as const, challengeId: "paid-terminal",
      opponent: {displayName: "Nova", adjustedFinishMs: status === "completed" ? 10000 : 400000, events: []}};
    h.respond("raceStart", {run});h.advance(3480);h.session.skip();
    /** Canonical paid event retains its original question even when no successor is editable. */
    const wall = status === "completed" ? 0 : run.rules.maxAdjustedTimeMs - run.rules.skipPenaltyMs;
    /** Terminal authority snapshot is internally coherent and includes the original skip charge. */
    const terminal = {...run, status, correctCount: 1, currentRiddle: null, wallElapsedMs: wall,
      serverNowMs: run.startsAtMs! + wall, totalPenaltyMs: run.rules.skipPenaltyMs, adjustedElapsedMs: wall + run.rules.skipPenaltyMs,
      events: [{sequence: 0, type: "skip" as const, riddlePosition: 0, wallElapsedMs: wall, penaltyAddedMs: run.rules.skipPenaltyMs,
        totalPenaltyMs: run.rules.skipPenaltyMs, adjustedElapsedMs: wall + run.rules.skipPenaltyMs, correctCount: 1}]};
    h.respond("raceSkip", {run: terminal, penaltyAddedMs: run.rules.skipPenaltyMs});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {status, currentRiddle: null}, stage: "result", pending: "raceOutcome"});
  });

  it("returns to the lobby when another tab abandons after the skip commits", async () => {
    /** Paid mutation belongs to the original active authority checkpoint. */
    const h = await racing();h.session.skip();
    /** The mutation's response is delivered after another tab's authoritative abandonment. */
    const response = await h.authority.skipRaceRiddle({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "skip-before-abandon"});
    await h.authority.abandonRace({runId: h.run.runId, requestId: "other-tab-abandon"});
    response.run = (await h.authority.resumeRace(h.run.runId)).run;
    h.respond("raceSkip", response);
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", run: null, outcome: null, pending: null, error: null});
    expect(h.commands.filter(command => command.type === "game:getRaceOutcome")).toHaveLength(0);
    h.session.begin("mixed");expect(h.last().type).toBe("game:startRace");
  });

  it("does not overwrite an account installed while clearing a cross-tab abandoned run", async () => {
    /** A real skip commits before its final canonical view is delivered. */
    const h = await racing();h.session.skip();
    /** Server history still carries the accepted skip after abandonment. */
    const response = await h.authority.skipRaceRiddle({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "skip-before-replacement"});
    await h.authority.abandonRace({runId: h.run.runId, requestId: "abandon-before-replacement"});
    response.run = (await h.authority.resumeRace(h.run.runId)).run;
    /** Replacement occurs specifically during the new lobby transition. */
    let changed = false;
    /** Synchronous account observers own their replacement pending delivery. */
    const unsubscribe = h.session.subscribe(() => {
      if (!changed && h.session.getSnapshot().stage === "categories" && !h.session.getSnapshot().run) {
        changed = true;h.session.enter({locale: "en", ownerId: "owner-2"});
      }
    });
    h.respond("raceSkip", response);unsubscribe();
    expect(changed).toBe(true);
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", run: null, pending: "raceCategories", error: null});
    expect(h.last().type).toBe("game:listRaceCategories");
    expect(h.timers.size).toBe(1);
  });

});
