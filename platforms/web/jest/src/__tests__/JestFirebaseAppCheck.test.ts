/** Provides mock initialize app check behavior. */
const mockInitializeAppCheck = jest.fn(() => ({name: "jest-app-check"}));
/** Provides mock get token behavior. */
const mockGetToken = jest.fn();
/** Provides mock set token auto refresh enabled behavior. */
const mockSetTokenAutoRefreshEnabled = jest.fn();

jest.mock("firebase/app-check", () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
  initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
  ReCaptchaEnterpriseProvider: class ReCaptchaEnterpriseProvider {
    /** Creates a class instance. */
    public constructor(public readonly siteKey: string) {}
  },
  setTokenAutoRefreshEnabled: (...args: unknown[]) => mockSetTokenAutoRefreshEnabled(...args),
}));
jest.mock("../../../../../src/platform/firebase/browserClient", () => ({firebaseApp: {name: "firebase-app"}}));

describe("Jest Firebase App Check adapter", () => {
  /** Provides environment behavior. */
  const environment = {
    appCheckSiteKey: "site-key",
    jestRuntime: "1",
    platformTarget: "jest",
    production: true,
  } as const;

  /** Loads adapter. */
  const loadAdapter = async (
    overrides: Partial<typeof environment> = {},
    windowValue?: {
      /** Stores location. */
      location: {
        /** Stores search. */
        search: string;
      }; /** Stores riddle quest browser test. */
      /** Stores riddle quest browser test. */
      __RIDDLE_QUEST_BROWSER_TEST__?: boolean;
    },
  ) => {
    jest.doMock("../../../../../src/app/testing/mocks/firebaseEnvironmentMock", () => ({
      firebaseEnvironment: {...environment, ...overrides},
    }));
    if (windowValue) {
      Object.defineProperty(globalThis, "window", {configurable: true, value: windowValue});
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
    /** Loads ed. */
    let loaded: typeof import("../JestFirebaseAppCheck") | undefined;
    await jest.isolateModulesAsync(async () => {
      loaded = await import("../JestFirebaseAppCheck");
    });
    return loaded!;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue({token: "attested"});
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    jest.dontMock("../../../../../src/app/testing/mocks/firebaseEnvironmentMock");
  });

  it("attests before enabling token refresh", async () => {
    /** Provides adapter behavior. */
    const adapter = await loadAdapter({}, {location: {search: "?source=jest"}});
    expect(mockInitializeAppCheck).toHaveBeenCalledWith(
      {name: "firebase-app"},
      expect.objectContaining({
        provider: expect.objectContaining({siteKey: "site-key"}),
        isTokenAutoRefreshEnabled: false,
      }),
    );

    await expect(adapter.ensureJestFirebaseAppCheckReady()).resolves.toBeUndefined();
    expect(mockGetToken).toHaveBeenCalledWith({name: "jest-app-check"});
    expect(mockSetTokenAutoRefreshEnabled).toHaveBeenCalledWith({name: "jest-app-check"}, true);
  });

  it("allows only an explicitly trusted harness to bypass production attestation", async () => {
    /** Provides adapter behavior. */
    const adapter = await loadAdapter({}, {location: {search: "?harness=race"}, __RIDDLE_QUEST_BROWSER_TEST__: true});
    expect(mockInitializeAppCheck).not.toHaveBeenCalled();
    await expect(adapter.ensureJestFirebaseAppCheckReady()).resolves.toBeUndefined();
  });

  it("propagates throttling and leaves refresh disabled until attestation succeeds", async () => {
    /** Production adapter with attestation enabled. */
    const adapter = await loadAdapter();
    /** Rejection retains the original exchange status. */
    const failure = Object.assign(new Error("attestation rejected"), {
      code: "appCheck/throttled",
      customData: {httpStatus: 403},
    });
    mockGetToken.mockRejectedValueOnce(failure);
    await expect(adapter.ensureJestFirebaseAppCheckReady()).rejects.toBe(failure);
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(mockSetTokenAutoRefreshEnabled).not.toHaveBeenCalled();
    await expect(adapter.ensureJestFirebaseAppCheckReady()).resolves.toBeUndefined();
    expect(mockSetTokenAutoRefreshEnabled).toHaveBeenCalledWith({name: "jest-app-check"}, true);
  });

  it("does not let an untrusted production query disable attestation", async () => {
    /** Provides adapter behavior. */
    const adapter = await loadAdapter({}, {location: {search: "?harness=race"}});
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    await expect(adapter.ensureJestFirebaseAppCheckReady()).resolves.toBeUndefined();
  });

  it("fails closed when a production Jest build has no App Check key", async () => {
    /** Provides adapter behavior. */
    const adapter = await loadAdapter({appCheckSiteKey: undefined});
    await expect(adapter.ensureJestFirebaseAppCheckReady()).rejects.toThrow("not configured for the Jest build");
  });

  it("rejects accidental use outside the Jest Web Target", async () => {
    await expect(loadAdapter({platformTarget: "reddit" as "jest"})).rejects.toThrow(
      "only initialize in the Jest Web Target",
    );
  });
});

describe("Jest Firebase App Check warm-up", () => {
  /** Loads a fresh adapter with production attestation configured. */
  const loadWarmAdapter = async () => {
    jest.doMock("../../../../../src/app/testing/mocks/firebaseEnvironmentMock", () => ({
      firebaseEnvironment: {appCheckSiteKey: "site-key", jestRuntime: "1", platformTarget: "jest", production: true},
    }));
    Object.defineProperty(globalThis, "window", {configurable: true, value: {location: {search: ""}}});
    /** Loaded adapter. */
    let loaded: typeof import("../JestFirebaseAppCheck") | undefined;
    await jest.isolateModulesAsync(async () => {
      loaded = await import("../JestFirebaseAppCheck");
    });
    return loaded!;
  };

  beforeEach(() => jest.clearAllMocks());

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    jest.dontMock("../../../../../src/app/testing/mocks/firebaseEnvironmentMock");
  });

  it("shares one early attestation with the authenticated readiness gate", async () => {
    /** Token request that resolves only when the test releases it. */
    let release!: () => void;
    mockGetToken.mockImplementation(() => new Promise<{
      /** Attested App Check token. */
      token: string;
    }>((resolve) => {
      release = () => resolve({token: "attested"});
    }));
    /** Fresh adapter. */
    const adapter = await loadWarmAdapter();
    adapter.warmJestFirebaseAppCheck();
    /** Gate awaited after sign-in. */
    const ready = adapter.ensureJestFirebaseAppCheckReady();
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(mockSetTokenAutoRefreshEnabled).not.toHaveBeenCalled();
    release();
    await expect(ready).resolves.toBeUndefined();
    expect(mockSetTokenAutoRefreshEnabled).toHaveBeenCalledTimes(1);
    await adapter.ensureJestFirebaseAppCheckReady();
    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });

  it("retries on the readiness gate after a failed warm-up", async () => {
    mockGetToken.mockRejectedValueOnce(new Error("recaptcha unavailable")).mockResolvedValue({token: "attested"});
    /** Fresh adapter. */
    const adapter = await loadWarmAdapter();
    adapter.warmJestFirebaseAppCheck();
    await Promise.resolve();
    await Promise.resolve();
    await expect(adapter.ensureJestFirebaseAppCheckReady()).resolves.toBeUndefined();
    expect(mockGetToken).toHaveBeenCalledTimes(2);
    expect(mockSetTokenAutoRefreshEnabled).toHaveBeenCalledTimes(1);
  });
});
