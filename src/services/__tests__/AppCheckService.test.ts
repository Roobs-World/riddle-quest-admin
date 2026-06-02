const mockInitializeAppCheck = jest.fn(async () => undefined);

jest.mock("@react-native-firebase/app-check", () => {
  const appCheckMock = jest.fn(() => ({
    initializeAppCheck: mockInitializeAppCheck,
  }));

  return {
    __esModule: true,
    default: appCheckMock,
  };
});

jest.mock("../firebaseApp", () => ({
  getFirebaseApp: jest.fn(() => ({
    name: "[DEFAULT]",
    appCheck: jest.fn(() => ({
      newReactNativeFirebaseAppCheckProvider: jest.fn(() => ({
        configure: jest.fn(),
      })),
    })),
  })),
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  createFirebaseAppCheckProvider,
  initializeFirebaseAppCheck,
  resetFirebaseAppCheckForTests,
} from "../AppCheckService";

const mockAppCheckModule = require("@react-native-firebase/app-check").default as jest.Mock;
const {getFirebaseApp: mockGetFirebaseApp} = require("../firebaseApp");

const getLatestProviderMock = () => {
  const app = mockGetFirebaseApp.mock.results[0]?.value;
  const appCheck = app?.appCheck.mock.results[0]?.value;
  const providerFactory =
    appCheck?.newReactNativeFirebaseAppCheckProvider.mock.results[0]?.value;
  const provider = providerFactory?.configure ? providerFactory : undefined;

  return {
    app,
    appCheck,
    providerFactory,
    provider,
  };
};

describe("AppCheckService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFirebaseAppCheckForTests();
  });

  it("configures debug providers for development builds", () => {
    createFirebaseAppCheckProvider({
      debugToken: "debug-token",
      isDevelopmentBuild: true,
    });

    const {appCheck, providerFactory, provider} = getLatestProviderMock();

    expect(mockGetFirebaseApp).toHaveBeenCalledTimes(1);
    expect(appCheck).toBeDefined();
    expect(appCheck.newReactNativeFirebaseAppCheckProvider).toHaveBeenCalledTimes(1);
    expect(providerFactory).toBeDefined();
    expect(provider.configure).toHaveBeenCalledWith({
      android: {
        provider: "debug",
        debugToken: "debug-token",
      },
      apple: {
        provider: "debug",
        debugToken: "debug-token",
      },
    });
  });

  it("configures release providers for production builds", () => {
    createFirebaseAppCheckProvider({
      isDevelopmentBuild: false,
    });

    const {appCheck, providerFactory, provider} = getLatestProviderMock();

    expect(mockGetFirebaseApp).toHaveBeenCalledTimes(1);
    expect(appCheck).toBeDefined();
    expect(appCheck.newReactNativeFirebaseAppCheckProvider).toHaveBeenCalledTimes(1);
    expect(providerFactory).toBeDefined();
    expect(provider.configure).toHaveBeenCalledWith({
      android: {
        provider: "playIntegrity",
      },
      apple: {
        provider: "appAttestWithDeviceCheckFallback",
      },
    });
  });

  it("initializes App Check once and reuses the cached promise", async () => {
    await initializeFirebaseAppCheck({
      debugToken: "debug-token",
      isDevelopmentBuild: true,
    });
    await initializeFirebaseAppCheck({
      debugToken: "different-token",
      isDevelopmentBuild: false,
    });

    const {app, appCheck, providerFactory, provider} = getLatestProviderMock();

    expect(mockGetFirebaseApp).toHaveBeenCalledTimes(1);
    expect(app).toBeDefined();
    expect(appCheck).toBeDefined();
    expect(appCheck.newReactNativeFirebaseAppCheckProvider).toHaveBeenCalledTimes(1);
    expect(providerFactory).toBeDefined();
    expect(provider.configure).toHaveBeenCalledWith({
      android: {
        provider: "debug",
        debugToken: "debug-token",
      },
      apple: {
        provider: "debug",
        debugToken: "debug-token",
      },
    });
    expect(mockAppCheckModule).toHaveBeenCalledTimes(1);
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    expect(mockInitializeAppCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        provider,
        isTokenAutoRefreshEnabled: true,
      }),
    );
  });
});
