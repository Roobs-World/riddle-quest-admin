import {createNotificationOperationGate, type NotificationCrossContextLock} from "../notifications/operationGate";

it("closes notification writes and drains work that was already in flight", async () => {
  /** Provides gate behavior. */
  const gate = createNotificationOperationGate();
  /** Provides finish behavior. */
  let finish: () => void = () => undefined;
  /** Provides operation behavior. */
  const operation = gate.run(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );

  gate.close();
  expect(gate.isOpen()).toBe(false);
  await expect(gate.run(async () => undefined)).rejects.toThrow("notification-operation-gate-closed");
  /** Provides drained behavior. */
  let drained = false;
  /** Provides drain behavior. */
  const drain = gate.waitForPending().then(() => {
    drained = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(drained).toBe(false);

  finish();
  await expect(operation).resolves.toBeUndefined();
  await drain;
  expect(drained).toBe(true);
});

it("rechecks the deletion generation after a queued cross-tab lock is acquired", async () => {
  /** Provides epoch behavior. */
  let epoch = "before";
  /** Provides enter shared behavior. */
  let enterShared: (() => Promise<unknown>) | undefined;
  /** Provides cross context lock behavior. */
  const crossContextLock: NotificationCrossContextLock = {
    runShared: (operation) =>
      new Promise((resolve, reject) => {
        enterShared = () => operation().then(resolve, reject);
      }),
    runExclusive: (operation) => operation(),
  };
  /** Provides gate behavior. */
  const gate = createNotificationOperationGate({
    crossContextLock,
    deletionEpoch: () => epoch,
    deletionPending: () => false,
  });
  /** Provides sdk write behavior. */
  const sdkWrite = jest.fn(async () => undefined);
  /** Provides queued write behavior. */
  const queuedWrite = gate.run(sdkWrite);

  epoch = "after-deletion-request";
  await enterShared?.();

  await expect(queuedWrite).rejects.toThrow("notification-operation-gate-closed");
  expect(sdkWrite).not.toHaveBeenCalled();
  expect(gate.isOpen()).toBe(false);
});

it("orders shared work from one tab before exclusive deletion work from another", async () => {
  /** Provides active shared behavior. */
  let activeShared = 0;
  /** Provides notify no shared behavior. */
  let notifyNoShared: (() => void) | undefined;
  /** Provides cross context lock behavior. */
  const crossContextLock: NotificationCrossContextLock = {
    runShared: async (operation) => {
      activeShared += 1;
      try {
        return await operation();
      } finally {
        activeShared -= 1;
        if (activeShared === 0) notifyNoShared?.();
      }
    },
    runExclusive: async (operation) => {
      if (activeShared > 0)
        await new Promise<void>((resolve) => {
          notifyNoShared = resolve;
        });
      return operation();
    },
  };
  /** Provides finish shared behavior. */
  let finishShared: () => void = () => undefined;
  /** Provides first tab behavior. */
  const firstTab = createNotificationOperationGate({crossContextLock, deletionPending: () => false});
  /** Provides deleting tab behavior. */
  const deletingTab = createNotificationOperationGate({crossContextLock, deletionPending: () => false});
  /** Provides shared behavior. */
  const shared = firstTab.run(
    () =>
      new Promise<void>((resolve) => {
        finishShared = resolve;
      }),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  /** Provides cleanup behavior. */
  const cleanup = jest.fn(async () => undefined);
  /** Provides exclusive behavior. */
  const exclusive = deletingTab.runExclusive(cleanup);
  await new Promise<void>((resolve) => setImmediate(resolve));

  expect(cleanup).not.toHaveBeenCalled();
  finishShared();
  await shared;
  await exclusive;
  expect(cleanup).toHaveBeenCalledTimes(1);
});

it("fails closed in a secure runtime without a cross-context lock", async () => {
  /** Provides gate behavior. */
  const gate = createNotificationOperationGate({
    crossContextLock: null,
    requireCrossContextLock: true,
    deletionPending: () => false,
  });
  /** Provides operation behavior. */
  const operation = jest.fn(async () => undefined);

  expect(gate.isOpen()).toBe(false);
  await expect(gate.run(operation)).rejects.toThrow("notification-operation-gate-closed");
  await expect(gate.runExclusive(operation)).rejects.toThrow("notification-cross-context-lock-unavailable");
  expect(operation).not.toHaveBeenCalled();
});
