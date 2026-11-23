import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "./raceSession.support.ts";

describe("Race Session deleted resume pointer ownership", () => {
  it.each([false, true])("preserves another tab's deletion during a late resume, prepared=%s", async prepared => {
    /** The first tab has already requested this authority-issued run. */
    const run = await fixture(prepared);
    /** Shared pointer can be deleted while its request is in flight. */
    let selected: string | null = run.runId;
    /** The adapter models the account's shared selection across session lifetimes. */
    const persistence = {read: () => selected, save: (_owner: string | undefined, id: string) => {selected = id;}, clear: () => {}};
    /** A late valid receipt remains useful in memory but cannot reclaim selection. */
    const h = harness({}, null, {persistence});
    selected = null;
    h.respond("raceResume", {run});
    expect(h.session.getSnapshot().run?.runId).toBe(run.runId);
    expect(h.session.getSnapshot().error).toBeNull();
    expect(selected).toBeNull();
    h.session.dispose();
    /** Re-entry must respect deliberate deletion instead of resuming the old run. */
    const reload = harness({}, null, {persistence});
    expect(reload.last().type).toBe("game:listRaceCategories");
  });

  it("preserves another tab's deletion during a readiness receipt", async () => {
    /** Explicit new selection initially takes ownership of the shared pointer. */
    const run = await fixture(true);
    /** Selection follows accepted authority while no competing tab exists. */
    let selected: string | null = null;
    /** Shared adapter exposes the pointer removed during readiness transport. */
    const h = harness({}, null, {persistence: {read: () => selected,
      save: (_owner: string | undefined, id: string) => {selected = id;}, clear: () => {}}});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.respond("raceStart", {run});
    expect(selected).toBe(run.runId);
    selected = null;
    h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: run.serverNowMs! + 3000}});
    expect(h.session.getSnapshot().run?.status).toBe("scheduled");
    expect(selected).toBeNull();
  });

  it("creates the first pointer after an interrupted start is confirmed on retry", async () => {
    /** No confirmed run has been retained before this original mutation succeeds. */
    let selected: string | null = null;
    /** The accepted start must remain recoverable even after its first delivery fails. */
    const h = harness({}, null, {persistence: {read: () => selected,
      save: (_owner, id) => {selected = id;}, clear: () => {}}});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.reject("raceStart", "delivery lost"); h.session.retry();
    /** Canonical start acceptance creates the missing hint rather than losing recovery. */
    const run = await fixture(true); h.respond("raceStart", {run});
    expect(selected).toBe(run.runId);
    expect(h.session.getSnapshot()).toMatchObject({run, pending: "raceReady", error: null});
  });
});
