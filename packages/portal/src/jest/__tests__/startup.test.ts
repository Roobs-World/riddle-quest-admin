import {MockJestPlatform} from "../MockJestPlatform";
import {JestPurchaseCoordinator} from "../purchases";
import {createNotificationOperationGate, type NotificationCrossContextLock} from "../notifications/operationGate";
import {markJestPlayable, startJestSession, stopJestLoadingHeartbeat} from "../startup";

it("runs identity, Firebase auth and recovery in startup order", async () => {
  /** Provides order behavior. */
  const order: string[] = [];
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.player.registered = true;
  /** Saves d player data. */
  const savedPlayerData = {schemaVersion: 1 as const, updatedAt: 10};
  platform.init = async () => {
    order.push("init");
    return {status: "success", value: undefined};
  };
  platform.getPlayer = () => {
    order.push("player");
    return platform.player;
  };
  platform.getPlayerSigned = async () => {
    order.push("signed");
    return {player: platform.player, playerSigned: "signed"};
  };
  platform.readPreferences = () => {
    order.push("preferences");
    return {};
  };
  platform.readPlayerData = () => {
    order.push("playerData");
    return savedPlayerData;
  };
  platform.getProfile = async () => {
    order.push("profile");
    return null;
  };
  /** Provides backend behavior. */
  const backend = {
    exchangeIdentity: async () => {
      order.push("exchange");
      return {customToken: "firebase", uid: "uid"};
    },
  };
  /** Provides purchases behavior. */
  const purchases = {
    reconcile: async () => {
      order.push("recover");
      return {status: "success", value: 0};
    },
  };
  /** Provides result behavior. */
  const result = await startJestSession(
    platform,
    backend as never,
    purchases as never,
    async () => {
      order.push("firebase");
    },
    undefined,
    {
      withAccountOperation: async (operation) => {
        order.push("gate");
        return operation();
      },
    },
  );
  expect(result).toMatchObject({
    status: "success",
    value: {firebaseAuthenticated: true, firebaseUid: "uid", playerData: savedPlayerData},
  });
  expect(order).toEqual([
    "init",
    "player",
    "signed",
    "preferences",
    "playerData",
    "profile",
    "exchange",
    "firebase",
    "gate",
    "recover",
  ]);
  expect(platform.progress).toEqual([5, 15, 28, 42, 58, 72]);
});

it("grants and completes incomplete purchases before a later identity exchange failure", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.player.registered = true;
  platform.getIncompletePurchases = jest.fn(async () => ({
    status: "success" as const,
    value: {
      purchases: [{purchaseToken: "pending-token", productSku: "com.roobsworld.riddlequest.coinpack1"}],
      purchasesSigned: "signed-purchases",
      hasMore: false,
    },
  }));
  platform.completePurchase = jest.fn(async () => ({status: "success" as const, value: undefined}));
  /** Provides backend behavior. */
  const backend = {
    grantPurchase: jest.fn(async () => ({
      granted: true,
      purchaseToken: "pending-token",
      coinsAwarded: 250,
      newCoins: 250,
    })),
    exchangeIdentity: async () => {
      throw new Error("simulator identity unavailable");
    },
  };

  await expect(
    startJestSession(
      platform,
      backend as never,
      new JestPurchaseCoordinator(platform, backend as never),
      async () => undefined,
    ),
  ).resolves.toMatchObject({status: "retryable-failure"});

  expect(platform.getIncompletePurchases).toHaveBeenCalledTimes(1);
  expect(backend.grantPurchase).toHaveBeenCalledWith("signed-purchases", platform.player.playerId, "pending-token");
  expect(platform.completePurchase).toHaveBeenCalledWith("pending-token");
});

it("stops startup when the incomplete-purchase check fails", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.getIncompletePurchases = jest.fn(async () => ({
    status: "retryable-failure" as const,
    message: "purchase recovery unavailable",
  }));
  /** Provides backend behavior. */
  const backend = {exchangeIdentity: jest.fn()};

  await expect(
    startJestSession(platform, backend as never, {} as never, async () => undefined),
  ).resolves.toEqual({status: "retryable-failure", message: "purchase recovery unavailable"});

  expect(backend.exchangeIdentity).not.toHaveBeenCalled();
});

it("continues urgent recovery when an empty first page reports more purchases", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.getIncompletePurchases = jest.fn(async () => ({
    status: "success" as const,
    value: {purchases: [], purchasesSigned: "signed-purchases", hasMore: true},
  }));
  /** Provides reconcile behavior. */
  const reconcile = jest.fn(async () => ({status: "success" as const, value: 1}));
  /** Provides with account operation behavior. */
  const withAccountOperation = jest.fn(async (operation: () => Promise<unknown>) => operation());

  await startJestSession(
    platform,
    {exchangeIdentity: async () => Promise.reject(new Error("stop after recovery"))} as never,
    {reconcile} as never,
    async () => undefined,
    undefined,
    {withAccountOperation},
  );

  expect(withAccountOperation).toHaveBeenCalledTimes(1);
  expect(reconcile).toHaveBeenCalledWith(platform.player.playerId, {
    purchases: [],
    purchasesSigned: "signed-purchases",
    hasMore: true,
  });
});

it("stops startup when urgent purchase recovery cannot complete", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.getIncompletePurchases = jest.fn(async () => ({
    status: "success" as const,
    value: {
      purchases: [{purchaseToken: "pending-token", productSku: "com.roobsworld.riddlequest.coinpack1"}],
      purchasesSigned: "signed-purchases",
      hasMore: false,
    },
  }));
  /** Provides backend behavior. */
  const backend = {exchangeIdentity: jest.fn()};

  await expect(
    startJestSession(
      platform,
      backend as never,
      {reconcile: async () => ({status: "retryable-failure", message: "grant unavailable"})} as never,
      async () => undefined,
    ),
  ).resolves.toEqual({status: "retryable-failure", message: "grant unavailable"});

  expect(backend.exchangeIdentity).not.toHaveBeenCalled();
});

it("does not run successful urgent recovery a second time after authentication", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.getIncompletePurchases = jest.fn(async () => ({
    status: "success" as const,
    value: {
      purchases: [{purchaseToken: "pending-token", productSku: "com.roobsworld.riddlequest.coinpack1"}],
      purchasesSigned: "signed-purchases",
      hasMore: false,
    },
  }));
  /** Provides reconcile behavior. */
  const reconcile = jest.fn(async () => ({status: "success" as const, value: 1}));

  await expect(
    startJestSession(
      platform,
      {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})} as never,
      {reconcile} as never,
      async () => undefined,
    ),
  ).resolves.toMatchObject({status: "success"});

  expect(reconcile).toHaveBeenCalledTimes(1);
});

it("drains cross-tab identity authentication before authoritative deletion", async () => {
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
  /** Provides deletion pending behavior. */
  let deletionPending = false;
  /** Provides deletion epoch behavior. */
  let deletionEpoch = "before";
  /** Provides gate options behavior. */
  const gateOptions = {
    crossContextLock,
    deletionPending: () => deletionPending,
    deletionEpoch: () => deletionEpoch,
  };
  /** Starts up gate. */
  const startupGate = createNotificationOperationGate(gateOptions);
  /** Provides deletion gate behavior. */
  const deletionGate = createNotificationOperationGate(gateOptions);
  /** Provides release exchange behavior. */
  let releaseExchange: () => void = () => undefined;
  /** Provides exchange started behavior. */
  let exchangeStarted: () => void = () => undefined;
  /** Provides exchange ready behavior. */
  const exchangeReady = new Promise<void>((resolve) => {
    exchangeStarted = resolve;
  });
  /** Provides order behavior. */
  const order: string[] = [];
  /** Provides reconcile behavior. */
  const reconcile = jest.fn(async () => ({status: "success", value: 0}) as const);
  /** Starts up. */
  const startup = startJestSession(
    new MockJestPlatform(),
    {
      exchangeIdentity: async () => {
        order.push("exchange-start");
        exchangeStarted();
        await new Promise<void>((resolve) => {
          releaseExchange = resolve;
        });
        order.push("exchange-finish");
        return {status: "success", customToken: "firebase", uid: "uid"};
      },
    } as never,
    {reconcile} as never,
    async () => {
      order.push("firebase");
    },
    undefined,
    {
      onAuthenticated: () => deletionPending,
      withIdentityOperation: async (operation) => (await startupGate.run(operation)) || !startupGate.isOpen(),
    },
  );
  await exchangeReady;

  deletionPending = true;
  deletionEpoch = "after";
  /** Provides deletion behavior. */
  const deletion = deletionGate.runExclusive(async () => {
    order.push("delete");
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(order).toEqual(["exchange-start"]);

  releaseExchange();
  await expect(startup).resolves.toEqual({status: "account-deleted"});
  await deletion;
  expect(order).toEqual(["exchange-start", "exchange-finish", "firebase", "delete"]);
  expect(reconcile).not.toHaveBeenCalled();
});

it("restores saved progress but skips the registered-only profile for guests", async () => {
  /** Provides order behavior. */
  const order: string[] = [];
  /** Updates s. */
  const updates: string[] = [];
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.readPreferences = () => {
    order.push("preferences");
    return {};
  };
  platform.readPlayerData = () => {
    order.push("playerData");
    return null;
  };
  platform.getProfile = async () => {
    order.push("profile");
    return null;
  };
  /** Provides backend behavior. */
  const backend = {
    exchangeIdentity: async () => {
      order.push("exchange");
      return {customToken: "firebase", uid: "uid"};
    },
  };
  /** Provides purchases behavior. */
  const purchases = {
    reconcile: async () => {
      order.push("recover");
      return {status: "success", value: 0};
    },
  };

  /** Provides result behavior. */
  const result = await startJestSession(
    platform,
    backend as never,
    purchases as never,
    async () => {
      order.push("firebase");
    },
    (update) => updates.push(update.stage),
  );

  expect(result).toMatchObject({
    status: "success",
    value: {player: {registered: false}, playerData: null, profile: null},
  });
  expect(order).toEqual(["preferences", "playerData", "exchange", "firebase", "recover"]);
  expect(updates).toEqual(["player", "game"]);
});

it("stops startup on an authoritative tombstone without Firebase auth or purchase recovery", async () => {
  /** Provides exchange identity behavior. */
  const exchangeIdentity = jest.fn(async () => ({status: "account-deleted"}) as const);
  /** Provides authenticate firebase behavior. */
  const authenticateFirebase = jest.fn(async () => undefined);
  /** Provides reconcile behavior. */
  const reconcile = jest.fn(async () => ({status: "success", value: 0}) as const);

  await expect(
    startJestSession(new MockJestPlatform(), {exchangeIdentity} as never, {reconcile} as never, authenticateFirebase),
  ).resolves.toEqual({status: "account-deleted"});

  expect(exchangeIdentity).toHaveBeenCalledWith(expect.any(String));
  expect(authenticateFirebase).not.toHaveBeenCalled();
  expect(reconcile).not.toHaveBeenCalled();
});

it("uses signed deletion recovery without recreating Firebase identity", async () => {
  /** Provides exchange identity behavior. */
  const exchangeIdentity = jest.fn();
  /** Provides recover account deletion behavior. */
  const recoverAccountDeletion = jest.fn(async () => undefined);
  /** Provides authenticate firebase behavior. */
  const authenticateFirebase = jest.fn(async () => undefined);

  await expect(
    startJestSession(
      new MockJestPlatform(),
      {exchangeIdentity} as never,
      {reconcile: jest.fn()} as never,
      authenticateFirebase,
      undefined,
      {deletionRecovery: true, recoverAccountDeletion},
    ),
  ).resolves.toEqual({status: "account-deleted"});

  expect(recoverAccountDeletion).toHaveBeenCalledWith(expect.any(String));
  expect(exchangeIdentity).not.toHaveBeenCalled();
  expect(authenticateFirebase).not.toHaveBeenCalled();
});

it("fails closed when signed deletion recovery is not configured", async () => {
  /** Provides exchange identity behavior. */
  const exchangeIdentity = jest.fn();
  /** Provides result behavior. */
  const result = await startJestSession(
    new MockJestPlatform(),
    {exchangeIdentity} as never,
    {reconcile: jest.fn()} as never,
    jest.fn(),
    undefined,
    {deletionRecovery: true},
  );

  expect(result).toEqual({
    status: "retryable-failure",
    message: "account-deletion-recovery-unavailable",
  });
  expect(exchangeIdentity).not.toHaveBeenCalled();
});

it("continues startup when the optional registered profile is unavailable", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.player.registered = true;
  platform.getProfile = async () => {
    throw new Error("profile unavailable");
  };
  /** Provides backend behavior. */
  const backend = {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})};
  /** Provides purchases behavior. */
  const purchases = {reconcile: async () => ({status: "success", value: 0})};

  /** Provides result behavior. */
  const result = await startJestSession(platform, backend as never, purchases as never, async () => {});

  expect(result).toMatchObject({status: "success", value: {profile: null, firebaseAuthenticated: true}});
});

it("exposes the interactive retry screen after a post-init retryable failure", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  /** Provides result behavior. */
  const result = await startJestSession(
    platform,
    {
      exchangeIdentity: async () => {
        throw new Error("offline");
      },
    } as never,
    {} as never,
    async () => {},
  );
  expect(result).toEqual({status: "retryable-failure", message: "offline"});
  expect(platform.progress.at(-1)).toBe(100);
  expect(platform.loaded).toBe(true);
});

it("initializes the SDK before reporting manual loading progress", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  /** Provides initialized behavior. */
  let initialized = false;
  platform.init = async () => {
    initialized = true;
    return {status: "success", value: undefined};
  };
  platform.setLoadingProgress = (progress) => {
    if (!initialized) throw new Error("SDK not initialized. Call JestSDK.init() first.");
    platform.progress.push(progress);
  };
  /** Provides backend behavior. */
  const backend = {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})};
  /** Provides purchases behavior. */
  const purchases = {reconcile: async () => ({status: "success", value: 0})};

  /** Provides result behavior. */
  const result = await startJestSession(platform, backend as never, purchases as never, async () => {});

  expect(result.status).toBe("success");
  expect(platform.progress[0]).toBe(5);
});

it("fails closed when identity exchange omits the authoritative Firebase uid", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  /** Provides authenticate firebase behavior. */
  const authenticateFirebase = jest.fn(async () => undefined);
  /** Provides reconcile behavior. */
  const reconcile = jest.fn(async () => ({status: "success", value: 0}) as const);

  await expect(
    startJestSession(
      platform,
      {exchangeIdentity: async () => ({customToken: "firebase", uid: ""})} as never,
      {reconcile} as never,
      authenticateFirebase,
    ),
  ).resolves.toEqual({status: "retryable-failure", message: "jest-firebase-uid-missing"});

  expect(authenticateFirebase).toHaveBeenCalledWith("firebase");
  expect(reconcile).toHaveBeenCalled();
  expect(platform.progress.at(-1)).toBe(100);
  expect(platform.loaded).toBe(true);
});

it("returns a retryable failure when SDK initialization never settles", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.init = () => new Promise(() => undefined);
  /** Provides backend behavior. */
  const backend = {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})};
  /** Provides purchases behavior. */
  const purchases = {reconcile: async () => ({status: "success", value: 0})};

  /** Provides result behavior. */
  const result = await startJestSession(platform, backend as never, purchases as never, async () => {}, undefined, {
    initializationTimeoutMs: 5,
  });

  expect(result).toEqual({status: "retryable-failure", message: "Jest SDK initialization timed out."});
  expect(platform.progress).toEqual([]);
  expect(platform.loaded).toBe(false);
});

it("returns platform initialization and purchase reconciliation failures unchanged", async () => {
  /** Provides initialization failure behavior. */
  const initializationFailure = new MockJestPlatform();
  initializationFailure.init = async () => ({status: "error", error: new Error("sdk unavailable")});
  /** Provides unused backend behavior. */
  const unusedBackend = {exchangeIdentity: jest.fn()};
  /** Provides unused purchases behavior. */
  const unusedPurchases = {reconcile: jest.fn()};

  await expect(
    startJestSession(initializationFailure, unusedBackend as never, unusedPurchases as never, jest.fn()),
  ).resolves.toEqual({status: "error", error: expect.any(Error)});
  expect(unusedBackend.exchangeIdentity).not.toHaveBeenCalled();
  expect(initializationFailure.progress).toEqual([]);
  expect(initializationFailure.loaded).toBe(false);

  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  /** Provides recovery failure behavior. */
  const recoveryFailure = {status: "cancelled", message: "purchase cancelled"} as const;
  await expect(
    startJestSession(
      platform,
      {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})} as never,
      {reconcile: async () => recoveryFailure} as never,
      async () => {},
    ),
  ).resolves.toEqual(recoveryFailure);
  expect(platform.progress.at(-1)).toBe(100);
  expect(platform.loaded).toBe(true);
});

it("normalizes non-Error startup failures", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  await expect(
    startJestSession(
      platform,
      {
        exchangeIdentity: async () => {
          throw "network unavailable";
        },
      } as never,
      {} as never,
      async () => {},
    ),
  ).resolves.toEqual({status: "retryable-failure", message: "network unavailable"});
});

it("keeps the platform loading heartbeat alive while player identity is pending", async () => {
  jest.useFakeTimers();
  try {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Resolves signed. */
    let resolveSigned!: (value: Awaited<ReturnType<typeof platform.getPlayerSigned>>) => void;
    platform.getPlayerSigned = () =>
      new Promise((resolve) => {
        resolveSigned = resolve;
      });
    /** Provides pending behavior. */
    const pending = startJestSession(
      platform,
      {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})} as never,
      {reconcile: async () => ({status: "success", value: 0})} as never,
      async () => {},
    );
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10_000);
    resolveSigned({player: platform.player, playerSigned: "signed"});
    await pending;
    expect(platform.progress.filter((progress) => progress === 15)).toHaveLength(2);
    markJestPlayable(platform);
  } finally {
    jest.useRealTimers();
  }
});

it("keeps the latest progress alive after session startup until playable", async () => {
  jest.useFakeTimers();
  try {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Provides result behavior. */
    const result = await startJestSession(
      platform,
      {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})} as never,
      {reconcile: async () => ({status: "success", value: 0})} as never,
      async () => {},
    );
    expect(result.status).toBe("success");

    await jest.advanceTimersByTimeAsync(20_000);
    expect(platform.progress.slice(-2)).toEqual([72, 72]);

    markJestPlayable(platform);
    /** Provides progress after playable behavior. */
    const progressAfterPlayable = [...platform.progress];
    await jest.advanceTimersByTimeAsync(20_000);
    expect(platform.progress).toEqual(progressAfterPlayable);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

it("cleans up loading heartbeats on failure, retry, and lifecycle cancellation", async () => {
  jest.useFakeTimers();
  try {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Provides failed behavior. */
    const failed = await startJestSession(
      platform,
      {
        exchangeIdentity: async () => {
          throw new Error("offline");
        },
      } as never,
      {} as never,
      async () => {},
    );
    expect(failed.status).toBe("retryable-failure");
    expect(platform.loaded).toBe(true);
    expect(jest.getTimerCount()).toBe(0);

    /** Provides dependencies behavior. */
    const dependencies = [
      {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})} as never,
      {reconcile: async () => ({status: "success", value: 0})} as never,
    ] as const;
    await startJestSession(platform, dependencies[0], dependencies[1], async () => {});
    expect(jest.getTimerCount()).toBe(1);
    await startJestSession(platform, dependencies[0], dependencies[1], async () => {});
    expect(jest.getTimerCount()).toBe(1);

    /** Provides unrelated timer behavior. */
    const unrelatedTimer = setInterval(() => undefined, 10_000);
    stopJestLoadingHeartbeat(platform, unrelatedTimer);
    expect(jest.getTimerCount()).toBe(2);
    clearInterval(unrelatedTimer);
    expect(jest.getTimerCount()).toBe(1);

    stopJestLoadingHeartbeat(platform);
    expect(jest.getTimerCount()).toBe(0);
    stopJestLoadingHeartbeat(platform);
  } finally {
    jest.useRealTimers();
  }
});

it("preserves the startup failure when dismissing the manual-loading overlay also fails", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.markGameLoaded = () => {
    throw new Error("overlay unavailable");
  };

  await expect(
    startJestSession(
      platform,
      {
        exchangeIdentity: async () => {
          throw new Error("offline");
        },
      } as never,
      {} as never,
      async () => {},
    ),
  ).resolves.toEqual({status: "retryable-failure", message: "offline"});
  expect(platform.progress.at(-1)).toBe(100);
});

it("preserves the startup failure when final loading progress cannot be reported", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.setLoadingProgress = (progress) => {
    if (progress === 100) throw new Error("loading progress unavailable");
    platform.progress.push(progress);
  };

  await expect(
    startJestSession(
      platform,
      {
        exchangeIdentity: async () => {
          throw new Error("offline");
        },
      } as never,
      {} as never,
      async () => {},
    ),
  ).resolves.toEqual({status: "retryable-failure", message: "offline"});
  expect(platform.loaded).toBe(true);
});

it("marks the initialized platform playable", () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  markJestPlayable(platform);
  expect(platform.progress.at(-1)).toBe(100);
  expect(platform.loaded).toBe(true);
});
