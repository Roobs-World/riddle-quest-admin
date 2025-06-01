import "react-native-gesture-handler/jestSetup";

// Mock React Native modules
jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock React Native Vector Icons
jest.mock("react-native-vector-icons/MaterialIcons", () => "MaterialIcons");
jest.mock("react-native-vector-icons/Ionicons", () => "Ionicons");

// Mock Firebase modules
jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    // Mock app instance
  })),
  getApp: jest.fn(() => ({
    // Mock app instance for getApp()
  })),
}));

// Mock the auth module to ensure it's always mocked
jest.mock("@react-native-firebase/auth", () => {
  // Import the manual mock
  return require("../__mocks__/@react-native-firebase/auth.js");
});

jest.mock("@react-native-firebase/firestore", () => {
  // Create reusable mock functions
  const getMock = jest.fn(() =>
    Promise.resolve({
      exists: false,
      data: () => null,
    })
  );

  const whereMock = jest.fn();
  const orderByMock = jest.fn();
  const limitMock = jest.fn();

  // Create chainable mock object
  const createChainableMock = () => {
    const chainable = {
      where: whereMock,
      orderBy: orderByMock,
      limit: limitMock,
      get: getMock,
    };

    // Make each method return the chainable object for chaining
    whereMock.mockReturnValue(chainable);
    orderByMock.mockReturnValue(chainable);
    limitMock.mockReturnValue(chainable);

    return chainable;
  };

  return {
    __esModule: true,
    default: jest.fn(() => ({
      collection: jest.fn((collectionName) => {
        const collectionMock = createChainableMock();

        // Add doc method
        collectionMock.doc = jest.fn(() => ({
          get: getMock,
          set: jest.fn(() => Promise.resolve()),
          update: jest.fn(() => Promise.resolve()),
          delete: jest.fn(() => Promise.resolve()),
          onSnapshot: jest.fn(),
        }));

        return collectionMock;
      }),
    })),
  };
});

jest.mock("@react-native-firebase/functions", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
  })),
}));

jest.mock("@react-native-firebase/storage", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    ref: jest.fn(() => ({
      putFile: jest.fn(() => Promise.resolve()),
      getDownloadURL: jest.fn(() => Promise.resolve("mock-url")),
    })),
  })),
}));

// Create mock sound instances that tests can use
const createMockSoundInstance = () => ({
  playAsync: jest.fn(() => Promise.resolve()),
  stopAsync: jest.fn(() => Promise.resolve()),
  setIsLoopingAsync: jest.fn(() => Promise.resolve()),
  setVolumeAsync: jest.fn(() => Promise.resolve()),
  replayAsync: jest.fn(() => Promise.resolve()),
  getStatusAsync: jest.fn(() =>
    Promise.resolve({ isLoaded: true, isPlaying: false })
  ),
  unloadAsync: jest.fn(() => Promise.resolve()),
  pauseAsync: jest.fn(() => Promise.resolve()),
});

// Global array to track sound instances for tests (used by some tests, others may override)
global.mockSoundInstances = [];

// Mock expo-av (can be overridden by individual test files)
jest.mock("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => {
        const soundInstance = createMockSoundInstance();
        // Ensure the global array exists and push the new instance
        if (!global.mockSoundInstances) {
          global.mockSoundInstances = [];
        }
        global.mockSoundInstances.push(soundInstance);
        return Promise.resolve({
          sound: soundInstance,
        });
      }),
    },
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  },
  AVPlaybackStatus: {},
}));

// Mock react-native-haptic-feedback
jest.mock("react-native-haptic-feedback", () => ({
  trigger: jest.fn(),
  HapticFeedbackTypes: {
    selection: "selection",
    impactLight: "impactLight",
    impactMedium: "impactMedium",
    impactHeavy: "impactHeavy",
    notificationSuccess: "notificationSuccess",
    notificationWarning: "notificationWarning",
    notificationError: "notificationError",
  },
}));

// Mock Google Sign-In
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() =>
      Promise.resolve({
        user: { id: "test-id", email: "test@example.com" },
        idToken: "mock-id-token",
      })
    ),
    signOut: jest.fn(() => Promise.resolve()),
    isSignedIn: jest.fn(() => Promise.resolve(false)),
    getCurrentUser: jest.fn(() => Promise.resolve(null)),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
}));

// Mock Facebook SDK
jest.mock("react-native-fbsdk-next", () => ({
  LoginManager: {
    logInWithPermissions: jest.fn(() => Promise.resolve({ result: "granted" })),
    logOut: jest.fn(),
  },
  AccessToken: {
    getCurrentAccessToken: jest.fn(() =>
      Promise.resolve({
        accessToken: "mock-fb-token",
      })
    ),
  },
}));

// Mock NativeWind
jest.mock("nativewind", () => ({
  styled: jest.fn((component) => component),
  withTailwindCSS: jest.fn(),
}));

// Mock async storage
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock React Navigation
jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
  })),
  useRoute: jest.fn(() => ({
    params: {},
  })),
  useFocusEffect: jest.fn(),
  CommonActions: {
    reset: jest.fn(),
  },
}));

// Mock safe area context
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Global test utilities
global.__TEST__ = true;

// Mock console functions as jest functions for testing
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

// Mock setTimeout and clearTimeout for testing
global.setTimeout = jest.fn((callback, delay) => {
  if (typeof callback === "function") {
    return setTimeout(callback, delay);
  }
  return 1; // Return a mock timer ID
});
global.clearTimeout = jest.fn();
