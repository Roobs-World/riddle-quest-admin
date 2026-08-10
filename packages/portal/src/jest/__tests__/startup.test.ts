import {MockJestPlatform} from "../MockJestPlatform";
import {markJestPlayable, startJestSession} from "../startup";

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
  const result = await startJestSession(platform, backend as never, purchases as never, async () => { order.push("firebase"); });
  expect(result).toMatchObject({status: "success", value: {firebaseAuthenticated: true, playerData: savedPlayerData}});
  expect(order).toEqual(["init", "signed", "preferences", "playerData", "profile", "exchange", "firebase", "recover"]);
  expect(platform.progress).toEqual([5, 15, 28, 42, 58, 72]);
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

it("returns retryable failure without claiming readiness", async () => {
  const platform = new MockJestPlatform();
  const result = await startJestSession(platform, {exchangeIdentity: async () => { throw new Error("offline"); }} as never, {} as never, async () => {});
  expect(result).toEqual({status: "retryable-failure", message: "offline"});
  expect(platform.loaded).toBe(false);
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

  const platform = new MockJestPlatform();
  const recoveryFailure = {status: "cancelled", message: "purchase cancelled"} as const;
  await expect(startJestSession(
    platform,
    {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})} as never,
    {reconcile: async () => recoveryFailure} as never,
    async () => {},
  )).resolves.toEqual(recoveryFailure);
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
    expect(platform.progress.filter((progress) => progress === 5)).toHaveLength(2);
  } finally {
    jest.useRealTimers();
  }
});

it("marks the initialized platform playable", () => {
  const platform = new MockJestPlatform();
  markJestPlayable(platform);
  expect(platform.progress.at(-1)).toBe(100);
  expect(platform.loaded).toBe(true);
});
