const mockIsSupported = jest.fn();
const mockGetAnalytics = jest.fn(() => ({name: "analytics"}));
const mockLogEvent = jest.fn();

jest.mock("../../firebase", () => ({firebaseApp: {name: "firebase-app"}}));
jest.mock("firebase/analytics", () => ({
  isSupported: (...args: unknown[]) => mockIsSupported(...args),
  getAnalytics: (...args: unknown[]) => mockGetAnalytics(...args),
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

import {initializeGoogleAnalytics} from "../firebaseAnalytics";
import {resetAnalyticsForTests, trackEvent} from "../googleAnalytics";

describe("Firebase Analytics adapter", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAnalyticsForTests();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: originalWindow});
    jest.restoreAllMocks();
  });

  const flushImports = async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  };

  it("does not initialize browser analytics during server rendering", async () => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: undefined});
    initializeGoogleAnalytics();
    await flushImports();
    expect(mockIsSupported).not.toHaveBeenCalled();
  });

  it("stops when Firebase reports analytics as unsupported", async () => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: {}});
    mockIsSupported.mockResolvedValue(false);
    initializeGoogleAnalytics();
    await flushImports();
    expect(mockGetAnalytics).not.toHaveBeenCalled();
  });

  it("defers initialization through the browser idle scheduler when available", async () => {
    const requestIdleCallback = jest.fn((callback: () => void) => {
      callback();
      return 1;
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {requestIdleCallback},
    });
    mockIsSupported.mockResolvedValue(false);

    initializeGoogleAnalytics();
    await flushImports();

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {timeout: 2_000});
    expect(mockIsSupported).toHaveBeenCalledTimes(1);
  });

  it("forwards sanitized events to Firebase Analytics", async () => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: {}});
    mockIsSupported.mockResolvedValue(true);
    initializeGoogleAnalytics();
    await flushImports();

    trackEvent("Game Started", {registered: true});

    expect(mockGetAnalytics).toHaveBeenCalledWith({name: "firebase-app"});
    expect(mockLogEvent).toHaveBeenCalledWith(
      {name: "analytics"},
      "game_started",
      {registered: true},
    );
  });

  it("contains Analytics initialization failures", async () => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: {}});
    const error = new Error("blocked");
    mockIsSupported.mockRejectedValue(error);
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    initializeGoogleAnalytics();
    await flushImports();
    expect(warning).toHaveBeenCalledWith("[riddle-quest-analytics] Google Analytics is unavailable", error);
  });
});
