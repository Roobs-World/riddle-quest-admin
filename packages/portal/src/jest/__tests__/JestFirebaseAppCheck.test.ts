const mockInitializeAppCheck = jest.fn(() => ({name: "jest-app-check"}));
const mockGetToken = jest.fn();
const mockSetTokenAutoRefreshEnabled = jest.fn();

jest.mock("firebase/app-check", () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
  initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
  ReCaptchaEnterpriseProvider: class ReCaptchaEnterpriseProvider {
    public constructor(public readonly siteKey: string) {}
  },
  setTokenAutoRefreshEnabled: (...args: unknown[]) => mockSetTokenAutoRefreshEnabled(...args),
}));
jest.mock("../../firebase", () => ({firebaseApp: {name: "firebase-app"}}));

describe("Jest Firebase App Check adapter", () => {
  const environment = {
    appCheckSiteKey: "site-key",
    jestRuntime: "1",
    platformTarget: "jest",
    production: true,
  } as const;

  const loadAdapter = async (
    overrides: Partial<typeof environment> = {},
    windowValue?: {location: {search: string}; __RIDDLE_QUEST_BROWSER_TEST__?: boolean},
  ) => {
    jest.doMock("../../test/firebaseEnvironmentMock", () => ({
      firebaseEnvironment: {...environment, ...overrides},
    }));
    if (windowValue) {
      Object.defineProperty(globalThis, "window", {configurable: true, value: windowValue});
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
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
    jest.dontMock("../../test/firebaseEnvironmentMock");
  });

  it("attests before enabling token refresh", async () => {
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
    const adapter = await loadAdapter(
      {},
      {location: {search: "?harness=race"}, __RIDDLE_QUEST_BROWSER_TEST__: true},
    );
    expect(mockInitializeAppCheck).not.toHaveBeenCalled();
    await expect(adapter.ensureJestFirebaseAppCheckReady()).resolves.toBeUndefined();
  });

  it("does not let an untrusted production query disable attestation", async () => {
    const adapter = await loadAdapter({}, {location: {search: "?harness=race"}});
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    await expect(adapter.ensureJestFirebaseAppCheckReady()).resolves.toBeUndefined();
  });

  it("fails closed when a production Jest build has no App Check key", async () => {
    const adapter = await loadAdapter({appCheckSiteKey: undefined});
    await expect(adapter.ensureJestFirebaseAppCheckReady()).rejects.toThrow(
      "not configured for the Jest build",
    );
  });

  it("rejects accidental use outside the Jest Web Target", async () => {
    await expect(loadAdapter({platformTarget: "facebook" as "jest"})).rejects.toThrow(
      "only initialize in the Jest Web Target",
    );
  });
});
