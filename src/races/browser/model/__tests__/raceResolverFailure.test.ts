import {describe, expect, it} from "@jest/globals";
import type {MatchmakingCapability, MatchmakingResult} from "../../../../platform/contracts/capabilities";
import {catalog, harness, preview} from "../../controllers/__tests__/raceSession.support.ts";

describe("Optional matchmaking resolver failures", () => {
  it.each(["initial", "tick", "completion", "valid"])("isolates %s lookup failures", async mode => {
    /** Pending provider responses belong to the adapter that started discovery. */
    let resolve!: (result: MatchmakingResult) => void;
    /** A successful lookup may become unavailable before its asynchronous response. */
    let fail = mode === "initial", calls = 0;
    /** Optional SDK lookup must not escape into browser timers or promise completion. */
    const adapter: MatchmakingCapability = {find: () => {calls++; return new Promise(yes => {resolve = yes;});}};
    /** Resolver failure is independent of the selected provider's pending SDK call. */
    const h = harness({}, null, {getMatchmaking: () => {if (fail) throw new Error("provider lookup failed"); return adapter;}});
    h.respond("raceCategories", await catalog());
    /** The public promise must settle even if capability lookup fails during completion. */
    const pending = h.session.findOpponent(adapter);
    if (mode !== "initial") {
      fail = mode !== "valid";
      if (mode === "tick") expect(() => h.advance(50)).not.toThrow();
      resolve({status: "success", value: {status: "matched", challenge: preview("offered")}});
    }
    await expect(pending).resolves.toBeUndefined();
    if (mode === "valid") expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "offered", error: null});
    else expect(h.session.getSnapshot()).toMatchObject({stage: "categories", findingOpponent: false, challenge: null, matchSearchStatus: "idle", error: null});
    expect(calls).toBe(mode === "initial" ? 0 : 1);
  });
});
