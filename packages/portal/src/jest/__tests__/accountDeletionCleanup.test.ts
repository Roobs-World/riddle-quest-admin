import {MockJestPlatform} from "../MockJestPlatform";
import {
  ACCOUNT_DELETION_CLEANUP_PENDING_KEY,
  ACCOUNT_DELETION_EPOCH_KEY,
  ACCOUNT_DELETION_PENDING_PHASE,
  AccountDeletionCleanupError,
  completeTombstonedAccountDeletion,
  getAccountDeletionPendingPhase,
  isAccountDeletionCleanupPending,
  markAccountDeletionRequested,
  purgeDeletedPlayerState,
  recoverPendingAccountDeletion,
  runAccountDeletionAwareIdentityOperation,
} from "../accountDeletionCleanup";
import {startJestSession} from "../startup";
import {PLAYER_NOTIFICATION_IDS} from "../notifications/engagement";
import {createNotificationOperationGate, type NotificationCrossContextLock} from "../notifications/operationGate";
import {PLAYER_PREFERENCE_STORAGE_KEYS, safeBrowserStorageSet} from "../../play/playerPreferences";

/** In-memory browser storage used to model cleanup across page instances. */
class MemoryStorage implements Storage {
  /** Stores values. */
  private readonly values = new Map<string, string>();
  /** Gets length. */
  get length() {
    return this.values.size;
  }
  /** Provides clear behavior. */
  clear() {
    this.values.clear();
  }
  /** Gets item. */
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  /** Provides key behavior. */
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  /** Removes item. */
  removeItem(key: string) {
    this.values.delete(key);
  }
  /** Sets item. */
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

/** Storage area that models a restrictive browser silently handled by safe wrappers. */
class WriteBlockedStorage extends MemoryStorage {
  /** Stores block writes. */
  blockWrites = true;
  /** Sets item. */
  override setItem(key: string, value: string): void {
    if (this.blockWrites) throw new Error("storage write blocked");
    super.setItem(key, value);
  }
}

/** Storage area that verifies writes but blocks marker removal. */
class RemoveBlockedStorage extends MemoryStorage {
  /** Stores block removals. */
  blockRemovals = true;
  /** Removes item. */
  override removeItem(key: string): void {
    if (this.blockRemovals && key === ACCOUNT_DELETION_CLEANUP_PENDING_KEY) {
      throw new Error("storage removal blocked");
    }
    super.removeItem(key);
  }
}

/** Storage that proves deletion intent survives a later cross-tab epoch failure. */
class EpochWriteBlockedStorage extends MemoryStorage {
  /** Sets item. */
  override setItem(key: string, value: string): void {
    if (key === ACCOUNT_DELETION_EPOCH_KEY) throw new Error("epoch write blocked");
    super.setItem(key, value);
  }
}

/** Provides original local storage behavior. */
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
/** Provides original session storage behavior. */
const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
});

afterEach(() => {
  if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  else delete (globalThis as Record<string, unknown>).localStorage;
  if (originalSessionStorage) Object.defineProperty(globalThis, "sessionStorage", originalSessionStorage);
  else delete (globalThis as Record<string, unknown>).sessionStorage;
});

it("retains a pending marker after failure and completes an idempotent client-only retry", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.clearPlayerState = jest
    .fn()
    .mockRejectedValueOnce(new Error("SDK flush unavailable"))
    .mockResolvedValueOnce(undefined);
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.locale, "fr");

  await expect(purgeDeletedPlayerState(platform)).rejects.toEqual(
    expect.objectContaining({
      name: "AccountDeletionCleanupError",
      platformFailed: true,
      browserFailed: false,
    } satisfies Partial<AccountDeletionCleanupError>),
  );
  expect(isAccountDeletionCleanupPending()).toBe(true);
  expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale)).toBeNull();

  await expect(purgeDeletedPlayerState(platform)).resolves.toBeUndefined();
  expect(platform.clearPlayerState).toHaveBeenCalledTimes(2);
  expect(isAccountDeletionCleanupPending()).toBe(false);
});

it("retains client cleanup until the persisted Firebase session is signed out", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  /** Clears firebase authentication. */
  const clearFirebaseAuthentication = jest
    .fn()
    .mockRejectedValueOnce(new Error("firebase-sign-out-failed"))
    .mockResolvedValueOnce(undefined);

  await expect(purgeDeletedPlayerState(platform, {clearFirebaseAuthentication})).rejects.toEqual(
    expect.objectContaining({browserFailed: true}),
  );
  expect(getAccountDeletionPendingPhase()).toBe(ACCOUNT_DELETION_PENDING_PHASE.clientCleanup);

  await expect(purgeDeletedPlayerState(platform, {clearFirebaseAuthentication})).resolves.toBeUndefined();
  expect(clearFirebaseAuthentication).toHaveBeenCalledTimes(2);
  expect(getAccountDeletionPendingPhase()).toBeNull();
});

it("refuses cleanup with only a tab-scoped marker until durable local storage recovers", async () => {
  /** Provides local behavior. */
  const local = new WriteBlockedStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: local,
  });
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.clearPlayerState = jest.fn().mockResolvedValue(undefined);

  await expect(purgeDeletedPlayerState(platform)).rejects.toEqual(
    expect.objectContaining({
      platformFailed: false,
      browserFailed: true,
    } satisfies Partial<AccountDeletionCleanupError>),
  );
  expect(sessionStorage.getItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY)).toBe(
    ACCOUNT_DELETION_PENDING_PHASE.clientCleanup,
  );
  expect(isAccountDeletionCleanupPending()).toBe(true);
  expect(platform.clearPlayerState).not.toHaveBeenCalled();

  local.blockWrites = false;
  await expect(purgeDeletedPlayerState(platform)).resolves.toBeUndefined();
  expect(platform.clearPlayerState).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY)).toBeNull();
  expect(isAccountDeletionCleanupPending()).toBe(false);
});

it("fails before mutating client state when no reload marker can be verified", async () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new WriteBlockedStorage(),
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: new WriteBlockedStorage(),
  });
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.removeNotification = jest.fn(platform.removeNotification);
  platform.clearPlayerState = jest.fn(platform.clearPlayerState);

  await expect(purgeDeletedPlayerState(platform)).rejects.toEqual(
    expect.objectContaining({
      notificationsFailed: false,
      platformFailed: false,
      browserFailed: true,
    } satisfies Partial<AccountDeletionCleanupError>),
  );
  expect(platform.removeNotification).not.toHaveBeenCalled();
  expect(platform.clearPlayerState).not.toHaveBeenCalled();
});

it("persists authoritative intent before rotating the cross-tab deletion generation", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new EpochWriteBlockedStorage(),
  });

  expect(() => markAccountDeletionRequested()).toThrow(AccountDeletionCleanupError);
  expect(localStorage.getItem(ACCOUNT_DELETION_EPOCH_KEY)).toBeNull();
  expect(getAccountDeletionPendingPhase()).toBe(ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion);
  expect(sessionStorage.getItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY)).toBe(
    ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion,
  );
});

it("skips a queued recovery exchange when another tab already completed deletion", async () => {
  localStorage.setItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY, ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion);
  /** Provides exchange behavior. */
  const exchange = jest.fn(async () => false);
  /** Provides gate behavior. */
  const gate = {
    isOpen: () => false,
    run: jest.fn(async (operation: () => Promise<boolean>) => operation()),
    runExclusive: jest.fn(async (operation: () => Promise<void>) => {
      localStorage.removeItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY);
      await operation();
    }),
  };

  await expect(runAccountDeletionAwareIdentityOperation(true, gate, exchange)).resolves.toBe(true);
  expect(gate.runExclusive).toHaveBeenCalledTimes(1);
  expect(exchange).not.toHaveBeenCalled();
});

it("owns one non-reentrant exclusive lock through signed retry and client purge", async () => {
  markAccountDeletionRequested();
  /** Provides exclusive active behavior. */
  let exclusiveActive = false;
  /** Provides run exclusive behavior. */
  const runExclusive = jest.fn(async (operation: () => Promise<void>) => {
    if (exclusiveActive) throw new Error("nested-exclusive-lock");
    exclusiveActive = true;
    try {
      await operation();
    } finally {
      exclusiveActive = false;
    }
  });
  /** Provides cross context lock behavior. */
  const crossContextLock: NotificationCrossContextLock = {
    runShared: (operation) => operation(),
    runExclusive,
  };
  /** Provides gate behavior. */
  const gate = createNotificationOperationGate({crossContextLock});
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  /** Provides retry authoritative deletion behavior. */
  const retryAuthoritativeDeletion = jest.fn(async () => undefined);

  await expect(
    runAccountDeletionAwareIdentityOperation(true, gate, () =>
      recoverPendingAccountDeletion(platform, "signed", {
        retryAuthoritativeDeletion,
        waitForPendingNotificationOperations: gate.waitForPending,
      }),
    ),
  ).resolves.toBe(true);

  expect(runExclusive).toHaveBeenCalledTimes(1);
  expect(retryAuthoritativeDeletion).toHaveBeenCalledTimes(1);
  expect(getAccountDeletionPendingPhase()).toBeNull();
});

it("does not report success when a persisted marker cannot be removed and verifies a retry", async () => {
  /** Provides local behavior. */
  const local = new RemoveBlockedStorage();
  Object.defineProperty(globalThis, "localStorage", {configurable: true, value: local});
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();

  /** Provides failure behavior. */
  const failure = await purgeDeletedPlayerState(platform).catch((error: unknown) => error);
  expect(failure).toMatchObject({
    notificationsFailed: false,
    platformFailed: false,
    browserFailed: true,
  } satisfies Partial<AccountDeletionCleanupError>);
  expect(local.getItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY)).toBe(ACCOUNT_DELETION_PENDING_PHASE.clientCleanup);
  expect(isAccountDeletionCleanupPending()).toBe(true);

  local.blockRemovals = false;
  await expect(purgeDeletedPlayerState(platform)).resolves.toBeUndefined();
  expect(isAccountDeletionCleanupPending()).toBe(false);
});

it("does not report success while an older marker copy remains in a temporarily read-only area", async () => {
  /** Provides local behavior. */
  const local = new WriteBlockedStorage();
  local.blockWrites = false;
  local.setItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY, "1");
  local.blockWrites = true;
  Object.defineProperty(globalThis, "localStorage", {configurable: true, value: local});
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();

  /** Provides failure behavior. */
  const failure = await purgeDeletedPlayerState(platform).catch((error: unknown) => error);
  expect(failure).toMatchObject({browserFailed: true} satisfies Partial<AccountDeletionCleanupError>);
  expect(isAccountDeletionCleanupPending()).toBe(true);

  local.blockWrites = false;
  await expect(purgeDeletedPlayerState(platform)).resolves.toBeUndefined();
  expect(isAccountDeletionCleanupPending()).toBe(false);
});

it("best-effort unschedules every stable notification id and fails closed until all removals succeed", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  /** Provides rejected identifier behavior. */
  const rejectedIdentifier = PLAYER_NOTIFICATION_IDS[2];
  /** Provides thrown identifier behavior. */
  const thrownIdentifier = PLAYER_NOTIFICATION_IDS.at(-1);
  platform.removeNotification = jest.fn(async (identifier) => {
    if (identifier === rejectedIdentifier) {
      return {status: "retryable-failure", message: "offline"} as const;
    }
    if (identifier === thrownIdentifier) throw new Error("SDK unavailable");
    return {status: "success", value: undefined} as const;
  });
  platform.clearPlayerState = jest.fn().mockResolvedValue(undefined);
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.locale, "fr");

  await expect(purgeDeletedPlayerState(platform)).rejects.toEqual(
    expect.objectContaining({
      name: "AccountDeletionCleanupError",
      notificationsFailed: true,
      platformFailed: false,
      browserFailed: false,
    } satisfies Partial<AccountDeletionCleanupError>),
  );
  expect(platform.removeNotification.mock.calls.map(([identifier]) => identifier)).toEqual(PLAYER_NOTIFICATION_IDS);
  expect(platform.clearPlayerState).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale)).toBeNull();
  expect(isAccountDeletionCleanupPending()).toBe(true);

  platform.removeNotification.mockResolvedValue({status: "success", value: undefined});
  await expect(purgeDeletedPlayerState(platform)).resolves.toBeUndefined();
  expect(platform.removeNotification).toHaveBeenCalledTimes(PLAYER_NOTIFICATION_IDS.length * 2);
  expect(platform.clearPlayerState).toHaveBeenCalledTimes(2);
  expect(isAccountDeletionCleanupPending()).toBe(false);
});

it("does not call the registered-player notification API for a guest cleanup", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(false);
  platform.removeNotification = jest.fn(platform.removeNotification);

  await expect(purgeDeletedPlayerState(platform)).resolves.toBeUndefined();

  expect(platform.removeNotification).not.toHaveBeenCalled();
});

it("persists the retry marker before waiting for in-flight notification work", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.removeNotification = jest.fn(platform.removeNotification);
  /** Provides release pending operation behavior. */
  let releasePendingOperation: () => void = () => undefined;
  /** Provides pending operation behavior. */
  const pendingOperation = new Promise<void>((resolve) => {
    releasePendingOperation = resolve;
  });

  /** Provides cleanup behavior. */
  const cleanup = purgeDeletedPlayerState(platform, {
    waitForPendingNotificationOperations: () => pendingOperation,
  });
  await new Promise<void>((resolve) => setImmediate(resolve));

  expect(isAccountDeletionCleanupPending()).toBe(true);
  expect(platform.removeNotification).not.toHaveBeenCalled();

  releasePendingOperation();
  await expect(cleanup).resolves.toBeUndefined();
  expect(platform.removeNotification).toHaveBeenCalledTimes(PLAYER_NOTIFICATION_IDS.length);
  expect(isAccountDeletionCleanupPending()).toBe(false);
});

it("resumes legacy post-server cleanup after SDK init and stops before recreating an identity", async () => {
  /** Provides order behavior. */
  const order: string[] = [];
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  safeBrowserStorageSet("local", "riddleQuest:accountDeletionCleanupPending", "1");
  platform.removeNotification = async (identifier) => {
    order.push(`notification:${identifier}`);
    return {status: "success", value: undefined};
  };
  platform.clearPlayerState = async () => {
    order.push("cleanup");
  };
  platform.getPlayerSigned = async () => {
    order.push("signed");
    return {player: platform.player, playerSigned: "signed"};
  };

  /** Provides result behavior. */
  const result = await startJestSession(
    platform,
    {
      exchangeIdentity: async () => {
        throw new Error("identity must not be recreated");
      },
    } as never,
    {
      reconcile: async () => {
        throw new Error("purchases must not run");
      },
    } as never,
    async () => {
      throw new Error("Firebase auth must not run");
    },
    undefined,
    {
      onInitialized: () => recoverPendingAccountDeletion(platform, "initialized"),
    },
  );

  expect(result.status).toBe("account-deleted");
  expect(order).toEqual([...PLAYER_NOTIFICATION_IDS.map((identifier) => `notification:${identifier}`), "cleanup"]);
  expect(isAccountDeletionCleanupPending()).toBe(false);
  expect(platform.loaded).toBe(true);
});

it("purges this device after identity reports a tombstone on another device", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  /** Removes notification. */
  const removeNotification = jest.spyOn(platform, "removeNotification");
  /** Clears player state. */
  const clearPlayerState = jest.spyOn(platform, "clearPlayerState");
  /** Provides shared identity active behavior. */
  let sharedIdentityActive = false;
  /** Provides retry authoritative deletion behavior. */
  const retryAuthoritativeDeletion = jest.fn(async () => undefined);
  /** Clears firebase authentication. */
  const clearFirebaseAuthentication = jest.fn(async () => undefined);
  /** Provides gate behavior. */
  const gate = createNotificationOperationGate({crossContextLock: null, requireCrossContextLock: false});
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.locale, "fr");

  /** Provides result behavior. */
  const result = await startJestSession(
    platform,
    {exchangeIdentity: async () => ({status: "account-deleted"})} as never,
    {reconcile: jest.fn()} as never,
    jest.fn(),
    undefined,
    {
      withIdentityOperation: async (operation) => {
        sharedIdentityActive = true;
        try {
          return await operation();
        } finally {
          sharedIdentityActive = false;
        }
      },
      onIdentityDeleted: async (playerSigned) => {
        expect(sharedIdentityActive).toBe(false);
        await completeTombstonedAccountDeletion(
          platform,
          playerSigned,
          gate,
          retryAuthoritativeDeletion,
          clearFirebaseAuthentication,
        );
      },
    },
  );

  expect(result).toEqual({status: "account-deleted"});
  expect(retryAuthoritativeDeletion).toHaveBeenCalledWith("mock.signed.player");
  expect(clearFirebaseAuthentication).toHaveBeenCalledTimes(1);
  expect(removeNotification.mock.calls.map(([identifier]) => identifier)).toEqual(PLAYER_NOTIFICATION_IDS);
  expect(clearPlayerState).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale)).toBeNull();
  expect(getAccountDeletionPendingPhase()).toBeNull();
});

it("retains client-cleanup recovery when cross-device tombstone cleanup fails", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.removeNotification = jest.fn(async (identifier) =>
    identifier === PLAYER_NOTIFICATION_IDS[0]
      ? ({status: "retryable-failure", message: "offline"} as const)
      : ({status: "success", value: undefined} as const),
  );
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.locale, "fr");
  /** Provides retry authoritative deletion behavior. */
  const retryAuthoritativeDeletion = jest.fn(async () => undefined);
  /** Provides gate behavior. */
  const gate = createNotificationOperationGate({crossContextLock: null, requireCrossContextLock: false});

  /** Provides result behavior. */
  const result = await startJestSession(
    platform,
    {exchangeIdentity: async () => ({status: "account-deleted"})} as never,
    {reconcile: jest.fn()} as never,
    jest.fn(),
    undefined,
    {
      onIdentityDeleted: (playerSigned) =>
        completeTombstonedAccountDeletion(platform, playerSigned, gate, retryAuthoritativeDeletion),
    },
  );

  expect(result.status).toBe("retryable-failure");
  expect(retryAuthoritativeDeletion).toHaveBeenCalledTimes(1);
  expect(platform.removeNotification).toHaveBeenCalledTimes(PLAYER_NOTIFICATION_IDS.length);
  expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale)).toBeNull();
  expect(getAccountDeletionPendingPhase()).toBe(ACCOUNT_DELETION_PENDING_PHASE.clientCleanup);
});

it("retains authoritative recovery when a discovered tombstone sweep is still busy", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  /** Removes notification. */
  const removeNotification = jest.spyOn(platform, "removeNotification");
  /** Clears player state. */
  const clearPlayerState = jest.spyOn(platform, "clearPlayerState");
  /** Provides retry authoritative deletion behavior. */
  const retryAuthoritativeDeletion = jest.fn(async () => {
    throw new Error("account-deletion-busy");
  });
  /** Provides gate behavior. */
  const gate = createNotificationOperationGate({crossContextLock: null, requireCrossContextLock: false});

  /** Provides result behavior. */
  const result = await startJestSession(
    platform,
    {exchangeIdentity: async () => ({status: "account-deleted"})} as never,
    {reconcile: jest.fn()} as never,
    jest.fn(),
    undefined,
    {
      onIdentityDeleted: (playerSigned) =>
        completeTombstonedAccountDeletion(platform, playerSigned, gate, retryAuthoritativeDeletion),
    },
  );

  expect(result).toEqual({status: "retryable-failure", message: "account-deletion-busy"});
  expect(retryAuthoritativeDeletion).toHaveBeenCalledWith("mock.signed.player");
  expect(removeNotification).not.toHaveBeenCalled();
  expect(clearPlayerState).not.toHaveBeenCalled();
  expect(getAccountDeletionPendingPhase()).toBe(ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion);
});

it("retries authority after a crash exactly between server success and client cleanup", async () => {
  /** Provides order behavior. */
  const order: string[] = [];
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  /** Provides reconcile behavior. */
  const reconcile = jest.fn(async () => ({status: "success", value: 0}) as const);
  markAccountDeletionRequested();
  // The first tab's server call succeeded, then the tab disappeared before its cleanup callback.
  platform.getPlayerSigned = async () => {
    order.push("signed");
    return {player: platform.player, playerSigned: "signed"};
  };
  platform.removeNotification = async (identifier) => {
    order.push(`notification:${identifier}`);
    return {status: "success", value: undefined};
  };
  platform.clearPlayerState = async () => {
    order.push("cleanup");
  };

  /** Provides result behavior. */
  const result = await startJestSession(
    platform,
    {
      exchangeIdentity: async () => {
        throw new Error("identity must not be recreated");
      },
    } as never,
    {reconcile} as never,
    async () => {
      throw new Error("Firebase auth must not run");
    },
    undefined,
    {
      onInitialized: () => recoverPendingAccountDeletion(platform, "initialized"),
      deletionRecovery: true,
      recoverAccountDeletion: () =>
        recoverPendingAccountDeletion(platform, "signed", {
          clearFirebaseAuthentication: async () => {
            order.push("firebase-signout");
          },
          retryAuthoritativeDeletion: async () => {
            order.push("server-retry");
          },
        }).then(() => undefined),
    },
  );

  expect(result.status).toBe("account-deleted");
  expect(order).toEqual([
    "signed",
    "server-retry",
    ...PLAYER_NOTIFICATION_IDS.map((identifier) => `notification:${identifier}`),
    "cleanup",
    "firebase-signout",
  ]);
  expect(reconcile).not.toHaveBeenCalled();
  expect(getAccountDeletionPendingPhase()).toBeNull();
});

it("never purges an ambiguous request before a signed authoritative retry succeeds", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  /** Removes notification. */
  const removeNotification = jest.spyOn(platform, "removeNotification");
  /** Clears player state. */
  const clearPlayerState = jest.spyOn(platform, "clearPlayerState");
  /** Clears firebase authentication. */
  const clearFirebaseAuthentication = jest.fn(async () => undefined);
  markAccountDeletionRequested();
  /** Provides dependencies behavior. */
  const dependencies = [
    {
      exchangeIdentity: async () => {
        throw new Error("identity must not be recreated");
      },
    } as never,
    {reconcile: jest.fn(async () => ({status: "success", value: 0}) as const)} as never,
  ] as const;

  /** Provides failed behavior. */
  const failed = await startJestSession(platform, dependencies[0], dependencies[1], async () => {}, undefined, {
    onInitialized: () => recoverPendingAccountDeletion(platform, "initialized"),
    deletionRecovery: true,
    recoverAccountDeletion: () =>
      recoverPendingAccountDeletion(platform, "signed", {
        clearFirebaseAuthentication,
        retryAuthoritativeDeletion: async () => {
          throw new Error("authoritative deletion timed out");
        },
      }).then(() => undefined),
  });

  expect(failed).toEqual({status: "retryable-failure", message: "authoritative deletion timed out"});
  expect(removeNotification).not.toHaveBeenCalled();
  expect(clearPlayerState).not.toHaveBeenCalled();
  expect(clearFirebaseAuthentication).not.toHaveBeenCalled();
  expect(getAccountDeletionPendingPhase()).toBe(ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion);

  /** Provides recovered behavior. */
  const recovered = await startJestSession(platform, dependencies[0], dependencies[1], async () => {}, undefined, {
    onInitialized: () => recoverPendingAccountDeletion(platform, "initialized"),
    deletionRecovery: true,
    recoverAccountDeletion: () =>
      recoverPendingAccountDeletion(platform, "signed", {
        clearFirebaseAuthentication,
        retryAuthoritativeDeletion: async () => undefined,
      }).then(() => undefined),
  });
  expect(recovered.status).toBe("account-deleted");
  expect(removeNotification).toHaveBeenCalledTimes(PLAYER_NOTIFICATION_IDS.length);
  expect(clearPlayerState).toHaveBeenCalledTimes(1);
  expect(clearFirebaseAuthentication).toHaveBeenCalledTimes(1);
  expect(getAccountDeletionPendingPhase()).toBeNull();
});

it("refuses authoritative recovery until an origin-wide deletion generation is verified", async () => {
  /** Provides local behavior. */
  const local = new WriteBlockedStorage();
  Object.defineProperty(globalThis, "localStorage", {configurable: true, value: local});
  sessionStorage.setItem(ACCOUNT_DELETION_CLEANUP_PENDING_KEY, ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion);
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  /** Provides retry authoritative deletion behavior. */
  const retryAuthoritativeDeletion = jest.fn(async () => undefined);
  /** Clears player state. */
  const clearPlayerState = jest.spyOn(platform, "clearPlayerState");
  /** Provides start behavior. */
  const start = () =>
    startJestSession(
      platform,
      {
        exchangeIdentity: async () => {
          throw new Error("identity must not be recreated");
        },
      } as never,
      {reconcile: async () => ({status: "success", value: 0})} as never,
      async () => undefined,
      undefined,
      {
        onInitialized: () => recoverPendingAccountDeletion(platform, "initialized"),
        deletionRecovery: true,
        recoverAccountDeletion: () =>
          recoverPendingAccountDeletion(platform, "signed", {
            retryAuthoritativeDeletion,
          }).then(() => undefined),
      },
    );

  expect((await start()).status).toBe("retryable-failure");
  expect(retryAuthoritativeDeletion).not.toHaveBeenCalled();
  expect(clearPlayerState).not.toHaveBeenCalled();
  expect(getAccountDeletionPendingPhase()).toBe(ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion);

  local.blockWrites = false;
  expect((await start()).status).toBe("account-deleted");
  expect(retryAuthoritativeDeletion).toHaveBeenCalledTimes(1);
  expect(clearPlayerState).toHaveBeenCalledTimes(1);
  expect(getAccountDeletionPendingPhase()).toBeNull();
});
