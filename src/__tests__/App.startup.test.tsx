import React from "react";
import {Text, View} from "react-native";
import {render, waitFor} from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
const mockFirebaseSignOut = jest.fn();
const mockFirebaseAuth = {currentUser: null as {uid: string} | null};
const mockSoundManagerInit = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockSetSoundEnabled = jest.fn();
const mockPlayBackgroundMusic = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockPauseBackgroundMusic = jest.fn((..._args: unknown[]) => Promise.resolve());

jest.mock("../../global.css", () => ({}));

jest.mock("@sentry/react-native", () => ({
  __esModule: true,
  wrap: (component: any) => component,
  ErrorBoundary: ({children}: any) => {
    const ReactLocal = require("react");
    return ReactLocal.createElement(ReactLocal.Fragment, null, children);
  },
}));

jest.mock("../../src/utils/sentry", () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
  wrapAppWithSentry: (component: any) => component,
}));

jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../src/utils/timing", () => ({
  safeDelay: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../src/utils/fontLoader", () => ({
  loadFonts: () => mockLoadFonts(),
}));

jest.mock("../../src/services/SoundManager", () => ({
  SoundManager: {
    init: (...args: any[]) => mockSoundManagerInit(...args),
    setSoundEnabled: (...args: any[]) => mockSetSoundEnabled(...args),
    playBackgroundMusic: (...args: any[]) => mockPlayBackgroundMusic(...args),
    pauseBackgroundMusic: (...args: any[]) => mockPauseBackgroundMusic(...args),
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

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({children}: any) => {
    const ReactLocal = require("react");
    const {View: ReactNativeView} = require("react-native");
    return ReactLocal.createElement(ReactNativeView, {testID: "safe-area-provider"}, children);
  },
}));

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: () => mockFirebaseAuth,
  signOut: (...args: any[]) => mockFirebaseSignOut(...args),
}));

jest.mock("../../src/contexts/AuthContext", () => ({
  AuthProvider: ({children}: any) => {
    const ReactLocal = require("react");
    const {View: ReactNativeView} = require("react-native");
    return ReactLocal.createElement(ReactNativeView, {testID: "auth-provider"}, children);
  },
  useAuth: () =>
    mockUseAuth({
      isAuthenticated: false,
      isLoading: false,
      playerData: null,
      updatePlayerData: mockUpdatePlayerData,
    }),
}));

jest.mock("../../src/contexts/TooltipContext", () => ({
  TooltipProvider: ({children}: any) => {
    const ReactLocal = require("react");
    const {View: ReactNativeView} = require("react-native");
    return ReactLocal.createElement(ReactNativeView, {testID: "tooltip-provider"}, children);
  },
}));

jest.mock("../../src/contexts/ModalContext", () => ({
  ModalProvider: ({children}: any) => {
    const ReactLocal = require("react");
    const {View: ReactNativeView} = require("react-native");
    return ReactLocal.createElement(ReactNativeView, {testID: "modal-provider"}, children);
  },
}));

jest.mock("../../src/contexts/SettingsContext", () => ({
  SettingsProvider: ({children}: any) => {
    const ReactLocal = require("react");
    const {View: ReactNativeView} = require("react-native");
    return ReactLocal.createElement(ReactNativeView, {testID: "settings-provider"}, children);
  },
  useAppSettings: () => ({
    isHapticsEnabled: true,
    isSoundEnabled: true,
    toggleHapticsEnabled: jest.fn(),
    toggleSoundEnabled: jest.fn(),
  }),
}));

jest.mock("../../src/navigation/NavigationStack", () => ({
  Navigation: () => {
    const ReactLocal = require("react");
    const {Text: ReactNativeText} = require("react-native");
    return ReactLocal.createElement(ReactNativeText, {testID: "navigation"}, "Navigation ready");
  },
}));

jest.mock("../../src/screens/LanguageSelectionScreen", () => ({
  __esModule: true,
  default: ({onSubmit}: {onSubmit: (language: string) => void}) => {
    const ReactLocal = require("react");
    const {Text: ReactNativeText} = require("react-native");
    return ReactLocal.createElement(
      ReactNativeText,
      {
        onPress: () => onSubmit("en"),
        testID: "language-selection-screen",
      },
      "Language selection",
    );
  },
}));

jest.mock("../../src/components/overlays/GlobalMuteOverlay", () => ({
  __esModule: true,
  default: ({isSoundEnabled, onToggleSound}: {isSoundEnabled: boolean; onToggleSound: (enabled: boolean) => void}) => {
    const ReactLocal = require("react");
    const {Text: ReactNativeText} = require("react-native");
    return ReactLocal.createElement(
      ReactNativeText,
      {
        onPress: () => onToggleSound(!isSoundEnabled),
        testID: "global-mute-overlay",
      },
      isSoundEnabled ? "Sound on" : "Sound off",
    );
  },
}));

jest.mock("@react-navigation/native", () => ({
  NavigationContainer: ({children}: any) => {
    const ReactLocal = require("react");
    const {View: ReactNativeView} = require("react-native");
    return ReactLocal.createElement(ReactNativeView, {testID: "navigation-container"}, children);
  },
}));

jest.mock("@/components/loading/PulsingSpinner", () => ({
  __esModule: true,
  default: ({visible}: any) => {
    const ReactLocal = require("react");
    const {View: ReactNativeView} = require("react-native");
    return ReactLocal.createElement(ReactNativeView, {testID: visible ? "startup-spinner" : "hidden-spinner"});
  },
}));

jest.mock("../../src/services/RewardedAdService", () => ({
  initializeRewardedAds: () => mockInitializeRewardedAds(),
}));

jest.mock("../../src/services/ShopCatalogPreloader", () => ({
  preloadShopCatalog: () => mockLoadShopCatalog(),
}));

jest.mock("../../src/services/AppCheckService", () => ({
  initializeFirebaseAppCheck: () => mockInitializeFirebaseAppCheck(),
}));

jest.mock("../../src/qa/QASurfaceHarness", () => ({
  QASurfaceGate: ({children}: any) => {
    const ReactLocal = require("react");
    const {View: ReactNativeView} = require("react-native");
    return ReactLocal.createElement(ReactNativeView, {testID: "qa-gate"}, children);
  },
}));

jest.mock("../../src/i18n", () => ({
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

jest.mock("../../src/utils/localeStorage", () => ({
  persistLocale: (...args: any[]) => mockPersistLocale(...args),
  readStoredLocale: (...args: any[]) => mockReadStoredLocale(...args),
}));

jest.mock("@react-native-firebase/crashlytics", () => ({
  getCrashlytics: () => ({}),
  log: (...args: any[]) => mockCrashlyticsLog(...args),
}));

jest.mock("../../src/services/SolarSystemPreloader", () => ({
  SolarSystemPreloader: {
    preloadSolarSystem: (...args: any[]) => mockPreloadSolarSystem(...args),
  },
}));

const {default: App} = require("../../App");

describe("App startup", () => {
  const originalDev = (global as typeof global & {__DEV__?: boolean}).__DEV__;
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

  beforeEach(() => {
    jest.clearAllMocks();
    (global as typeof global & {__DEV__?: boolean}).__DEV__ = true;
    mockFirebaseAuth.currentUser = null;
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

  afterAll(() => {
    (global as typeof global & {__DEV__?: boolean}).__DEV__ = originalDev;
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
      return;
    }
    delete (globalThis as {localStorage?: unknown}).localStorage;
  });

  it("allows app initialization when solar preload succeeds", async () => {
    const {getByTestId, queryByText} = render(<App />);

    await waitFor(() => expect(mockPreloadSolarSystem).toHaveBeenCalled());
    await waitFor(() => expect(getByTestId("navigation")).toBeTruthy());

    expect(getByTestId("global-mute-overlay")).toBeTruthy();
    expect(queryByText("Startup failed")).toBeNull();
  });

  it("shows the language selection screen when no locale is stored for a signed-out user", async () => {
    mockReadStoredLocale.mockResolvedValue(null);
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      playerData: null,
      updatePlayerData: mockUpdatePlayerData,
    });

    const {getByTestId, queryByTestId} = render(<App />);

    await waitFor(() => expect(getByTestId("language-selection-screen")).toBeTruthy());
    expect(getByTestId("global-mute-overlay")).toBeTruthy();
    expect(queryByTestId("startup-spinner")).toBeNull();
  });

  it("clears persisted local state on startup in development", async () => {
    const clearLocalStorage = jest.fn();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {clear: clearLocalStorage},
    });
    mockFirebaseAuth.currentUser = {uid: "persisted-user"};

    render(<App />);

    await waitFor(() => expect(AsyncStorage.clear).toHaveBeenCalled());
    await waitFor(() => expect(mockFirebaseSignOut).toHaveBeenCalledWith(mockFirebaseAuth));
    expect(clearLocalStorage).toHaveBeenCalled();
  });

  it("does not clear persisted local state on startup in production", async () => {
    (global as typeof global & {__DEV__?: boolean}).__DEV__ = false;
    mockFirebaseAuth.currentUser = {uid: "prod-user"};

    const {getByTestId} = render(<App />);

    await waitFor(() => expect(getByTestId("navigation")).toBeTruthy());
    expect(AsyncStorage.clear).not.toHaveBeenCalled();
    expect(mockFirebaseSignOut).not.toHaveBeenCalled();
  });

  it("applies a persisted muted state before initializing startup music", async () => {
    (global as typeof global & {__DEV__?: boolean}).__DEV__ = false;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => (key === "isSoundEnabled" ? JSON.stringify(false) : null)),
        setItem: jest.fn(),
      },
    });

    render(<App />);

    await waitFor(() => expect(mockSoundManagerInit).toHaveBeenCalled());

    const firstInitOrder = mockSoundManagerInit.mock.invocationCallOrder[0];
    const mutedBeforeInit = mockSetSoundEnabled.mock.calls.some(
      ([enabled], index) => enabled === false && mockSetSoundEnabled.mock.invocationCallOrder[index] < firstInitOrder,
    );

    expect(mutedBeforeInit).toBe(true);
    expect(mockPlayBackgroundMusic).not.toHaveBeenCalled();
  });
});
