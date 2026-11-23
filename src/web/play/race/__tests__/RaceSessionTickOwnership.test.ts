import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "./raceSession.support";

describe("Race Session clock transition ownership", () => {
  it("does not read the old terminal run after a result observer replaces the account", async () => {
    /** A live challenger reaches the recorded opponent deadline. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed", "challenge");
    /** The immutable ghost provides the competitive deadline. */
    const run = {...await fixture(), role: "challenger" as const, challengeId: "challenge",
      opponent: {displayName: "Nova", adjustedFinishMs: 100000, events: []}};
    h.respond("raceStart", {run});h.advance(3480);
    /** Result publication synchronously installs a new authenticated journey. */
    let changed = false;
    /** Observe only the originating terminal publication before replacing its account. */
    const unsubscribe = h.session.subscribe(() => {
      if (!changed && h.session.getSnapshot().stage === "result") {
        changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});
      }
    });
    expect(() => h.advance(100001)).not.toThrow();unsubscribe();
    expect(changed).toBe(true);
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", pending: "raceCategories", run: null, outcome: null, error: null});
    expect(h.commands.filter(command => command.type === "game:getRaceOutcome")).toHaveLength(0);
    expect(h.timers.size).toBe(1);
  });
  it("does not expire an old invitation into an account installed by recovery cleanup", () => {
    /** Cleanup can synchronously install a different authenticated account. */
    let h: ReturnType<typeof harness>, armed = false, changed = false;
    h = harness({challengeId: "invitation"}, null, {recovery: {read: () => null, save: () => {}, clear: () => {
      if (armed && !changed) {changed = true;h.session.enter({locale: "en", ownerId: "owner-2"});}
    }}});
    h.respond("raceEntry", {status: "waiting", invitation: {claimState: "claimed", publicationState: "pending", role: "recipient", canCancel: false, expiresAtMs: 11000}, serverNowMs: 10000});
    armed = true;h.advance(1000);
    expect(changed).toBe(true);
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", pending: "raceCategories", entryStatus: null, error: null});
    expect(h.timers.size).toBe(1);
  });
});
