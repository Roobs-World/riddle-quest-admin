import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "./raceSession.support";

describe("Race Session shared resume selection ownership", () => {
  it.each([false, true])("preserves another tab's selection during a late resume, prepared=%s", async prepared => {
    /** The first tab has already requested this authority-issued run. */
    const run = await fixture(prepared);
    /** Shared pointer can be replaced while its request is in flight. */
    let selected: string | null = run.runId;
    /** The adapter models the account's shared selection across session lifetimes. */
    const persistence = {read: () => selected, save: (_owner: string | undefined, id: string) => {selected = id;}, clear: () => {}};
    /** A late valid receipt remains useful in memory but cannot reclaim selection. */
    const h = harness({}, null, {persistence});
    selected = "newer-tab-run";
    h.respond("raceResume", {run});
    expect(h.session.getSnapshot().run?.runId).toBe(run.runId);
    expect(h.session.getSnapshot().error).toBeNull();
    expect(selected).toBe("newer-tab-run");
    h.session.dispose();
    /** Re-entry must choose the newer tab's hint. */
    const reload = harness({}, null, {persistence});
    expect(reload.last()).toMatchObject({type: "game:resumeRace", payload: {runId: "newer-tab-run"}});
  });

  it("preserves another tab's selection during a readiness receipt", async () => {
    /** Explicit new selection initially takes ownership of the shared pointer. */
    const run = await fixture(true);
    /** Selection follows accepted authority while no competing tab exists. */
    let selected: string | null = null;
    /** Shared adapter exposes the pointer replaced during readiness transport. */
    const h = harness({}, null, {persistence: {read: () => selected,
      save: (_owner: string | undefined, id: string) => {selected = id;}, clear: () => {}}});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.respond("raceStart", {run});
    expect(selected).toBe(run.runId);
    selected = "newer-tab-run";
    h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: run.serverNowMs! + 3000}});
    expect(h.session.getSnapshot().run?.status).toBe("scheduled");
    expect(selected).toBe("newer-tab-run");
  });

  it("allows an explicit accepted new start to replace the previous selection", async () => {
    /** The user deliberately begins a new authority-owned race. */
    const run = await fixture(true);
    /** A competing selection does not revoke an explicit new start. */
    let selected: string | null = null;
    /** Start acceptance owns replacement; later receipts only refresh their own run. */
    const h = harness({}, null, {persistence: {read: () => selected,
      save: (_owner: string | undefined, id: string) => {selected = id;}, clear: () => {}}});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed"); selected = "previous-selection";
    h.respond("raceStart", {run});
    expect(selected).toBe(run.runId);
    expect(h.session.getSnapshot().error).toBeNull();
  });
});
