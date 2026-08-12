import {getAccountDeletionEpoch, isAccountDeletionCleanupPending} from "../accountDeletionCleanup";

/** Cross-context lock used to order app-owned player operations and deletion cleanup. */
export type NotificationCrossContextLock = {
  /** Runs one ordinary notification operation under a shared lock. */
  runShared<Result>(operation: () => Promise<Result>): Promise<Result>;
  /** Runs deletion cleanup after every shared operation in every live tab. */
  runExclusive<Result>(operation: () => Promise<Result>): Promise<Result>;
};

/** Coordinates notification work with fail-closed account deletion. */
export type NotificationOperationGate = {
  /** Prevents any later notification operation from starting. */
  close(): void;
  /** Returns whether hooks may start new notification work. */
  isOpen(): boolean;
  /** Runs and tracks one notification operation. */
  run<Result>(operation: () => Promise<Result>): Promise<Result>;
  /** Waits for every operation that started before the gate closed. */
  waitForPending(): Promise<void>;
  /** Drains this tab and every cross-tab shared operation before cleanup. */
  runExclusive(operation: () => Promise<void>): Promise<void>;
};

/** Lock name shared by every Riddle Quest tab on the same Jest game origin. */
const NOTIFICATION_LOCK_NAME = "riddleQuest:jestPlayerOperations:v1";

/** Uses the browser lock manager when the secure embedded runtime exposes it. */
const createBrowserCrossContextLock = (): NotificationCrossContextLock | null => {
  const locks = globalThis.navigator?.locks;
  if (!locks) return null;
  return {
    runShared: (operation) => locks.request(NOTIFICATION_LOCK_NAME, {mode: "shared"}, operation),
    runExclusive: (operation) => locks.request(NOTIFICATION_LOCK_NAME, {mode: "exclusive"}, operation),
  };
};

/** Creates one tab gate backed by an origin-wide notification lock when available. */
export function createNotificationOperationGate({
  crossContextLock = createBrowserCrossContextLock(),
  deletionPending = isAccountDeletionCleanupPending,
  deletionEpoch = getAccountDeletionEpoch,
  requireCrossContextLock = typeof window !== "undefined" && globalThis.isSecureContext === true,
}: {
  crossContextLock?: NotificationCrossContextLock | null;
  deletionPending?: () => boolean;
  deletionEpoch?: () => string | null;
  requireCrossContextLock?: boolean;
} = {}): NotificationOperationGate {
  const initialDeletionEpoch = deletionEpoch();
  let open = !deletionPending();
  const pending = new Set<Promise<unknown>>();
  const mayRun = (): boolean =>
    open && !deletionPending() && deletionEpoch() === initialDeletionEpoch &&
    (!requireCrossContextLock || crossContextLock !== null);

  return {
    close: () => { open = false; },
    isOpen: mayRun,
    run: <Result,>(operation: () => Promise<Result>): Promise<Result> => {
      if (!mayRun()) return Promise.reject(new Error("notification-operation-gate-closed"));
      const guardedOperation = async (): Promise<Result> => {
        // Recheck after lock acquisition: another tab may have requested deletion while queued.
        if (!mayRun()) throw new Error("notification-operation-gate-closed");
        return operation();
      };
      const operationPromise = crossContextLock
        ? crossContextLock.runShared(guardedOperation)
        : Promise.resolve().then(guardedOperation);
      pending.add(operationPromise);
      void operationPromise.then(
        () => pending.delete(operationPromise),
        () => pending.delete(operationPromise),
      );
      return operationPromise;
    },
    waitForPending: async () => {
      await Promise.allSettled([...pending]);
    },
    runExclusive: async (operation) => {
      open = false;
      await Promise.allSettled([...pending]);
      if (!crossContextLock) {
        if (requireCrossContextLock) throw new Error("notification-cross-context-lock-unavailable");
        await operation();
        return;
      }
      await crossContextLock.runExclusive(operation);
    },
  };
}
