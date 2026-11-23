import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery, RaceMatchRequest} from "../../../../core/race";
import type {MatchmakingCapability} from "../../../platform/types";
import {catalog, harness, settleMatch} from "./raceSession.support";

/** Unexpired account-bound search journal contains preferences, never competitive authority. */
const saved = (): RaceRecovery => ({version: 1, id: "saved-search", ownerId: "owner-1", locale: "en",
  savedAtMs: 1000, expiresAtMs: 2000, intent: {kind: "search", request: {locale: "en", requestId: "old-receipt"}}});

describe("Cold unavailable search retirement", () => {
  it.each(["absent", "throws"])("retires %s provider recovery without reviving it on reopen", async mode => {
    /** The provider is unavailable at initial entry, then becomes available on another visit. */
    let selected: MatchmakingCapability | undefined, journal: RaceRecovery | null = saved();
    /** Observable provider receipt proves later availability cannot revive the retired intent. */
    const calls: RaceMatchRequest[] = [];
    /** A fresh explicit search remains usable after provider recovery. */
    const adapter: MatchmakingCapability = {find: async request => {calls.push(request); return {status: "cancelled"};}};
    /** Cleanup obeys the same expected-owner/revision contract as browser storage. */
    const h = harness({}, null, {wallNow: () => 1000, getMatchmaking: () => {if (!selected && mode === "throws") throw new Error("lookup"); return selected;},
      recovery: {read: () => journal, save: record => {journal = record;}, clear: (owner, id) => {if (journal?.ownerId === owner && journal.id === id) journal = null;}}});
    expect(h.last().type).toBe("game:listRaceCategories"); expect(journal).toBeNull();
    h.respond("raceCategories", await catalog()); selected = adapter;
    h.session.enter(); expect(calls).toHaveLength(0); expect(h.last().type).toBe("game:listRaceCategories");
    h.respond("raceCategories", await catalog()); await h.session.findOpponent(adapter);
    expect(calls).toHaveLength(1); expect(calls[0].requestId).not.toBe("old-receipt");
  });
  it("does not clear a newer shared journal after the old revision was read", () => {
    /** Capability observation installs another tab's selection before cleanup. */
    let journal: RaceRecovery | null = saved();
    /** Resolver removal must retire only the old observation. */
    const h = harness({}, null, {wallNow: () => 1000, getMatchmaking: () => {journal = {...saved(), id: "newer-search"}; return undefined;},
      recovery: {read: () => journal, save: record => {journal = record;}, clear: (owner, id) => {if (journal?.ownerId === owner && journal.id === id) journal = null;}}});
    expect(h.last().type).toBe("game:listRaceCategories"); expect(journal?.id).toBe("newer-search");
  });
  it("preserves available-provider recovery with its original receipt", async () => {
    /** Cold recovery can continue the same provider's already selected intent. */
    const calls: RaceMatchRequest[] = [];
    /** This adapter remains available throughout the entry lifetime. */
    const adapter: MatchmakingCapability = {find: async request => {calls.push(request); return {status: "cancelled"};}};
    /** Stored request belongs to this account and locale. */
    let journal: RaceRecovery | null = saved();
    /** Recovery dispatch is independent of presentation state. */
    const h = harness({}, null, {wallNow: () => 1000, getMatchmaking: () => adapter,
      recovery: {read: () => journal, save: record => {journal = record;}, clear: () => {journal = null;}}});
    await settleMatch(h.session); expect(calls[0].requestId).toBe("old-receipt");
  });
  it("keeps confirmed run recovery ahead of unavailable search hints", () => {
    /** A confirmed authoritative run must be read before any provider discovery intent. */
    let journal: RaceRecovery | null = saved();
    /** Optional provider lookup cannot replace the saved run selection. */
    const h = harness({}, "confirmed-run", {wallNow: () => 1000, getMatchmaking: () => {throw new Error("lookup");},
      recovery: {read: () => journal, save: record => {journal = record;}, clear: () => {journal = null;}}});
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: "confirmed-run"}});
    expect(journal?.id).toBe("saved-search");
  });
  it("does not duplicate entry work after cleanup installs a replacement account", async () => {
    /** Initial setup has no recovery, allowing replacement to be armed on a later entry. */
    let journal: RaceRecovery | null = null, armed = false;
    /** Storage notifications may synchronously install a different authenticated journey. */
    const h = harness({}, null, {wallNow: () => 1000, getMatchmaking: () => undefined,
      recovery: {read: () => journal, save: record => {journal = record;}, clear: () => {
        journal = null; if (armed) {armed = false; h.session.enter({locale: "en", ownerId: "owner-2"});}
      }}});
    h.respond("raceCategories", await catalog()); journal = saved(); armed = true;
    /** Only the replacement entry may issue its catalog command. */
    const count = h.commands.length; h.session.enter({locale: "en", ownerId: "owner-1"});
    expect(h.commands.slice(count).map(command => command.type)).toEqual(["game:listRaceCategories"]);
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", pending: "raceCategories", error: null});
  });
});
