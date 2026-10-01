import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "./raceSession.support";

describe("Race Session cleanup ownership", () => {
  it.each(["dispose", "recovery"] as const)("does not close the replacement account after an old %s callback", async boundary => {
    /** The old account's selected intent provides recovery cleanup on close. */
    let h: ReturnType<typeof harness>, armed = false, changed = false;
    h = harness({}, null, {recovery: {read: () => null, save: () => {}, clear: () => {
      if (armed && boundary === "recovery") {armed = false; changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});}
    }}});
    h.respond("raceCategories", await catalog());
    if (boundary === "recovery") {h.session.begin("mixed"); h.reject("raceStart", "lost-start");}
    /** Disposal publication can itself synchronously change the account. */
    const unsubscribe = h.session.subscribe(() => {
      if (armed && boundary === "dispose") {armed = false; changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});}
    });
    armed = true; h.session.requestClose(); unsubscribe();
    expect(changed).toBe(true);
    expect(h.effects.filter(effect => effect.kind === "close")).toEqual([]);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceCategories", stage: "categories", run: null});
    expect(h.timers.size).toBe(1);
    h.respond("raceCategories", await catalog());
    expect(h.session.getSnapshot()).toMatchObject({pending: null, error: null});
  });

  it("does not reset a new provider search while finishing old disposal", async () => {
    /** Reentrant replacement starts a genuine provider wait rather than a synthetic state patch. */
    const h = harness(), categories = (await catalog()).categories;
    h.respond("raceCategories", {categories});
    /** Only the first disposal publication replaces account ownership. */
    let changed = false, search: Promise<void> | undefined;
    /** The provider stays unresolved until cleanup so the new search remains observable. */
    const unsubscribe = h.session.subscribe(() => {
      if (!changed) {
        changed = true; h.session.enter({locale: "en", ownerId: "owner-2", initialCategories: categories});
        search = h.session.findOpponent({find: () => new Promise(() => {})}, "mixed");
      }
    });
    h.session.dispose(); unsubscribe();
    expect(h.session.getSnapshot()).toMatchObject({findingOpponent: true, matchSearchStatus: "searching", pending: null});
    expect(h.timers.size).toBe(1);
    h.session.dispose(); await search;
    expect(h.timers.size).toBe(0);
  });

  it.each(["recovery", "read"] as const)("does not persist again into a replacement account after the old %s callback", async boundary => {
    /** Authority fixtures carry different opaque run IDs across account replacement. */
    const original = await fixture(true), replacement = {...original, runId: "replacement-run"};
    /** Both accounts can enter with a previously validated catalog. */
    const categories = (await catalog()).categories;
    /** Capture actual persistence side effects independently of session state. */
    const writes: Array<{
      /** Account receiving this actual storage write. */ ownerId: string | undefined;
      /** Authority run retained for recovery. */ runId: string;
    }> = [];
    /** Arm replacement only during the original run's acceptance. */
    let h: ReturnType<typeof harness>, armed = false;
    /** Nested valid authority responses fully establish the replacement account's run. */
    const replace = () => {
      armed = false; h.session.enter({locale: "en", ownerId: "owner-2", initialCategories: categories}); h.session.begin("mixed");
      h.respond("raceStart", {run: replacement});
      h.respond("raceReady", {run: {...replacement, status: "scheduled", startsAtMs: replacement.serverNowMs! + 3000}});
    };
    h = harness({}, null, {recovery: {read: () => null, save: () => {}, clear: ownerId => {
      if (armed && ownerId === "owner-1" && boundary === "recovery") replace();
    }}, persistence: {read: ownerId => {
      if (armed && ownerId === "owner-1" && boundary === "read") replace();
      return null;
    }, save: (ownerId, runId) => {writes.push({ownerId, runId});}, clear: () => {}}});
    h.respond("raceCategories", {categories}); h.session.begin("mixed");
    armed = true; h.respond("raceStart", {run: original});
    expect(writes).toEqual([{ownerId: "owner-2", runId: replacement.runId}, {ownerId: "owner-2", runId: replacement.runId}]);
    expect(h.session.getSnapshot()).toMatchObject({run: {runId: replacement.runId}, error: null, pending: null});
    expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(1);
  });

  it("still emits one close and clears delivery timers when no observer replaces the journey", async () => {
    /** A normal local close must not be suppressed by disposal invalidating the old active flag. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.requestClose();
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
    expect(h.timers.size).toBe(0);
  });
});
