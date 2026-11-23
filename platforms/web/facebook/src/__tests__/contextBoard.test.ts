import {describe, expect, jest, test} from "@jest/globals";
import type {PlatformResult} from "../../../../../src/platform/contracts/capabilities";
import {createFacebookContextBoard, type FacebookContextBoardBackend} from "../contextBoard";

/** Native context result owns the destination; caller locale/run data cannot select another one. */
type Context = {
  /** Valid SDK destination. */
  contextId: string;
  /** Social setting. */
  contextType: "THREAD" | "GROUP";
};
/** Creates the typed adapter over controlled native and authenticated callable ports. */
function fixture() {
  /** Initial native state precedes each independent test operation. */
  let current: PlatformResult<Context> = {status: "success", value: {contextId: "thread-a", contextType: "THREAD"}};
  /** Explicit listener retirement is forwarded to the owning coordinator. */
  const stop = jest.fn();
  /** Same production coordinator surface used by the actual Facebook entry. */
  const coordinator = {ensureCurrent: jest.fn(async () => current), onContextChange: jest.fn((_callback: () => void) => stop)};
  /** Actual server data shape, without identity or reward grants. */
  const board = {locale: "fr" as const, startsAtMs: 1000, endsAtMs: 604801000,
    sortOrder: "LOWER_IS_BETTER" as const, rewardsEnabled: false as const, standings: []};
  /** Read/write destinations remain authenticated backend calls. */
  const backend = {
    list: jest.fn<FacebookContextBoardBackend["list"]>(async () => ({data: board})),
    record: jest.fn<FacebookContextBoardBackend["record"]>(async input => ({data: {
      locale: input.locale, runId: input.runId, adjustedTimeMs: 10000, completedAtMs: 2000,
      improved: true, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
    }})),
  };
  return {capability: createFacebookContextBoard(coordinator, backend), coordinator, backend, board, stop,
    setCurrent: (value: PlatformResult<Context>) => {current = value;}};
}

describe("Facebook optional native context board", () => {
  test("reads and records only the synchronized native context with the exact locale and opaque run", async () => {
    /** Invoke the actual adapter returned to shared gameplay. */
    const value = fixture();
    await expect(value.capability.list("fr")).resolves.toEqual(value.board);
    await expect(value.capability.record("opaque-run", "fr")).resolves.toMatchObject({runId: "opaque-run", rewardsEnabled: false});
    expect(value.backend.list).toHaveBeenCalledWith({contextId: "thread-a", locale: "fr"});
    expect(value.backend.record).toHaveBeenCalledWith({contextId: "thread-a", locale: "fr", runId: "opaque-run"});
  });
  test("normal solo absence issues no board read or optional score mutation and can later recover", async () => {
    /** Solo returns an explicit absence rather than inventing empty server standings. */
    const value = fixture(); value.setCurrent({status: "unavailable", message: "facebook-context-unavailable"});
    await expect(value.capability.list("fr")).resolves.toBeNull();
    await expect(value.capability.record("opaque-run", "fr")).resolves.toBeNull();
    expect(value.backend.list).not.toHaveBeenCalled(); expect(value.backend.record).not.toHaveBeenCalled();
    value.setCurrent({status: "success", value: {contextId: "group-b", contextType: "GROUP"}});
    await expect(value.capability.list("fr")).resolves.toEqual(value.board);
    expect(value.backend.list).toHaveBeenCalledWith({contextId: "group-b", locale: "fr"});
  });
  test.each([
    {status: "retryable-failure", message: "private-membership-error"},
    {status: "terminal-failure", message: "private-account-error"},
    {status: "unavailable", message: "facebook-context-not-synchronized"},
    {status: "unavailable", message: "different-unavailability"},
    {status: "cancelled"},
  ] satisfies PlatformResult<Context>[])("does not conceal a failed or retired context as normal solo: %p", async current => {
    /** Every non-solo failure preserves the shared retry/error path without issuing a request. */
    const value = fixture(); value.setCurrent(current);
    await expect(value.capability.list("fr")).rejects.toThrow("facebook-context-board-unavailable");
    await expect(value.capability.record("opaque-run", "fr")).rejects.toThrow("facebook-context-board-unavailable");
    expect(value.backend.list).not.toHaveBeenCalled(); expect(value.backend.record).not.toHaveBeenCalled();
  });
  test("preserves backend delivery failures rather than replacing them with absence", async () => {
    /** Callable errors still represent an unavailable server result. */
    const value = fixture(); value.backend.list.mockRejectedValueOnce(new Error("read-offline"));
    value.backend.record.mockRejectedValueOnce(new Error("record-offline"));
    await expect(value.capability.list("fr")).rejects.toThrow("read-offline");
    await expect(value.capability.record("opaque-run", "fr")).rejects.toThrow("record-offline");
  });
  test("forwards invalidation and unsubscribe to the existing session owner", () => {
    /** Shared presentation does not register an additional native SDK callback. */
    const value = fixture();
    /** Callback belongs to this board consumer. */
    const changed = jest.fn();
    value.capability.onContextChange!(changed)();
    expect(value.coordinator.onContextChange).toHaveBeenCalledWith(changed);
    expect(value.stop).toHaveBeenCalledTimes(1);
  });
  test("a previously retired read does not start shared native synchronization", async () => {
    /** Cancellation applies only to this consumer, before any membership or authority work. */
    const value = fixture(), controller = new AbortController(); controller.abort();
    await expect(value.capability.list("fr", controller.signal)).resolves.toBeNull();
    expect(value.coordinator.ensureCurrent).not.toHaveBeenCalled();
    expect(value.backend.list).not.toHaveBeenCalled();
  });
  test("retiring a read during membership confirmation preserves independent score recording", async () => {
    /** Both operations await the same native membership; only the read owns a cancellation signal. */
    const value = fixture(), controller = new AbortController();
    /** Resolve the original membership without replacing either adapter operation. */
    let confirm!: (current: PlatformResult<Context>) => void;
    /** Shared membership stays pending while its consumer retires. */
    const membership = new Promise<PlatformResult<Context>>(resolve => {confirm = resolve;});
    value.coordinator.ensureCurrent.mockImplementation(() => membership);
    /** The authenticated score projection remains independent of the optional read. */
    const read = value.capability.list("fr", controller.signal), record = value.capability.record("opaque-run", "fr");
    controller.abort(); confirm({status: "success", value: {contextId: "group-b", contextType: "GROUP"}});
    await expect(read).resolves.toBeNull();
    await expect(record).resolves.toMatchObject({runId: "opaque-run", rewardsEnabled: false});
    expect(value.backend.list).not.toHaveBeenCalled();
    expect(value.backend.record).toHaveBeenCalledTimes(1);
    expect(value.backend.record).toHaveBeenCalledWith({contextId: "group-b", locale: "fr", runId: "opaque-run"});
  });
  test("cancellation after authority admission neither replays nor pretends to revoke the callable", async () => {
    /** An already admitted authenticated request keeps its original delivery semantics. */
    const value = fixture(), controller = new AbortController();
    /** Hold the original callable result until after this UI consumer retires. */
    let deliver!: (response: Awaited<ReturnType<FacebookContextBoardBackend["list"]>>) => void;
    value.backend.list.mockImplementation(() => new Promise(resolve => {deliver = resolve;}));
    /** Native membership resolves before backend admission. */
    const read = value.capability.list("fr", controller.signal);
    await Promise.resolve(); await Promise.resolve();
    expect(value.backend.list).toHaveBeenCalledTimes(1);
    controller.abort(); deliver({data: value.board});
    await expect(read).resolves.toEqual(value.board);
    expect(value.backend.list).toHaveBeenCalledTimes(1);
  });
  test("retirement between native context resolution and callable admission skips the backend", async () => {
    /** The outer adapter continuation must recheck cancellation after resolving the native destination. */
    const value = fixture(), controller = new AbortController();
    /** The native context resolves first, but the authenticated callable has not yet been invoked. */
    const read = value.capability.list("fr", controller.signal);
    await Promise.resolve(); controller.abort();
    await expect(read).resolves.toBeNull();
    expect(value.backend.list).not.toHaveBeenCalled();
  });
});
