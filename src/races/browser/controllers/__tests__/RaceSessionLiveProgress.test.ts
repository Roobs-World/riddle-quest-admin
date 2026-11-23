import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness, racing} from "./raceSession.support.ts";

describe("Race Session live score and question authority", () => {
  it("rejects initial score ahead of its current question before saving a run", async () => {
    /** No run ownership is established by a contradictory first authority response. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed");
    h.respond("raceStart", {run: {...await fixture(), correctCount: 1}});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: null});
    expect(h.saved).toEqual([]);
  });
  it("retains the owned draft when resume invents clears ahead of the current question", async () => {
    /** Recovery cannot overwrite input with impossible progress. */
    const h = await racing();h.session.input("text", "pi");h.session.retry();
    h.respond("raceResume", {run: {...h.run, correctCount: 1}});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", currentLetters: ["p", "i", "", "", ""]});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: ["p", "i", "", "", ""]});
  });
});
