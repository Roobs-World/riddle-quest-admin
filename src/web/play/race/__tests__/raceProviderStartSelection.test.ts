import {describe, expect, it} from "@jest/globals";
import type {MatchmakingCapability} from "../../../platform/types";
import {catalog, fixture, harness, preview} from "./raceSession.support";

describe("Provider challenge acceptance selection", () => {
  it.each(["identity", "name", "time", "valid"] as const)("retains accepted provider facts after public %s changes", async mode => {
    /** Provider selection creates its own accepted preview without a ready entry response. */
    const adapter: MatchmakingCapability = {find: async () => ({status: "success", value: {status: "matched", challenge: preview("matched")}})};
    /** Real provider discovery commits the preview before observers can change it. */
    const h = harness({}, null, {getMatchmaking: () => adapter}); h.respond("raceCategories", await catalog());
    await h.session.findOpponent(adapter);
    /** Poisoning public identity must not retarget default acceptance. */
    const state = h.session.getSnapshot();
    if (mode === "identity") state.activeChallengeId = "foreign";
    if (mode === "name" && state.challenge) state.challenge.creator.displayName = "Other";
    if (mode === "time" && state.challenge) state.challenge.adjustedTimeToBeatMs = 90000;
    h.session.begin("mixed");
    expect(h.last()).toMatchObject({type: "game:startRace", payload: {challengeId: "matched"}});
    /** Supplied competitive facts deliberately agree with poisoned presentation only. */
    const run = {...await fixture(true), role: "challenger" as const, challengeId: "matched",
      opponent: {displayName: mode === "name" ? "Other" : "Nova", adjustedFinishMs: mode === "time" ? 90000 : 60000, events: []}};
    h.respond("raceStart", {run});
    if (mode === "name" || mode === "time") expect(h.session.getSnapshot()).toMatchObject({run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    else {expect(h.session.getSnapshot().run?.runId).toBe(run.runId); expect(h.session.getSnapshot().error).toBeNull();}
  });
  it("does not impose an earlier provider preview on an explicit different recording", async () => {
    /** Another explicit selection must validate its own request identity without preceding opponent facts. */
    const adapter: MatchmakingCapability = {find: async () => ({status: "success", value: {status: "matched", challenge: preview("matched")}})};
    /** Public session retains the provider preview while a distinct start is explicitly requested. */
    const h = harness({}, null, {getMatchmaking: () => adapter});h.respond("raceCategories", await catalog());await h.session.findOpponent(adapter);
    h.session.begin("mixed", "different");
    /** Valid new recording has a different opponent and target. */
    const run = {...await fixture(true), role: "challenger" as const, challengeId: "different", opponent: {displayName: "Other", adjustedFinishMs: 90000, events: []}};
    h.respond("raceStart", {run});
    expect(h.session.getSnapshot().run?.runId).toBe(run.runId); expect(h.session.getSnapshot().error).toBeNull();
  });
});
