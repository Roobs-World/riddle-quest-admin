import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness, racing} from "./raceSession.support.ts";

/** A recorded rival cannot be attached to a creator's own recording. */
const opponent = {displayName: "Nova", adjustedFinishMs: 60000, events: []};

describe("Creator opponent authority", () => {
  it("rejects an opponent introduced by readiness and accepts a clean retry", async () => {
    /** Prepared creator owns no competitive target. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Server preparation remains canonical before readiness introduces contradictory facts. */
    const run = await fixture(true); h.respond("raceStart", {run});
    h.respond("raceReady", {run: {...run, status: "active", opponent}});
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    expect(h.session.getSnapshot().run?.opponent).toBeUndefined();
    h.session.retry(); h.respond("raceReady", {run: {...run, status: "active"}});
    expect(h.session.getSnapshot().error).toBeNull();
  });
  it("rejects a later opponent even when the public view was rewritten", async () => {
    /** Confirmed creator facts remain private across mutable rendering. */
    const h = await racing(); h.session.getSnapshot().run!.opponent = opponent;
    h.session.retry(); h.respond("raceResume", {run: {...h.run, opponent}});
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    h.session.retry(); h.respond("raceResume", {run: h.run});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {role: "creator"}});
    expect(h.session.getSnapshot().run?.opponent).toBeUndefined();
  });
  it.each([false, true])("validates cold creator recovery with opponent=%s", async invalid => {
    /** Cold resume has no previous in-memory run contract. */
    const run = await fixture(true), h = harness({}, run.runId);
    h.respond("raceResume", {run: {...run, ...(invalid ? {opponent} : {})}});
    if (invalid) {expect(h.session.getSnapshot()).toMatchObject({run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"}); expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(0);}
    else {expect(h.session.getSnapshot().error).toBeNull(); expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(1);}
  });
  it("allows an omitted legacy challenger opponent to arrive on later recovery", async () => {
    /** Optional legacy challenger details may become available without changing creator semantics. */
    const run = {...await fixture(), role: "challenger" as const, challengeId: "legacy"}, h = harness({}, run.runId);
    h.respond("raceResume", {run}); h.session.retry(); h.respond("raceResume", {run: {...run, opponent}});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {role: "challenger", opponent}});
  });
});
