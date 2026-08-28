/** Provides mock initialize browser sentry behavior. */
const mockInitializeBrowserSentry = jest.fn(() => true);
/** Provides mock is browser telemetry runtime allowed behavior. */
const mockIsBrowserTelemetryRuntimeAllowed = jest.fn(() => true);
/** Provides mock configure browser error reporter behavior. */
const mockConfigureBrowserErrorReporter = jest.fn();
/** Provides mock capture browser exception behavior. */
const mockCaptureBrowserException = jest.fn();

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

import {initializeBrowserSentryFromEnvironment} from "../sentryEnvironment";

describe("browser Sentry environment adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBrowserTelemetryRuntimeAllowed.mockReturnValue(true);
  });

  it("does not initialize Sentry in a trusted harness or local production build", () => {
    mockIsBrowserTelemetryRuntimeAllowed.mockReturnValue(false);
    expect(initializeBrowserSentryFromEnvironment()).toBe(false);
    expect(mockInitializeBrowserSentry).not.toHaveBeenCalled();
    expect(mockConfigureBrowserErrorReporter).toHaveBeenCalledWith(null);
  });

  it("forwards build configuration only when the runtime policy allows telemetry", () => {
    expect(initializeBrowserSentryFromEnvironment()).toBe(true);
    expect(mockInitializeBrowserSentry).toHaveBeenCalledWith({
      dsn: undefined,
      environment: undefined,
      production: false,
      release: undefined,
      runtime: "jest",
    });
    expect(mockConfigureBrowserErrorReporter).toHaveBeenCalledWith(expect.any(Function));
  });
});
