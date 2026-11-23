import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness, racing} from "./raceSession.support.ts";
import type {RaceRunView} from "../../../contracts/index";

/** Individually valid transport fields contradict one attempt's remaining capacity. */
const corrupt = (run: RaceRunView, kind: string): RaceRunView => {
  /** Mutation is confined to the reply and never alters the real authority. */
  const reply = structuredClone(run);
  if (kind === "guesses") reply.currentRiddle!.guessesRemaining = 4;
  else reply.currentRiddle!.hintAvailable = false;
  return reply;
};
describe("Race Session attempt budget authority", () => {
  it.each(["guesses", "hints"])("rejects initial contradictory %s before retaining an owned run", async kind => {
    /** A bad start must remain retryable without persisting a resume hint. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed");
    h.respond("raceStart", {run: corrupt(await fixture(), kind)});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: null});
    expect(h.saved).toEqual([]);
  });
  it.each(["guesses", "hints"])("preserves input after contradictory resumed %s and recovers", async kind => {
    /** Only valid authority may replace the player's current attempt. */
    const h = await racing();h.session.input("text", "pi");h.session.retry();
    h.respond("raceResume", {run: corrupt(h.run, kind)});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", currentLetters: ["p", "i", "", "", ""]});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: ["p", "i", "", "", ""]});
  });
});
