import {describe, expect, it} from "@jest/globals";
import {catalog, harness, preview} from "./raceSession.support";

describe("Race Session discovery completion ownership", () => {
  it.each(["matched", "empty", "failure", "cancelled"] as const)("preserves a replacement account during %s recovery callbacks", async mode => {
    /** Storage is allowed to synchronously notify the authentication owner. */
    let h: ReturnType<typeof harness>, armed = false, changed = false;
    /** Replace exactly once during completion persistence, after discovery has begun. */
    const replace = () => {if (armed && !changed) {changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});}};
    h = harness({}, null, {recovery: {read: () => null, save: replace, clear: replace}});
    h.respond("raceCategories", await catalog());
    /** A provider result crosses the public discovery interface. */
    await h.session.findOpponent({find: async () => {
      armed = true;
      if (mode === "matched") return {status: "success", value: {status: "matched", challenge: preview()}};
      if (mode === "empty") return {status: "success", value: {status: "empty", locale: "en"}};
      if (mode === "cancelled") return {status: "cancelled"};
      return {status: "retryable-failure", message: "offline"};
    }});
    expect(changed).toBe(true);
    expect(h.last()).toMatchObject({type: "game:listRaceCategories"});
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", pending: "raceCategories", error: null,
      matchSearchStatus: "idle", findingOpponent: false, challenge: null});
    expect(h.timers.size).toBe(1);
  });
});
