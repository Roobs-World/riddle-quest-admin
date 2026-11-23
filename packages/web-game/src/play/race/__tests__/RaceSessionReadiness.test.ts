import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "./raceSession.support";

// Readiness may recover a scheduled or finished run, but cannot remain preparation.
describe("Race Session readiness response ownership", () => {
  it.each(["start", "resume", "retry"])("rejects an unchanged prepared reply after %s without automatically requesting again", async entry => {
    /** Immutable prepared authority state retained across explicit recovery. */
    const run = await fixture(true);
    /** Initial start and saved-run recovery both legitimately chain one readiness request. */
    const h = entry === "resume" ? harness({}, run.runId) : harness();
    if (entry === "resume") h.respond("raceResume", {run});
    else {h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.respond("raceStart", {run});}
    if (entry === "retry") {h.reject("raceReady", "lost-ready"); h.session.retry();}
    /** Matching response must be consumed once without creating a replacement command. */
    const command = h.last(), before = h.session.getSnapshot(), count = h.commands.length;
    h.respond("raceReady", {run}, command);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", pending: null,
      run: before.run, receivedAtMs: before.receivedAtMs, stage: "countdown"});
    expect(h.commands).toHaveLength(count);
    /** Duplicate deliveries cannot clear the error, restart its timer or silently retry. */
    const rejected = h.session.getSnapshot(); h.respond("raceReady", {run}, command);
    expect(h.session.getSnapshot()).toBe(rejected);
    h.advance(60000); expect(h.commands).toHaveLength(count);
    expect(h.session.getSnapshot()).toMatchObject({pending: null, run: {status: "prepared"}, stage: "countdown"});
    h.session.retry();
    expect(h.last()).toMatchObject({type: "game:readyRace", payload: {runId: run.runId}});
    expect(h.commands).toHaveLength(count + 1);
    /** Valid confirmation schedules the original deck rather than starting a new attempt. */
    const scheduled = {...run, status: "scheduled" as const, startsAtMs: run.serverNowMs! + 3000};
    h.respond("raceReady", {run: scheduled}); h.advance(3480);
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, stage: "racing", run: {runId: run.runId, status: "active"}});
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(entry === "resume" ? 0 : 1);
  });
  it("retains a pending close after an invalid readiness phase until explicit recovery confirms the owned run", async () => {
    /** Closing during initial preparation awaits a valid authority reply before abandonment. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Original deck is recoverable even when its readiness confirmation is malformed. */
    const run = await fixture(true); h.respond("raceStart", {run}); h.session.requestClose();
    /** A prepared echo must not consume close intent or initiate a different mutation. */
    const count = h.commands.length; h.respond("raceReady", {run});
    expect(h.session.getSnapshot()).toMatchObject({pending: null, error: "RaceTo10.ERROR_INVALID_RESPONSE", closeAfterStart: true, run});
    expect(h.commands).toHaveLength(count);
    h.session.retry();
    expect(h.last().type).toBe("game:abandonRace");
    h.respond("raceAbandon", {run: {...run, status: "abandoned", currentRiddle: null}, result: null});
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
  });
  it.each(["scheduled", "active", "completed", "timed_out", "abandoned"] as const)("accepts valid %s readiness recovery without automatically repeating readiness", async status => {
    /** A delayed readiness reply may already expose another tab's progress or expiry. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Owned preparation supplies the immutable deck and one authority clock. */
    const prepared = await fixture(true); h.respond("raceStart", {run: prepared});
    /** Real readiness is allowed to resolve to scheduling, scoring or terminal recovery. */
    const run = {...prepared, status, startsAtMs: prepared.serverNowMs! + 3000};
    run.serverNowMs = status === "scheduled" || status === "abandoned" ? prepared.serverNowMs! + 1000 :
      run.startsAtMs + (status === "timed_out" ? run.rules.maxAdjustedTimeMs : 1000);
    run.wallElapsedMs = status === "scheduled" || status === "abandoned" ? 0 : run.serverNowMs - run.startsAtMs;
    run.adjustedElapsedMs = run.wallElapsedMs;
    if (["completed", "timed_out", "abandoned"].includes(status)) run.currentRiddle = null;
    if (status === "completed") run.correctCount = run.rules.targetCorrect;
    /** Only explicit recovery or readiness itself may schedule the next command. */
    const count = h.commands.filter(command => command.type === "game:readyRace").length;
    h.respond("raceReady", {run});
    expect(h.session.getSnapshot().error).toBeNull();
    expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(count);
    if (status === "abandoned") expect(h.session.getSnapshot()).toMatchObject({stage: "categories", run: null, pending: null});
    else if (["completed", "timed_out"].includes(status)) expect(h.session.getSnapshot()).toMatchObject({stage: "result", pending: "raceOutcome", run});
    else expect(h.session.getSnapshot()).toMatchObject({stage: status === "scheduled" ? "countdown" : "racing", pending: null, run});
  });
});
