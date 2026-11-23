import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "./raceSession.support";

describe("Countdown clock ownership", () => {
  it.each(["early", "late", "server", "receipt", "omitted", "valid"])("preserves the confirmed schedule after %s public edits", async mode => {
    /** Readiness confirms a three-second schedule on the session's monotonic receipt anchor. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Preparation has no scored clock until the ready response arrives. */
    const prepared = await fixture(true); h.respond("raceStart", {run: prepared});
    h.respond("raceReady", {run: {...prepared, status: "scheduled", startsAtMs: 13000, serverNowMs: 10000}});
    /** Retained rendering references cannot alter the confirmed start or receipt timing. */
    const state = h.session.getSnapshot();
    if (mode === "early") state.run!.startsAtMs = 9000;
    if (mode === "late") state.run!.startsAtMs = 130000;
    if (mode === "server") state.run!.serverNowMs = 20000;
    if (mode === "receipt") state.receivedAtMs = -10000;
    if (mode === "omitted") {delete state.run!.startsAtMs; delete state.run!.serverNowMs;}
    h.advance(1000);
    expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", countdown: 2});
    h.advance(2180);
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", adjustedNow: 180,
      run: {startsAtMs: 13000, status: "active", wallElapsedMs: 180}});
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(1);
  });
  it("keeps published GO content independent of the private scheduled deck", async () => {
    /** Local schedule activation publishes editable presentation objects without transferring authority. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** The same deck must remain canonical throughout the GO display interval. */
    const run = await fixture(true); h.respond("raceStart", {run});
    h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: 13000, serverNowMs: 10000}});
    h.advance(3000); h.session.getSnapshot().run!.preloadedRiddles![0].text = "Changed public content";
    h.advance(180);
    expect(h.session.getSnapshot().run!.preloadedRiddles![0].text).toBe(run.preloadedRiddles![0].text);
  });
});
