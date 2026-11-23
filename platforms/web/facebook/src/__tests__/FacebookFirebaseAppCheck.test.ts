/** Provides mock initialize app check behavior. */
const mockInitializeAppCheck = jest.fn(() => ({name: "facebook-app-check"}));
/** Provides mock get token behavior. */
const mockGetToken = jest.fn();
/** Provides mock set token auto refresh enabled behavior. */
const mockSetTokenAutoRefreshEnabled = jest.fn();

jest.mock("firebase/app-check", () => ({
  CustomProvider: class CustomProvider {
    /** Stores get token. */
    public readonly getToken: () => Promise<{
      /** Stores token. */
      token: string; /** Stores expire time millis. */
      /** Stores expire time millis. */
      expireTimeMillis: number;
    }>;
    /** Creates a class instance. */
    public constructor(options: {
      /** Stores get token. */
      getToken: () => Promise<{
        /** Stores token. */
        token: string; /** Stores expire time millis. */
        /** Stores expire time millis. */
        expireTimeMillis: number;
      }>;
    }) {
      this.getToken = options.getToken;
    }
  },
  getToken: (...args: unknown[]) => mockGetToken(...args),
  initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
  setTokenAutoRefreshEnabled: (...args: unknown[]) => mockSetTokenAutoRefreshEnabled(...args),
}));
jest.mock("../../firebase", () => ({firebaseApp: {name: "firebase-app"}}));

describe("Facebook Firebase App Check adapter", () => {
  /** Loads adapter. */
  const loadAdapter = async (platformTarget: "facebook" | "jest" = "facebook") => {
    jest.doMock("../../test/firebaseEnvironmentMock", () => ({
      firebaseEnvironment: {platformTarget},
    }));
    /** Loads ed. */
    let loaded: typeof import("../FacebookFirebaseAppCheck") | undefined;
    await jest.isolateModulesAsync(async () => {
      loaded = await import("../FacebookFirebaseAppCheck");
    });
    return loaded!;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue({token: "attested"});
  });

  afterEach(() => jest.dontMock("../../test/firebaseEnvironmentMock"));

  it("replaces the renewable callback without recreating the custom provider", async () => {
    /** Provides adapter behavior. */
    const adapter = await loadAdapter();
    /** Provides first behavior. */
    const first = jest.fn(async () => ({token: "generation-1", expireTimeMillis: 1_000}));
    /** Provides second behavior. */
    const second = jest.fn(async () => ({token: "generation-2", expireTimeMillis: 2_000}));

    await adapter.initializeFacebookAppCheck(first);
    /** Provides provider behavior. */
    const provider = mockInitializeAppCheck.mock.calls[0]?.[1]?.provider as {
      /** Stores get token. */
      getToken: () => Promise<unknown>;
    };
    await expect(provider.getToken()).resolves.toMatchObject({token: "generation-1"});

    await adapter.initializeFacebookAppCheck(second);
    await expect(provider.getToken()).resolves.toMatchObject({token: "generation-2"});

    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    expect(mockGetToken).toHaveBeenNthCalledWith(1, {name: "facebook-app-check"}, true);
    expect(mockGetToken).toHaveBeenNthCalledWith(2, {name: "facebook-app-check"}, true);
    expect(mockSetTokenAutoRefreshEnabled).toHaveBeenCalledTimes(2);
  });

  it("rejects accidental use outside the Facebook Web Target", async () => {
    /** Provides adapter behavior. */
    const adapter = await loadAdapter("jest");
    await expect(adapter.initializeFacebookAppCheck(async () => ({token: "x", expireTimeMillis: 1}))).rejects.toThrow(
      "only initialize in the Facebook Web Target",
    );
  });
});
