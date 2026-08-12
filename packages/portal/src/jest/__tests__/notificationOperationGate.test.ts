import {
  createNotificationOperationGate,
  type NotificationCrossContextLock,
} from "../notifications/operationGate";

it("closes notification writes and drains work that was already in flight", async () => {
  const gate = createNotificationOperationGate();
  let finish: () => void = () => undefined;
  const operation = gate.run(() => new Promise<void>((resolve) => {
    finish = resolve;
  }));

  gate.close();
  expect(gate.isOpen()).toBe(false);
  await expect(gate.run(async () => undefined)).rejects.toThrow("notification-operation-gate-closed");
  let drained = false;
  const drain = gate.waitForPending().then(() => { drained = true; });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(drained).toBe(false);

  finish();
  await expect(operation).resolves.toBeUndefined();
  await drain;
  expect(drained).toBe(true);
});

it("rechecks the deletion generation after a queued cross-tab lock is acquired", async () => {
  let epoch = "before";
  let enterShared: (() => Promise<unknown>) | undefined;
  const crossContextLock: NotificationCrossContextLock = {
    runShared: (operation) => new Promise((resolve, reject) => {
      enterShared = () => operation().then(resolve, reject);
    }),
    runExclusive: (operation) => operation(),
  };
  const gate = createNotificationOperationGate({
    crossContextLock,
    deletionEpoch: () => epoch,
    deletionPending: () => false,
  });
  const sdkWrite = jest.fn(async () => undefined);
  const queuedWrite = gate.run(sdkWrite);

  epoch = "after-deletion-request";
  await enterShared?.();

  await expect(queuedWrite).rejects.toThrow("notification-operation-gate-closed");
  expect(sdkWrite).not.toHaveBeenCalled();
  expect(gate.isOpen()).toBe(false);
});

it("orders shared work from one tab before exclusive deletion work from another", async () => {
  let activeShared = 0;
  let notifyNoShared: (() => void) | undefined;
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
      if (activeShared > 0) await new Promise<void>((resolve) => { notifyNoShared = resolve; });
      return operation();
    },
  };
  let finishShared: () => void = () => undefined;
  const firstTab = createNotificationOperationGate({crossContextLock, deletionPending: () => false});
  const deletingTab = createNotificationOperationGate({crossContextLock, deletionPending: () => false});
  const shared = firstTab.run(() => new Promise<void>((resolve) => { finishShared = resolve; }));
  await new Promise<void>((resolve) => setImmediate(resolve));
  const cleanup = jest.fn(async () => undefined);
  const exclusive = deletingTab.runExclusive(cleanup);
  await new Promise<void>((resolve) => setImmediate(resolve));

  expect(cleanup).not.toHaveBeenCalled();
  finishShared();
  await shared;
  await exclusive;
  expect(cleanup).toHaveBeenCalledTimes(1);
});

it("fails closed in a secure runtime without a cross-context lock", async () => {
  const gate = createNotificationOperationGate({
    crossContextLock: null,
    requireCrossContextLock: true,
    deletionPending: () => false,
  });
  const operation = jest.fn(async () => undefined);

  expect(gate.isOpen()).toBe(false);
  await expect(gate.run(operation)).rejects.toThrow("notification-operation-gate-closed");
  await expect(gate.runExclusive(operation)).rejects.toThrow("notification-cross-context-lock-unavailable");
  expect(operation).not.toHaveBeenCalled();
});
