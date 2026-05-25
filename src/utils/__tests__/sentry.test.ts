const mockInit = jest.fn();
const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
const mockSetUser = jest.fn();
const mockAddBreadcrumb = jest.fn();
const mockStartInactiveSpan = jest.fn();
const mockWithScope = jest.fn();

jest.mock("@sentry/react-native", () => ({
  init: (...args: unknown[]) => mockInit(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
  setUser: (...args: unknown[]) => mockSetUser(...args),
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
  startInactiveSpan: (...args: unknown[]) => mockStartInactiveSpan(...args),
  withScope: (...args: unknown[]) => mockWithScope(...args),
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
        tracesSampleRate: 1,
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
});
