import {describe, expect, it} from "@jest/globals";
import {raceMatchFailure, type RaceRecovery} from "../../../contracts/index";
import type {MatchmakingCapability} from "../../../../platform/contracts/capabilities";
import {catalog, harness, settleMatch} from "../../controllers/__tests__/raceSession.support.ts";

/** Cold discovery starts without the host's optional preloaded category cache. */
const saved = (): RaceRecovery => ({version: 1, id: "saved-search", ownerId: "owner-1", locale: "en",
  savedAtMs: 1000, expiresAtMs: 2000, intent: {kind: "search", request: {locale: "en", requestId: "old-receipt"}}});

describe("Cold discovery catalog recovery", () => {
  it.each(["cancelled", "failure", "empty", "saved-failure"])("loads the catalog after %s without erasing recovery guidance", async mode => {
    /** Persisted selection retains its original retry identity across catalog delivery. */
    let journal: RaceRecovery | null = saved();
    if (mode === "saved-failure") journal.intent = {kind: "search", request: {locale: "en", requestId: "old-receipt"}, failure: raceMatchFailure("temporarily-unavailable", 1000)};
    /** This provider settles before any category response has arrived. */
    const adapter: MatchmakingCapability = {find: async () => mode === "cancelled" ? {status: "cancelled"} : mode === "empty" ?
      {status: "success", value: {status: "empty", locale: "en"}} : {status: "retryable-failure", failure: raceMatchFailure("temporarily-unavailable", 1000)}};
    /** Catalog receipts use the public bridge, independently of provider discovery. */
    const h = harness({}, null, {wallNow: () => 1000, getMatchmaking: () => adapter,
      recovery: {read: () => journal, save: record => {journal = record;}, clear: () => {journal = null;}}});
    await settleMatch(h.session);
    expect(h.last()?.type).toBe("game:listRaceCategories");
    /** Loading categories must preserve the provider's failed/empty retry explanation. */
    const before = h.session.getSnapshot();
    expect(before.matchSearchStatus).toBe(mode === "cancelled" ? "idle" : mode === "empty" ? "empty" : "failed");
    h.respond("raceCategories", await catalog());
    expect(h.session.getSnapshot()).toMatchObject({categories: (await catalog()).categories, pending: null,
      error: before.error, matchSearchStatus: before.matchSearchStatus, matchFailure: before.matchFailure});
    if (mode !== "cancelled") expect(journal?.intent).toMatchObject({kind: "search", request: {requestId: "old-receipt"}});
  });
  it("loads categories when the provider retires during a cold search", async () => {
    /** Provider availability changes while its original promise is still outstanding. */
    let selected: MatchmakingCapability | undefined;
    /** Pending discovery cannot prevent the newly idle hub from loading. */
    const adapter: MatchmakingCapability = {find: () => new Promise(() => undefined)};
    selected = adapter;
    /** Account-bound recovery is still valid at initial entry. */
    const h = harness({}, null, {wallNow: () => 1000, getMatchmaking: () => selected,
      recovery: {read: saved, save: () => undefined, clear: () => undefined}});
    selected = undefined; h.session.tick(); await settleMatch(h.session);
    expect(h.last()?.type).toBe("game:listRaceCategories");
    h.respond("raceCategories", await catalog()); expect(h.session.getSnapshot().categories.length).toBeGreaterThan(0);
  });
});
