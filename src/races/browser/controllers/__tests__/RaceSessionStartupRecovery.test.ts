import {describe, expect, it} from "@jest/globals";
import {fixture, harness} from "./raceSession.support.ts";

describe("Race Session first resume delivery recovery", () => {
  it.each(["rejected", "malformed", "wrong-run", "expired"])("preserves the saved run and retries the same read after %s delivery", async delivery => {
    /** Canonical authority view remains recoverable despite a failed initial delivery. */
    const run = await fixture();
    /** Real shared storage retains only the account-bound run pointer. */
    let saved: string | null = run.runId;
    /** Conditional cleanup emulates the browser store's matching-run protection. */
    const storage = {read: () => saved, save: (_owner: string | undefined, id: string) => {saved = id;},
      clear: (_owner: string | undefined, id?: string) => {if (!id || id === saved) saved = null;}};
    /** Cold entry has not accepted any in-memory authority yet. */
    const h = harness({}, null, {persistence: storage});
    if (delivery === "rejected") h.reject("raceResume", "Temporary service failure");
    else if (delivery === "malformed") h.respond("raceResume", {run: {runId: run.runId}});
    else if (delivery === "wrong-run") h.respond("raceResume", {run: {...run, runId: "another-run"}});
    else h.advance(30000);
    expect(saved).toBe(run.runId);
    expect(h.session.getSnapshot()).toMatchObject({run: null, pending: null});
    expect(h.session.getSnapshot().error).not.toBeNull();
    expect(h.commands).toHaveLength(1);
    h.session.retry();
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: run.runId}});
    expect(h.commands).toHaveLength(2);
    h.respond("raceResume", {run});
    expect(h.session.getSnapshot()).toMatchObject({run, stage: "racing", pending: null, error: null});
    h.session.dispose();
    /** Another mount independently resumes the same retained authoritative run. */
    const reload = harness({}, null, {persistence: storage});
    expect(reload.last()).toMatchObject({type: "game:resumeRace", payload: {runId: run.runId}});
  });
  it("drops the failed read intent on deliberate reset without deleting a newer tab's run", () => {
    /** Cleanup remains scoped to the originally requested pointer. */
    const h = harness({}, "older-run");
    h.reject("raceResume", "Temporary read failure");h.session.rematch();
    expect(h.clearCalls).toEqual([{ownerId: "owner-1", runId: "older-run"}]);
    expect(h.last().type).toBe("game:listRaceCategories");
    h.session.retry();
    expect(h.last().type).toBe("game:listRaceCategories");
  });
  it("cannot migrate failed initial resume work into a replacement account", () => {
    /** An account replacement invalidates the original read recovery intent. */
    const h = harness({}, null, {persistence: {read: owner => owner === "owner-1" ? "old-run" : null,
      save: () => undefined, clear: () => undefined}});
    h.reject("raceResume", "Temporary read failure");
    h.session.enter({locale: "en", ownerId: "owner-2", initialCategories: []});
    expect(h.last().type).toBe("game:listRaceCategories");
    h.session.retry();
    expect(h.last().type).toBe("game:listRaceCategories");
    expect(h.clearCalls).toEqual([]);
  });
});
