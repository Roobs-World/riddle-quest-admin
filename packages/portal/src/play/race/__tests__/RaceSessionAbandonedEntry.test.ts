import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness, preview} from "./raceSession.support";

/** Creates a canonical abandoned run without gameplay mutation effects. */
const abandoned = async () => ({...await fixture(true), status: "abandoned" as const, currentRiddle: null});

describe("abandoned entry returns to a usable multiplayer hub", () => {
  it.each(["start", "resume", "ready"])("loads missing categories after abandoned %s recovery", async operation => {
    /** Entry recovery starts without any previously loaded catalog. */
    const run = await abandoned(), h = harness({}, operation === "start" ? null : run.runId);
    if (operation === "start") {h.respond("raceCategories", {categories: [], rules: run.rules}); h.session.begin("mixed");}
    else if (operation === "ready") h.respond("raceResume", {run: {...run, status: "prepared", currentRiddle: (await fixture(true)).currentRiddle}});
    h.respond(operation === "start" ? "raceStart" : operation === "ready" ? "raceReady" : "raceResume", {run});
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", run: null, pending: "raceCategories", error: null, activeChallengeId: undefined});
    expect(h.last().type).toBe("game:listRaceCategories");
    h.respond("raceCategories", await catalog());
    expect(h.session.getSnapshot()).toMatchObject({pending: null, error: null});
    expect(h.session.getSnapshot().categories.length).toBeGreaterThan(0);
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(operation === "start" ? 1 : 0);
    expect(h.commands.filter(command => command.type === "game:abandonRace")).toHaveLength(0);
  });
  it.each(["start", "ready"])("clears an abandoned challenge before a new selection after %s", async operation => {
    /** Previously selected challenge metadata must not enter a new creator run. */
    const run = {...await fixture(true), role: "challenger" as const, challengeId: "challenge-1", opponent: {displayName: "Nova", adjustedFinishMs: 60000, events: []}};
    /** This challenge is loaded through its normal authoritative entry response. */
    const h = harness({challengeId: run.challengeId}); h.respond("raceEntry", {status: "ready", challenge: preview(run.challengeId), serverNowMs: run.serverNowMs}); h.session.begin("mixed");
    if (operation === "ready") h.respond("raceStart", {run});
    h.respond(operation === "start" ? "raceStart" : "raceReady", {run: {...run, status: "abandoned", currentRiddle: null}});
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceCategories", activeChallengeId: undefined, challenge: null, entryStatus: null});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    expect(h.last()).toMatchObject({type: "game:startRace", payload: {categoryId: "mixed"}});
    expect(h.last().payload).not.toHaveProperty("challengeId"); expect(h.last().payload).not.toHaveProperty("rivalryChallengeId");
  });
  it.each(["start", "resume", "ready"])("recovers a rejected catalog read after %s without repeating abandonment", async operation => {
    /** Optional presentation delivery may fail after terminal cleanup has succeeded. */
    const run = await abandoned(), h = harness({}, operation === "start" ? null : run.runId);
    if (operation === "start") {h.respond("raceCategories", {categories: [], rules: run.rules}); h.session.begin("mixed");}
    else if (operation === "ready") h.respond("raceResume", {run: {...run, status: "prepared", currentRiddle: (await fixture(true)).currentRiddle}});
    /** Capture the consumed receipt before its catalog follow-up. */
    const original = h.last(), response = operation === "start" ? "raceStart" : operation === "ready" ? "raceReady" : "raceResume", count = h.commands.length;
    h.respond(response, {run}); h.reject("raceCategories", "temporary unavailable");
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", run: null, pending: null});
    h.session.retry(); expect(h.last().type).toBe("game:listRaceCategories"); h.respond("raceCategories", await catalog());
    /** An already-consumed terminal response cannot reset the freshly loaded hub. */
    const recovered = h.session.getSnapshot(); h.respond(response, {run}, original);
    expect(h.session.getSnapshot()).toBe(recovered);
    expect(h.commands.slice(count).map(command => command.type)).toEqual(["game:listRaceCategories", "game:listRaceCategories"]);
  });
  it("cannot issue the old owner's catalog read after an observer replaces the account", async () => {
    /** Terminal transition notifications can replace the authenticated player synchronously. */
    const run = await abandoned(), categories = (await catalog()).categories, h = harness({}, null, {persistence: {
      read: owner => owner === "owner-1" ? run.runId : null, save: () => undefined, clear: () => undefined,
    }});
    /** Only the first reset notification replaces ownership. */
    let replaced = false;
    h.session.subscribe(() => {if (!replaced && h.session.getSnapshot().run === null) {replaced = true; h.session.enter({ownerId: "owner-2", locale: "en", initialCategories: categories});}});
    h.respond("raceResume", {run});
    expect(h.commands.map(command => command.type)).toEqual(["game:resumeRace"]);
    expect(h.session.getSnapshot()).toMatchObject({categories, run: null, pending: null, error: null});
  });
  it("keeps cached categories without another read when resume confirms abandonment", async () => {
    /** Cached translated categories remain usable after terminal recovery. */
    const run = await abandoned(), categories = (await catalog()).categories, h = harness({initialCategories: categories}, run.runId);
    h.respond("raceResume", {run});
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", run: null, categories, pending: null, error: null});
    expect(h.commands.map(command => command.type)).toEqual(["game:resumeRace"]);
  });
  it("retains close intent when readiness confirms an already-abandoned preparation", async () => {
    /** Closing during a resumed preparation must not start a catalog request. */
    const run = await fixture(true), h = harness({}, run.runId); h.respond("raceResume", {run}); h.session.requestClose();
    h.respond("raceReady", {run: {...run, status: "abandoned", currentRiddle: null}});
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
    expect(h.commands.map(command => command.type)).toEqual(["game:resumeRace", "game:readyRace"]);
  });
});
