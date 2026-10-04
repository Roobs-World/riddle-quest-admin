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
  /** Reads alone must never invent a completed run to record. */
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
  it("settles normal context absence without reporting a failed board or repeating a mutation", async () => {
    /** Explicit null is supplied by the provider adapter, independently of transport failures. */
    const h = harness();
    /** A solo context cannot receive a server-owned board projection. */
    const list = jest.fn(async () => null), record = jest.fn(async () => null);
    h.views.enter({locale: "en", contextBoard: {list, record}});
    h.views.selectStage("inbox"); await settle();
    expect(h.views.getSnapshot()).toMatchObject({contextBoard: null, contextBoardLoading: false, failed: false});
    expect(h.errors).not.toContain("RaceTo10.ERROR_GENERIC");
    expect(record).not.toHaveBeenCalled(); expect(h.timers.size).toBe(0);
  });
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

/** Failed writes recover through visible reads without changing competitive authority. */
describe("provider completion recovery", () => {
  it.each(["tournaments", "inbox"] as const)("retries a failed %s record and replaces a pre-write read", async stage => {
    /** The first write fails; the recovery write remains pending while the view reads. */
    const h = harness();
    /** Explicit completion of the recovered write. */
    let resolve!: (value: RecordFacebookTournamentRunResponse) => void;
    /** Controlled recovered write can finish after the first view read starts. */
    const pending = new Promise<RecordFacebookTournamentRunResponse>(yes => {resolve = yes;});
    /** Each target has an independent recording lifetime. */
    const record = jest.fn(() => pending), other = jest.fn(async () => recorded());
    record.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    h.views.enter({locale: "en", tournaments: {list: h.list, record: stage === "tournaments" ? record : other},
      contextBoard: {list: h.list, record: stage === "inbox" ? record : other}});
    h.views.record("run-1"); await settle(); h.views.selectStage(stage);
    expect(record).toHaveBeenCalledTimes(2); expect(other).toHaveBeenCalledTimes(1);
    h.views.refresh(stage); expect(record).toHaveBeenCalledTimes(2);
    resolve(recorded()); await settle(); expect(h.list).toHaveBeenCalledTimes(2);
    h.reads[0].resolve(board(9)); await settle();
    expect(h.views.getSnapshot()[stage === "tournaments" ? "tournament" : "contextBoard"]).toBeNull();
    h.reads[1].resolve(board(1)); await settle();
    expect(h.views.getSnapshot()[stage === "tournaments" ? "tournament" : "contextBoard"]).toEqual(board(1));
    h.views.refresh(stage); expect(record).toHaveBeenCalledTimes(2); expect(other).toHaveBeenCalledTimes(1);
    expect(h.errors).toEqual([]);
  });
  it("does not retry a failed record for a context that has since changed", async () => {
    /** Provider selection may change which context would receive a newly submitted run. */
    const h = harness(); h.views.record("run-1"); await settle(); h.views.contextChanged();
    h.views.selectStage("inbox"); await settle(); expect(h.record).toHaveBeenCalledTimes(2);
  });
  it("does not retain failed delivery retries across account replacement", async () => {
    /** Reused adapters do not imply the same player ownership. */
    const h = harness(); h.views.record("run-1"); await settle();
    h.views.enter({locale: "en", ...h.adapters}); h.views.selectStage("tournaments"); await settle();
    expect(h.record).toHaveBeenCalledTimes(2);
  });
});

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

  it("retries only the selected failed adapter, including synchronous rejection", async () => {
    /** Both writes fail independently without a race mutation or presentation error. */
    const h = harness();
    /** Native adapters can reject before returning a promise. */
    const tournament = jest.fn(async () => recorded()), context = jest.fn(async () => recorded());
    tournament.mockImplementationOnce(() => {throw new Error("sync-offline");});
    context.mockRejectedValueOnce(new Error("offline"));
    h.views.enter({locale: "en", tournaments: {list: h.list, record: tournament}, contextBoard: {list: h.list, record: context}});
    h.views.record("run-1"); await settle(); h.views.selectStage("tournaments"); await settle();
    expect(tournament).toHaveBeenCalledTimes(2); expect(context).toHaveBeenCalledTimes(1);
    h.views.selectStage("inbox"); await settle();
    expect(tournament).toHaveBeenCalledTimes(2); expect(context).toHaveBeenCalledTimes(2);
    expect(h.errors).toEqual([]);
  });
  it.each(["success", "failure"])("ignores old context recording %s after a room change", async ending => {
    /** An in-flight record is bound to the context selected at submission. */
    const h = harness();
    /** Native completion is released after context selection changes. */
    let resolve!: (value: RecordFacebookTournamentRunResponse) => void, reject!: (error: Error) => void;
    /** Controlled old room write cannot authorize a retry in a new room. */
    const pending = new Promise<RecordFacebookTournamentRunResponse>((yes, no) => {resolve = yes; reject = no;});
    /** One context record remains held through the switch. */
    const record = jest.fn(() => pending);
    h.views.enter({locale: "en", contextBoard: {list: h.list, record}}); h.views.record("run-1");
    h.views.selectStage("inbox"); h.views.contextChanged();
    h.reads[1].resolve(board(2)); await settle();
    if (ending === "success") resolve(recorded()); else reject(new Error("old-room-offline"));
    await settle(); expect(h.views.getSnapshot().contextBoard).toEqual(board(2));
    h.views.refresh("inbox"); expect(record).toHaveBeenCalledTimes(1);
    expect(h.list).toHaveBeenCalledTimes(3); expect(h.errors).toEqual([]);
  });
});

/** Lost native replies must not permanently suppress completion delivery. */
describe("provider record delivery deadlines", () => {
  it.each(["tournaments", "inbox"] as const)("releases a stalled %s write at the exact budget for an explicit retry", async stage => {
    /** A never-returning provider call models a dropped reply after possible server commit. */
    const h = harness();
    /** Only the first write loses its reply. */
    const record = jest.fn(async () => recorded()); record.mockImplementationOnce(() => new Promise(() => {}));
    h.views.enter({locale: "en", [stage === "tournaments" ? "tournaments" : "contextBoard"]: {list: h.list, record}});
    h.views.record("run-1"); h.advance(29999); h.views.record("run-1");
    expect(record).toHaveBeenCalledTimes(1); expect(h.timers.size).toBe(1);
    h.advance(1); expect(record).toHaveBeenCalledTimes(1); expect(h.timers.size).toBe(0);
    h.views.selectStage(stage); await settle(); expect(record).toHaveBeenCalledTimes(2);
    h.views.record("run-1"); expect(record).toHaveBeenCalledTimes(2);
    expect(h.errors).toEqual([]); h.views.dispose(); expect(h.timers.size).toBe(0);
  });
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
  it.each(["completed", "failed", "disposed", "replaced", "context-changed"])("cleans a %s recording deadline", async ending => {
    /** Every terminal owner transition must cancel the actual timer. */
    const h = harness();
    /** Controlled completion is shared by the optional provider destinations. */
    let resolve!: (value: RecordFacebookTournamentRunResponse) => void, reject!: (error: Error) => void;
    /** Two provider deliveries can be pending simultaneously. */
    const pending = new Promise<RecordFacebookTournamentRunResponse>((yes, no) => {resolve = yes; reject = no;});
    /** One adapter lifetime supplies both destinations. */
    const record = jest.fn(() => pending);
    h.views.enter({locale: "en", tournaments: {list: h.list, record}, contextBoard: {list: h.list, record}});
    h.views.record("run-1"); expect(h.timers.size).toBe(2);
    if (ending === "completed") resolve(recorded());
    else if (ending === "failed") reject(new Error("offline"));
    else if (ending === "disposed") h.views.dispose();
    else if (ending === "replaced") h.views.enter({locale: "ar"});
    else h.views.contextChanged();
    await settle(); expect(h.timers.size).toBe(ending === "context-changed" ? 1 : 0);
    h.advance(30000); expect(h.timers.size).toBe(0); expect(h.errors).toEqual([]);
    if (["disposed", "replaced"].includes(ending)) {h.views.selectStage("inbox"); expect(h.list).not.toHaveBeenCalled();}
    if (ending === "context-changed") {h.views.selectStage("inbox"); expect(record).toHaveBeenCalledTimes(2);}
  });
});
