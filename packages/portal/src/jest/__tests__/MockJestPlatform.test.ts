import {MockJestPlatform} from "../MockJestPlatform";

describe("MockJestPlatform", () => {
  /** Provides original storage behavior. */
  const originalStorage = globalThis.localStorage;
  /** Provides original location behavior. */
  const originalLocation = globalThis.location;

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {configurable: true, value: originalStorage});
    Object.defineProperty(globalThis, "location", {configurable: true, value: originalLocation});
  });

  it("implements identity, registration, loading and milestone lifecycle", async () => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    await expect(platform.init()).resolves.toEqual({status: "success", value: undefined});
    expect(platform.getPlayer()).toEqual({playerId: "jest-mock-player", registered: false});
    await expect(platform.getPlayerSigned()).resolves.toEqual({
      player: platform.player,
      playerSigned: "mock.signed.player",
    });
    await expect(platform.login()).resolves.toMatchObject({status: "success"});
    platform.setLoadingProgress(42);
    platform.markGameLoaded();
    await platform.markFirstMilestone();
    expect(platform).toMatchObject({loaded: true, firstMilestoneMarked: true, progress: [42]});
  });

  it("closes the registration overlay exactly once", () => {
    /** Provides on close behavior. */
    const onClose = jest.fn();
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Provides result behavior. */
    const result = platform.showRegistrationOverlay({
      theme: "dark",
      message: "Keep my Riddle Quest progress! {{registrationCode}} is my registration code.",
      onClose,
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    result.value.loginButtonAction();
    result.value.closeButtonAction();
    expect(platform.player.registered).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("merges preferences and persists player data", async () => {
    /** Provides values behavior. */
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    platform.preferences = {locale: "en", muted: false};
    await platform.writePreferences({muted: true, highContrast: true});
    expect(platform.readPreferences()).toEqual({locale: "en", muted: true, highContrast: true});
    /** Provides player data behavior. */
    const playerData = {schemaVersion: 1 as const, updatedAt: 10};
    expect(platform.readPlayerData()).toBeNull();
    await platform.writePlayerData(playerData);
    expect(platform.readPlayerData()).toEqual(playerData);
    await platform.clearPlayerState();
    expect(platform.readPreferences()).toEqual({});
    expect(platform.readPlayerData()).toBeNull();
  });

  it("contains unavailable and malformed browser storage", async () => {
    Object.defineProperty(globalThis, "localStorage", {configurable: true, value: undefined});
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    expect(platform.readPlayerData()).toBeNull();
    await expect(platform.writePlayerData({schemaVersion: 1, updatedAt: 1})).resolves.toBeUndefined();

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {getItem: () => "not json", setItem: jest.fn()},
    });
    expect(platform.readPlayerData()).toBeNull();
  });

  it("parses default and race harness entry intents", () => {
    Object.defineProperty(globalThis, "location", {configurable: true, value: undefined});
    expect(new MockJestPlatform().getEntryIntent()).toEqual({});
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {search: "?harness=race&challengeId=challenge-1&gameMode=classic"},
    });
    expect(new MockJestPlatform().getEntryIntent()).toMatchObject({challengeId: "challenge-1", gameMode: "classic"});
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {search: "?harness=other&challengeId=ignored&gameMode=unknown"},
    });
    expect(new MockJestPlatform().getEntryIntent()).toEqual({});
  });

  it("maps guest and registered notification availability", async () => {
    /** Provides guest behavior. */
    const guest = new MockJestPlatform();
    await expect(guest.scheduleNotification({} as never)).resolves.toMatchObject({status: "unavailable"});
    await expect(guest.removeNotification("daily")).resolves.toMatchObject({status: "unavailable"});
    /** Provides registered behavior. */
    const registered = new MockJestPlatform(true);
    await expect(registered.scheduleNotification({} as never)).resolves.toEqual({status: "success", value: undefined});
    await expect(registered.removeNotification("daily")).resolves.toEqual({status: "success", value: undefined});
  });

  it("implements referrals, screenshots and purchase fixtures", async () => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    await expect(platform.getProfile()).resolves.toBeNull();
    await expect(platform.shareReferral({} as never)).resolves.toEqual({status: "success", value: undefined});
    await expect(platform.listReferralsSigned()).resolves.toEqual({status: "success", value: "mock.referrals.signed"});
    expect(() => platform.setScreenshotProvider(null)).not.toThrow();
    await expect(platform.getProducts()).resolves.toEqual(
      expect.objectContaining({
        status: "success",
        value: expect.arrayContaining([expect.objectContaining({sku: "com.roobsworld.riddlequest.coinpack1"})]),
      }),
    );
    await expect(platform.beginPurchase("coins")).resolves.toEqual({
      status: "success",
      value: {purchase: {purchaseToken: "mock-coins", productSku: "coins"}, purchaseSigned: "mock.purchase.signed"},
    });
    await expect(platform.getIncompletePurchases()).resolves.toMatchObject({status: "success"});
    await expect(platform.completePurchase()).resolves.toEqual({status: "success", value: undefined});
  });

  it("implements guest, inactive and active subscription states", async () => {
    /** Provides guest behavior. */
    const guest = new MockJestPlatform();
    await expect(guest.getSubscriptions()).resolves.toMatchObject({
      value: {subscriptions: [], subscriptionsSigned: "mock.subscriptions.inactive.signed"},
    });
    await expect(guest.beginSubscription("premium")).resolves.toEqual({
      status: "unavailable",
      message: "guest_not_allowed",
    });

    /** Provides registered behavior. */
    const registered = new MockJestPlatform(true);
    /** Provides inactive behavior. */
    const inactive = await registered.getSubscriptions();
    expect(inactive).toMatchObject({
      value: {subscriptions: [expect.objectContaining({status: "inactive", trialEligible: true})]},
    });
    await expect(registered.beginSubscription("premium")).resolves.toMatchObject({
      value: {subscription: {status: "active", trialEligible: false}, subscriptionSigned: "mock.subscription.signed"},
    });
    await expect(registered.getSubscriptions()).resolves.toMatchObject({
      value: {
        subscriptions: [expect.objectContaining({status: "active", trialEligible: false})],
        subscriptionsSigned: "mock.subscriptions.active.signed",
      },
    });
  });

  it("captures analytics properties", () => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    platform.captureEvent("race_started", {kind: "creator"});
    platform.captureEvent("game_loaded");
    expect(platform.capturedEvents).toEqual([
      {name: "race_started", properties: {kind: "creator"}},
      {name: "game_loaded", properties: undefined},
    ]);
  });
});
