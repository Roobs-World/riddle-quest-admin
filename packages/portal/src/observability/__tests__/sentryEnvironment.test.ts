const mockInitializeBrowserSentry = jest.fn(() => true);
const mockIsBrowserTelemetryRuntimeAllowed = jest.fn(() => true);

jest.mock("../sentry", () => ({
  initializeBrowserSentry: (...args: unknown[]) => mockInitializeBrowserSentry(...args),
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
  });

  it("forwards build configuration only when the runtime policy allows telemetry", () => {
    expect(initializeBrowserSentryFromEnvironment()).toBe(true);
    expect(mockInitializeBrowserSentry).toHaveBeenCalledWith({
      dsn: undefined,
      environment: undefined,
      production: false,
      release: undefined,
    });
  });
});
