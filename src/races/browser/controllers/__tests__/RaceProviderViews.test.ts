import {describe, expect, it, jest} from "@jest/globals";
import type {ListFacebookTournamentResponse, RecordFacebookTournamentRunResponse} from "../../../contracts/index";
import {RaceProviderViews} from "../RaceProviderViews";

/** Identity-free standings expose which delivery was accepted. */
const board = (rank = 1): ListFacebookTournamentResponse => ({tournamentId: `board-${rank}`, locale: "en",
  startsAtMs: 1000, endsAtMs: 2000, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
  standings: [{rank, adjustedTimeMs: 10000, isCurrentPlayer: true}]});
/** Controllable adapter delivery exercises success, loss and rejection without mocking module internals. */
const delivery = () => {
  /** Provider reply released by the test after navigation or a newer read. */
  let resolve!: (value: ListFacebookTournamentResponse) => void;
  /** Provider failure released by the test after navigation or a newer read. */
  let reject!: (error: Error) => void;
  /** One actual asynchronous read at the adapter seam. */
  const promise = new Promise<ListFacebookTournamentResponse>((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
};
/** Deterministic timer and provider adapters exercise whole observable transitions. */
const harness = () => {
  /** Monotonic time and timer sequence. */
  let now = 0, sequence = 0;
  /** Owned delivery deadlines. */
  const timers = new Map<number, {
    /** Scheduled deadline. */ at: number;
    /** Deadline transition. */ callback: () => void;
  }>();
  /** All independently controlled read deliveries. */
  const reads: ReturnType<typeof delivery>[] = [];
  /** Session error reports are the only downstream side effect. */
  const errors: Array<string | null> = [];
  /** Adapter calls retain their requested language. */
  const list = jest.fn((locale: string) => {
    /** Controlled request owned by this invocation. */
    const read = delivery(); reads.push(read); return read.promise;
  });
  /** Reads alone must never invent a completed run to record. */
  const record = jest.fn(async () => {throw new Error("unexpected-record");});
  /** Module follows the same timer seam as the competitive session. */
  const views = new RaceProviderViews({reportError: error => errors.push(error), clock: {
    schedule: (callback, delay) => {
      /** Unique timer identity. */
      const id = ++sequence; timers.set(id, {at: now + delay, callback}); return id;
    }, cancel: id => {timers.delete(id);},
  }});
  /** The target tournament adapter supplies identity-free standings. */
  const adapters = {tournaments: {list, record}};
  views.enter({locale: "en", ...adapters});
  return {views, reads, errors, list, record, timers, adapters,
    advance: (elapsed: number) => {now += elapsed; for (const [id, timer] of timers) if (timer.at <= now) {timers.delete(id); timer.callback();}},
  };
};
/** Flushes provider fulfillment and its rejection handler. */
const settle = async () => {await Promise.resolve(); await Promise.resolve();};
/** Successful provider projection receipt, independent of competitive settlement. */
const recorded = (): RecordFacebookTournamentRunResponse => ({tournamentId: "board-1", locale: "en", runId: "run-1",
  adjustedTimeMs: 10000, completedAtMs: 2000, improved: true, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false});

describe("owned multiplayer provider views", () => {
  it("preserves a newer account installed by an entry cleanup notification", async () => {
    /** Observable cleanup may synchronously replace authentication before the outer entry returns. */
    const h = harness();
    /** Recording adapters expose which account actually owns subsequent effects. */
    const oldRecord = jest.fn(async () => recorded()), newRecord = jest.fn(async () => recorded());
    /** The replacement language must reach reads as well as writes. */
    const newList = jest.fn(async () => ({...board(), locale: "ar" as const}));
    /** Replace exactly once during the old entry's empty-state notification. */
    let armed = true;
    h.views.subscribe(() => {if (armed) {armed = false; h.views.enter({locale: "ar", tournaments: {list: newList, record: newRecord}});}});
    h.views.enter({locale: "en", tournaments: {list: h.list, record: oldRecord}});
    h.views.record("run-1"); h.views.selectStage("tournaments"); await settle();
    expect(oldRecord).not.toHaveBeenCalled(); expect(h.list).not.toHaveBeenCalled();
    expect(newRecord).toHaveBeenCalledWith("run-1", "ar"); expect(newList).toHaveBeenCalledWith("ar");
    expect(h.views.getSnapshot().tournament?.locale).toBe("ar"); h.views.dispose(); expect(h.timers.size).toBe(0);
  });
  it("respects disposal requested by an entry cleanup notification", async () => {
    /** A host teardown notification must prevent an older requested entry from reopening adapters. */
    const h = harness();
    /** Dispose once to avoid recursive cleanup notifications. */
    let armed = true;
    h.views.subscribe(() => {if (armed) {armed = false; h.views.dispose();}});
    h.views.enter({locale: "en", ...h.adapters});
    h.views.record("run-1"); h.views.selectStage("tournaments"); await settle();
    expect(h.record).not.toHaveBeenCalled(); expect(h.list).not.toHaveBeenCalled();
    expect(h.timers.size).toBe(0); expect(h.views.getSnapshot().tournamentLoading).toBe(false);
  });
  it("retains a new account's delivery guard when an old recording rejects", async () => {
    /** Old and new owners can deliver the same run identifier through different adapters. */
    const h = harness();
    /** Late rejection belongs exclusively to the first adapter lifetime. */
    let reject!: (error: Error) => void;
    /** Controlled pending write, never used as a scoring authority. */
    const pending = new Promise<never>((_resolve, no) => {reject = no;});
    /** Independent adapters expose cross-account duplicate delivery. */
    const oldRecord = jest.fn(() => pending), newRecord = jest.fn(async () => recorded());
    h.views.enter({locale: "en", tournaments: {list: h.list, record: oldRecord}}); h.views.record("run-1");
    h.views.enter({locale: "ar", tournaments: {list: h.list, record: newRecord}}); h.views.record("run-1");
    reject(new Error("old-account-failure")); await settle(); h.views.record("run-1");
    expect(oldRecord).toHaveBeenCalledTimes(1); expect(newRecord).toHaveBeenCalledTimes(1);
    expect(newRecord).toHaveBeenCalledWith("run-1", "ar");
    h.views.dispose(); h.views.record("run-2");
    expect(newRecord).toHaveBeenCalledTimes(1); expect(h.errors).toEqual([]);
  });
  it.each(["success", "failure"])("ignores old %s after leaving and reopening the same tab", async ending => {
    /** Screen identity alone cannot distinguish two separate visits. */
    const h = harness(); h.views.selectStage("tournaments"); h.views.selectStage("categories");
    expect(h.timers.size).toBe(0);
    expect(h.views.getSnapshot().tournamentLoading).toBe(false);
    h.views.selectStage("tournaments");
    if (ending === "success") h.reads[0].resolve(board(9)); else h.reads[0].reject(new Error("old-private-error"));
    await settle();
    expect(h.views.getSnapshot()).toMatchObject({tournament: null, tournamentLoading: true, failed: false});
    expect(h.errors).toEqual([]);
    h.reads[1].resolve(board()); await settle();
    expect(h.views.getSnapshot()).toMatchObject({tournament: board(), tournamentLoading: false});
  });
  it("catches synchronous adapter failures and permits an explicit fresh read", async () => {
    /** Platform adapters can throw before returning their Promise. */
    const h = harness(); h.list.mockImplementationOnce(() => {throw new Error("private-native-failure");});
    expect(() => h.views.selectStage("tournaments")).not.toThrow();
    expect(h.views.getSnapshot()).toMatchObject({failed: true, tournamentLoading: false});
    expect(h.errors).toEqual(["RaceTo10.ERROR_GENERIC"]); expect(h.timers.size).toBe(0);
    h.views.refresh("tournaments"); h.reads[0].resolve(board()); await settle();
    expect(h.views.getSnapshot()).toMatchObject({tournament: board(), failed: false});
  });
  it("preserves a successful cache through a refresh failure and ignores late rejection after expiry", async () => {
    /** A failure must neither erase a known view nor poison the next delivery. */
    const h = harness(); h.views.selectStage("tournaments"); h.reads[0].resolve(board()); await settle();
    h.views.refresh("tournaments"); h.advance(30000); h.views.refresh("tournaments");
    h.reads[1].reject(new Error("expired-provider-error")); await settle();
    expect(h.views.getSnapshot()).toMatchObject({tournament: board(), tournamentLoading: true, failed: false});
    expect(h.errors).toEqual(["RaceTo10.ERROR_GENERIC", null]);
  });
});

/** Failed writes recover through visible reads without changing competitive authority. */

/** Retry routing follows provider identity rather than whichever screen happens to be visible. */
describe("provider record retry ownership", () => {
  it("retains a successful write guard when optional cache notification throws", async () => {
    /** Rendering failure cannot turn confirmed provider delivery into another write. */
    const h = harness();
    /** Successful provider receipt is independent of presentation callbacks. */
    const record = jest.fn(async () => recorded());
    h.views.enter({locale: "en", tournaments: {list: h.list, record}});
    /** A failing optional subscriber runs after the native delivery resolves. */
    const unsubscribe = h.views.subscribe(() => {throw new Error("presentation-unavailable");});
    h.views.record("run-1"); await settle(); await settle(); unsubscribe();
    h.views.record("run-1"); h.views.selectStage("tournaments"); await settle();
    expect(record).toHaveBeenCalledTimes(1); expect(h.errors).toEqual([]);
  });
});

/** Lost native replies must not permanently suppress completion delivery. */
describe("provider record delivery deadlines", () => {
  it.each(["success", "failure"])("ignores the old %s after a stalled write is replaced", async ending => {
    /** Distinct receipts protect the new write even when run identifiers match. */
    const h = harness();
    /** Late response from the expired first delivery. */
    let resolve!: (value: RecordFacebookTournamentRunResponse) => void, reject!: (error: Error) => void;
    /** The first delivery remains observable after its budget expires. */
    const old = new Promise<RecordFacebookTournamentRunResponse>((yes, no) => {resolve = yes; reject = no;});
    /** Successful replacement remains held while the old write settles. */
    let finish!: (value: RecordFacebookTournamentRunResponse) => void;
    /** Replacement write owns a separate receipt and deadline. */
    const current = new Promise<RecordFacebookTournamentRunResponse>(yes => {finish = yes;});
    /** Adapter records the same canonical run on both attempts. */
    const record = jest.fn(() => current); record.mockImplementationOnce(() => old);
    h.views.enter({locale: "en", tournaments: {list: h.list, record}}); h.views.record("run-1");
    h.advance(30000); h.views.selectStage("tournaments");
    expect(record).toHaveBeenCalledTimes(2); expect(h.list).toHaveBeenCalledTimes(1);
    if (ending === "success") resolve(recorded()); else reject(new Error("late-offline"));
    await settle(); h.views.record("run-1");
    expect(record).toHaveBeenCalledTimes(2); expect(h.list).toHaveBeenCalledTimes(1);
    finish(recorded()); await settle(); expect(h.list).toHaveBeenCalledTimes(2);
    h.reads[0].resolve(board(9)); await settle(); expect(h.views.getSnapshot().tournament).toBeNull();
    h.reads[1].resolve(board(1)); await settle(); expect(h.views.getSnapshot().tournament).toEqual(board(1));
    expect(h.timers.size).toBe(0); expect(h.errors).toEqual([]);
  });
});
