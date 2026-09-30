import {describe, expect, it, jest} from "@jest/globals";
import type {ListFacebookTournamentResponse, RecordFacebookTournamentRunResponse} from "@qwordly/core/race";
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
  /** Record operations must never be invoked by optional reads or recovery. */
  const record = jest.fn(async () => {throw new Error("unexpected-record");});
  /** Module follows the same timer seam as the competitive session. */
  const views = new RaceProviderViews({reportError: error => errors.push(error), clock: {
    schedule: (callback, delay) => {
      /** Unique timer identity. */
      const id = ++sequence; timers.set(id, {at: now + delay, callback}); return id;
    }, cancel: id => {timers.delete(id);},
  }});
  /** Both real platform interfaces can supply the shared identity-free view shape. */
  const adapters = {tournaments: {list, record}, contextBoard: {list, record}};
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
  it("refreshes a changed context and ignores the previous context's pending standings", async () => {
    /** Cache and delayed reads both belong to the old context until selection is confirmed. */
    const h = harness(); h.views.selectStage("inbox"); h.reads[0].resolve(board(9)); await settle();
    h.views.refresh("inbox"); h.views.contextChanged();
    expect(h.list).toHaveBeenCalledTimes(3);
    expect(h.views.getSnapshot()).toMatchObject({contextBoard: null, contextBoardLoading: true, failed: false});
    h.reads[1].resolve(board(8)); await settle();
    expect(h.views.getSnapshot()).toMatchObject({contextBoard: null, contextBoardLoading: true});
    h.reads[2].resolve(board(1)); await settle();
    expect(h.views.getSnapshot()).toMatchObject({contextBoard: board(1), contextBoardLoading: false});
    expect(h.timers.size).toBe(0); expect(h.errors).toEqual([]);
  });
  it("clears a hidden context cache without cancelling an unrelated tournament read", async () => {
    /** Context selection can finish after navigation to a different provider screen. */
    const h = harness(); h.views.selectStage("inbox"); h.reads[0].resolve(board(9)); await settle();
    h.views.selectStage("tournaments"); h.views.contextChanged();
    expect(h.views.getSnapshot()).toMatchObject({contextBoard: null, tournamentLoading: true});
    expect(h.list).toHaveBeenCalledTimes(2);
    h.reads[1].resolve(board(2)); await settle();
    expect(h.views.getSnapshot()).toMatchObject({tournament: board(2), tournamentLoading: false});
    h.views.selectStage("inbox"); expect(h.list).toHaveBeenCalledTimes(3);
    h.views.dispose(); h.views.contextChanged(); expect(h.list).toHaveBeenCalledTimes(3);
  });
  it("clears the failed old context error when a confirmed selection starts a new read", async () => {
    /** Changing provider context is independent read recovery, not a race mutation. */
    const h = harness(); h.views.selectStage("inbox"); h.reads[0].reject(new Error("old-context-unavailable")); await settle();
    h.views.contextChanged();
    expect(h.errors).toEqual(["RaceTo10.ERROR_GENERIC", null]);
    expect(h.views.getSnapshot()).toMatchObject({failed: false, contextBoardLoading: true});
    h.reads[1].resolve(board()); await settle(); expect(h.views.getSnapshot().failed).toBe(false);
    expect(h.record).not.toHaveBeenCalled();
  });
  it.each(["sync", "async"])("isolates a %s recording failure and retries only the failed adapter", async failure => {
    /** A failing tournament cannot suppress an independent context delivery. */
    const h = harness();
    /** Each adapter owns its own delivery guard for the same run. */
    const tournament = jest.fn(async () => recorded()), context = jest.fn(async () => recorded());
    tournament.mockImplementationOnce(() => {
      if (failure === "sync") throw new Error("native-failure");
      return Promise.reject(new Error("network-failure"));
    });
    h.views.enter({locale: "en", tournaments: {list: h.list, record: tournament}, contextBoard: {list: h.list, record: context}});
    expect(() => h.views.record("run-1")).not.toThrow(); await settle();
    expect(context).toHaveBeenCalledTimes(1);
    h.views.record("run-1"); h.views.record("run-1"); await settle();
    expect(tournament).toHaveBeenCalledTimes(2); expect(context).toHaveBeenCalledTimes(1);
    expect(h.errors).toEqual([]); expect(h.list).not.toHaveBeenCalled();
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
  it("stops the old account's remaining adapters after reentrant replacement", async () => {
    /** Account replacement during a native callback invalidates the remaining old deliveries. */
    const h = harness();
    /** The second provider must never receive an old account's result after replacement. */
    const context = jest.fn(async () => recorded());
    /** A synchronous native callback may replace the current entry before returning. */
    const tournament = jest.fn(async () => {h.views.enter({locale: "ar"}); return recorded();});
    h.views.enter({locale: "en", tournaments: {list: h.list, record: tournament}, contextBoard: {list: h.list, record: context}});
    h.views.record("run-1"); await settle();
    expect(tournament).toHaveBeenCalledTimes(1); expect(context).not.toHaveBeenCalled();
    h.views.record("run-1"); expect(context).not.toHaveBeenCalled();
  });
  it.each(["tournaments", "inbox"] as const)("expires a stalled %s read and retries without accepting the late reply", async stage => {
    /** Lost request must release loading at the exact delivery budget. */
    const h = harness(); h.views.selectStage(stage);
    h.advance(29999);
    expect(h.views.getSnapshot().failed).toBe(false);
    expect(h.timers.size).toBe(1);
    h.advance(1);
    expect(h.views.getSnapshot()).toMatchObject({failed: true, tournamentLoading: false, contextBoardLoading: false});
    expect(h.errors).toEqual(["RaceTo10.ERROR_GENERIC"]);
    h.views.refresh(stage);
    expect(h.list).toHaveBeenCalledTimes(2);
    expect(h.errors).toEqual(["RaceTo10.ERROR_GENERIC", null]);
    h.reads[0].resolve(board(9)); await settle();
    expect(h.views.getSnapshot().failed).toBe(false);
    expect(h.views.getSnapshot()[stage === "tournaments" ? "tournamentLoading" : "contextBoardLoading"]).toBe(true);
    expect(h.views.getSnapshot()[stage === "tournaments" ? "tournament" : "contextBoard"]).toBeNull();
    h.reads[1].resolve(board()); await settle();
    expect(h.views.getSnapshot()[stage === "tournaments" ? "tournament" : "contextBoard"]).toEqual(board());
    expect(h.timers.size).toBe(0);
    expect(h.record).not.toHaveBeenCalled();
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
  it("coalesces repeated tab and retry clicks while a delivery is owned", () => {
    /** React rendering delays cannot create duplicate native calls. */
    const h = harness(); h.views.selectStage("tournaments"); h.views.selectStage("tournaments");
    h.views.refresh("tournaments"); h.views.refresh("inbox");
    expect(h.list).toHaveBeenCalledTimes(1); expect(h.timers.size).toBe(1);
  });
  it.each(["tournaments", "inbox"] as const)("rejects a %s response for another language and keeps read recovery available", async stage => {
    /** Schema-valid language drift cannot become the current player's cached view. */
    const h = harness(); h.views.selectStage(stage); h.reads[0].resolve({...board(), locale: "ar"}); await settle();
    expect(h.views.getSnapshot()).toMatchObject({tournament: null, contextBoard: null, failed: true});
    expect(h.errors).toEqual(["RaceTo10.ERROR_GENERIC"]);
    h.views.refresh(stage); h.reads[1].resolve(board()); await settle();
    expect(h.views.getSnapshot().failed).toBe(false); expect(h.timers.size).toBe(0);
  });
  it.each(["dispose", "replace"])("invalidates cached values, timers and late failures on %s", async transition => {
    /** Account/locale replacement cancels request ownership before accepting newer views. */
    const h = harness(); h.views.selectStage("tournaments"); h.reads[0].resolve(board()); await settle();
    h.views.refresh("tournaments");
    if (transition === "dispose") h.views.dispose(); else h.views.enter({locale: "ar", ...h.adapters});
    h.reads[1].reject(new Error("old-account-failure")); await settle();
    expect(h.errors).toEqual([]); expect(h.timers.size).toBe(0);
    expect(h.views.getSnapshot()).toMatchObject({tournament: null, contextBoard: null, tournamentLoading: false, contextBoardLoading: false, failed: false});
    if (transition === "replace") {
      expect(h.views.getSnapshot().tournament).toBeNull();
      h.views.selectStage("tournaments"); expect(h.list).toHaveBeenLastCalledWith("ar");
    }
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
  it("does not issue unsupported provider calls or requests on gameplay screens", () => {
    /** Capability gaps and competitive screens have no provider read budget. */
    const h = harness(); h.views.enter({locale: "en"}); h.views.selectStage("tournaments"); h.views.selectStage("inbox");
    h.views.enter({locale: "en", ...h.adapters}); h.views.selectStage("racing");
    h.views.refresh("tournaments"); expect(h.list).not.toHaveBeenCalled(); expect(h.timers.size).toBe(0);
  });
});
