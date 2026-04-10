/* eslint-disable no-undef */
// Required for React Native to load in Jest (avoids __fbBatchedBridgeConfig / nativeModules errors)
// PaperUIManager/NativeUIManager expects UIManager.getConstants() to return object

// Suppress console.log/warn during tests to avoid Firebase/logger noise (tests can spyOn when asserting)
if (typeof global.console !== "undefined") {
  global.console.log = jest.fn();
  global.console.warn = jest.fn();
}

global.nativeModuleProxy = {
  UIManager: {
    getConstants: () => ({}),
    getConstantsForViewManager: () => null,
    lazilyLoadView: () => null,
  },
};
global.__fbBatchedBridgeConfig = { remoteModuleConfig: [] };

if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import "react-native-gesture-handler/jestSetup";

jest.mock("react-native/Libraries/TurboModule/TurboModuleRegistry", () => ({
  get: jest.fn((name) => {
    if (name === "DeviceInfo") {
      return {
        getConstants: () => ({
          Dimensions: {
            window: { width: 375, height: 812, scale: 2, fontScale: 1 },
            screen: { width: 375, height: 812, scale: 2, fontScale: 1 },
          },
        }),
      };
    }
    return null;
  }),
  getEnforcing: jest.fn((name) => {
    if (name === "UIManager") {
      return {
        getConstants: () => ({}),
        getConstantsForViewManager: () => null,
        lazilyLoadView: () => null,
        createView: jest.fn(),
        updateView: jest.fn(),
      };
    }
    if (name === "DeviceInfo") {
      return {
        getConstants: () => ({
          Dimensions: {
            window: { width: 375, height: 812, scale: 2, fontScale: 1 },
            screen: { width: 375, height: 812, scale: 2, fontScale: 1 },
          },
        }),
      };
    }
    if (name === "PlatformConstants") {
      return {
        getConstants: () => ({
          isTesting: true,
          reactNativeVersion: { major: 0, minor: 84, patch: 1 },
        }),
      };
    }
    if (name === "SourceCode") {
      return {
        getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }),
      };
    }
    return {};
  }),
}));

jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  default: {
    apps: [],
    initializeApp: jest.fn(() => Promise.resolve()),
    app: jest.fn(() => ({
      // Mock app methods if needed
    })),
  },
  getApp: jest.fn(() => ({
    // Mock app methods if needed
  })),
}));

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => ({
    volume: 1.0,
    playing: false,
    paused: true,
    isLoaded: true,
    play: jest.fn(),
    pause: jest.fn(),
    release: jest.fn(),
  })),
  setAudioModeAsync: jest.fn(),
}));

// Mock Dimensions - react-native requires .default with .get() (avoids getConstants error)
const mockDimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};
jest.mock("react-native/Libraries/Utilities/Dimensions", () => ({
  __esModule: true,
  default: mockDimensions,
}));

// Mock PixelRatio for ScrollView/StyleSheet
jest.mock("react-native/Libraries/Utilities/PixelRatio", () => ({
  __esModule: true,
  default: {
    get: () => 2,
    getFontScale: () => 1,
    getPixelSizeForLayoutSize: (size) => size * 2,
    roundToNearestPixel: (size) => Math.round(size * 2) / 2,
  },
}));

// Mock NativeLinkingManager to avoid nullthrows in Linking (iOS path)
jest.mock("react-native/Libraries/Linking/NativeLinkingManager", () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// Mock AppState to avoid getConstants error when tests override react-native
jest.mock("react-native/Libraries/AppState/AppState", () => ({
  __esModule: true,
  default: {
    getConstants: () => ({ initialAppState: "active" }),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
    currentState: "active",
  },
}));

// Mock Platform for PaperUIManager/ScrollView (avoids Platform.OS undefined)
jest.mock("react-native/Libraries/Utilities/Platform", () => ({
  __esModule: true,
  default: {
    OS: "ios",
    select: (config) => config.ios ?? config.default,
  },
}));

// Mock NativeEventEmitter to avoid "requires a non-null argument" (iOS) and AggregateError
jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter", () => {
  const { EventEmitter } = require("events");
  const MockEmitter = class MockNativeEventEmitter extends EventEmitter {
    constructor() {
      super();
      this.setMaxListeners(20); // Avoid MaxListenersExceededWarning for Keyboard listeners
    }
  };
  return { __esModule: true, default: MockEmitter };
});

// Mock NativeAnimatedModule to avoid "Native animated module is not available" (ScrollView/Animated)
jest.mock("react-native/Libraries/Animated/NativeAnimatedModule", () => {
  const methods = [
    "createAnimatedNode",
    "updateAnimatedNodeConfig",
    "getValue",
    "startListeningToAnimatedNodeValue",
    "stopListeningToAnimatedNodeValue",
    "connectAnimatedNodes",
    "disconnectAnimatedNodes",
    "startAnimatingNode",
    "stopAnimation",
    "setAnimatedNodeValue",
    "setAnimatedNodeOffset",
    "flattenAnimatedNodeOffset",
    "extractAnimatedNodeOffset",
    "connectAnimatedNodeToView",
    "disconnectAnimatedNodeFromView",
    "restoreDefaultValues",
    "dropAnimatedNode",
    "addAnimatedEventToView",
    "removeAnimatedEventFromView",
    "addListener",
    "removeListener",
    "startOperationBatch",
    "finishOperationBatch",
    "queueAndExecuteBatchedOperations",
  ];
  const mock = Object.fromEntries(methods.map((m) => [m, jest.fn()]));
  return { __esModule: true, default: mock, ...mock };
});

// Mock Keyboard to avoid AggregateError (ScrollView calls Keyboard.metrics in componentDidMount)
jest.mock("react-native/Libraries/Components/Keyboard/Keyboard", () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListener: jest.fn(),
    dismiss: jest.fn(),
    metrics: jest.fn(() => ({ height: 0, screenY: 0 })),
  },
}));

// Mock Modal to avoid NativeEventEmitter/Keyboard native module errors (AggregateError in tests)
// Use View from internal path to avoid circular require when tests override react-native
jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  const View = require("react-native/Libraries/Components/View/View").default;
  return {
    __esModule: true,
    default: function MockModal(props) {
      // Always render so UNSAFE_getByType(Modal) can find it; only show children when visible
      return React.createElement(
        View,
        { testID: props.testID ?? "mock-modal", "data-modal-visible": props.visible },
        props.visible ? props.children : null
      );
    },
  };
});

jest.mock("@react-native-firebase/functions", () => {
  const mockCallable = jest.fn(() => Promise.resolve({ data: {} }));
  return {
    __esModule: true,
    getFunctions: jest.fn(() => ({})),
    httpsCallable: jest.fn(() => mockCallable),
  };
});

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@react-native-firebase/analytics", () => {
  const mockAnalyticsInstance = {
    setUserId: jest.fn(() => Promise.resolve()),
    setAnalyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
    logEvent: jest.fn(() => Promise.resolve()),
    logScreenView: jest.fn(() => Promise.resolve()),
    logLevelEnd: jest.fn(() => Promise.resolve()),
    logShare: jest.fn(() => Promise.resolve()),
    setUserProperty: jest.fn(() => Promise.resolve()),
  };
  return {
    __esModule: true,
    default: jest.fn(() => mockAnalyticsInstance),
    getAnalytics: jest.fn(() => mockAnalyticsInstance),
    setUserId: jest.fn(() => Promise.resolve()),
    setAnalyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
    logEvent: jest.fn(() => Promise.resolve()),
    logScreenView: jest.fn(() => Promise.resolve()),
    logLevelEnd: jest.fn(() => Promise.resolve()),
    logShare: jest.fn(() => Promise.resolve()),
    setUserProperty: jest.fn(() => Promise.resolve()),
  };
});

jest.mock("@sentry/react-native", () => ({
  __esModule: true,
  init: jest.fn(),
  withScope: jest.fn((cb) => {
    cb?.({ setExtras: jest.fn() });
  }),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  startInactiveSpan: jest.fn(() => ({
    end: jest.fn(),
  })),
}));

jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    signInWithCredential: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
  })),
  getAuth: jest.fn(() => ({
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    signInWithCredential: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
  })),
}));
