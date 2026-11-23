import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness, racing} from "./raceSession.support.ts";

describe("Race Session known event aggregate ownership", () => {
  it.each(["score", "penalty", "wall", "opponent-finish"])("rejects initial history beyond the %s aggregate and recovers original selection", async kind => {
    /** No earlier confirmed history is needed to detect a contradiction within the first view. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed", kind === "opponent-finish" ? "challenge" : undefined);
    /** Original canonical content is independent of a malformed transport history. */
    const canonical = await fixture();
    if (kind === "opponent-finish") {canonical.role = "challenger";canonical.challengeId = "challenge";
      canonical.opponent = {displayName: "Nova", adjustedFinishMs: 60000, events: []};}
    /** Every corruption preserves individually valid event fields and clock arithmetic. */
    const bad = structuredClone(canonical);
    if (kind === "opponent-finish") bad.opponent!.events = [{sequence: 0, type: "correct", riddlePosition: 0,
      wallElapsedMs: 60001, adjustedElapsedMs: 60001, penaltyAddedMs: 0, totalPenaltyMs: 0, correctCount: 1}];
    else {
      bad.events = [{sequence: 0, type: kind === "score" ? "correct" : "hint", riddlePosition: 0,
        wallElapsedMs: bad.wallElapsedMs, adjustedElapsedMs: bad.wallElapsedMs + (kind === "score" ? 0 : 15000),
        penaltyAddedMs: kind === "score" ? 0 : 15000, totalPenaltyMs: kind === "score" ? 0 : 15000, correctCount: kind === "score" ? 1 : 0}];
      if (kind === "wall") {bad.totalPenaltyMs = 15000;bad.adjustedElapsedMs += 15000;
        bad.events[0].wallElapsedMs += 1;bad.events[0].adjustedElapsedMs += 1;}
    }
    h.respond("raceStart", {run: bad});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: null});
    expect(h.saved).toEqual([]);
    h.session.retry();h.respond("raceStart", {run: canonical});h.advance(3480);
    expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "racing", run: {runId: canonical.runId}});
  });
  it.each(["hint", "skip"] as const)("retains %s rollback when its new event exceeds the containing score", async operation => {
    /** Real authority commits one paid action behind corrupted transport evidence. */
    const h = await racing();h.session.input("text", "pi");
    /** The pending paid checkpoint must survive rejection of newly appended history. */
    const original = h.session.getSnapshot();h.session[operation]();
    /** Cloning leaves the canonical recovery view intact. */
    const input = {runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "aggregate-paid"};
    /** New charges and transition are valid; only event score exceeds the whole run. */
    const bad = structuredClone(operation === "hint" ? await h.authority.requestRaceHint(input) : await h.authority.skipRaceRiddle(input));
    bad.run.events[0].correctCount = bad.run.correctCount + 1;
    h.respond(operation === "hint" ? "raceHint" : "raceSkip", bad);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: original.run, currentLetters: original.currentLetters});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: operation === "hint" ? 0 : 1, totalPenaltyMs: operation === "hint" ? 15000 : 45000}});
    expect(h.commands.filter(command => command.type === (operation === "hint" ? "game:requestRaceHint" : "game:skipRaceRiddle"))).toHaveLength(1);
  });
});
