type AdListener = (payload?: unknown) => void;

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const setupInterstitialAdService = async (
  showBehavior: (emit: (eventType: string, payload?: unknown) => void) => void = (emit) => {
    emit("closed");
  },
) => {
  jest.resetModules();

  const captureException = jest.fn();
  const logger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };

  jest.doMock("../../utils/logger", () => ({logger}));
  jest.doMock("../../utils/sentry", () => ({
    captureException,
  }));

  const listeners = new Map<string, Set<AdListener>>();

  const emit = (eventType: string, payload?: unknown) => {
    const handlers = listeners.get(eventType);
    handlers?.forEach((handler) => handler(payload));
  };

  const addAdEventListener = jest.fn((eventType: string, listener: AdListener) => {
    const eventListeners = listeners.get(eventType) ?? new Set<AdListener>();
    eventListeners.add(listener);
    listeners.set(eventType, eventListeners);

    return () => {
      listeners.get(eventType)?.delete(listener);
    };
  });

  const load = jest.fn(() => {
    emit("loaded");
  });
  const show = jest.fn(async () => {
    showBehavior(emit);
  });
  const initialize = jest.fn(() => Promise.resolve({}));
  const mobileAdsFactory = jest.fn(() => ({initialize}));
  const createForAdRequest = jest.fn(() => ({
    addAdEventListener,
    load,
    show,
  }));

  jest.doMock("react-native-google-mobile-ads", () => ({
    __esModule: true,
    default: mobileAdsFactory,
    mobileAds: mobileAdsFactory,
    InterstitialAd: {
      createForAdRequest,
    },
    TestIds: {
      INTERSTITIAL: "ca-app-pub-3940256099942544/1033173712",
    },
    AdEventType: {
      LOADED: "loaded",
      CLOSED: "closed",
      ERROR: "error",
    },
  }));

  const service = require("../InterstitialAdService") as typeof import("../InterstitialAdService");

  return {
    service,
    listeners,
    addAdEventListener,
    createForAdRequest,
    captureException,
    logger,
    initialize,
    load,
    show,
  };
};

describe("InterstitialAdService", () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock("react-native-google-mobile-ads");
    jest.dontMock("../../utils/logger");
    jest.dontMock("../../utils/sentry");
  });

  it("removes temporary close listeners after repeated interstitial shows", async () => {
    const {service, listeners, createForAdRequest, show} = await setupInterstitialAdService();

    await service.initializeInterstitialAds();
    await flushPromises();

    expect(createForAdRequest).toHaveBeenCalledTimes(1);
    expect(listeners.get("closed")?.size).toBe(1);

    await expect(service.showInterstitialAd("post_victory")).resolves.toBe(true);
    await flushPromises();

    expect(show).toHaveBeenCalledTimes(1);
    expect(listeners.get("closed")?.size).toBe(1);

    await expect(service.showInterstitialAd("post_victory")).resolves.toBe(true);
    await flushPromises();

    expect(show).toHaveBeenCalledTimes(2);
    expect(listeners.get("closed")?.size).toBe(1);
  });

  it("does not capture expected Google Mobile Ads no-fill events", async () => {
    jest.useFakeTimers();
    const {service, listeners, captureException, logger} = await setupInterstitialAdService();

    await service.initializeInterstitialAds();
    await flushPromises();

    listeners.get("error")?.forEach((handler) =>
      handler({
        code: "googleMobileAds/no-fill",
        message: "No fill.",
      }),
    );

    await flushPromises();

    expect(logger.warn).toHaveBeenCalledWith(
      "Interstitial ad failed to load or show",
      expect.objectContaining({code: "googleMobileAds/no-fill"}),
    );
    expect(captureException).not.toHaveBeenCalled();
    jest.clearAllTimers();
  });

  it("returns false when a ready interstitial errors while showing", async () => {
    const {service, listeners} = await setupInterstitialAdService((emit) => {
      emit("error", {message: "show failed"});
    });

    await service.initializeInterstitialAds();
    await flushPromises();

    await expect(service.showInterstitialAd("post_victory")).resolves.toBe(false);
    await flushPromises();

    expect(listeners.get("closed")?.size).toBe(1);
    expect(listeners.get("error")?.size).toBe(1);
  });
});
