import {describe, expect, it} from "@jest/globals";
import type {MatchmakingCapability} from "../../../../platform/contracts/capabilities";
import {catalog, fixture, harness} from "../../controllers/__tests__/raceSession.support.ts";

describe("Private start origin context", () => {
  it.each(["creator-challenge", "creator-rivalry", "counter-rivalry", "fallback-challenge"] as const)("rejects an unrelated %s context", async mode => {
    /** A fallback offer creates a challenger without a selected public challenge. */
    const adapter: MatchmakingCapability = {find: async () => ({status: "success", value: {status: "empty", locale: "en", fallback: {offerId: "a".repeat(64), categoryId: "mixed"}}})};
    /** Original preferences remain private across automatic and explicit starts. */
    const h = harness({}, null, {getMatchmaking: () => adapter}); h.respond("raceCategories", await catalog());
    if (mode === "fallback-challenge") await h.session.findOpponent(adapter);
    else if (mode === "counter-rivalry") h.session.rematch("mixed", "expected-rivalry");
    else h.session.begin("mixed");
    /** Schema-valid run keeps expected role/category but carries another origin identifier. */
    const run = {...await fixture(true),
      ...(mode.endsWith("challenge") ? {challengeId: "foreign"} : {rivalryChallengeId: "foreign"}),
      ...(mode === "fallback-challenge" ? {role: "challenger" as const, opponent: {displayName: "Nova", adjustedFinishMs: 60000, events: []}} : {})};
    h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(0);
  });
  it("preserves an explicitly requested counter-recording context", async () => {
    /** A valid rivalry start carries the same original identifier. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.rematch("mixed", "expected-rivalry");
    h.respond("raceStart", {run: {...await fixture(true), rivalryChallengeId: "expected-rivalry"}});
    expect(h.session.getSnapshot().error).toBeNull();
    expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(1);
  });
});
