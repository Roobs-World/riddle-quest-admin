import {MockJestPlatform} from "../MockJestPlatform";
import {
  createNotificationOperationGate,
  type NotificationCrossContextLock,
} from "../notifications/operationGate";
import {markJestPlayable, startJestSession, stopJestLoadingHeartbeat} from "../startup";

it("runs identity, Firebase auth and recovery in startup order", async () => {
  const order: string[] = [];
  const platform = new MockJestPlatform();
  platform.player.registered = true;
  const savedPlayerData = {schemaVersion: 1 as const, updatedAt: 10};
  platform.init = async () => { order.push("init"); return {status: "success", value: undefined}; };
  platform.getPlayerSigned = async () => { order.push("signed"); return {player: platform.player, playerSigned: "signed"}; };
  platform.readPreferences = () => { order.push("preferences"); return {}; };
  platform.readPlayerData = () => { order.push("playerData"); return savedPlayerData; };
  platform.getProfile = async () => { order.push("profile"); return null; };
  const backend = {exchangeIdentity: async () => { order.push("exchange"); return {customToken: "firebase", uid: "uid"}; }};
  const purchases = {reconcile: async () => { order.push("recover"); return {status: "success", value: 0}; }};
  const result = await startJestSession(
    platform,
    backend as never,
    purchases as never,
    async () => { order.push("firebase"); },
    undefined,
    {withAccountOperation: async (operation) => { order.push("gate"); return operation(); }},
  );
  expect(result).toMatchObject({
    status: "success",
    value: {firebaseAuthenticated: true, firebaseUid: "uid", playerData: savedPlayerData},
  });
  expect(order).toEqual([
    "init", "signed", "preferences", "playerData", "profile", "exchange", "firebase", "gate", "recover",
  ]);
  expect(platform.progress).toEqual([5, 15, 28, 42, 58, 72]);
});

it("drains cross-tab identity authentication before authoritative deletion", async () => {
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
  let deletionPending = false;
  let deletionEpoch = "before";
  const gateOptions = {
    crossContextLock,
    deletionPending: () => deletionPending,
    deletionEpoch: () => deletionEpoch,
  };
  const startupGate = createNotificationOperationGate(gateOptions);
  const deletionGate = createNotificationOperationGate(gateOptions);
  let releaseExchange: () => void = () => undefined;
  let exchangeStarted: () => void = () => undefined;
  const exchangeReady = new Promise<void>((resolve) => { exchangeStarted = resolve; });
  const order: string[] = [];
  const reconcile = jest.fn(async () => ({status: "success", value: 0} as const));
  const startup = startJestSession(
    new MockJestPlatform(),
    {exchangeIdentity: async () => {
      order.push("exchange-start");
      exchangeStarted();
      await new Promise<void>((resolve) => { releaseExchange = resolve; });
      order.push("exchange-finish");
      return {status: "success", customToken: "firebase", uid: "uid"};
    }} as never,
    {reconcile} as never,
    async () => { order.push("firebase"); },
    undefined,
    {
      onAuthenticated: () => deletionPending,
      withIdentityOperation: async (operation) =>
        (await startupGate.run(operation)) || !startupGate.isOpen(),
    },
  );
  await exchangeReady;

  deletionPending = true;
  deletionEpoch = "after";
  const deletion = deletionGate.runExclusive(async () => { order.push("delete"); });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(order).toEqual(["exchange-start"]);

  releaseExchange();
  await expect(startup).resolves.toEqual({status: "account-deleted"});
  await deletion;
  expect(order).toEqual(["exchange-start", "exchange-finish", "firebase", "delete"]);
  expect(reconcile).not.toHaveBeenCalled();
});

it("restores saved progress but skips the registered-only profile for guests", async () => {
  const order: string[] = [];
  const updates: string[] = [];
  const platform = new MockJestPlatform();
  platform.readPreferences = () => { order.push("preferences"); return {}; };
  platform.readPlayerData = () => { order.push("playerData"); return null; };
  platform.getProfile = async () => { order.push("profile"); return null; };
  const backend = {exchangeIdentity: async () => { order.push("exchange"); return {customToken: "firebase", uid: "uid"}; }};
  const purchases = {reconcile: async () => { order.push("recover"); return {status: "success", value: 0}; }};

  const result = await startJestSession(
    platform,
    backend as never,
    purchases as never,
    async () => { order.push("firebase"); },
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
  const exchangeIdentity = jest.fn(async () => ({status: "account-deleted"} as const));
  const authenticateFirebase = jest.fn(async () => undefined);
  const reconcile = jest.fn(async () => ({status: "success", value: 0} as const));

  await expect(startJestSession(
    new MockJestPlatform(),
    {exchangeIdentity} as never,
    {reconcile} as never,
    authenticateFirebase,
  )).resolves.toEqual({status: "account-deleted"});

  expect(exchangeIdentity).toHaveBeenCalledWith(expect.any(String));
  expect(authenticateFirebase).not.toHaveBeenCalled();
  expect(reconcile).not.toHaveBeenCalled();
});

it("uses signed deletion recovery without recreating Firebase identity", async () => {
  const exchangeIdentity = jest.fn();
  const recoverAccountDeletion = jest.fn(async () => undefined);
  const authenticateFirebase = jest.fn(async () => undefined);

  await expect(startJestSession(
    new MockJestPlatform(),
    {exchangeIdentity} as never,
    {reconcile: jest.fn()} as never,
    authenticateFirebase,
    undefined,
    {deletionRecovery: true, recoverAccountDeletion},
  )).resolves.toEqual({status: "account-deleted"});

  expect(recoverAccountDeletion).toHaveBeenCalledWith(expect.any(String));
  expect(exchangeIdentity).not.toHaveBeenCalled();
  expect(authenticateFirebase).not.toHaveBeenCalled();
});

it("fails closed when signed deletion recovery is not configured", async () => {
  const exchangeIdentity = jest.fn();
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
  const platform = new MockJestPlatform();
  platform.player.registered = true;
  platform.getProfile = async () => { throw new Error("profile unavailable"); };
  const backend = {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})};
  const purchases = {reconcile: async () => ({status: "success", value: 0})};

  const result = await startJestSession(platform, backend as never, purchases as never, async () => {});

  expect(result).toMatchObject({status: "success", value: {profile: null, firebaseAuthenticated: true}});
});

it("exposes the interactive retry screen after a post-init retryable failure", async () => {
  const platform = new MockJestPlatform();
  const result = await startJestSession(platform, {exchangeIdentity: async () => { throw new Error("offline"); }} as never, {} as never, async () => {});
  expect(result).toEqual({status: "retryable-failure", message: "offline"});
  expect(platform.progress.at(-1)).toBe(100);
  expect(platform.loaded).toBe(true);
});

it("initializes the SDK before reporting manual loading progress", async () => {
  const platform = new MockJestPlatform();
  let initialized = false;
  platform.init = async () => {
    initialized = true;
    return {status: "success", value: undefined};
  };
  platform.setLoadingProgress = (progress) => {
    if (!initialized) throw new Error("SDK not initialized. Call JestSDK.init() first.");
    platform.progress.push(progress);
  };
  const backend = {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})};
  const purchases = {reconcile: async () => ({status: "success", value: 0})};

  const result = await startJestSession(platform, backend as never, purchases as never, async () => {});

  expect(result.status).toBe("success");
  expect(platform.progress[0]).toBe(5);
});

it("fails closed when identity exchange omits the authoritative Firebase uid", async () => {
  const platform = new MockJestPlatform();
  const authenticateFirebase = jest.fn(async () => undefined);
  const reconcile = jest.fn(async () => ({status: "success", value: 0} as const));

  await expect(startJestSession(
    platform,
    {exchangeIdentity: async () => ({customToken: "firebase", uid: ""})} as never,
    {reconcile} as never,
    authenticateFirebase,
  )).resolves.toEqual({status: "retryable-failure", message: "jest-firebase-uid-missing"});

  expect(authenticateFirebase).toHaveBeenCalledWith("firebase");
  expect(reconcile).toHaveBeenCalled();
  expect(platform.progress.at(-1)).toBe(100);
  expect(platform.loaded).toBe(true);
});

it("returns a retryable failure when SDK initialization never settles", async () => {
  const platform = new MockJestPlatform();
  platform.init = () => new Promise(() => undefined);
  const backend = {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})};
  const purchases = {reconcile: async () => ({status: "success", value: 0})};

  const result = await startJestSession(
    platform,
    backend as never,
    purchases as never,
    async () => {},
    undefined,
    {initializationTimeoutMs: 5},
  );

  expect(result).toEqual({status: "retryable-failure", message: "Jest SDK initialization timed out."});
  expect(platform.progress).toEqual([]);
  expect(platform.loaded).toBe(false);
});

it("returns platform initialization and purchase reconciliation failures unchanged", async () => {
  const initializationFailure = new MockJestPlatform();
  initializationFailure.init = async () => ({status: "error", error: new Error("sdk unavailable")});
  const unusedBackend = {exchangeIdentity: jest.fn()};
  const unusedPurchases = {reconcile: jest.fn()};

  await expect(startJestSession(
    initializationFailure,
    unusedBackend as never,
    unusedPurchases as never,
    jest.fn(),
  )).resolves.toEqual({status: "error", error: expect.any(Error)});
  expect(unusedBackend.exchangeIdentity).not.toHaveBeenCalled();
  expect(initializationFailure.progress).toEqual([]);
  expect(initializationFailure.loaded).toBe(false);

  const platform = new MockJestPlatform();
  const recoveryFailure = {status: "cancelled", message: "purchase cancelled"} as const;
  await expect(startJestSession(
    platform,
    {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})} as never,
    {reconcile: async () => recoveryFailure} as never,
    async () => {},
  )).resolves.toEqual(recoveryFailure);
  expect(platform.progress.at(-1)).toBe(100);
  expect(platform.loaded).toBe(true);
});

it("normalizes non-Error startup failures", async () => {
  const platform = new MockJestPlatform();
  await expect(startJestSession(
    platform,
    {exchangeIdentity: async () => { throw "network unavailable"; }} as never,
    {} as never,
    async () => {},
  )).resolves.toEqual({status: "retryable-failure", message: "network unavailable"});
});

it("keeps the platform loading heartbeat alive while player identity is pending", async () => {
  jest.useFakeTimers();
  try {
    const platform = new MockJestPlatform();
    let resolveSigned!: (value: Awaited<ReturnType<typeof platform.getPlayerSigned>>) => void;
    platform.getPlayerSigned = () => new Promise((resolve) => { resolveSigned = resolve; });
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
    const platform = new MockJestPlatform();
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
    const platform = new MockJestPlatform();
    const failed = await startJestSession(
      platform,
      {exchangeIdentity: async () => { throw new Error("offline"); }} as never,
      {} as never,
      async () => {},
    );
    expect(failed.status).toBe("retryable-failure");
    expect(platform.loaded).toBe(true);
    expect(jest.getTimerCount()).toBe(0);

    const dependencies = [
      {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})} as never,
      {reconcile: async () => ({status: "success", value: 0})} as never,
    ] as const;
    await startJestSession(platform, dependencies[0], dependencies[1], async () => {});
    expect(jest.getTimerCount()).toBe(1);
    await startJestSession(platform, dependencies[0], dependencies[1], async () => {});
    expect(jest.getTimerCount()).toBe(1);

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
  const platform = new MockJestPlatform();
  platform.markGameLoaded = () => { throw new Error("overlay unavailable"); };

  await expect(startJestSession(
    platform,
    {exchangeIdentity: async () => { throw new Error("offline"); }} as never,
    {} as never,
    async () => {},
  )).resolves.toEqual({status: "retryable-failure", message: "offline"});
  expect(platform.progress.at(-1)).toBe(100);
});

it("preserves the startup failure when final loading progress cannot be reported", async () => {
  const platform = new MockJestPlatform();
  platform.setLoadingProgress = (progress) => {
    if (progress === 100) throw new Error("loading progress unavailable");
    platform.progress.push(progress);
  };

  await expect(startJestSession(
    platform,
    {exchangeIdentity: async () => { throw new Error("offline"); }} as never,
    {} as never,
    async () => {},
  )).resolves.toEqual({status: "retryable-failure", message: "offline"});
  expect(platform.loaded).toBe(true);
});

it("marks the initialized platform playable", () => {
  const platform = new MockJestPlatform();
  markJestPlayable(platform);
  expect(platform.progress.at(-1)).toBe(100);
  expect(platform.loaded).toBe(true);
});
