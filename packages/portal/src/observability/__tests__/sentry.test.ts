const init = jest.fn();
const setTag = jest.fn();
const captureException = jest.fn();
const setExtras = jest.fn();
const withScope = jest.fn((callback: (scope: {setExtras: typeof setExtras}) => void) => callback({setExtras}));
const captureConsoleIntegration = jest.fn(() => ({name: "CaptureConsole"}));

jest.mock("@sentry/browser", () => ({
  captureConsoleIntegration,
  captureException,
  init,
  setTag,
  withScope,
}));

import {
  captureBrowserException,
  initializeBrowserSentry,
  resetBrowserSentryForTests,
} from "../sentry";

describe("browser Sentry lifecycle", () => {
  beforeEach(() => {
    resetBrowserSentryForTests();
    jest.clearAllMocks();
  });

  it("stays disabled outside production or without a DSN", () => {
    expect(initializeBrowserSentry({production: false, dsn: "https://public@example.test/1"})).toBe(false);
    expect(initializeBrowserSentry({production: true})).toBe(false);
    captureBrowserException(new Error("ignored"));
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("initializes once with complete error sampling and privacy hooks", () => {
    const configuration = {
      production: true,
      dsn: "https://public@example.test/1",
      environment: " production-eu ",
      release: " release-1 ",
    };
    expect(initializeBrowserSentry(configuration)).toBe(true);
    expect(initializeBrowserSentry(configuration)).toBe(true);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(expect.objectContaining({
      dsn: "https://public@example.test/1",
      environment: "production-eu",
      release: "release-1",
      sampleRate: 1,
      sendDefaultPii: false,
    }));
    expect(setTag).toHaveBeenCalledWith("runtime", "jest-html5");

    const options = init.mock.calls[0][0];
    const defaults = [{name: "Default"}];
    expect(options.integrations(defaults)).toEqual([...defaults, {name: "CaptureConsole"}]);
    expect(captureConsoleIntegration).toHaveBeenCalledWith({levels: ["warn", "error"]});
    expect(options.beforeSend({extra: {token: "secret", safe: true}})).toEqual({
      extra: {token: "[REDACTED]", safe: true},
    });
    expect(options.beforeSendTransaction({contexts: {answer: "hidden"}})).toEqual({
      contexts: {answer: "[REDACTED]"},
    });
  });

  it("captures exceptions with redacted context", () => {
    initializeBrowserSentry({production: true, dsn: "https://public@example.test/1"});
    const error = new Error("failed");
    captureBrowserException(error, {userId: "player", operation: "startup"});
    captureBrowserException(error);

    expect(setExtras).toHaveBeenCalledWith({userId: "[REDACTED]", operation: "startup"});
    expect(captureException).toHaveBeenCalledTimes(2);
    expect(captureException).toHaveBeenCalledWith(error);
  });
});
