import {describe, expect, jest, test} from "@jest/globals";
import type {NativeSocialCapability, PlatformResult} from "../../platform/types";
import {FacebookContextCoordinator, type FacebookContextBackendPort} from "../contexts";

/** Describes context. */
type Context = {
  /** Stores context id. */
  contextId: string; /** Stores context type. */
  /** Stores context type. */
  contextType: "THREAD" | "GROUP";
};
/** Provides ok behavior. */
const ok = (contextId: string, contextType: Context["contextType"] = "THREAD"): PlatformResult<Context> => ({
  status: "success",
  value: {contextId, contextType},
});

/** Provides fixture behavior. */
const fixture = () => {
  /** Provides current behavior. */
  let current = ok("context-a");
  /** Provides locale behavior. */
  let locale: import("@qwordly/core/race").RaceLocale = "ja";
  /** Provides sdk behavior. */
  const sdk: NativeSocialCapability = {
    currentContext: () => current,
    chooseContext: jest.fn(async () => current),
    matchPlayer: jest.fn(async () => current),
  };
  /** Provides backend behavior. */
  const backend: FacebookContextBackendPort = {
    join: jest.fn(async () => undefined),
    leave: jest.fn(async () => undefined),
  };
  /** Provides coordinator behavior. */
  const coordinator = new FacebookContextCoordinator(sdk, () => locale, backend);
  return {
    sdk,
    backend,
    coordinator,
    setCurrent: (value: PlatformResult<Context>) => {
      current = value;
    },
    setLocale: (value: import("@qwordly/core/race").RaceLocale) => {
      locale = value;
    },
  };
};

describe("FacebookContextCoordinator", () => {
  test("reconciles changed preferences once for concurrent board consumers", async () => {
    /** Initial membership may precede restored or changed game preferences. */
    const value = fixture(); await value.coordinator.synchronizeCurrent(); value.setLocale("fr");
    await expect(Promise.all([value.coordinator.ensureCurrent(), value.coordinator.ensureCurrent()])).resolves.toEqual([ok("context-a"), ok("context-a")]);
    expect(value.backend.join).toHaveBeenCalledTimes(2);
    expect(value.backend.join).toHaveBeenLastCalledWith({contextId: "context-a", contextType: "THREAD", locale: "fr"});
    await value.coordinator.ensureCurrent(); expect(value.backend.join).toHaveBeenCalledTimes(2);
    value.setCurrent(ok("context-b", "GROUP"));
    await expect(value.coordinator.ensureCurrent()).resolves.toEqual(ok("context-b", "GROUP"));
    expect(value.backend.leave).toHaveBeenCalledWith({contextId: "context-a"});
  });
  test("fails closed when locale changes during shared reconciliation, then permits fresh recovery", async () => {
    /** A completed old-language membership cannot authorize the new-language board. */
    const value = fixture();
    /** Exact membership delivery is deliberately delayed. */
    let release!: () => void;
    (value.backend.join as jest.Mock).mockImplementationOnce(async () => new Promise<void>(resolve => {release = resolve;}));
    /** Both consumers own the same membership operation. */
    const first = value.coordinator.ensureCurrent(), second = value.coordinator.ensureCurrent();
    await new Promise<void>(resolve => setTimeout(resolve, 0)); value.setLocale("fr"); release();
    await expect(first).resolves.toMatchObject({status: "unavailable"});
    await expect(second).resolves.toMatchObject({status: "unavailable"});
    expect(value.backend.join).toHaveBeenCalledTimes(1);
    await expect(value.coordinator.ensureCurrent()).resolves.toEqual(ok("context-a"));
    expect(value.backend.join).toHaveBeenCalledTimes(2);
  });
  test("joins the current SDK context with the exact active locale", async () => {
    /** Provides value behavior. */
    const value = fixture();
    expect(value.coordinator.currentContext()).toEqual({
      status: "unavailable",
      message: "facebook-context-not-synchronized",
    });
    await expect(value.coordinator.synchronizeCurrent()).resolves.toEqual(ok("context-a"));
    expect(value.coordinator.currentContext()).toEqual(ok("context-a"));
    expect(value.backend.join).toHaveBeenCalledWith({
      contextId: "context-a",
      contextType: "THREAD",
      locale: "ja",
    });
    expect(value.backend.leave).not.toHaveBeenCalled();
  });

  test("joins a chosen context before leaving the previous context", async () => {
    /** Provides value behavior. */
    const value = fixture();
    await value.coordinator.synchronizeCurrent();
    value.setCurrent(ok("context-b", "GROUP"));
    expect(value.coordinator.currentContext()).toEqual({
      status: "unavailable",
      message: "facebook-context-not-synchronized",
    });
    await expect(value.coordinator.chooseContext()).resolves.toEqual(ok("context-b", "GROUP"));
    expect(value.coordinator.currentContext()).toEqual(ok("context-b", "GROUP"));
    /** Provides join order behavior. */
    const joinOrder = (value.backend.join as jest.Mock).mock.invocationCallOrder.at(-1)!;
    /** Provides leave order behavior. */
    const leaveOrder = (value.backend.leave as jest.Mock).mock.invocationCallOrder.at(-1)!;
    expect(joinOrder).toBeLessThan(leaveOrder);
    expect(value.backend.leave).toHaveBeenCalledWith({contextId: "context-a"});
  });

  test("passes SDK cancellation through and reports server synchronization failures safely", async () => {
    /** Provides value behavior. */
    const value = fixture();
    value.setCurrent({status: "cancelled"});
    await expect(value.coordinator.matchPlayer("race10_v1:ja")).resolves.toEqual({status: "cancelled"});
    expect(value.backend.join).not.toHaveBeenCalled();

    value.setCurrent(ok("context-c"));
    (value.backend.join as jest.Mock).mockRejectedValueOnce(new Error("private backend detail"));
    await expect(value.coordinator.matchPlayer("race10_v1:ja")).resolves.toEqual({
      status: "retryable-failure",
      message: "facebook-context-sync-failed",
    });
    expect(value.coordinator.currentContext()).toEqual({
      status: "unavailable",
      message: "facebook-context-not-synchronized",
    });
  });

  test("serializes overlapping transitions and leaves only the last synchronized context current", async () => {
    /** Provides value behavior. */
    const value = fixture();
    await value.coordinator.synchronizeCurrent();
    /** Provides release first join behavior. */
    let releaseFirstJoin!: () => void;
    /** Provides first join blocked behavior. */
    const firstJoinBlocked = new Promise<void>((resolve) => {
      releaseFirstJoin = resolve;
    });
    (value.backend.join as jest.Mock)
      .mockImplementationOnce(async () => firstJoinBlocked)
      .mockImplementationOnce(async () => undefined);

    value.setCurrent(ok("context-b"));
    /** Provides first behavior. */
    const first = value.coordinator.chooseContext();
    value.setCurrent(ok("context-c", "GROUP"));
    /** Provides second behavior. */
    const second = value.coordinator.matchPlayer("race10_v1:ja");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(value.backend.join).toHaveBeenCalledTimes(2);
    releaseFirstJoin();

    await expect(first).resolves.toEqual({
      status: "unavailable",
      message: "facebook-context-not-synchronized",
    });
    await expect(second).resolves.toEqual(ok("context-c", "GROUP"));
    expect((value.backend.join as jest.Mock).mock.calls).toEqual([
      [{contextId: "context-a", contextType: "THREAD", locale: "ja"}],
      [{contextId: "context-c", contextType: "GROUP", locale: "ja"}],
    ]);
    expect((value.backend.leave as jest.Mock).mock.calls).toEqual([[{contextId: "context-a"}]]);
    expect(value.coordinator.currentContext()).toEqual(ok("context-c", "GROUP"));
  });

  test("invalidates a synchronized context when locale changes or changes during the join", async () => {
    /** Provides value behavior. */
    const value = fixture();
    await value.coordinator.synchronizeCurrent();
    value.setLocale("fr");
    expect(value.coordinator.currentContext()).toEqual({
      status: "unavailable",
      message: "facebook-context-not-synchronized",
    });

    /** Provides release join behavior. */
    let releaseJoin!: () => void;
    (value.backend.join as jest.Mock).mockImplementationOnce(
      async () =>
        new Promise<void>((resolve) => {
          releaseJoin = resolve;
        }),
    );
    /** Provides synchronization behavior. */
    const synchronization = value.coordinator.synchronizeCurrent();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    value.setLocale("de");
    releaseJoin();
    await expect(synchronization).resolves.toEqual({
      status: "unavailable",
      message: "facebook-context-not-synchronized",
    });
    expect(value.coordinator.currentContext()).toEqual({
      status: "unavailable",
      message: "facebook-context-not-synchronized",
    });
    expect(value.backend.join).toHaveBeenLastCalledWith({
      contextId: "context-a",
      contextType: "THREAD",
      locale: "fr",
    });
  });
});
