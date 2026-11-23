import {describe, expect, it} from "@jest/globals";
import {fixture, harness, preview} from "./raceSession.support.ts";

describe("Existing attempt opponent authority", () => {
  it.each(["name", "time", "name-public", "time-public", "valid", "omitted"] as const)("checks recovered opponent facts for %s", async mode => {
    /** Cold direct-link recovery belongs to an immutable published recording. */
    const h = harness({challengeId: "played"});
    /** Prepared snapshot retains optional opponent support for compatible legacy views. */
    const base = {...await fixture(true), challengeId: "played", role: "challenger" as const};
    h.respond("raceEntry", {status: "ready", challenge: preview("played"), existingRunId: base.runId, serverNowMs: 1000});
    /** Public preview mutation cannot change the accepted recording's private target. */
    const entry = h.session.getSnapshot().entryStatus;
    if (entry?.status === "ready" && mode === "name-public") entry.challenge.creator.displayName = "Other";
    if (entry?.status === "ready" && mode === "time-public") entry.challenge.adjustedTimeToBeatMs = 90000;
    /** Provided opponent facts must agree with the canonical accepted entry. */
    const run = {...base, ...(mode === "omitted" ? {} : {opponent: {
      displayName: mode.startsWith("name") ? "Other" : "Nova", adjustedFinishMs: mode.startsWith("time") ? 90000 : 60000, events: [],
    }})};
    h.respond("raceResume", {run});
    if (mode === "valid" || mode === "omitted") {
      expect(h.session.getSnapshot().run?.runId).toBe(base.runId);
      expect(h.session.getSnapshot().error).toBeNull();
    } else expect(h.session.getSnapshot()).toMatchObject({run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
  });
});
