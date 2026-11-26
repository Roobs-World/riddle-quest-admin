/** Provides init behavior. */
const init = jest.fn();
/** Sets tag. */
const setTag = jest.fn();
/** Captures exception. */
const captureException = jest.fn();
/** Sets extras. */
const setExtras = jest.fn();
/** Runs scope. */
const withScope = jest.fn(
  (
    callback: (scope: {
      /** Stores set extras. */ /** Stores set extras. */ /** Stores set extras. */
      /** Stores set extras. */
      setExtras: typeof setExtras;
    }) => void,
  ) => callback({setExtras}),
);

jest.mock("@sentry/browser", () => ({
  captureException,
  init,
  setTag,
  withScope,
}));

import {captureBrowserException, initializeBrowserSentry, resetBrowserSentryForTests} from "../sentry";

describe("browser Sentry lifecycle", () => {
  beforeEach(() => {
    resetBrowserSentryForTests();
    jest.clearAllMocks();
  });

  it("stays disabled outside production or without a DSN", () => {
    expect(initializeBrowserSentry({production: false, dsn: "https://public@example.test/1", runtime: "jest"})).toBe(
      false,
    );
    expect(initializeBrowserSentry({production: true, runtime: "jest"})).toBe(false);
    captureBrowserException(new Error("ignored"));
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("initializes once with complete error sampling and privacy hooks", () => {
    /** Provides configuration behavior. */
    const configuration = {
      production: true,
      dsn: "https://public@example.test/1",
      environment: " production-eu ",
      release: " release-1 ",
      runtime: "jest" as const,
    };
    expect(initializeBrowserSentry(configuration)).toBe(true);
    expect(initializeBrowserSentry(configuration)).toBe(true);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://public@example.test/1",
        environment: "production-eu",
        release: "release-1",
        sampleRate: 1,
        dataCollection: {
          userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
          genAI: {inputs: false, outputs: false}, databaseQueryData: false, queues: false,
          graphQL: {document: false, variables: false}, stackFrameVariables: false, frameContextLines: 0,
        },
        tracesSampleRate: 0,
        traceLifecycle: "static",
      }),
    );
    expect(setTag).toHaveBeenCalledWith("runtime", "jest-html5");

    /** Provides options behavior. */
    const options = init.mock.calls[0][0];
    /** Provides defaults behavior. */
    const defaults = [
      {name: "GlobalHandlers"},
      {name: "Console"},
      {name: "Breadcrumbs"},
      {name: "BrowserSession"},
      {name: "ConversationId"},
      {name: "CultureContext"},
      {name: "HttpContext"},
    ];
    expect(options.integrations(defaults)).toEqual([{name: "GlobalHandlers"}]);
    expect(options.beforeSend({extra: {token: "secret", safe: true}})).toEqual({
      extra: {token: "[REDACTED]", safe: true},
    });
    expect(options.beforeSendTransaction({contexts: {answer: "hidden"}})).toEqual({});
  });

  it("captures exceptions with redacted context", () => {
    initializeBrowserSentry({production: true, dsn: "https://public@example.test/1", runtime: "jest"});
    /** Provides error behavior. */
    const error = new Error("failed");
    captureBrowserException(error, {userId: "player", operation: "startup"});
    captureBrowserException(error);

    expect(setExtras).toHaveBeenCalledWith({userId: "[REDACTED]", operation: "startup"});
    expect(captureException).toHaveBeenCalledTimes(2);
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it.each(["initial-throttle", "throttled", "fetch-status-error"])(
    "preserves bounded App Check %s diagnostics through the privacy hook",
    (suffix) => {
      initializeBrowserSentry({production: true, dsn: "https://public@example.test/1", runtime: "jest"});
      /** Simulates SDK metadata containing both safe diagnostics and private data. */
      const originalException = Object.assign(new Error("private response"), {
        code: `appCheck/${suffix}`,
        customData: {httpStatus: 403, token: "secret", response: "private response", url: "private url"},
      });
      /** Event shared by manual and automatic Sentry captures. */
      const event = {
        exception: {values: [{type: "FirebaseError", value: originalException.message}]},
        extra: {component: "jest_startup"},
        breadcrumbs: [{message: "private response"}],
      };
      expect(init.mock.calls[0][0].beforeSend(event, {originalException})).toEqual({
        exception: {values: [{type: "FirebaseError", value: "[REDACTED_MESSAGE]"}]},
        extra: {component: "jest_startup", appCheckErrorCode: `appCheck/${suffix}`, appCheckHttpStatus: 403},
      });
      expect(event.exception.values[0].value).toBe("private response");
    },
  );
});
