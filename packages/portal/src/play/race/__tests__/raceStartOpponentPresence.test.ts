import {describe, expect, it} from "@jest/globals";
import type {MatchmakingCapability} from "../../../platform/types";
import {catalog, fixture, harness, preview} from "./raceSession.support";

describe("Start opponent presence contract", () => {
  it.each(["creator-opponent", "fallback-missing", "direct-missing", "creator-valid", "fallback-valid"] as const)("validates %s before readiness", async mode => {
    /** Server fallback creates a challenger with a recorded target but no public challenge ID. */
    const adapter: MatchmakingCapability = {find: async () => ({status: "success", value: {status: "empty", locale: "en", fallback: {offerId: "a".repeat(64), categoryId: "mixed"}}})};
    /** Each start is issued through its public entry or discovery seam. */
    const h = harness(mode === "direct-missing" ? {challengeId: "original"} : {}, null, {getMatchmaking: () => adapter});
    if (mode === "direct-missing") {h.respond("raceEntry", {status: "ready", challenge: preview("original"), viewerRole: "recipient", serverNowMs: 10000});h.session.begin("mixed");}
    else {h.respond("raceCategories", await catalog());if (mode.startsWith("fallback")) await h.session.findOpponent(adapter);else h.session.begin("mixed");}
    /** Run keeps the issued identity, role and category while varying only opponent presence. */
    const run = {...await fixture(true), ...(mode.startsWith("fallback") || mode === "direct-missing" ? {role: "challenger" as const} : {}),
      ...(mode === "direct-missing" ? {challengeId: "original"} : {}),
      ...(mode === "creator-opponent" || mode === "fallback-valid" ? {opponent: {displayName: "Nova", adjustedFinishMs: 60000, events: []}} : {})};
    h.respond("raceStart", {run});
    if (mode.endsWith("valid")) {expect(h.session.getSnapshot().error).toBeNull();expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(1);}
    else {expect(h.session.getSnapshot()).toMatchObject({run: null, error: "RaceTo10.ERROR_INVALID_RESPONSE"});expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(0);}
  });
});
