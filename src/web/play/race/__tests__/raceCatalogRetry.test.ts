import {describe, expect, it} from "@jest/globals";
import {raceMatchFailure, type RaceRecovery} from "../../../../core/race";
import type {MatchmakingCapability} from "../../../platform/types";
import {catalog, harness, settleMatch} from "./raceSession.support";

describe("Catalog retry independent of discovery policy", () => {
  it.each([["terminal", "network"], ["waiting", "network"], ["ready", "network"], ["terminal", "malformed"], ["terminal", "timeout"]])("retries only categories after a %s search and %s catalog failure", async (mode, delivery) => {
    /** Retained provider policy belongs to the original discovery receipt. */
    const failure = raceMatchFailure(mode === "terminal" ? "access-denied" : "temporarily-unavailable", mode === "waiting" ? 5000 : 0);
    /** Catalog retries must never replay or rotate provider discovery. */
    const requests: unknown[] = [];
    /** Current provider would accept a retry if incorrectly invoked. */
    const adapter: MatchmakingCapability = {find: async request => {requests.push(request); return {status: "cancelled"};}};
    /** Stored failure precedes a cold catalog load. */
    let journal: RaceRecovery | null = {version: 1, id: "search", ownerId: "owner-1", locale: "en", savedAtMs: 1000, expiresAtMs: 2000,
      intent: {kind: "search", request: {locale: "en", requestId: "original"}, failure, retryAtMs: 1000 + failure.retryAfterMs}};
    /** Public transport seam correlates category errors independently of the SDK. */
    const h = harness({}, null, {wallNow: () => 1000, getMatchmaking: () => adapter,
      recovery: {read: () => journal, save: record => {journal = record;}, clear: () => {journal = null;}}});
    /** Accepted discovery diagnostic must return after catalog transport recovers. */
    const error = h.session.getSnapshot().error;
    if (delivery === "malformed") h.respond("raceCategories", {categories: [{}]});
    else if (delivery === "timeout") h.advance(30000);
    else h.reject("raceCategories", "Network unavailable");
    /** Generic Retry targets the failed catalog, even with a ready provider retry. */
    const before = h.commands.length; h.session.retry(); await settleMatch(h.session);
    expect(h.commands.slice(before).map(command => command.type)).toEqual(["game:listRaceCategories"]);
    expect(requests).toHaveLength(0);
    h.respond("raceCategories", await catalog());
    expect(h.session.getSnapshot()).toMatchObject({error, pending: null, matchSearchStatus: "failed", matchFailure: failure});
    /** Completed catalog recovery cannot bypass terminal discovery policy or its deadline. */
    h.session.retry(); await settleMatch(h.session); expect(requests).toHaveLength(mode === "ready" ? 1 : 0);
    if (mode === "ready") expect(requests[0]).toMatchObject({requestId: "original"});
  });
});
