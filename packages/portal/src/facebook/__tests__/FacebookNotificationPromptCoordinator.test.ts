import {describe, expect, it, jest} from "@jest/globals";
import type {NotificationCapability, PlatformPreferences, PlatformStorage} from "../../platform/types";
import {FacebookNotificationPromptCoordinator} from "../FacebookNotificationPromptCoordinator";

const WEEK = 7 * 24 * 60 * 60 * 1_000;

const harness = (
  initial: PlatformPreferences = {},
  permissionResult: Awaited<ReturnType<NotificationCapability["requestPermission"]>> = {
    status: "success", value: undefined,
  },
) => {
  let preferences = initial;
  const calls: string[] = [];
  const storage = {
    readPreferences: jest.fn(async () => preferences),
    writePreferences: jest.fn(async (next: PlatformPreferences) => {
      calls.push(`write:${next.facebookNotificationPermission}`);
      preferences = next;
    }),
    flush: jest.fn(async () => { calls.push("flush"); }),
  } as unknown as PlatformStorage;
  const capability = {
    requestPermission: jest.fn(async () => {
      calls.push("prompt");
      return permissionResult;
    }),
  } as unknown as NotificationCapability;
  return {
    storage,
    capability,
    calls,
    preferences: () => preferences,
    mutatePreferences: (next: PlatformPreferences) => { preferences = next; },
  };
};

describe("FacebookNotificationPromptCoordinator", () => {
  it("persists the attempt before prompting and remembers acceptance", async () => {
    const test = harness();
    const coordinator = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => 123);
    await expect(coordinator.afterAuthoritativeCompletion(true)).resolves.toBe("accepted");
    expect(test.calls).toEqual(["write:declined", "flush", "prompt", "write:accepted", "flush"]);
    expect(test.preferences()).toMatchObject({
      facebookNotificationPermission: "accepted",
      facebookNotificationLastPromptAtMs: 123,
    });
  });

  it("does not prompt for a loss, before the weekly boundary, or after acceptance", async () => {
    const loss = harness();
    await expect(new FacebookNotificationPromptCoordinator(loss.storage, loss.capability, () => 10)
      .afterAuthoritativeCompletion(false)).resolves.toBe("not-eligible");
    expect(loss.capability.requestPermission).not.toHaveBeenCalled();

    const weekly = harness({facebookNotificationPermission: "declined", facebookNotificationLastPromptAtMs: 100});
    const coordinator = new FacebookNotificationPromptCoordinator(weekly.storage, weekly.capability, () => 100 + WEEK - 1);
    await expect(coordinator.afterAuthoritativeCompletion(true)).resolves.toBe("not-eligible");
    expect(weekly.capability.requestPermission).not.toHaveBeenCalled();

    const accepted = harness({facebookNotificationPermission: "accepted", facebookNotificationLastPromptAtMs: 1});
    await new FacebookNotificationPromptCoordinator(accepted.storage, accepted.capability, () => 1 + WEEK)
      .afterAuthoritativeCompletion(true);
    expect(accepted.capability.requestPermission).not.toHaveBeenCalled();
  });

  it("serializes concurrent wins and records cancellation as a weekly decline", async () => {
    const test = harness({}, {status: "cancelled"});
    const coordinator = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => 500);
    await expect(Promise.all([
      coordinator.afterAuthoritativeCompletion(true),
      coordinator.afterAuthoritativeCompletion(true),
    ])).resolves.toEqual(["declined", "declined"]);
    expect(test.capability.requestPermission).toHaveBeenCalledTimes(1);
    expect(test.preferences()).toMatchObject({
      facebookNotificationPermission: "declined",
      facebookNotificationLastPromptAtMs: 500,
    });
  });

  it("serializes separate tab coordinators before reading the shared weekly state", async () => {
    const test = harness();
    let tail = Promise.resolve();
    const runExclusive = async <Result,>(operation: () => Promise<Result>): Promise<Result> => {
      const previous = tail;
      let release = () => undefined;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await operation();
      } finally {
        release();
      }
    };
    const first = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => 500, runExclusive);
    const sibling = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => 500, runExclusive);

    await expect(Promise.all([
      first.afterAuthoritativeCompletion(true),
      sibling.afterAuthoritativeCompletion(true),
    ])).resolves.toEqual(["accepted", "not-eligible"]);
    expect(test.capability.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("persists weekly suppression when the platform prompt throws", async () => {
    const test = harness();
    test.capability.requestPermission.mockRejectedValueOnce(new Error("host-failed"));
    const coordinator = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => 500);
    await expect(coordinator.afterAuthoritativeCompletion(true)).rejects.toThrow("host-failed");
    expect(test.preferences()).toMatchObject({
      facebookNotificationPermission: "declined",
      facebookNotificationLastPromptAtMs: 500,
    });
    await expect(coordinator.afterAuthoritativeCompletion(true)).resolves.toBe("not-eligible");
    expect(test.capability.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("requires the authoritative cross-device lease and records server acceptance first", async () => {
    const denied = harness();
    const deniedLease = {claim: jest.fn(async () => ({granted: false as const})), accept: jest.fn()};
    await expect(new FacebookNotificationPromptCoordinator(
      denied.storage, denied.capability, () => 500, undefined, deniedLease,
    ).afterAuthoritativeCompletion(true)).resolves.toBe("not-eligible");
    expect(denied.storage.writePreferences).not.toHaveBeenCalled();
    expect(denied.capability.requestPermission).not.toHaveBeenCalled();

    const granted = harness();
    const order: string[] = [];
    granted.capability.requestPermission.mockImplementationOnce(async () => {
      order.push("prompt");
      return {status: "success", value: undefined};
    });
    const grantedLease = {
      claim: jest.fn(async () => ({granted: true as const, claimedAtMs: 600})),
      accept: jest.fn(async () => { order.push("server-accepted"); }),
    };
    granted.storage.writePreferences.mockImplementation(async (next) => {
      order.push(`local:${next.facebookNotificationPermission}`);
      granted.mutatePreferences(next);
    });
    await expect(new FacebookNotificationPromptCoordinator(
      granted.storage, granted.capability, () => 500, undefined, grantedLease,
    ).afterAuthoritativeCompletion(true)).resolves.toBe("accepted");
    expect(order).toEqual(["local:declined", "prompt", "server-accepted", "local:accepted"]);
    expect(granted.preferences().facebookNotificationLastPromptAtMs).toBe(600);
  });

  it("preserves settings changed while the platform permission UI is open", async () => {
    const test = harness({locale: "en", muted: false});
    test.capability.requestPermission.mockImplementationOnce(async () => {
      test.mutatePreferences({...test.preferences(), locale: "ar", muted: true, presenceEnabled: true});
      return {status: "success", value: undefined};
    });
    const coordinator = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => 500);

    await expect(coordinator.afterAuthoritativeCompletion(true)).resolves.toBe("accepted");

    expect(test.preferences()).toMatchObject({
      locale: "ar",
      muted: true,
      presenceEnabled: true,
      facebookNotificationPermission: "accepted",
      facebookNotificationLastPromptAtMs: 500,
    });
  });

  it("does not write or open platform UI when the runtime clock is invalid", async () => {
    const test = harness();
    const coordinator = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => Number.NaN);
    await expect(coordinator.afterAuthoritativeCompletion(true)).resolves.toBe("not-eligible");
    expect(test.storage.writePreferences).not.toHaveBeenCalled();
    expect(test.capability.requestPermission).not.toHaveBeenCalled();
  });
});
