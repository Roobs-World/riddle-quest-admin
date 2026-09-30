import {describe, it, expect, jest} from "@jest/globals";
import type {MatchmakingCapability} from "../../../platform/types";
import {harness, catalog, fixture} from "./raceSession.support";
import {parseRaceRecovery, type RaceRecovery} from "../logic/raceRecoveryStorage";

/** Stable empty-pool receipt supplied through the real provider adapter contract. */
const fallback = {status: "empty" as const, locale: "en" as const, fallback: {offerId: "a".repeat(64), categoryId: "mixed" as const}};

describe("Empty multiplayer fallback", () => {
  it("starts an offered rival through normal preparation without showing an empty-pool message", async () => {
    /** Provider-owned journey retains the fallback receipt through start recovery. */
    const h = harness(); h.respond("raceCategories", await catalog());
    await h.session.findOpponent({find: async () => ({status: "success", value: fallback})});
    expect(h.last()).toMatchObject({type: "game:startRace", payload: {locale: "en", categoryId: "mixed",
      fallbackOfferId: fallback.fallback.offerId, prepare: true, includeEvaluation: true}});
    expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", error: null, findingOpponent: false});
    /** Original idempotent start command must survive uncertain delivery. */
    const original = h.last();
    h.reject("raceStart", "delivery-lost"); h.session.retry();
    expect(h.last().payload).toEqual(original.payload);
  });

  it("persists fallback acceptance before transport and replays it after reload", async () => {
    /** Persisted account-bound recovery record. */
    let saved: RaceRecovery | null = null;
    /** Storage adapter used by both session lifetimes. */
    const recovery = {read: (ownerId: string | undefined, locale: string, now: number) => parseRaceRecovery(saved, ownerId, locale, now),
      save: (value: RaceRecovery) => {saved = value;}, clear: () => {saved = null;}};
    /** First player journey receives and accepts the fallback. */
    const h = harness({}, null, {recovery, wallNow: () => 1000}); h.respond("raceCategories", await catalog());
    await h.session.findOpponent({find: async () => ({status: "success", value: fallback})});
    /** Reload must replay the original acceptance receipt. */
    const original = h.last(); h.session.dispose();
    /** Replacement journey restores storage before issuing any new intent. */
    const reloaded = harness({}, null, {recovery, wallNow: () => 1001});
    expect(reloaded.last().payload).toEqual(original.payload);
    expect(reloaded.last().type).toBe("game:startRace");
  });

  it("rejects a fallback outside the selected category", async () => {
    /** Explicit category selection remains part of request ownership. */
    const h = harness(); h.respond("raceCategories", await catalog());
    await h.session.findOpponent({find: async () => ({status: "success", value: fallback})}, "history");
    expect(h.last().type).toBe("game:listRaceCategories");
    expect(h.session.getSnapshot()).toMatchObject({matchSearchStatus: "failed", error: "RaceTo10.ERROR_INVALID_RESPONSE"});
  });

  it("ignores an empty result arriving after account replacement", async () => {
    /** First account owns the pending provider selection. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Delayed response is released only after replacement. */
    let resolve!: (result: Awaited<ReturnType<MatchmakingCapability["find"]>>) => void;
    /** In-flight provider lookup whose late result cannot start the new account's run. */
    const pending = h.session.findOpponent({find: () => new Promise(yes => {resolve = yes;})});
    h.session.enter({ownerId: "new-owner", locale: "en"});
    resolve({status: "success", value: fallback}); await pending;
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(0);
  });

  it("searches for a new rival after a fallback race instead of starting a solo recording", async () => {
    /** Current provider journey supplies the fallback and owns subsequent rematches. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Observable provider search verifies a fresh opponent intent. */
    const find = jest.fn<MatchmakingCapability["find"]>().mockResolvedValue({status: "success", value: fallback});
    await h.session.findOpponent({find});
    /** Fallback authority confirms a challenger run without a recorded challenge ID. */
    const run = {...await fixture(), role: "challenger" as const, challengeId: undefined,
      opponent: {displayName: "Nova", adjustedFinishMs: 120000, events: []}};
    h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {role: "challenger"}});
    h.session.rematch("mixed");
    await Promise.resolve(); await Promise.resolve();
    expect(find).toHaveBeenCalledTimes(2);
    expect(find.mock.calls[1][0]).toMatchObject({locale: "en", categoryId: "mixed"});
  });
});
