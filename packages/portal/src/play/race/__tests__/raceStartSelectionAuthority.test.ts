import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness, preview} from "./raceSession.support";

describe("Private challenge start selection", () => {
  it.each(["identity", "opponent", "target"] as const)("rejects a contradictory start after public %s rewrite", async mode => {
    /** Accepted direct entry supplies the immutable competitive preview. */
    const h = harness({challengeId: "original"});
    h.respond("raceEntry", {status: "ready", challenge: preview("original"), viewerRole: "recipient", serverNowMs: 10000});
    h.session.begin("mixed");
    /** Only the public presentation agrees with this deliberately wrong receipt. */
    const state = h.session.getSnapshot();
    if (mode === "identity") {state.activeChallengeId = "foreign"; if (state.challenge) state.challenge.challengeId = "foreign";}
    if (mode === "opponent" && state.challenge) state.challenge.creator.displayName = "Other";
    if (mode === "target" && state.challenge) state.challenge.adjustedTimeToBeatMs = 90000;
    /** Schema-valid prepared challenger must still match the accepted recording. */
    const run = {...await fixture(true), role: "challenger" as const, challengeId: mode === "identity" ? "foreign" : "original",
      opponent: {displayName: mode === "opponent" ? "Other" : "Nova", adjustedFinishMs: mode === "target" ? 90000 : 60000, events: []}};
    h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(0);
  });
  it("does not let an injected public challenge ID reject a valid creator start", async () => {
    /** Creator command has no challenge selection even if presentation is later overwritten. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    h.session.getSnapshot().activeChallengeId = "foreign";
    h.respond("raceStart", {run: await fixture(true)});
    expect(h.session.getSnapshot().error).toBeNull();
    expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(1);
  });
});
