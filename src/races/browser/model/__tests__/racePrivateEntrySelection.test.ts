import {describe, expect, it} from "@jest/globals";
import {fixture, harness, preview} from "../../controllers/__tests__/raceSession.support.ts";

describe("Private accepted entry selection", () => {
  it("does not dispatch a rewritten public existing-run pointer", async () => {
    /** Entry belongs to the server-confirmed accepted attempt. */
    const h = harness({challengeId: "played"});
    /** Requested resume ID is captured before entry publication. */
    const run = {...await fixture(true), challengeId: "played", role: "challenger" as const};
    /** A retained UI observer may mutate presentation without authorizing another run. */
    const unsubscribe = h.session.subscribe(() => {
      /** Public entry is deliberately edited only after its accepted publication. */
      const entry = h.session.getSnapshot().entryStatus;
      if (entry?.status === "ready") entry.existingRunId = "other-run";
    });
    h.respond("raceEntry", {status: "ready", challenge: preview("played"), existingRunId: run.runId, serverNowMs: 1000});
    unsubscribe();
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: run.runId}});
  });
  it.each(["clear", "rewrite"] as const)("rejects a mismatched resume after public entry facts are %s", async mutation => {
    /** Confirmed entry constrains subsequent resume even after its UI object is changed. */
    const h = harness({challengeId: "played"});
    /** Run ID remains correctly correlated while competitive selection is deliberately wrong. */
    const run = {...await fixture(true), challengeId: "played", role: "challenger" as const};
    h.respond("raceEntry", {status: "ready", challenge: preview("played"), existingRunId: run.runId, serverNowMs: 1000});
    /** Public snapshot is not an ownership credential. */
    const state = h.session.getSnapshot();
    state.activeChallengeId = "other";
    if (mutation === "clear") state.entryStatus = null;
    else if (state.entryStatus?.status === "ready") state.entryStatus.challenge.categoryId = "history";
    h.respond("raceResume", {run: {...run, challengeId: "other", categoryId: "history"}});
    expect(h.session.getSnapshot()).toMatchObject({run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
  });
  it("validates an entry response against the private requested challenge", () => {
    /** Original command keeps its request even if the UI selection is overwritten. */
    const h = harness({challengeId: "played"});
    h.session.getSnapshot().activeChallengeId = "other";
    h.respond("raceEntry", {status: "ready", challenge: preview("other"), existingRunId: "other-run", serverNowMs: 1000});
    expect(h.commands.filter(command => command.type === "game:resumeRace")).toHaveLength(0);
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
  });
});
