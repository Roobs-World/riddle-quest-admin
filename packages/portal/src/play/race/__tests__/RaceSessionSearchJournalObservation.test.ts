import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery} from "@qwordly/core/race";
import {catalog, harness, preview} from "./raceSession.support";

describe("Race Session unavailable search journal observation", () => {
  it.each(["matched", "empty", "failure"] as const)("preserves another tab's journal during a late %s result with denied reads", async mode => {
    /** Optional shared journal stores validated search intent across lifetimes. */
    let saved: RaceRecovery | null = null, denied = false;
    /** Public provider callback changes the shared selection before settling. */
    const h = harness({}, null, {wallNow: () => 1000, recovery: {read: () => {if (denied) throw new Error("read denied"); return saved;},
      save: record => {saved = record;}, clear: (_owner, id) => {if (saved?.id === id) saved = null;}}});
    h.respond("raceCategories", await catalog());
    await h.session.findOpponent({find: async () => {
      denied = true;
      saved = {...saved!, id: "other-tab-journal", intent: {kind: "challenge", challengeId: "newer-challenge"}};
      if (mode === "matched") return {status: "success", value: {status: "matched", challenge: preview()}};
      if (mode === "empty") return {status: "success", value: {status: "empty", locale: "en"}};
      return {status: "retryable-failure", message: "offline"};
    }});
    expect(saved).toMatchObject({id: "other-tab-journal", intent: {kind: "challenge", challengeId: "newer-challenge"}});
    expect(h.session.getSnapshot().findingOpponent).toBe(false);
    expect(h.session.getSnapshot().matchSearchStatus).toBe(mode === "failure" ? "failed" : mode);
    h.session.requestClose();
    expect(saved?.id).toBe("other-tab-journal");
  });
  it("does not resurrect a journal removed while a provider result is pending", async () => {
    /** Another tab can deliberately clear a previously observed selection. */
    let saved: RaceRecovery | null = null;
    /** Storage retains the initial search until the provider models another tab's removal. */
    const h = harness({}, null, {recovery: {read: () => saved, save: record => {saved = record;}, clear: () => {saved = null;}}});
    h.respond("raceCategories", await catalog());
    await h.session.findOpponent({find: async () => {
      saved = null;
      return {status: "success", value: {status: "matched", challenge: preview()}};
    }});
    expect(saved).toBeNull();
    expect(h.session.getSnapshot()).toMatchObject({matchSearchStatus: "matched", stage: "challenge"});
  });
});
