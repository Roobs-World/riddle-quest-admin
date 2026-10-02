import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "./raceSession.support";

describe("Race Session unscored response recovery", () => {
  it.each(["start", "resume", "ready"] as const)("rejects pre-start attempts on %s without pinning fabricated progress", async entry => {
    /** The real authority issues an untouched preparation deck. */
    const run = await fixture(true);
    /** Initial saved-run recovery has no confirmed in-memory authority yet. */
    const h = entry === "resume" ? harness({}, run.runId) : harness();
    if (entry !== "resume") {h.respond("raceCategories", await catalog()); h.session.begin("mixed");}
    if (entry === "ready") h.respond("raceStart", {run});
    /** Scheduling changes only phase and its fixed start, never attempts or hints. */
    const valid = entry === "ready" ? {...run, status: "scheduled" as const, startsAtMs: run.serverNowMs! + 3000} : run;
    /** A forged attempted question otherwise preserves clock, deck and identity. */
    const bad = {...valid, currentRiddle: {...valid.currentRiddle!, guessesUsed: 1, guessesRemaining: 4}};
    /** Rejection leaves all confirmed facts and persistence writes untouched. */
    const before = h.session.getSnapshot(), saved = h.saved.length, count = h.commands.length, command = h.last();
    h.respond(entry === "start" ? "raceStart" : entry === "resume" ? "raceResume" : "raceReady", {run: bad});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", pending: null, run: before.run});
    expect(h.commands).toHaveLength(count); expect(h.saved).toHaveLength(saved);
    /** Duplicate corrupt receipts cannot clear the recoverable error. */
    const rejected = h.session.getSnapshot();
    h.respond(entry === "start" ? "raceStart" : entry === "resume" ? "raceResume" : "raceReady", {run: bad}, command);
    expect(h.session.getSnapshot()).toBe(rejected);
    h.session.retry();
    expect(h.last().type).toBe(entry === "start" ? "game:startRace" : entry === "resume" ? "game:resumeRace" : "game:readyRace");
    h.respond(entry === "start" ? "raceStart" : entry === "resume" ? "raceResume" : "raceReady", {run: valid});
    if (entry !== "ready") h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: run.serverNowMs! + 3000}});
    h.advance(3480);
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, stage: "racing",
      run: {runId: run.runId, correctCount: 0, totalPenaltyMs: 0, currentRiddle: {position: 0, guessesUsed: 0}}});
  });
});
