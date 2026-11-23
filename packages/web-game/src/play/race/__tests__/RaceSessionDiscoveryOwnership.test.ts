import {describe, expect, it} from "@jest/globals";
import type {MatchmakingCapability, MatchmakingResult} from "../../../platform/types";
import type {RaceRecovery} from "@riddle-quest/core/race";
import {catalog, harness, preview} from "./raceSession.support";

describe("Race Session discovery completion ownership", () => {
  it.each(["removed", "replaced"].flatMap(mode => ["matched", "fallback", "empty", "failure", "cancelled", "rejected"].map(result => [mode, result])))("ignores %s provider completion for %s", async (mode, result) => {
    /** Mutable provider selection represents the host's current capability. */
    let selected: MatchmakingCapability | undefined;
    /** Exact delayed result belongs to the original search adapter. */
    let resolve!: (result: MatchmakingResult) => void;
    /** Rejections must obey the same selected-provider boundary as successful responses. */
    let reject!: (error: Error) => void;
    /** Original provider deliberately remains unresolved while its selection changes. */
    const first: MatchmakingCapability = {find: () => new Promise((yes, no) => {resolve = yes; reject = no;})};
    selected = first;
    /** Replacement capability must remain unused until another explicit player search. */
    const second: MatchmakingCapability = {find: async () => ({status: "cancelled"})};
    /** Production session resolves the currently rendered provider selection. */
    const h = harness({}, null, {getMatchmaking: () => selected});
    h.respond("raceCategories", await catalog());
    /** Delayed lookup may not migrate its offered recording into a replacement provider. */
    const pending = h.session.findOpponent(first);
    selected = mode === "removed" ? undefined : second;
    if (result === "rejected") reject(new Error("offline"));
    else if (result === "failure") resolve({status: "retryable-failure", message: "offline"});
    else if (result === "cancelled") resolve({status: "cancelled"});
    else resolve({status: "success", value: result === "matched" ? {status: "matched", challenge: preview()} :
      {status: "empty", locale: "en", ...(result === "fallback" ? {fallback: {offerId: "a".repeat(64), categoryId: "mixed"}} : {})}});
    await pending;
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", challenge: null, findingOpponent: false,
      matchSearchStatus: "idle", error: null});
  });
  it.each(["removed", "replaced"] as const)("does not retry a retired provider when %s", async mode => {
    /** Count observable SDK calls independently of final session state. */
    let calls = 0;
    /** A transport failure normally permits same-intent recovery. */
    const first: MatchmakingCapability = {find: async () => {calls++; return {status: "retryable-failure", message: "offline"};}};
    /** Live adapter selection changes before the player retries. */
    let selected: MatchmakingCapability | undefined = first;
    /** Resolver-backed session retains its failed search until explicit recovery. */
    const h = harness({}, null, {getMatchmaking: () => selected});
    h.respond("raceCategories", await catalog());
    await h.session.findOpponent(first);
    h.advance(1000);
    selected = mode === "removed" ? undefined : {find: async () => ({status: "cancelled"})};
    h.session.retry();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(calls).toBe(1);
  });

  it("settles a never-returning retired search at its original deadline", async () => {
    /** Provider selection can disappear while its SDK never resolves. */
    let selected: MatchmakingCapability | undefined = {find: () => new Promise(() => {})};
    /** Existing delivery budget must bound the obsolete SDK wait. */
    const h = harness({}, null, {getMatchmaking: () => selected});
    h.respond("raceCategories", await catalog());
    /** Original wait remains owned until completion or its bounded deadline. */
    const pending = h.session.findOpponent(selected);
    selected = undefined;
    h.advance(30000);
    await pending;
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", findingOpponent: false,
      matchSearchStatus: "idle", matchFailure: null, error: null});
  });
  it.each(["matched", "empty", "failure", "cancelled"] as const)("preserves a replacement account during %s recovery callbacks", async mode => {
    /** Storage is allowed to synchronously notify the authentication owner. */
    let h: ReturnType<typeof harness>, armed = false, changed = false;
    /** Replace exactly once during completion persistence, after discovery has begun. */
    const replace = () => {if (armed && !changed) {changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});}};
    /** Store the journal so later completion observes its actual owned revision. */
    let journal: RaceRecovery | null = null;
    h = harness({}, null, {recovery: {read: () => journal, save: record => {journal = record; replace();}, clear: replace}});
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
