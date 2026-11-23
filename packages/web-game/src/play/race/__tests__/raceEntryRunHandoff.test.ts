import {describe, expect, it} from "@jest/globals";
import {fixture, harness, preview, withCorrectHistory} from "./raceSession.support";
import {projectRaceOutcome} from "../logic/racePresentation";

describe("Accepted entry to run ownership handoff", () => {
  it("does not retain an earlier accepted attempt pointer after another recording starts", async () => {
    /** A completed accepted attempt is recovered through its original challenge entry. */
    const h = harness({challengeId: "original"});
    /** Completed authority view has a coherent scored history and immutable deck. */
    const oldRun = withCorrectHistory({...await fixture(true), role: "challenger" as const, challengeId: "original", status: "completed" as const,
      correctCount: 10, currentRiddle: null, wallElapsedMs: 60000, adjustedElapsedMs: 60000, opponent: {displayName: "Nova", adjustedFinishMs: 60000, events: []}});
    h.respond("raceEntry", {status: "ready", challenge: preview("original"), existingRunId: oldRun.runId, serverNowMs: 10000});
    h.respond("raceResume", {run: oldRun});
    h.respond("raceOutcome", projectRaceOutcome(oldRun, oldRun.adjustedElapsedMs));
    h.session.navigate("inbox"); h.respond("raceInbox", {items: []});
    h.session.begin("mixed", "different");
    /** Another explicit recording supplies its own accepted run identity and competitive facts. */
    const newRun = {...await fixture(true), runId: "different-run", role: "challenger" as const, challengeId: "different", opponent: {displayName: "Other", adjustedFinishMs: 90000, events: []}};
    h.respond("raceStart", {run: newRun});
    /** Readiness enters the new run before an uncertain hint triggers canonical recovery. */
    const activeRun = {...newRun, status: "active" as const};
    h.respond("raceReady", {run: activeRun});
    h.session.hint(); h.reject("raceHint", "connection interrupted"); h.session.retry();
    expect(h.last().type).toBe("game:resumeRace");
    h.respond("raceResume", {run: activeRun});
    expect(h.session.getSnapshot().error).toBeNull();
    expect(h.session.getSnapshot().run?.runId).toBe("different-run");
  });
});
