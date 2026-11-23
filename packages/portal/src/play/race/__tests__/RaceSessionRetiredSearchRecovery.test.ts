import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery} from "@riddle-quest/core/race";
import type {MatchmakingCapability} from "../../../platform/types";
import {catalog, harness} from "./raceSession.support";

describe("Retired search recovery", () => {
  it.each(["removed", "replaced"].flatMap(mode => ["failed", "empty"].flatMap(result =>
    ["categories", "tournaments"].map(stage => [mode, result, stage] as const))))("clears %s provider %s recovery in %s", async (mode, result, stage) => {
    /** Completed discovery leaves either a retryable failure or an empty-pool receipt. */
    const first: MatchmakingCapability = {find: async () => result === "failed" ?
      {status: "retryable-failure", message: "offline"} : {status: "success", value: {status: "empty", locale: "en"}}};
    /** Provider selection may change after the original delivery has already settled. */
    let selected: MatchmakingCapability | undefined = first;
    /** Owned journal must disappear without touching another selection. */
    let journal: RaceRecovery | null = null;
    /** New adapters must never be called automatically by retired retry cleanup. */
    let calls = 0;
    /** Actual session persists the failed/empty intent until its provider is retired. */
    const h = harness({}, null, {getMatchmaking: () => selected, recovery: {read: () => journal,
      save: record => {journal = record;}, clear: () => {journal = null;}}});
    h.respond("raceCategories", await catalog());
    if (stage === "tournaments") h.session.navigate("tournaments");
    await h.session.findOpponent(first);
    expect(h.session.getSnapshot().matchSearchStatus).toBe(result);
    expect(journal).not.toBeNull();
    selected = mode === "removed" ? undefined : {find: async () => {calls++; return {status: "cancelled"};}};
    h.advance(50);
    expect(h.session.getSnapshot()).toMatchObject({stage, matchSearchStatus: "idle", matchFailure: null,
      findingOpponent: false, matchRetryReady: true, error: null});
    expect(journal).toBeNull();
    expect(calls).toBe(0);
  });
});
