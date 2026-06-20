jest.mock("expo", () => ({
  registerRootComponent: jest.fn(),
}));

const {resolveBootstrapMode} = require("../../index");

describe("resolveBootstrapMode", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("falls back to the main app when initial URL lookup stalls", async () => {
    const appComponent = () => null;
    const resolutionPromise = resolveBootstrapMode({
      getInitialUrl: () => new Promise<string | null>(() => {}),
      loadApp: () => appComponent,
      initialUrlTimeoutMs: 5000,
    });

    jest.advanceTimersByTime(5000);

    await expect(resolutionPromise).resolves.toEqual({
      mode: "app",
      AppComponent: appComponent,
    });
  });

  it("routes lightweight QA surfaces without importing the full app", async () => {
    const ignoreAllLogs = jest.fn();
    const loadApp = jest.fn(() => () => null);
    const loadQASurface = jest.fn(() => () => null);

    await expect(
      resolveBootstrapMode({
        getInitialUrl: async () => "qwordly://qa/page-app-loading",
        loadApp,
        loadQASurface,
        ignoreAllLogs,
      }),
    ).resolves.toEqual({
      mode: "qa-light",
      surfaceId: "page-app-loading",
    });

    expect(ignoreAllLogs).toHaveBeenCalledWith(true);
    expect(loadApp).not.toHaveBeenCalled();
    expect(loadQASurface).not.toHaveBeenCalled();
  });

  it("rethrows app import failures so the bootstrap screen can show an error state", async () => {
    await expect(
      resolveBootstrapMode({
        getInitialUrl: async () => null,
        loadApp: () => {
          throw new Error("boom");
        },
      }),
    ).rejects.toThrow("boom");
  });
});
