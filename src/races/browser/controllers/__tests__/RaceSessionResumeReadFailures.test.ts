import {describe, expect, it} from "@jest/globals";
import {fixture, harness} from "./raceSession.support.ts";

describe("Race Session unavailable resume observation", () => {
  it("accepts a delayed resume without overwriting a newer hint when observation throws", async () => {
    /** Canonical run already requested before browser storage becomes unavailable. */
    const run = await fixture();
    /** Another tab owns a newer pointer despite the failed observation. */
    let selected = run.runId, denied = false;
    /** Read failure is independent of a still-usable write operation. */
    const h = harness({}, null, {persistence: {read: () => {
      if (denied) throw new Error("read denied");
      return selected;
    }, save: (_owner: string | undefined, id: string) => {selected = id;}, clear: () => {}}});
    selected = "newer-tab-run"; denied = true;
    h.respond("raceResume", {run});
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", run, error: null});
    expect(selected).toBe("newer-tab-run");
    denied = false; h.session.dispose();
    /** Restored access permits the next session to use the untouched selection. */
    const reload = harness({}, null, {persistence: {read: () => selected, save: () => {}, clear: () => {}}});
    expect(reload.last()).toMatchObject({type: "game:resumeRace", payload: {runId: "newer-tab-run"}});
  });
});
