import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery, RaceMatchRequest} from "../../../../core/race";
import {catalog, harness, preview, settleMatch} from "./raceSession.support";

describe("Race Session search retry journal ownership", () => {
  it.each(["replacement", "denied", "removed"] as const)("does not reclaim shared recovery during a %s retry", async mode => {
    /** Shared journal and read availability change independently of the retained provider intent. */
    let saved: RaceRecovery | null = null, denied = false;
    /** Public provider calls retain their idempotency request identity. */
    const requests: RaceMatchRequest[] = [];
    /** A canonical failure enables retry without issuing a new search receipt. */
    const h = harness({}, null, {wallNow: () => 1000, recovery: {read: () => {
      if (denied) throw new Error("read denied"); return saved;
    }, save: record => {saved = record;}, clear: (_owner, id) => {if (saved?.id === id) saved = null;}}});
    h.respond("raceCategories", await catalog());
    await h.session.findOpponent({find: async request => {
      requests.push(request);
      if (requests.length === 1) return {status: "retryable-failure", message: "offline"};
      return {status: "success", value: {status: "matched", challenge: preview()}};
    }});
    saved = mode === "removed" ? null : {...saved!, id: "newer-tab-journal", intent: {kind: "challenge", challengeId: "newer-challenge"}};
    denied = mode === "denied"; h.advance(1000); h.session.retry(); await settleMatch(h.session);
    expect(saved).toEqual(mode === "removed" ? null : expect.objectContaining({id: "newer-tab-journal"}));
    expect(requests).toHaveLength(2); expect(requests[1].requestId).toBe(requests[0].requestId);
    expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", matchSearchStatus: "matched", findingOpponent: false});
  });
  it("lets a deliberate fresh search replace another tab's journal", async () => {
    /** Shared state retains each explicit selection and its completion. */
    let saved: RaceRecovery | null = null;
    /** An empty store permits initial catalog entry before another tab selects a challenge. */
    const h = harness({}, null, {wallNow: () => 1000, recovery: {read: () => saved, save: record => {saved = record;}, clear: () => {}}});
    h.respond("raceCategories", await catalog());
    await h.session.findOpponent({find: async () => ({status: "retryable-failure", message: "offline"})});
    saved = {...saved!, id: "other-tab-journal", intent: {kind: "challenge", challengeId: "other-challenge"}};
    await h.session.findOpponent({find: async () => ({status: "success", value: {status: "matched", challenge: preview("fresh-challenge")}})});
    expect(saved).toMatchObject({intent: {kind: "challenge", challengeId: "fresh-challenge"}});
    expect(saved?.id).not.toBe("other-tab-journal");
    expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "fresh-challenge"});
  });
});
