import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "./raceSession.support";

describe("Race Session synchronous transport failure", () => {
  it("preserves an accepted prepared run when its chained readiness delivery throws", async () => {
    /** Only readiness transport fails; the start reply is already authoritative. */
    let failReady = true;
    /** Controlled host adapter throws while the session applies a valid start reply. */
    const h = harness({}, null, {postToHost: message => {
      if (failReady && message.type === "game:readyRace") throw new Error("bridge-unavailable");
    }});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Canonical issued deck must survive failure of a separate follow-up command. */
    const run = await fixture(true); h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({run, stage: "countdown", pending: null, error: "RaceTo10.ERROR_GENERIC"});
    expect(h.saved).toEqual([{ownerId: "owner-1", runId: run.runId}]);
    expect(h.effects.filter(effect => effect.kind === "analytics" && effect.event === "race_started")).toHaveLength(1);
    failReady = false; h.session.retry();
    expect(h.last()).toMatchObject({type: "game:readyRace", payload: {runId: run.runId}});
    h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: run.serverNowMs! + 3000}}); h.advance(3480);
    expect(h.session.getSnapshot()).toMatchObject({run: {runId: run.runId}, stage: "racing", pending: null, error: null});
    h.advance(30000); expect(h.session.getSnapshot().error).toBeNull();
  });
  it("contains a failed start delivery and reuses its mutation receipt on explicit retry", async () => {
    /** Delivery may throw before or after the host received a start mutation. */
    let failStart = true;
    /** Correlation makes the transport error recoverable without creating another attempt. */
    const h = harness({}, null, {postToHost: message => {
      if (failStart && message.type === "game:startRace") throw new Error("bridge-unavailable");
    }});
    h.respond("raceCategories", await catalog());
    expect(() => h.session.begin("mixed")).not.toThrow();
    /** Original idempotency receipt is the only safe start retry identity. */
    const original = h.last();
    expect(h.session.getSnapshot()).toMatchObject({run: null, stage: "categories", pending: null, error: "RaceTo10.ERROR_GENERIC"});
    failStart = false; h.session.retry();
    expect(h.last()).toMatchObject({type: "game:startRace", requestId: original.requestId, payload: original.payload});
    h.respond("raceStart", {run: await fixture(true)});
    expect(h.session.getSnapshot()).toMatchObject({run: {status: "prepared"}, pending: "raceReady", error: null});
  });
  it.each(["hint", "skip", "submit"] as const)("restores owned input and clocks when %s transport throws", async operation => {
    /** Failure occurs after provisional state is prepared, before any confirmation is consumed. */
    const h = harness({}, null, {postToHost: message => {
      if (["game:requestRaceHint", "game:skipRaceRiddle", "game:submitRaceGuess"].includes(message.type)) throw new Error("bridge-unavailable");
    }});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Valid active authority enables the real optimistic action path. */
    const run = await fixture(); h.respond("raceStart", {run}); h.advance(3480); h.session.input("text", "piano");
    /** Input, question and authority clock all belong to the same pre-action checkpoint. */
    const before = h.session.getSnapshot();
    expect(() => h.session[operation]()).not.toThrow();
    expect(h.session.getSnapshot()).toMatchObject({run: before.run, currentLetters: before.currentLetters,
      receivedAtMs: before.receivedAtMs, raceGuesses: before.raceGuesses, pending: null, error: "RaceTo10.ERROR_GENERIC"});
    h.session.retry(); expect(h.last().type).toBe("game:resumeRace");
    h.respond("raceResume", {run});
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, currentLetters: before.currentLetters});
    expect(h.commands.filter(command => ["game:requestRaceHint", "game:skipRaceRiddle", "game:submitRaceGuess"].includes(command.type))).toHaveLength(1);
  });
  it("ignores an adapter throw after synchronous confirmation while preserving the chained command", async () => {
    /** Original response is valid even when the delivering adapter throws after dispatch. */
    const run = await fixture(true);
    /** Adapter callbacks run only after this public harness has been assigned. */
    let h: ReturnType<typeof harness>;
    h = harness({}, null, {postToHost: message => {
      if (message.type === "game:startRace") {
        h.respond("raceStart", {run}, message);
        throw new Error("adapter-failed-after-delivery");
      }
    }});
    h.respond("raceCategories", await catalog());
    expect(() => h.session.begin("mixed")).not.toThrow();
    expect(h.session.getSnapshot()).toMatchObject({run, pending: "raceReady", error: null, stage: "countdown"});
    expect(h.last().type).toBe("game:readyRace");
    h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: run.serverNowMs! + 3000}}); h.advance(3480);
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, stage: "racing"});
  });
  it.each(["throw", "timeout"])("does not apply an old delivery %s to a newer retry using the same mutation receipt", async failure => {
    /** Retried start deliberately shares its idempotency ID but owns a different delivery. */
    let first = true;
    /** Reentrant transport may dispatch a failure then throw after explicit retry starts. */
    let h: ReturnType<typeof harness>;
    h = harness({}, null, {postToHost: message => {
      if (failure === "throw" && first && message.type === "game:startRace") {
        first = false; h.reject("raceStart", "delivery-rejected", message); h.session.retry();
        throw new Error("original-delivery-failed-after-retry");
      }
    }});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** A cancelled deadline can already be queued by an injected timer adapter. */
    const oldTimer = [...h.timers.values()].find(timer => timer.at === 30000);
    if (failure === "timeout") {h.reject("raceStart", "delivery-rejected"); h.session.retry(); oldTimer!.callback();}
    /** The old delivery must not consume or reject the newer owned attempt. */
    const starts = h.commands.filter(command => command.type === "game:startRace");
    expect(starts).toHaveLength(2); expect(starts[0].requestId).toBe(starts[1].requestId);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceStart", error: null, run: null});
    h.respond("raceStart", {run: await fixture(true)}, starts[1]);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceReady", error: null, run: {status: "prepared"}});
    expect(h.timers.size).toBe(1);
    h.session.dispose(); expect(h.timers.size).toBe(0);
  });
});
