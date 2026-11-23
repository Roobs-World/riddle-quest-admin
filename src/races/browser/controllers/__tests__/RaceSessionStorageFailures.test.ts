import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery} from "../../../contracts/index";
import {catalog, fixture, harness} from "./raceSession.support.ts";

/** Optional storage can be denied independently of authority and transport. */
const unavailable = (): never => {throw new Error("optional-storage-unavailable");};

describe("Race Session optional storage failure isolation", () => {
  it("continues cold entry from a confirmed run hint when the recovery read throws", () => {
    /** A confirmed run hint outranks unavailable selection recovery. */
    let h: ReturnType<typeof harness> | undefined;
    expect(() => {h = harness({}, "owned-run", {recovery: {read: unavailable, save: () => {}, clear: () => {}}});}).not.toThrow();
    expect(h!.last()).toMatchObject({type: "game:resumeRace", payload: {runId: "owned-run"}});
  });

  it("preserves a validated original start receipt when the active-run hint read throws", () => {
    /** Existing selection recovery is still usable when the other optional store is unavailable. */
    const saved: RaceRecovery = {version: 1, id: "recovery-id", ownerId: "owner-1", locale: "en", savedAtMs: 1000,
      expiresAtMs: 2000, intent: {kind: "start", request: {locale: "en", categoryId: "mixed", requestId: "original-start", includeEvaluation: true, prepare: true}}};
    /** The public entry must issue the original idempotent start rather than throw. */
    let h: ReturnType<typeof harness> | undefined;
    expect(() => {h = harness({}, null, {wallNow: () => 1000, recovery: {read: () => saved, save: () => {}, clear: () => {}},
      persistence: {read: unavailable, save: () => {}, clear: () => {}}});}).not.toThrow();
    expect(h!.last()).toMatchObject({type: "game:startRace", requestId: "original-start", payload: {requestId: "original-start"}});
  });

  it("delivers a new start when saving its optional recovery intent throws", async () => {
    /** Storage is a resume aid, not a prerequisite for a valid new authority mutation. */
    const h = harness({}, null, {recovery: {read: () => null, save: unavailable, clear: () => {}}});
    h.respond("raceCategories", await catalog());
    expect(() => h.session.begin("mixed")).not.toThrow();
    expect(h.last().type).toBe("game:startRace");
    h.respond("raceStart", {run: await fixture(true)});
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceReady", error: null});
  });

  it.each(["read", "save", "recovery-clear"] as const)("does not reject accepted preparation when optional %s fails", async boundary => {
    /** Reads fail only during authority acceptance, after initial entry has completed. */
    let armed = false;
    /** Independently failing optional adapters preserve their normal receiver-bound methods. */
    const h = harness({}, null, {recovery: {read: () => null, save: () => {}, clear: () => {if (armed && boundary === "recovery-clear") unavailable();}},
      persistence: {read: () => {if (armed && boundary === "read") unavailable(); return null;},
        save: () => {if (armed && boundary === "save") unavailable();}, clear: () => {}}});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Complete server preparation remains accepted even without reload persistence. */
    const run = await fixture(true); armed = true; h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceReady", error: null, run});
    h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: run.serverNowMs! + 3000}}); h.advance(3480);
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", pending: null, error: null});
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(1);
  });

  it("still closes after cleanup of a lost-start recovery hint throws", async () => {
    /** A failed start leaves a selected intent which close attempts to remove. */
    const h = harness({}, null, {recovery: {read: () => null, save: () => {}, clear: unavailable}});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.reject("raceStart", "lost-start");
    expect(() => h.session.requestClose()).not.toThrow();
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
    expect(h.timers.size).toBe(0);
  });

  it("does not undo accepted abandonment when the active-run hint clear throws", async () => {
    /** Canonical abandonment must not depend on optional resume-hint cleanup. */
    const h = harness({}, null, {persistence: {read: () => null, save: () => {}, clear: unavailable}});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** The owned prepared run can be abandoned before its scored countdown. */
    const run = await fixture(true); h.respond("raceStart", {run});
    h.respond("raceReady", {run: {...run, status: "scheduled", startsAtMs: run.serverNowMs! + 3000}});
    h.session.abandon(); h.respond("raceAbandon", {run: {...run, status: "abandoned", currentRiddle: null}, result: null});
    expect(h.effects.filter(effect => effect.kind === "close")).toHaveLength(1);
    expect(h.session.getSnapshot().error).toBeNull();
  });

  it("still invokes provider discovery when the optional search journal cannot be saved", async () => {
    /** Failure to retain a reload hint does not revoke authenticated provider capability. */
    const h = harness({}, null, {recovery: {read: () => null, save: unavailable, clear: () => {}}});
    h.respond("raceCategories", await catalog());
    /** Count the actual provider request and its valid empty result. */
    let finds = 0;
    await expect(h.session.findOpponent({find: async () => {finds++; return {status: "success", value: {status: "empty", locale: "en"}};}}, "mixed")).resolves.toBeUndefined();
    expect(finds).toBe(1); expect(h.session.getSnapshot()).toMatchObject({findingOpponent: false, matchSearchStatus: "empty"});
    expect(h.timers.size).toBe(0);
  });
  it("preserves receiver-bound adapter methods and usable resume hints", async () => {
    /** Some storage adapters keep their validated hint on the receiver. */
    const adapter = {hint: "",
      /** Reads the hint retained on this adapter receiver. */
      read() {return this.hint || null;},
      /** Stores the accepted run without losing method binding. */
      save(_ownerId: string | undefined, runId: string) {this.hint = runId;},
      /** Removes the hint on the same adapter receiver. */
      clear() {this.hint = "";}};
    /** A successful accepted preparation must still save and resume normally. */
    const h = harness({}, null, {persistence: adapter}); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** The original authority identity is retained rather than replacing it with a fallback. */
    const run = await fixture(true); h.respond("raceStart", {run});
    expect(adapter.hint).toBe(run.runId);
    h.session.enter(); expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: run.runId}});
  });

  it("retains account invalidation when an optional adapter replaces the account and then throws", async () => {
    /** Swallowing an optional storage exception cannot revive its originating lifetime. */
    let h: ReturnType<typeof harness>, armed = false;
    h = harness({}, null, {persistence: {read: ownerId => {
      if (armed && ownerId === "owner-1") {armed = false; h.session.enter({locale: "en", ownerId: "owner-2"}); unavailable();}
      return null;
    }, save: () => {}, clear: () => {}}});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed"); armed = true;
    h.respond("raceStart", {run: await fixture(true)});
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceCategories", stage: "categories", run: null, error: null});
    expect(h.commands.filter(command => command.type === "game:readyRace")).toHaveLength(0);
    expect(h.timers.size).toBe(1);
  });

});
