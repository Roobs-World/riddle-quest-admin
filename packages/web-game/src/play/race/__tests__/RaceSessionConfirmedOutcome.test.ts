import {describe, expect, it} from "@jest/globals";
import {fixture, harness, recorded} from "./raceSession.support";
import {projectRaceOutcome} from "../logic/racePresentation";

describe("privately confirmed provider completion identity", () => {
  it("withholds a clock-projected outcome until the server confirms it", async () => {
    /** Local terminal presentation is not a committed provider recording. */
    const run = {...await fixture(), role: "challenger" as const, challengeId: "recorded-challenge",
      opponent: {displayName: "Nova", adjustedFinishMs: 1300, events: []}}, h = harness({}, run.runId);
    h.respond("raceResume", {run}); h.advance(3500);
    expect(h.session.getSnapshot()).toMatchObject({stage: "result", pending: "raceOutcome"});
    expect(h.session.getSnapshot().outcome).not.toBeNull(); expect(h.session.getConfirmedOutcomeRunId()).toBeNull();
    /** Only the canonical response owns the completion identity. */
    const canonical = projectRaceOutcome(run, 1301);
    h.respond("raceOutcome", canonical);
    expect(h.session.getSnapshot().error).toBeNull(); expect(h.session.getConfirmedOutcomeRunId()).toBe(run.runId);
  });
  it("retains confirmed identity when the visible result is modified", async () => {
    /** Presentation consumers cannot redirect provider completion into another run. */
    const h = await recorded(), runId = h.session.getConfirmedOutcomeRunId();
    h.session.getSnapshot().outcome!.runId = "untrusted-run";
    expect(h.session.getConfirmedOutcomeRunId()).toBe(runId);
  });
  it.each(["rematch", "dispose", "account"])("clears confirmed provider identity after %s", async ending => {
    /** A previously confirmed result belongs only to its authenticated journey. */
    const h = await recorded(); expect(h.session.getConfirmedOutcomeRunId()).not.toBeNull();
    if (ending === "account") h.session.enter({ownerId: "owner-2", locale: "en"});
    else if (ending === "rematch") h.session.rematch();
    else h.session.dispose();
    expect(h.session.getConfirmedOutcomeRunId()).toBeNull();
  });
});
