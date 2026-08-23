const mockInitializeAppCheck = jest.fn(() => ({name: "facebook-app-check"}));
const mockGetToken = jest.fn();
const mockSetTokenAutoRefreshEnabled = jest.fn();

jest.mock("firebase/app-check", () => ({
  CustomProvider: class CustomProvider {
    public readonly getToken: () => Promise<{token: string; expireTimeMillis: number}>;
    public constructor(options: {getToken: () => Promise<{token: string; expireTimeMillis: number}>}) {
      this.getToken = options.getToken;
    }
  },
  getToken: (...args: unknown[]) => mockGetToken(...args),
  initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
  setTokenAutoRefreshEnabled: (...args: unknown[]) => mockSetTokenAutoRefreshEnabled(...args),
}));
jest.mock("../../firebase", () => ({firebaseApp: {name: "firebase-app"}}));

describe("Facebook Firebase App Check adapter", () => {
  const loadAdapter = async (platformTarget: "facebook" | "jest" = "facebook") => {
    jest.doMock("../../test/firebaseEnvironmentMock", () => ({
      firebaseEnvironment: {platformTarget},
    }));
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
    const adapter = await loadAdapter();
    const first = jest.fn(async () => ({token: "generation-1", expireTimeMillis: 1_000}));
    const second = jest.fn(async () => ({token: "generation-2", expireTimeMillis: 2_000}));

    await adapter.initializeFacebookAppCheck(first);
    const provider = mockInitializeAppCheck.mock.calls[0]?.[1]?.provider as {getToken: () => Promise<unknown>};
    await expect(provider.getToken()).resolves.toMatchObject({token: "generation-1"});

    await adapter.initializeFacebookAppCheck(second);
    await expect(provider.getToken()).resolves.toMatchObject({token: "generation-2"});

    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    expect(mockGetToken).toHaveBeenNthCalledWith(1, {name: "facebook-app-check"}, true);
    expect(mockGetToken).toHaveBeenNthCalledWith(2, {name: "facebook-app-check"}, true);
    expect(mockSetTokenAutoRefreshEnabled).toHaveBeenCalledTimes(2);
  });

  it("rejects accidental use outside the Facebook Web Target", async () => {
    const adapter = await loadAdapter("jest");
    await expect(adapter.initializeFacebookAppCheck(async () => ({token: "x", expireTimeMillis: 1})))
      .rejects.toThrow("only initialize in the Facebook Web Target");
  });
});
