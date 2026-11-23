import {describe, expect, it, jest} from "@jest/globals";
import type {NotificationCapability, PlatformPreferences, PlatformStorage} from "../../../../../src/platform/contracts/capabilities";
import {FacebookNotificationPromptCoordinator} from "../FacebookNotificationPromptCoordinator";

/** Renders the week interface. */
const WEEK = 7 * 24 * 60 * 60 * 1_000;

/** Provides harness behavior. */
const harness = (
  initial: PlatformPreferences = {},
  permissionResult: Awaited<ReturnType<NotificationCapability["requestPermission"]>> = {
    status: "success",
    value: undefined,
  },
) => {
  /** Provides preferences behavior. */
  let preferences = initial;
  /** Provides calls behavior. */
  const calls: string[] = [];
  /** Provides storage behavior. */
  const storage = {
    readPreferences: jest.fn(async () => preferences),
    writePreferences: jest.fn(async (next: PlatformPreferences) => {
      calls.push(`write:${next.facebookNotificationPermission}`);
      preferences = next;
    }),
    flush: jest.fn(async () => {
      calls.push("flush");
    }),
  } as unknown as PlatformStorage;
  /** Provides capability behavior. */
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
    mutatePreferences: (next: PlatformPreferences) => {
      preferences = next;
    },
  };
};

describe("FacebookNotificationPromptCoordinator", () => {
  it("persists the attempt before prompting and remembers acceptance", async () => {
    /** Provides test behavior. */
    const test = harness();
    /** Provides coordinator behavior. */
    const coordinator = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => 123);
    await expect(coordinator.afterAuthoritativeCompletion(true)).resolves.toBe("accepted");
    expect(test.calls).toEqual(["write:declined", "flush", "prompt", "write:accepted", "flush"]);
    expect(test.preferences()).toMatchObject({
      facebookNotificationPermission: "accepted",
      facebookNotificationLastPromptAtMs: 123,
    });
  });

  it("does not prompt for a loss, before the weekly boundary, or after acceptance", async () => {
    /** Provides loss behavior. */
    const loss = harness();
    await expect(
      new FacebookNotificationPromptCoordinator(loss.storage, loss.capability, () => 10).afterAuthoritativeCompletion(
        false,
      ),
    ).resolves.toBe("not-eligible");
    expect(loss.capability.requestPermission).not.toHaveBeenCalled();

    /** Provides weekly behavior. */
    const weekly = harness({facebookNotificationPermission: "declined", facebookNotificationLastPromptAtMs: 100});
    /** Provides coordinator behavior. */
    const coordinator = new FacebookNotificationPromptCoordinator(
      weekly.storage,
      weekly.capability,
      () => 100 + WEEK - 1,
    );
    await expect(coordinator.afterAuthoritativeCompletion(true)).resolves.toBe("not-eligible");
    expect(weekly.capability.requestPermission).not.toHaveBeenCalled();

    /** Provides accepted behavior. */
    const accepted = harness({facebookNotificationPermission: "accepted", facebookNotificationLastPromptAtMs: 1});
    await new FacebookNotificationPromptCoordinator(
      accepted.storage,
      accepted.capability,
      () => 1 + WEEK,
    ).afterAuthoritativeCompletion(true);
    expect(accepted.capability.requestPermission).not.toHaveBeenCalled();
  });

  it("serializes concurrent wins and records cancellation as a weekly decline", async () => {
    /** Provides test behavior. */
    const test = harness({}, {status: "cancelled"});
    /** Provides coordinator behavior. */
    const coordinator = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => 500);
    await expect(
      Promise.all([coordinator.afterAuthoritativeCompletion(true), coordinator.afterAuthoritativeCompletion(true)]),
    ).resolves.toEqual(["declined", "declined"]);
    expect(test.capability.requestPermission).toHaveBeenCalledTimes(1);
    expect(test.preferences()).toMatchObject({
      facebookNotificationPermission: "declined",
      facebookNotificationLastPromptAtMs: 500,
    });
  });

  it("serializes separate tab coordinators before reading the shared weekly state", async () => {
    /** Provides test behavior. */
    const test = harness();
    /** Provides tail behavior. */
    let tail = Promise.resolve();
    /** Provides run exclusive behavior. */
    const runExclusive = async <Result>(operation: () => Promise<Result>): Promise<Result> => {
      /** Provides previous behavior. */
      const previous = tail;
      /** Provides release behavior. */
      let release = () => undefined;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await operation();
      } finally {
        release();
      }
    };
    /** Provides first behavior. */
    const first = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => 500, runExclusive);
    /** Provides sibling behavior. */
    const sibling = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => 500, runExclusive);

    await expect(
      Promise.all([first.afterAuthoritativeCompletion(true), sibling.afterAuthoritativeCompletion(true)]),
    ).resolves.toEqual(["accepted", "not-eligible"]);
    expect(test.capability.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("persists weekly suppression when the platform prompt throws", async () => {
    /** Provides test behavior. */
    const test = harness();
    test.capability.requestPermission.mockRejectedValueOnce(new Error("host-failed"));
    /** Provides coordinator behavior. */
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
    /** Provides denied behavior. */
    const denied = harness();
    /** Provides denied lease behavior. */
    const deniedLease = {claim: jest.fn(async () => ({granted: false as const})), accept: jest.fn()};
    await expect(
      new FacebookNotificationPromptCoordinator(
        denied.storage,
        denied.capability,
        () => 500,
        undefined,
        deniedLease,
      ).afterAuthoritativeCompletion(true),
    ).resolves.toBe("not-eligible");
    expect(denied.storage.writePreferences).not.toHaveBeenCalled();
    expect(denied.capability.requestPermission).not.toHaveBeenCalled();

    /** Provides granted behavior. */
    const granted = harness();
    /** Provides order behavior. */
    const order: string[] = [];
    granted.capability.requestPermission.mockImplementationOnce(async () => {
      order.push("prompt");
      return {status: "success", value: undefined};
    });
    /** Provides granted lease behavior. */
    const grantedLease = {
      claim: jest.fn(async () => ({granted: true as const, claimedAtMs: 600})),
      accept: jest.fn(async () => {
        order.push("server-accepted");
      }),
    };
    granted.storage.writePreferences.mockImplementation(async (next) => {
      order.push(`local:${next.facebookNotificationPermission}`);
      granted.mutatePreferences(next);
    });
    await expect(
      new FacebookNotificationPromptCoordinator(
        granted.storage,
        granted.capability,
        () => 500,
        undefined,
        grantedLease,
      ).afterAuthoritativeCompletion(true),
    ).resolves.toBe("accepted");
    expect(order).toEqual(["local:declined", "prompt", "server-accepted", "local:accepted"]);
    expect(granted.preferences().facebookNotificationLastPromptAtMs).toBe(600);
  });

  it("preserves settings changed while the platform permission UI is open", async () => {
    /** Provides test behavior. */
    const test = harness({locale: "en", muted: false});
    test.capability.requestPermission.mockImplementationOnce(async () => {
      test.mutatePreferences({...test.preferences(), locale: "ar", muted: true, presenceEnabled: true});
      return {status: "success", value: undefined};
    });
    /** Provides coordinator behavior. */
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
    /** Provides test behavior. */
    const test = harness();
    /** Provides coordinator behavior. */
    const coordinator = new FacebookNotificationPromptCoordinator(test.storage, test.capability, () => Number.NaN);
    await expect(coordinator.afterAuthoritativeCompletion(true)).resolves.toBe("not-eligible");
    expect(test.storage.writePreferences).not.toHaveBeenCalled();
    expect(test.capability.requestPermission).not.toHaveBeenCalled();
  });
});
