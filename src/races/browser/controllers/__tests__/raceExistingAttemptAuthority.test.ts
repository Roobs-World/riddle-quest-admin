import {describe, expect, it} from "@jest/globals";
import {fixture, harness, preview} from "./raceSession.support.ts";

describe("Existing challenge attempt recovery authority", () => {
  it.each(["challenge", "role", "category", "run"] as const)("rejects a recovered attempt with the wrong %s", async field => {
    /** Direct challenge entry requests the server-confirmed existing attempt. */
    const h = harness({challengeId: "played"});
    /** Valid initial fixture belongs to the selected challenge and recipient role. */
    const run = {...await fixture(true), challengeId: "played", role: "challenger" as const};
    h.respond("raceEntry", {status: "ready", challenge: preview("played"), viewerRole: "recipient", existingRunId: run.runId, serverNowMs: 1000});
    /** Schema-valid mismatches may not migrate another attempt into this challenge entry. */
    const mismatched = {...run, ...(field === "challenge" ? {challengeId: "other"} : field === "role" ? {role: "creator" as const} :
      field === "category" ? {categoryId: "history" as const} : {runId: "other-run"})};
    h.respond("raceResume", {run: mismatched});
    expect(h.session.getSnapshot()).toMatchObject({run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(0);
  });
  it("preserves ordinary creator cold resume without a challenge recovery pointer", async () => {
    /** Independent local resume may legitimately recover a creator run. */
    const run = await fixture(true);
    /** No ready challenge entry authorizes or constrains this recovery. */
    const h = harness({}, run.runId);
    h.respond("raceResume", {run});
    expect(h.session.getSnapshot().run?.runId).toBe(run.runId);
    expect(h.session.getSnapshot().error).toBeNull();
  });
});
