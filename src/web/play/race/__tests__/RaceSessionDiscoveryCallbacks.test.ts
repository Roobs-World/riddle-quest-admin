import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery} from "../../../../core/race";
import type {MatchmakingCapability} from "../../../platform/types";
import {catalog, harness, preview} from "./raceSession.support";

describe("Matchmaking completion callback ownership", () => {
  it.each(["matched", "empty", "failure", "fallback"] as const)("drops %s completion after its callback removes the provider", async mode => {
    /** Every completion begins with a valid current provider. */
    const adapter: MatchmakingCapability = {find: async () => mode === "failure" ? {status: "retryable-failure", message: "offline"} :
      {status: "success", value: mode === "matched" ? {status: "matched", challenge: preview()} :
        {status: "empty", locale: "en", ...(mode === "fallback" ? {fallback: {offerId: "a".repeat(64), categoryId: "mixed"}} : {})}}};
    /** Completion notifications may synchronously revoke a capability without changing account. */
    let selected: MatchmakingCapability | undefined = adapter;
    /** Observable recovery journal lets completion legitimately attempt its owned write. */
    let journal: RaceRecovery | null = null;
    /** Provider removal occurs only during completion, after the SDK result was accepted. */
    let armed = false, changed = false;
    /** Select removal exactly once to avoid injecting unrelated side effects during cleanup. */
    const retire = () => {if (armed && !changed) {selected = undefined; changed = true;}};
    /** Real session exposes both persistence and external-store notification boundaries. */
    const h = harness({}, null, {getMatchmaking: () => selected, recovery: {read: () => journal,
      save: record => {journal = record; retire();}, clear: () => {journal = null;}}});
    h.respond("raceCategories", await catalog());
    /** Fallback publishes a loading transition instead of a completion journal write. */
    const unsubscribe = h.session.subscribe(() => {
      if (mode === "fallback" && armed && h.session.getSnapshot().matchSearchStatus === "searching" &&
        !h.session.getSnapshot().findingOpponent) retire();
    });
    /** Provider invocation arms completion callbacks after initial search persistence. */
    const originalFind = adapter.find;
    adapter.find = request => {armed = true; return originalFind(request);};
    await h.session.findOpponent(adapter);
    unsubscribe();
    expect(changed).toBe(true);
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(0);
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", challenge: null, error: null,
      findingOpponent: false, matchSearchStatus: "idle", matchFailure: null});
    expect(journal).toBeNull();
  });
});
