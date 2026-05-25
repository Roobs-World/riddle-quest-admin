type AdListener = (payload?: unknown) => void;

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const setupRewardedAdService = async (
  showBehavior: (emit: (eventType: string, payload?: unknown) => void) => void = (
    emit
  ) => {
    emit("earned_reward", { amount: 1, type: "coin" });
    emit("closed");
  }
) => {
  jest.resetModules();

  const listeners = new Map<string, Set<AdListener>>();

  const emit = (eventType: string, payload?: unknown) => {
    const handlers = listeners.get(eventType);
    handlers?.forEach((handler) => handler(payload));
  };

  const addAdEventListener = jest.fn(
    (eventType: string, listener: AdListener) => {
      const eventListeners = listeners.get(eventType) ?? new Set<AdListener>();
      eventListeners.add(listener);
      listeners.set(eventType, eventListeners);

      return () => {
        listeners.get(eventType)?.delete(listener);
      };
    }
  );

  const load = jest.fn(() => {
    emit("loaded");
  });
  const show = jest.fn(async () => {
    showBehavior(emit);
  });
  const initialize = jest.fn(() => Promise.resolve({}));
  const mobileAdsFactory = jest.fn(() => ({ initialize }));
  const createForAdRequest = jest.fn(() => ({
    addAdEventListener,
    load,
    show,
  }));

  jest.doMock("react-native-google-mobile-ads", () => ({
    __esModule: true,
    default: mobileAdsFactory,
    mobileAds: mobileAdsFactory,
    RewardedAd: {
      createForAdRequest,
    },
    RewardedAdEventType: {
      LOADED: "loaded",
      EARNED_REWARD: "earned_reward",
    },
    AdEventType: {
      CLOSED: "closed",
      ERROR: "error",
    },
  }));

  const service = require("../RewardedAdService") as typeof import("../RewardedAdService");

  return {
    service,
    listeners,
    addAdEventListener,
    createForAdRequest,
    initialize,
    load,
    show,
  };
};

describe("RewardedAdService", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock("react-native-google-mobile-ads");
  });

  it("removes temporary reward listeners after repeated rewarded-ad shows", async () => {
    const { service, listeners, createForAdRequest, show } =
      await setupRewardedAdService();

    await service.initializeRewardedAds();
    await flushPromises();

    expect(createForAdRequest).toHaveBeenCalledTimes(1);
    expect(listeners.get("closed")?.size).toBe(1);

    await expect(service.showRewardedAd()).resolves.toBe(true);
    await flushPromises();

    expect(show).toHaveBeenCalledTimes(1);
    expect(listeners.get("earned_reward")?.size ?? 0).toBe(0);
    expect(listeners.get("closed")?.size).toBe(1);

    await expect(service.showRewardedAd()).resolves.toBe(true);
    await flushPromises();

    expect(show).toHaveBeenCalledTimes(2);
    expect(listeners.get("earned_reward")?.size ?? 0).toBe(0);
    expect(listeners.get("closed")?.size).toBe(1);
  });

  it("returns false and still removes temporary listeners when the ad closes without a reward", async () => {
    const { service, listeners } = await setupRewardedAdService((emit) => {
      emit("closed");
    });

    await service.initializeRewardedAds();
    await flushPromises();

    await expect(service.showRewardedAd()).resolves.toBe(false);
    await flushPromises();

    expect(listeners.get("earned_reward")?.size ?? 0).toBe(0);
    expect(listeners.get("closed")?.size).toBe(1);
  });
});
