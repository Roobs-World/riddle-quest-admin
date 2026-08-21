import {describe, expect, jest, test} from "@jest/globals";
import type {NativeSocialCapability, PlatformResult} from "../../platform/types";
import {FacebookContextCoordinator, type FacebookContextBackendPort} from "../contexts";

type Context = {contextId: string; contextType: "THREAD" | "GROUP"};
const ok = (contextId: string, contextType: Context["contextType"] = "THREAD"): PlatformResult<Context> => ({
  status: "success",
  value: {contextId, contextType},
});

const fixture = () => {
  let current = ok("context-a");
  let locale: import("@qwordly/core/race").RaceLocale = "ja";
  const sdk: NativeSocialCapability = {
    currentContext: () => current,
    chooseContext: jest.fn(async () => current),
    matchPlayer: jest.fn(async () => current),
  };
  const backend: FacebookContextBackendPort = {
    join: jest.fn(async () => undefined),
    leave: jest.fn(async () => undefined),
  };
  const coordinator = new FacebookContextCoordinator(sdk, () => locale, backend);
  return {
    sdk,
    backend,
    coordinator,
    setCurrent: (value: PlatformResult<Context>) => { current = value; },
    setLocale: (value: import("@qwordly/core/race").RaceLocale) => { locale = value; },
  };
};

describe("FacebookContextCoordinator", () => {
  test("joins the current SDK context with the exact active locale", async () => {
    const value = fixture();
    expect(value.coordinator.currentContext()).toEqual({
      status: "unavailable", message: "facebook-context-not-synchronized",
    });
    await expect(value.coordinator.synchronizeCurrent()).resolves.toEqual(ok("context-a"));
    expect(value.coordinator.currentContext()).toEqual(ok("context-a"));
    expect(value.backend.join).toHaveBeenCalledWith({
      contextId: "context-a", contextType: "THREAD", locale: "ja",
    });
    expect(value.backend.leave).not.toHaveBeenCalled();
  });

  test("joins a chosen context before leaving the previous context", async () => {
    const value = fixture();
    await value.coordinator.synchronizeCurrent();
    value.setCurrent(ok("context-b", "GROUP"));
    expect(value.coordinator.currentContext()).toEqual({
      status: "unavailable", message: "facebook-context-not-synchronized",
    });
    await expect(value.coordinator.chooseContext()).resolves.toEqual(ok("context-b", "GROUP"));
    expect(value.coordinator.currentContext()).toEqual(ok("context-b", "GROUP"));
    const joinOrder = (value.backend.join as jest.Mock).mock.invocationCallOrder.at(-1)!;
    const leaveOrder = (value.backend.leave as jest.Mock).mock.invocationCallOrder.at(-1)!;
    expect(joinOrder).toBeLessThan(leaveOrder);
    expect(value.backend.leave).toHaveBeenCalledWith({contextId: "context-a"});
  });

  test("passes SDK cancellation through and reports server synchronization failures safely", async () => {
    const value = fixture();
    value.setCurrent({status: "cancelled"});
    await expect(value.coordinator.matchPlayer("race10_v1:ja")).resolves.toEqual({status: "cancelled"});
    expect(value.backend.join).not.toHaveBeenCalled();

    value.setCurrent(ok("context-c"));
    (value.backend.join as jest.Mock).mockRejectedValueOnce(new Error("private backend detail"));
    await expect(value.coordinator.matchPlayer("race10_v1:ja")).resolves.toEqual({
      status: "retryable-failure", message: "facebook-context-sync-failed",
    });
    expect(value.coordinator.currentContext()).toEqual({
      status: "unavailable", message: "facebook-context-not-synchronized",
    });
  });

  test("serializes overlapping transitions and leaves only the last synchronized context current", async () => {
    const value = fixture();
    await value.coordinator.synchronizeCurrent();
    let releaseFirstJoin!: () => void;
    const firstJoinBlocked = new Promise<void>((resolve) => { releaseFirstJoin = resolve; });
    (value.backend.join as jest.Mock)
      .mockImplementationOnce(async () => firstJoinBlocked)
      .mockImplementationOnce(async () => undefined);

    value.setCurrent(ok("context-b"));
    const first = value.coordinator.chooseContext();
    value.setCurrent(ok("context-c", "GROUP"));
    const second = value.coordinator.matchPlayer("race10_v1:ja");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(value.backend.join).toHaveBeenCalledTimes(2);
    releaseFirstJoin();

    await expect(first).resolves.toEqual({
      status: "unavailable", message: "facebook-context-not-synchronized",
    });
    await expect(second).resolves.toEqual(ok("context-c", "GROUP"));
    expect((value.backend.join as jest.Mock).mock.calls).toEqual([
      [{contextId: "context-a", contextType: "THREAD", locale: "ja"}],
      [{contextId: "context-c", contextType: "GROUP", locale: "ja"}],
    ]);
    expect((value.backend.leave as jest.Mock).mock.calls).toEqual([
      [{contextId: "context-a"}],
    ]);
    expect(value.coordinator.currentContext()).toEqual(ok("context-c", "GROUP"));
  });

  test("invalidates a synchronized context when locale changes or changes during the join", async () => {
    const value = fixture();
    await value.coordinator.synchronizeCurrent();
    value.setLocale("fr");
    expect(value.coordinator.currentContext()).toEqual({
      status: "unavailable", message: "facebook-context-not-synchronized",
    });

    let releaseJoin!: () => void;
    (value.backend.join as jest.Mock).mockImplementationOnce(async () =>
      new Promise<void>((resolve) => { releaseJoin = resolve; }));
    const synchronization = value.coordinator.synchronizeCurrent();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    value.setLocale("de");
    releaseJoin();
    await expect(synchronization).resolves.toEqual({
      status: "unavailable", message: "facebook-context-not-synchronized",
    });
    expect(value.coordinator.currentContext()).toEqual({
      status: "unavailable", message: "facebook-context-not-synchronized",
    });
    expect(value.backend.join).toHaveBeenLastCalledWith({
      contextId: "context-a", contextType: "THREAD", locale: "fr",
    });
  });
});
