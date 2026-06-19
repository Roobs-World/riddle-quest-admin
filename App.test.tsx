import React from "react";
import {Text, View} from "react-native";
import {render, waitFor} from "@testing-library/react-native";

const mockPreloadSolarSystem = jest.fn();
const mockLoadFonts = jest.fn();
const mockLoadShopCatalog = jest.fn();
const mockInitializeRewardedAds = jest.fn();
const mockInitializeFirebaseAppCheck = jest.fn();
const mockSetLocale = jest.fn();
const mockDetectDeviceLanguage = jest.fn();
const mockCaptureException = jest.fn();
const mockCrashlyticsLog = jest.fn();
const mockReadStoredLocale = jest.fn();
const mockPersistLocale = jest.fn();
const mockUpdatePlayerData = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("@sentry/react-native", () => ({
  wrap: (component: any) => component,
  ErrorBoundary: ({children}: any) => React.createElement(React.Fragment, null, children),
}));

jest.mock("./src/utils/sentry", () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
}));

jest.mock("./src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("./src/utils/fontLoader", () => ({
  loadFonts: () => mockLoadFonts(),
}));

jest.mock("./src/services/SoundManager", () => ({
  SoundManager: {
    init: jest.fn(() => Promise.resolve()),
    setSoundEnabled: jest.fn(),
    playBackgroundMusic: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("expo-constants", () => ({
  expoConfig: {
    extra: {
      GOOGLE_WEB_CLIENT_ID: "test-web-client",
      FACEBOOK_APP_ID: "test-facebook-app",
      FACEBOOK_CLIENT_TOKEN: "test-facebook-token",
      FIREBASE_APP_CHECK_DEBUG_TOKEN: "test-debug-token",
    },
  },
}));

jest.mock("react-native-fbsdk-next", () => ({
  Settings: {
    setAppID: jest.fn(),
    setClientToken: jest.fn(),
    initializeSDK: jest.fn(),
  },
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
  },
}));

jest.mock("./src/contexts/AuthContext", () => ({
  AuthProvider: ({children}: any) => React.createElement(View, {testID: "auth-provider"}, children),
  useAuth: () =>
    mockUseAuth({
      isAuthenticated: false,
      isLoading: false,
      playerData: null,
      updatePlayerData: mockUpdatePlayerData,
    }),
}));

jest.mock("./src/contexts/TooltipContext", () => ({
  TooltipProvider: ({children}: any) => React.createElement(View, {testID: "tooltip-provider"}, children),
}));

jest.mock("./src/contexts/ModalContext", () => ({
  ModalProvider: ({children}: any) => React.createElement(View, {testID: "modal-provider"}, children),
}));

jest.mock("./src/navigation/NavigationStack", () => ({
  Navigation: () => React.createElement(Text, {testID: "navigation"}, "Navigation ready"),
}));

jest.mock("@react-navigation/native", () => ({
  NavigationContainer: ({children}: any) => React.createElement(View, {testID: "navigation-container"}, children),
}));

jest.mock("@/components/loading/PulsingSpinner", () => ({
  __esModule: true,
  default: ({visible}: any) => React.createElement(View, {testID: visible ? "startup-spinner" : "hidden-spinner"}),
}));

jest.mock("./src/services/RewardedAdService", () => ({
  initializeRewardedAds: () => mockInitializeRewardedAds(),
}));

jest.mock("./src/services/ShopCatalogPreloader", () => ({
  preloadShopCatalog: () => mockLoadShopCatalog(),
}));

jest.mock("./src/services/AppCheckService", () => ({
  initializeFirebaseAppCheck: () => mockInitializeFirebaseAppCheck(),
}));

jest.mock("./src/qa/QASurfaceHarness", () => ({
  QASurfaceGate: ({children}: any) => React.createElement(View, {testID: "qa-gate"}, children),
}));

jest.mock("./src/i18n", () => ({
  isSupportedLanguage: jest.fn(() => true),
  setLocale: (...args: any[]) => mockSetLocale(...args),
  detectDeviceLanguage: (...args: any[]) => mockDetectDeviceLanguage(...args),
  t: (key: string) => {
    if (key === "ErrorMessages.FATAL_STARTUP_TITLE") {
      return "Startup failed";
    }
    if (key === "ErrorMessages.FATAL_STARTUP_MESSAGE") {
      return "The solar system background failed to load. Please restart the app.";
    }
    return key;
  },
}));

jest.mock("./src/utils/localeStorage", () => ({
  persistLocale: (...args: any[]) => mockPersistLocale(...args),
  readStoredLocale: (...args: any[]) => mockReadStoredLocale(...args),
}));

jest.mock("@react-native-firebase/crashlytics", () => ({
  getCrashlytics: () => ({}),
  log: (...args: any[]) => mockCrashlyticsLog(...args),
}));

jest.mock("./src/services/SolarSystemPreloader", () => ({
  SolarSystemPreloader: {
    preloadSolarSystem: (...args: any[]) => mockPreloadSolarSystem(...args),
  },
}));

const {default: App} = require("./App");

describe("App startup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadStoredLocale.mockResolvedValue("en");
    mockPersistLocale.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      playerData: null,
      updatePlayerData: mockUpdatePlayerData,
    });
    mockLoadFonts.mockResolvedValue(undefined);
    mockLoadShopCatalog.mockResolvedValue(undefined);
    mockInitializeRewardedAds.mockResolvedValue(undefined);
    mockInitializeFirebaseAppCheck.mockResolvedValue(undefined);
    mockPreloadSolarSystem.mockResolvedValue({
      scene: {},
      camera: {},
      planetsGroup: {},
      meshes: [],
      lights: [],
      geometries: new Map(),
      materials: new Map(),
      textures: new Map(),
    });
  });

  it("allows app initialization when solar preload succeeds", async () => {
    const {getByTestId, queryByText} = render(<App />);

    await waitFor(() => expect(mockPreloadSolarSystem).toHaveBeenCalled());
    await waitFor(() => expect(getByTestId("navigation")).toBeTruthy());

    expect(queryByText("Startup failed")).toBeNull();
  });

  it("captures solar preload failures and blocks navigation", async () => {
    mockPreloadSolarSystem.mockRejectedValueOnce(new Error("solar fail"));

    const {getByText, queryByTestId} = render(<App />);

    await waitFor(() => expect(getByText("Startup failed")).toBeTruthy());

    expect(getByText("The solar system background failed to load. Please restart the app.")).toBeTruthy();
    expect(queryByTestId("navigation")).toBeNull();
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error), {context: "App.solarStartup"});
  });
});
