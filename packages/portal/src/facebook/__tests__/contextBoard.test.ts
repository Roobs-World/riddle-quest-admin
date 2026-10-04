import {describe, expect, jest, test} from "@jest/globals";
import type {PlatformResult} from "../../platform/types";
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
});
