import {tr} from "../play/i18n";
import {clearBrowserPlayerState, safeBrowserStorageGet} from "../play/playerPreferences";
import {PLAYER_NOTIFICATION_IDS} from "./notifications/engagement";
import type {JestPlatformPort} from "./types";

/** Browser marker retained until all app-owned post-deletion state has been purged. */
export const ACCOUNT_DELETION_CLEANUP_PENDING_KEY = "riddleQuest:accountDeletionCleanupPending";
/** Player identity owning the durable deletion marker. */
export const ACCOUNT_DELETION_PENDING_PLAYER_KEY = "riddleQuest:accountDeletionPendingPlayer";
/** Monotonic deletion generation permanently quiesces tabs that predate a deletion request. */
export const ACCOUNT_DELETION_EPOCH_KEY = "riddleQuest:accountDeletionEpoch";
/** Durable phases distinguish requested server deletion from post-server client cleanup. */
export const ACCOUNT_DELETION_PENDING_PHASE = {
  authoritativeDeletion: "authoritative-deletion-pending",
  clientCleanup: "client-cleanup-pending",
} as const;
/** Durable account-deletion phase stored across a page reload. */
export type AccountDeletionPendingPhase =
  (typeof ACCOUNT_DELETION_PENDING_PHASE)[keyof typeof ACCOUNT_DELETION_PENDING_PHASE];
/** Browser areas used redundantly so one restricted storage boundary cannot lose the retry marker. */
const CLEANUP_MARKER_STORAGE_AREAS = ["local", "session"] as const;
/** Browser storage area that can retain one account-deletion recovery marker. */
type CleanupMarkerStorageArea = (typeof CLEANUP_MARKER_STORAGE_AREAS)[number];

/** Error describing which post-server account-deletion cleanup boundaries need retry. */
export class AccountDeletionCleanupError extends Error {
  /** Indicates that one or more app-owned Jest notifications could not be unscheduled. */
  readonly notificationsFailed: boolean;
  /** Indicates that the Jest SDK data flush failed. */
  readonly platformFailed: boolean;
  /** Indicates that app-owned browser storage could not be fully cleared. */
  readonly browserFailed: boolean;

  /** Creates one retryable client-cleanup error. */
  constructor(notificationsFailed: boolean, platformFailed: boolean, browserFailed: boolean, failures: unknown[]) {
    super(tr("Profile.DELETE_ACCOUNT_ERROR_MESSAGE"), {
      cause: new AggregateError(failures, "account-deletion-client-cleanup-failed"),
    });
    this.name = "AccountDeletionCleanupError";
    this.notificationsFailed = notificationsFailed;
    this.platformFailed = platformFailed;
    this.browserFailed = browserFailed;
  }
}

/** Returns the most conservative durable deletion phase visible to this tab. */
export function getAccountDeletionPendingPhase(): AccountDeletionPendingPhase | null {
  /** Provides values behavior. */
  const values = CLEANUP_MARKER_STORAGE_AREAS.map((area) =>
    safeBrowserStorageGet(area, ACCOUNT_DELETION_CLEANUP_PENDING_KEY),
  );
  if (values.includes(ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion)) {
    return ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion;
  }
  // `1` is the post-server marker written by builds released before phase tracking.
  if (values.some((value) => value === ACCOUNT_DELETION_PENDING_PHASE.clientCleanup || value === "1")) {
    return ACCOUNT_DELETION_PENDING_PHASE.clientCleanup;
  }
  return null;
}

/** Returns whether a requested deletion still needs an authoritative or client-side step. */
export const isAccountDeletionCleanupPending = (): boolean => getAccountDeletionPendingPhase() !== null;

/** Returns the deletion generation captured by cross-tab operation gates. */
export const getAccountDeletionEpoch = (): string | null => safeBrowserStorageGet("local", ACCOUNT_DELETION_EPOCH_KEY);

/**
 * Drops a player-scoped marker after the Jest simulator replaces its player.
 * Legacy unscoped markers remain fail-closed and require one-time site-data cleanup.
 */
export function discardAccountDeletionForDifferentPlayer(playerId: string): boolean {
  /** Provides marked player ids behavior. */
  const markedPlayerIds = CLEANUP_MARKER_STORAGE_AREAS.map((area) =>
    safeBrowserStorageGet(area, ACCOUNT_DELETION_PENDING_PLAYER_KEY),
  ).filter((value): value is string => Boolean(value));
  if (!isAccountDeletionCleanupPending() || markedPlayerIds.length === 0 || markedPlayerIds.includes(playerId)) {
    return false;
  }
  CLEANUP_MARKER_STORAGE_AREAS.forEach((area) => {
    try {
      /** Provides storage behavior. */
      const storage = getCleanupMarkerStorage(area);
      storage.removeItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY);
      storage.removeItem(ACCOUNT_DELETION_PENDING_PLAYER_KEY);
    } catch {
      // Verification below keeps a restricted storage boundary fail-closed.
    }
  });
  return !isAccountDeletionCleanupPending();
}

/** Minimal cross-tab gate used to serialize startup identity with deletion authority. */
type AccountDeletionStartupGate = {
  /** Returns whether this tab may still begin player operations. */
  isOpen(): boolean;
  /** Runs ordinary identity work under the shared player-operation lock. */
  run(operation: () => Promise<boolean>): Promise<boolean>;
  /** Runs deletion recovery after draining player work across tabs. */
  runExclusive(operation: () => Promise<void>): Promise<void>;
};

/** Cross-tab gate used to complete a tombstoned identity without overlapping player writes. */
type TombstonedIdentityCleanupGate = {
  /** Waits for player operations already queued in this tab. */
  waitForPending(): Promise<void>;
  /** Runs tombstone recovery after draining player work across tabs. */
  runExclusive(operation: () => Promise<void>): Promise<void>;
};

/**
 * Coordinates startup identity with deletion without allowing a recovery exchange to
 * outlive the durable intent that authorized it.
 */
export async function runAccountDeletionAwareIdentityOperation(
  deletionRecovery: boolean,
  gate: AccountDeletionStartupGate,
  operation: () => Promise<boolean>,
): Promise<boolean> {
  if (!deletionRecovery) return (await gate.run(operation)) || !gate.isOpen();

  await gate.runExclusive(async () => {
    // The owner may have completed deletion while this recovery waited for the lock.
    if (getAccountDeletionPendingPhase() !== ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion) return;
    await operation();
  });
  // A recovery startup is terminal even if another tab completed it first.
  return true;
}

/**
 * Treats a server tombstone as evidence that deletion was requested, not that its sweep finished.
 * A fresh signed assertion must drive the idempotent authoritative retry before local state is purged.
 */
export async function completeTombstonedAccountDeletion(
  platform: JestPlatformPort,
  playerSigned: string,
  gate: TombstonedIdentityCleanupGate,
  retryAuthoritativeDeletion: (playerSigned: string) => Promise<void>,
  clearFirebaseAuthentication?: () => Promise<void>,
): Promise<void> {
  if (getAccountDeletionPendingPhase() === null) markAccountDeletionRequested(platform.getPlayer().playerId);
  await gate.runExclusive(async () => {
    /** Provides phase behavior. */
    const phase = getAccountDeletionPendingPhase();
    if (phase === null) return;
    /** Provides recovered behavior. */
    const recovered = await recoverPendingAccountDeletion(
      platform,
      phase === ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion ? "signed" : "initialized",
      {
        clearFirebaseAuthentication,
        retryAuthoritativeDeletion: () => retryAuthoritativeDeletion(playerSigned),
        waitForPendingNotificationOperations: gate.waitForPending,
      },
    );
    if (!recovered && getAccountDeletionPendingPhase() !== null) {
      throw new Error("account-deletion-recovery-state-changed");
    }
  });
}

/** Returns one browser storage area without swallowing restrictive iframe failures. */
const getCleanupMarkerStorage = (area: CleanupMarkerStorageArea): Storage =>
  area === "local" ? globalThis.localStorage : globalThis.sessionStorage;

/** Persists and verifies a reload marker before any fallible client cleanup starts. */
const persistAccountDeletionCleanupMarker = (
  phase: AccountDeletionPendingPhase,
  playerId: string,
): CleanupMarkerStorageArea[] => {
  /** Provides persisted behavior. */
  const persisted: CleanupMarkerStorageArea[] = [];
  /** Provides failures behavior. */
  const failures: unknown[] = [];
  CLEANUP_MARKER_STORAGE_AREAS.forEach((area) => {
    try {
      /** Provides storage behavior. */
      const storage = getCleanupMarkerStorage(area);
      storage.setItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY, phase);
      storage.setItem(ACCOUNT_DELETION_PENDING_PLAYER_KEY, playerId);
      if (
        storage.getItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY) !== phase ||
        storage.getItem(ACCOUNT_DELETION_PENDING_PLAYER_KEY) !== playerId
      ) {
        throw new Error(`cleanup-marker-write-unverified:${area}`);
      }
      persisted.push(area);
    } catch (error) {
      failures.push(error);
    }
  });
  if (!persisted.includes("local")) {
    throw new AccountDeletionCleanupError(false, false, true, [
      new AggregateError(failures, "durable-cleanup-marker-write-failed"),
    ]);
  }
  return persisted;
};

/** Rotates and verifies the origin-wide generation that permanently quiesces older live tabs. */
const rotateAccountDeletionEpoch = (): void => {
  try {
    /** Provides storage behavior. */
    const storage = getCleanupMarkerStorage("local");
    /** Provides epoch behavior. */
    const epoch = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storage.setItem(ACCOUNT_DELETION_EPOCH_KEY, epoch);
    if (storage.getItem(ACCOUNT_DELETION_EPOCH_KEY) !== epoch) {
      throw new Error("account-deletion-epoch-write-unverified");
    }
  } catch (error) {
    throw new AccountDeletionCleanupError(false, false, true, [error]);
  }
};

/** Persists deletion intent before the authoritative request is allowed to start. */
export function markAccountDeletionRequested(playerId: string): void {
  persistAccountDeletionCleanupMarker(ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion, playerId);
  rotateAccountDeletionEpoch();
}

/** Removes every successfully persisted marker copy and verifies each removal. */
const removeAccountDeletionCleanupMarker = (persisted: CleanupMarkerStorageArea[]): void => {
  /** Provides failures behavior. */
  const failures: unknown[] = [];
  persisted.forEach((area) => {
    try {
      /** Provides storage behavior. */
      const storage = getCleanupMarkerStorage(area);
      storage.removeItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY);
      storage.removeItem(ACCOUNT_DELETION_PENDING_PLAYER_KEY);
      if (storage.getItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY) !== null) {
        throw new Error(`cleanup-marker-remove-unverified:${area}`);
      }
    } catch (error) {
      failures.push(error);
    }
  });
  if (isAccountDeletionCleanupPending()) failures.push(new Error("cleanup-marker-remove-incomplete"));
  if (failures.length > 0) {
    throw new AccountDeletionCleanupError(false, false, true, [
      new AggregateError(failures, "cleanup-marker-remove-failed"),
    ]);
  }
};

/**
 * Clears app-owned Jest and browser state while retaining a reload-safe retry marker on failure.
 *
 * The marker is deliberately not part of `clearBrowserPlayerState`; it is removed only after
 * every cleanup boundary succeeds and the absence of the marker can be verified.
 */
export async function purgeDeletedPlayerState(
  platform: JestPlatformPort,
  {
    clearFirebaseAuthentication,
    waitForPendingNotificationOperations,
    withExclusiveNotificationAccess,
  }: {
    /** Stores clear firebase authentication. */
    clearFirebaseAuthentication?: () => Promise<void>;
    /** Stores wait for pending notification operations. */
    waitForPendingNotificationOperations?: () => Promise<void>;
    /** Stores with exclusive notification access. */
    withExclusiveNotificationAccess?: (operation: () => Promise<void>) => Promise<void>;
  } = {},
): Promise<void> {
  /** Provides persisted marker areas behavior. */
  const persistedMarkerAreas = persistAccountDeletionCleanupMarker(
    ACCOUNT_DELETION_PENDING_PHASE.clientCleanup,
    platform.getPlayer().playerId,
  );
  /** Provides failures behavior. */
  const failures: unknown[] = [];
  /** Provides notifications failed behavior. */
  let notificationsFailed = false;
  /** Provides platform failed behavior. */
  let platformFailed = false;
  /** Provides browser failed behavior. */
  let browserFailed = false;
  /** Clears notifications. */
  const clearNotifications = async (): Promise<void> => {
    try {
      await waitForPendingNotificationOperations?.();
    } catch (error) {
      notificationsFailed = true;
      failures.push(error);
    }
    try {
      if (platform.getPlayer().registered) {
        /** Provides removals behavior. */
        const removals = await Promise.allSettled(
          PLAYER_NOTIFICATION_IDS.map((identifier) => platform.removeNotification(identifier)),
        );
        removals.forEach((removal, index) => {
          if (removal.status === "rejected") {
            notificationsFailed = true;
            failures.push(removal.reason);
          } else if (removal.value.status !== "success") {
            notificationsFailed = true;
            failures.push(
              new Error(`notification-unschedule-failed:${PLAYER_NOTIFICATION_IDS[index]}:${removal.value.status}`),
            );
          }
        });
      }
    } catch (error) {
      notificationsFailed = true;
      failures.push(error);
    }
  };
  try {
    if (withExclusiveNotificationAccess) await withExclusiveNotificationAccess(clearNotifications);
    else await clearNotifications();
  } catch (error) {
    notificationsFailed = true;
    failures.push(error);
  }
  try {
    await platform.clearPlayerState();
  } catch (error) {
    platformFailed = true;
    failures.push(error);
  }
  try {
    await clearFirebaseAuthentication?.();
  } catch (error) {
    browserFailed = true;
    failures.push(error);
  }
  try {
    clearBrowserPlayerState();
  } catch (error) {
    browserFailed = true;
    failures.push(error);
  }
  if (failures.length > 0) {
    throw new AccountDeletionCleanupError(notificationsFailed, platformFailed, browserFailed, failures);
  }

  removeAccountDeletionCleanupMarker(persistedMarkerAreas);
}

/**
 * Resumes one durable deletion phase without clearing client identity before server authority.
 * Returns true when startup must stop on the account-deleted confirmation surface.
 */
export async function recoverPendingAccountDeletion(
  platform: JestPlatformPort,
  stage: "initialized" | "signed",
  {
    clearFirebaseAuthentication,
    retryAuthoritativeDeletion,
    waitForPendingNotificationOperations,
    withExclusiveNotificationAccess,
  }: {
    /** Stores clear firebase authentication. */
    clearFirebaseAuthentication?: () => Promise<void>;
    /** Stores retry authoritative deletion. */
    retryAuthoritativeDeletion?: () => Promise<void>;
    /** Stores wait for pending notification operations. */
    waitForPendingNotificationOperations?: () => Promise<void>;
    /** Stores with exclusive notification access. */
    withExclusiveNotificationAccess?: (operation: () => Promise<void>) => Promise<void>;
  } = {},
): Promise<boolean> {
  /** Provides phase behavior. */
  const phase = getAccountDeletionPendingPhase();
  /** Provides client cleanup ready behavior. */
  const clientCleanupReady = phase === ACCOUNT_DELETION_PENDING_PHASE.clientCleanup && stage === "initialized";
  /** Provides authoritative retry ready behavior. */
  const authoritativeRetryReady = phase === ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion && stage === "signed";
  if (!clientCleanupReady && !authoritativeRetryReady) return false;

  if (authoritativeRetryReady) {
    rotateAccountDeletionEpoch();
    if (!retryAuthoritativeDeletion) throw new Error("account-deletion-recovery-unavailable");
    await retryAuthoritativeDeletion();
  }
  await purgeDeletedPlayerState(platform, {
    clearFirebaseAuthentication,
    waitForPendingNotificationOperations,
    withExclusiveNotificationAccess,
  });
  return true;
}
