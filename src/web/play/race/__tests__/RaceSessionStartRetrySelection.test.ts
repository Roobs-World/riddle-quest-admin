import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery} from "../../../../core/race";
import {catalog, fixture, harness} from "./raceSession.support";

describe("Race Session interrupted start selection", () => {
  it.each(["replacement", "denied", "removed"] as const)("preserves shared journal during a %s start retry", async mode => {
    /** Shared recovery can change after the original mutation has already been sent. */
    let journal: RaceRecovery | null = null, denied = false;
    /** Original request identity survives an unconfirmed delivery. */
    const h = harness({}, null, {wallNow: () => 1000, recovery: {read: () => {
      if (denied) throw new Error("read denied"); return journal;
    }, save: record => {journal = record;}, clear: (_owner, id) => {if (journal?.id === id) journal = null;}}});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Confirmation loss leaves the same start recoverable. */
    const original = h.last(); h.reject("raceStart", "delivery lost");
    journal = mode === "removed" ? null : {...journal!, id: "newer-journal", intent: {kind: "challenge", challengeId: "newer-challenge"}};
    denied = mode === "denied"; h.session.retry();
    expect(h.last()).toMatchObject({type: "game:startRace", requestId: original.requestId, payload: original.payload});
    expect(journal).toEqual(mode === "removed" ? null : expect.objectContaining({id: "newer-journal"}));
    h.respond("raceStart", {run: await fixture(true)});
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceReady", error: null});
    expect(journal).toEqual(mode === "removed" ? null : expect.objectContaining({id: "newer-journal"}));
  });
  it("accepts an original replayed start without reclaiming another tab's active run pointer", async () => {
    /** Initial selection starts with no active pointer and a real recovery journal. */
    let selected: string | null = null, journal: RaceRecovery | null = null;
    /** Another tab can select a confirmed run before this start's retry is accepted. */
    const h = harness({}, null, {wallNow: () => 1000, persistence: {read: () => selected,
      save: (_owner, runId) => {selected = runId;}, clear: () => {}}, recovery: {read: () => journal,
      save: record => {journal = record;}, clear: () => {journal = null;}}});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.reject("raceStart", "delivery lost");
    selected = "newer-run"; h.session.retry();
    /** The replayed receipt remains valid, but its selection was already made earlier. */
    const run = await fixture(true); h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({run, pending: "raceReady", error: null});
    expect(selected).toBe("newer-run");
  });
  it("preserves newer selection during a cold replay of the saved start", async () => {
    /** Interrupted start intent survives a complete session disposal. */
    let journal: RaceRecovery | null = null, selected: string | null = null;
    /** Shared adapters preserve the original authority receipt across mounts. */
    const recovery = {read: () => journal, save: (record: RaceRecovery) => {journal = record;},
      clear: (_owner: string | undefined, id: string) => {if (journal?.id === id) journal = null;}};
    /** First mount issues the mutation but never receives its confirmation. */
    const first = harness({}, null, {wallNow: () => 1000, recovery});
    first.respond("raceCategories", await catalog()); first.session.begin("mixed");
    /** Exact request identity must survive the reload. */
    const original = first.last(); first.session.dispose();
    /** Cold entry chooses the saved start before another tab changes selection. */
    const reload = harness({}, null, {wallNow: () => 1000, recovery, persistence: {read: () => selected,
      save: (_owner, id) => {selected = id;}, clear: () => {}}});
    expect(reload.last()).toMatchObject({type: "game:startRace", requestId: original.requestId});
    selected = "newer-run";
    journal = {...journal!, id: "newer-journal", intent: {kind: "challenge", challengeId: "newer-challenge"}};
    reload.respond("raceStart", {run: await fixture(true)});
    expect(selected).toBe("newer-run"); expect(journal?.id).toBe("newer-journal");
    expect(reload.session.getSnapshot()).toMatchObject({pending: "raceReady", error: null});
  });
});
