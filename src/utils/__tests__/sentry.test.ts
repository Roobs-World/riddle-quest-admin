const mockInit = jest.fn();
const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
const mockSetUser = jest.fn();
const mockAddBreadcrumb = jest.fn();
const mockStartSpan = jest.fn();
const mockStartInactiveSpan = jest.fn();
const mockWithScope = jest.fn();
const mockWrap = jest.fn((component: unknown) => component);

jest.mock("@sentry/react-native", () => ({
  init: (...args: any[]) => mockInit.apply(null, args),
  captureException: (...args: any[]) => mockCaptureException.apply(null, args),
  captureMessage: (...args: any[]) => mockCaptureMessage.apply(null, args),
  setUser: (...args: any[]) => mockSetUser.apply(null, args),
  addBreadcrumb: (...args: any[]) => mockAddBreadcrumb.apply(null, args),
  startSpan: (...args: any[]) => mockStartSpan.apply(null, args),
  startInactiveSpan: (...args: any[]) => mockStartInactiveSpan.apply(null, args),
  withScope: (...args: any[]) => mockWithScope.apply(null, args),
  wrap: (...args: any[]) => mockWrap.apply(null, args),
}));

const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

const loadSentryUtils = (dsn?: string) => {
  jest.resetModules();
  if (dsn) {
    process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  } else {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  }

  let mod: typeof import("../sentry");
  jest.isolateModules(() => {
    mod = require("../sentry");
  });
  return mod!;
};

describe("utils/sentry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalDsn) {
      process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    } else {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    }
  });

  it("initializes Sentry when DSN is configured", () => {
    loadSentryUtils("https://example-dsn@sentry.io/123");
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://example-dsn@sentry.io/123",
        environment: "development",
        tracesSampleRate: 1,
        beforeSend: expect.any(Function),
      }),
    );
  });

  it("does not initialize Sentry when DSN is missing", () => {
    loadSentryUtils(undefined);
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("captureException is a no-op without DSN", () => {
    const sentry = loadSentryUtils(undefined);
    sentry.captureException(new Error("no-op"), {source: "test"});
    expect(mockWithScope).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("captureException sends plain errors when DSN is set and no context provided", () => {
    const sentry = loadSentryUtils("dsn");
    const error = new Error("boom");
    sentry.captureException(error);
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("captureException skips expected user and provider noise", () => {
    const sentry = loadSentryUtils("dsn");

    sentry.captureException(new Error("Google sign-in cancelled by user."));
    sentry.captureException({code: "SIGN_IN_CANCELLED", message: "User cancelled the login flow"});
    sentry.captureException({code: "googleMobileAds/no-fill", message: "No fill."});
    sentry.captureException(new Error("ExpoAsset.downloadAsync Unable to download asset from URL: http://10.0.2.2:8081"));
    sentry.captureException({name: "PurchaseError", message: "Failed to initialize connection"});
    sentry.captureException({code: "functions/unauthenticated", message: "Unauthenticated"});
    sentry.captureException(new Error("Unauthenticated"));

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("beforeSend drops expected development-only events", () => {
    loadSentryUtils("dsn");
    const initOptions = mockInit.mock.calls[0]?.[0] as {
      beforeSend: (event: {message?: string; environment?: string}, hint?: {originalException?: unknown}) => unknown;
    };

    expect(initOptions.beforeSend({message: "Operation timed out after 15000ms", environment: "development"})).toBeNull();
    expect(
      initOptions.beforeSend({
        message: "Tried to register two views with the same name RNSScreenContentWrapper",
        environment: "development",
      }),
    ).toBeNull();
    expect(
      initOptions.beforeSend({
        message: 'Requiring unknown module "react-native"',
        environment: "development",
      }),
    ).toBeNull();
    expect(initOptions.beforeSend({message: "Real production error", environment: "production"})).toEqual({
      message: "Real production error",
      environment: "production",
    });
  });

  it("captureException uses withScope and extras when context is provided", () => {
    const scope = {setExtras: jest.fn()};
    mockWithScope.mockImplementation((cb: (s: {setExtras: (v: unknown) => void}) => void) => {
      cb(scope);
    });

    const sentry = loadSentryUtils("dsn");
    const error = new Error("context-error");
    sentry.captureException(error, {area: "navigation", attempt: 1});

    expect(mockWithScope).toHaveBeenCalledTimes(1);
    expect(scope.setExtras).toHaveBeenCalledWith({area: "navigation", attempt: 1});
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("captureMessage is a no-op without DSN and forwards when DSN exists", () => {
    const sentryNoDsn = loadSentryUtils(undefined);
    sentryNoDsn.captureMessage("hello");
    expect(mockCaptureMessage).not.toHaveBeenCalled();

    const sentry = loadSentryUtils("dsn");
    sentry.captureMessage("warn", "warning");
    expect(mockCaptureMessage).toHaveBeenCalledWith("warn", "warning");
  });

  it("setUser and clearUser are no-ops without DSN and active with DSN", () => {
    const sentryNoDsn = loadSentryUtils(undefined);
    sentryNoDsn.setUser("u1", "u1@example.com", "U1");
    sentryNoDsn.clearUser();
    expect(mockSetUser).not.toHaveBeenCalled();

    const sentry = loadSentryUtils("dsn");
    sentry.setUser("u2", "u2@example.com", "U2");
    sentry.clearUser();

    expect(mockSetUser).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: "u2",
        email: "u2@example.com",
        username: "U2",
      }),
    );
    expect(mockSetUser).toHaveBeenNthCalledWith(2, null);
  });

  it("addBreadcrumb is a no-op without DSN and forwards payload with DSN", () => {
    const sentryNoDsn = loadSentryUtils(undefined);
    sentryNoDsn.addBreadcrumb("auth", "login clicked", {method: "email"}, "info");
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();

    const sentry = loadSentryUtils("dsn");
    sentry.addBreadcrumb("game", "guess submitted", {guess: "APPLE"}, "debug");
    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      category: "game",
      message: "guess submitted",
      data: {guess: "APPLE"},
      level: "debug",
    });
  });

  it("startTransaction returns no-op finish without DSN", () => {
    const sentry = loadSentryUtils(undefined);
    const transaction = sentry.startTransaction("tx", "op");
    expect(() => transaction.finish()).not.toThrow();
    expect(mockStartInactiveSpan).not.toHaveBeenCalled();
  });

  it("withSentrySpan runs callback directly without DSN", () => {
    const sentry = loadSentryUtils(undefined);
    const callback = jest.fn(() => "ok");
    expect(sentry.withSentrySpan("span", "op", callback)).toBe("ok");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(mockStartSpan).not.toHaveBeenCalled();
  });

  it("withSentrySpan delegates to Sentry startSpan when DSN is set", () => {
    mockStartSpan.mockImplementation((_options, callback: () => string) => callback());

    const sentry = loadSentryUtils("dsn");
    const callback = jest.fn(() => "ok");
    expect(sentry.withSentrySpan("span", "op", callback, {thing: "value"})).toBe("ok");

    expect(mockStartSpan).toHaveBeenCalledWith(
      {
        name: "span",
        op: "op",
        attributes: {thing: "value"},
      },
      callback,
    );
  });

  it("startTransaction returns finish that ends span when DSN is set", () => {
    const end = jest.fn();
    mockStartInactiveSpan.mockReturnValue({end});

    const sentry = loadSentryUtils("dsn");
    const transaction = sentry.startTransaction("guess-submit", "ui.action");
    transaction.finish();

    expect(mockStartInactiveSpan).toHaveBeenCalledWith({
      name: "guess-submit",
      op: "ui.action",
    });
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("wrapAppWithSentry returns the component unchanged when DSN is missing", () => {
    const sentry = loadSentryUtils(undefined);
    const AppComponent = () => null;

    expect(sentry.wrapAppWithSentry(AppComponent)).toBe(AppComponent);
  });

  it("wrapAppWithSentry delegates to Sentry.wrap when DSN exists", () => {
    const sentry = loadSentryUtils("dsn");
    const AppComponent = () => null;

    expect(sentry.wrapAppWithSentry(AppComponent)).toBe(AppComponent);
    expect(mockWrap).toHaveBeenCalledWith(AppComponent);
  });
});
