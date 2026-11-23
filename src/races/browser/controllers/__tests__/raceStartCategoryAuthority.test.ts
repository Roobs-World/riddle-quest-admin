import {describe, expect, it} from "@jest/globals";
import type {MatchmakingCapability} from "../../../../platform/contracts/capabilities";
import {catalog, fixture, harness, preview} from "./raceSession.support.ts";

describe("Accepted challenge category authority", () => {
  it.each(["direct", "provider"] as const)("checks %s category against privately accepted preview", async source => {
    /** Provider and direct entry accept the same canonical mixed recording. */
    const adapter: MatchmakingCapability = {find: async () => ({status: "success", value: {status: "matched", challenge: preview("original")}})};
    /** Real entry/discovery seams preserve private selection before external observers. */
    const h = harness(source === "direct" ? {challengeId: "original"} : {}, null, {getMatchmaking: () => adapter});
    if (source === "direct") h.respond("raceEntry", {status: "ready", challenge: preview("original"), viewerRole: "recipient", serverNowMs: 10000});
    else {h.respond("raceCategories", await catalog());await h.session.findOpponent(adapter);}
    h.session.begin("mixed");
    /** Public category agrees with the contradictory response but cannot authorize it. */
    const state = h.session.getSnapshot(); if (state.challenge) state.challenge.categoryId = "history";
    /** Correct recording ID and opponent do not excuse another category. */
    const run = {...await fixture(true), categoryId: "history" as const, role: "challenger" as const, challengeId: "original", opponent: {displayName: "Nova", adjustedFinishMs: 60000, events: []}};
    h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(0);
  });
});
