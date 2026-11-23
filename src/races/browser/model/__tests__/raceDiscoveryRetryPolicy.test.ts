import {describe, expect, it} from "@jest/globals";
import {raceMatchFailure, type RaceMatchRequest} from "../../../contracts/index";
import type {MatchmakingCapability} from "../../../../platform/contracts/capabilities";
import {catalog, harness, settleMatch} from "../../controllers/__tests__/raceSession.support.ts";

describe("Private discovery retry policy", () => {
  it.each(["none", "early", "new-intent", "same-intent", "empty", "hidden-ready", "valid"])("retains %s recovery after public edits", async mode => {
    /** Provider request identities reveal whether retry retained or rotated the original receipt. */
    const calls: RaceMatchRequest[] = [];
    /** First delivery owns a bounded recovery policy; the second ends without selecting a run. */
    const adapter: MatchmakingCapability = {find: async request => {calls.push(request);
      if (calls.length > 1) return {status: "cancelled"};
      if (mode === "empty") return {status: "success", value: {status: "empty", locale: "en"}};
      return {status: "retryable-failure", message: "provider", failure: raceMatchFailure(
        mode === "none" ? "access-denied" : mode === "new-intent" ? "intent-expired" : "temporarily-unavailable",
        mode === "early" || mode === "hidden-ready" ? 1000 : 0)};
    }};
    /** Real public discovery establishes the private selection before observers edit its presentation. */
    const h = harness({}, null, {getMatchmaking: () => adapter}); h.respond("raceCategories", await catalog());
    await h.session.findOpponent(adapter);
    /** Mutable recovery presentation must not authorize a different provider request. */
    const state = h.session.getSnapshot();
    if (mode === "none") {state.matchFailure!.recovery = "same-intent"; state.matchRetryReady = true;}
    if (mode === "early") state.matchRetryReady = true;
    if (mode === "new-intent") state.matchFailure!.recovery = "same-intent";
    if (mode === "same-intent") state.matchFailure!.recovery = "new-intent";
    if (mode === "empty") {state.matchSearchStatus = "failed"; state.matchFailure = raceMatchFailure("temporarily-unavailable");}
    if (mode === "hidden-ready") {h.advance(1000); h.session.getSnapshot().matchRetryReady = false;}
    h.session.retry(); await settleMatch(h.session);
    if (mode === "none" || mode === "early") expect(calls).toHaveLength(1);
    else {
      expect(calls).toHaveLength(2);
      expect(calls[1].requestId === calls[0].requestId).toBe(!["new-intent", "empty"].includes(mode));
    }
  });
});
