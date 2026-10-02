import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery} from "@qwordly/core/race";
import {harness, preview} from "./raceSession.support";

describe("Race Session challenge refresh journal ownership", () => {
  it.each(["retry", "poll"] as const)("preserves competing selection during %s reads", path => {
    for (const mode of ["replacement", "denied", "removed"] as const) {
      /** Optional shared journal changes after the original challenge was selected. */
      let journal: RaceRecovery | null = null, denied = false;
      /** Storage failure is independent from an otherwise valid entry refresh. */
      const h = harness({challengeId: "old-challenge"}, null, {wallNow: () => 1000, recovery: {read: () => {
        if (denied) throw new Error("read denied"); return journal;
      }, save: record => {journal = record;}, clear: (_owner, id) => {if (journal?.id === id) journal = null;}}});
      if (path === "retry") h.reject("raceEntry", "offline");
      else h.respond("raceEntry", {status: "waiting", serverNowMs: 10000,
        invitation: {claimState: "claimed", publicationState: "pending", role: "recipient", canCancel: false, expiresAtMs: 1000000}});
      journal = mode === "removed" ? null : {...journal!, id: "newer-journal", intent: {kind: "challenge", challengeId: "newer-challenge"}};
      denied = mode === "denied";
      if (path === "retry") h.session.retry(); else h.advance(1000);
      expect(h.last()).toMatchObject({type: "game:getRaceEntry", payload: {challengeId: "old-challenge"}});
      expect(h.commands).toHaveLength(2);
      expect(journal).toEqual(mode === "removed" ? null : expect.objectContaining({id: "newer-journal"}));
      h.respond("raceEntry", {status: "ready", serverNowMs: 10000, challenge: preview("old-challenge")});
      expect(h.session.getSnapshot()).toMatchObject({entryStatus: {status: "ready"}, error: null});
      expect(journal).toEqual(mode === "removed" ? null : expect.objectContaining({id: "newer-journal"}));
      h.session.dispose();
    }
  });
});
