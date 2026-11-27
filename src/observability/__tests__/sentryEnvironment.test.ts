/** Provides mock initialize browser sentry behavior. */
const mockInitializeBrowserSentry = jest.fn(() => true);
/** Provides mock is browser telemetry runtime allowed behavior. */
const mockIsBrowserTelemetryRuntimeAllowed = jest.fn(() => true);
/** Provides mock configure browser error reporter behavior. */
const mockConfigureBrowserErrorReporter = jest.fn();
/** Provides mock capture browser exception behavior. */
const mockCaptureBrowserException = jest.fn();
/** Mutable build settings exercise disabled and unsupported target gates before loading. */
const mockEnvironment = {platformTarget: "facebook", production: true, sentryDsn: "https://public@example.test/1",
  sentryEnvironment: undefined, sentryRelease: undefined};

jest.mock("../../platform/firebase/browserEnvironment", () => ({firebaseEnvironment: mockEnvironment}));

jest.mock("../sentry", () => ({
  captureBrowserException: (...args: unknown[]) => mockCaptureBrowserException(...args),
  initializeBrowserSentry: (...args: unknown[]) => mockInitializeBrowserSentry(...args),
}));
jest.mock("../browserErrorReporter", () => ({
  configureBrowserErrorReporter: (...args: unknown[]) => mockConfigureBrowserErrorReporter(...args),
}));
jest.mock("../telemetryRuntime", () => ({
  isBrowserTelemetryRuntimeAllowed: () => mockIsBrowserTelemetryRuntimeAllowed(),
}));

import {initializeBrowserSentryFromEnvironment, resetBrowserSentryEnvironmentForTests} from "../sentryEnvironment";
/** Temporary event surface is owned by the test rather than a browser environment package. */
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
/** Deferred loader exercises only the actual startup adapter contract. */
type StartupAdapter = Pick<typeof import("../sentry"), "initializeBrowserSentry" | "captureBrowserException">;

describe("browser Sentry environment adapter", () => {
  beforeEach(() => {
    resetBrowserSentryEnvironmentForTests();
    jest.clearAllMocks();
    mockIsBrowserTelemetryRuntimeAllowed.mockReturnValue(true);
    mockInitializeBrowserSentry.mockReturnValue(true);
    Object.assign(mockEnvironment, {platformTarget: "facebook", production: true, sentryDsn: "https://public@example.test/1"});
    Object.defineProperty(globalThis, "window", {configurable: true, value: new EventTarget()});
  });
  afterEach(() => {
    resetBrowserSentryEnvironmentForTests();
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
  });

  it("does not initialize Sentry in a trusted harness or local production build", async () => {
    mockIsBrowserTelemetryRuntimeAllowed.mockReturnValue(false);
    expect(await initializeBrowserSentryFromEnvironment()).toBe(false);
    expect(mockInitializeBrowserSentry).not.toHaveBeenCalled();
    expect(mockConfigureBrowserErrorReporter).toHaveBeenCalledWith(null);
  });

  it("forwards build configuration only when the runtime policy allows telemetry", async () => {
    expect(await initializeBrowserSentryFromEnvironment()).toBe(true);
    expect(mockInitializeBrowserSentry).toHaveBeenCalledWith({
      dsn: "https://public@example.test/1",
      environment: undefined,
      production: true,
      release: undefined,
      runtime: "facebook",
    });
    expect(mockConfigureBrowserErrorReporter).toHaveBeenCalledWith(expect.any(Function));
  });
  it.each([{production: false}, {sentryDsn: ""}, {sentryDsn: "http://public@example.test/1"}, {platformTarget: "reddit"}])("does not load optional code for unavailable configuration: %j", async configuration => {
    Object.assign(mockEnvironment, configuration);
    /** Unexpected loading is observable independently of the SDK's own initialization guard. */
    const load = jest.fn();
    expect(await initializeBrowserSentryFromEnvironment(load)).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });
  it("coalesces delivery and buffers bounded early caught and uncaught errors", async () => {
    /** Deferred adapter emulates a slow optional chunk without delaying the caller. */
    let resolve!: (adapter: StartupAdapter) => void;
    /** Loader is called only once for concurrent startup consumers. */
    const load = jest.fn(() => new Promise<StartupAdapter>(yes => {resolve = yes;}));
    /** Shared startup promise remains pending while the game can render. */
    const first = initializeBrowserSentryFromEnvironment(load), second = initializeBrowserSentryFromEnvironment(load);
    expect(second).toBe(first); await Promise.resolve(); expect(load).toHaveBeenCalledTimes(1);
    /** Caught game failures use the early configured reporter. */
    const report = mockConfigureBrowserErrorReporter.mock.calls.at(-1)![0];
    report(new Error("caught"), {operation: "race"});
    window.dispatchEvent(Object.assign(new Event("error"), {error: new Error("uncaught")}));
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), {reason: new Error("rejected")}));
    for (let index = 0; index < 30; index++) report(new Error("extra"));
    resolve({initializeBrowserSentry: mockInitializeBrowserSentry, captureBrowserException: mockCaptureBrowserException});
    expect(await first).toBe(true); expect(mockCaptureBrowserException).toHaveBeenCalledTimes(20);
    expect(mockCaptureBrowserException.mock.calls[0][1]).toEqual({operation: "race"});
    expect(mockCaptureBrowserException.mock.calls[1][1]).toEqual({error_kind: "uncaught_error"});
    expect(mockCaptureBrowserException.mock.calls[2][1]).toEqual({error_kind: "unhandled_rejection"});
    window.dispatchEvent(Object.assign(new Event("error"), {error: new Error("after-startup")}));
    expect(mockCaptureBrowserException).toHaveBeenCalledTimes(20);
  });
  it("contains chunk delivery failure and allows a later explicit initialization", async () => {
    expect(await initializeBrowserSentryFromEnvironment(async () => {throw new Error("chunk-unavailable");})).toBe(false);
    expect(mockConfigureBrowserErrorReporter).toHaveBeenLastCalledWith(null);
    expect(await initializeBrowserSentryFromEnvironment()).toBe(true);
  });
  it("contains initializer failure and continues flushing when an optional capture throws", async () => {
    mockInitializeBrowserSentry.mockImplementationOnce(() => {throw new Error("init-failed");});
    expect(await initializeBrowserSentryFromEnvironment()).toBe(false);
    /** Buffered reporting failures do not reject the next startup or suppress subsequent failures. */
    const pending = initializeBrowserSentryFromEnvironment();
    /** Startup reporter is available before SDK delivery resolves. */
    const report = mockConfigureBrowserErrorReporter.mock.calls.at(-1)![0];
    report(new Error("first")); report(new Error("second"));
    mockCaptureBrowserException.mockImplementationOnce(() => {throw new Error("capture-failed");});
    expect(await pending).toBe(true);
    expect(mockCaptureBrowserException).toHaveBeenCalledTimes(2);
  });
  it("expires stalled loading, permits retry and ignores its late adapter", async () => {
    jest.useFakeTimers();
    try {
      /** Original chunk remains unresolved while its owned delivery expires. */
      let resolve!: (adapter: StartupAdapter) => void;
      /** Caller receives a bounded failure without waiting for the stale import. */
      const pending = initializeBrowserSentryFromEnvironment(() => new Promise(yes => {resolve = yes;}));
      await Promise.resolve(); jest.advanceTimersByTime(30000);
      expect(await pending).toBe(false); expect(mockConfigureBrowserErrorReporter).toHaveBeenLastCalledWith(null);
      expect(await initializeBrowserSentryFromEnvironment()).toBe(true);
      resolve({initializeBrowserSentry: mockInitializeBrowserSentry, captureBrowserException: mockCaptureBrowserException});
      await Promise.resolve(); await Promise.resolve();
      expect(mockInitializeBrowserSentry).toHaveBeenCalledTimes(1);
      expect(mockConfigureBrowserErrorReporter).toHaveBeenLastCalledWith(expect.any(Function));
    } finally {jest.useRealTimers();}
  });
  it("ignores late delivery after ownership is reset or runtime permission changes", async () => {
    for (const reset of [false, true]) {
      resetBrowserSentryEnvironmentForTests(); mockIsBrowserTelemetryRuntimeAllowed.mockReturnValue(true);
      /** Delayed SDK delivery belongs only to the captured initialization lifetime. */
      let resolve!: (adapter: StartupAdapter) => void;
      /** Pending load must never configure a replaced or disallowed runtime. */
      const pending = initializeBrowserSentryFromEnvironment(() => new Promise(yes => {resolve = yes;}));
      await Promise.resolve();
      if (reset) resetBrowserSentryEnvironmentForTests(); else mockIsBrowserTelemetryRuntimeAllowed.mockReturnValue(false);
      resolve({initializeBrowserSentry: mockInitializeBrowserSentry, captureBrowserException: mockCaptureBrowserException});
      expect(await pending).toBe(false);
      expect(mockInitializeBrowserSentry).not.toHaveBeenCalled();
      expect(mockConfigureBrowserErrorReporter).toHaveBeenLastCalledWith(null);
    }
  });
});
