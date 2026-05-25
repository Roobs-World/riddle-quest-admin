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
global.__fbBatchedBridgeConfig = {remoteModuleConfig: []};

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
            window: {width: 375, height: 812, scale: 2, fontScale: 1},
            screen: {width: 375, height: 812, scale: 2, fontScale: 1},
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
            window: {width: 375, height: 812, scale: 2, fontScale: 1},
            screen: {width: 375, height: 812, scale: 2, fontScale: 1},
          },
        }),
      };
    }
    if (name === "PlatformConstants") {
      return {
        getConstants: () => ({
          isTesting: true,
          reactNativeVersion: {major: 0, minor: 84, patch: 1},
        }),
      };
    }
    if (name === "SourceCode") {
      return {
        getConstants: () => ({scriptURL: "http://localhost:8081/index.bundle"}),
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
  get: () => ({width: 375, height: 812, scale: 2, fontScale: 1}),
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
    addListener: jest.fn(() => ({remove: jest.fn()})),
  },
}));

// Mock AppState to avoid getConstants error when tests override react-native
jest.mock("react-native/Libraries/AppState/AppState", () => ({
  __esModule: true,
  default: {
    getConstants: () => ({initialAppState: "active"}),
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
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
  const {EventEmitter} = require("events");
  class MockNativeEventEmitter extends EventEmitter {
    constructor() {
      super();
      this.setMaxListeners(20); // Avoid MaxListenersExceededWarning for Keyboard listeners
    }

    addListener(eventType, listener, context) {
      // RN expects a subscription object with a callable `remove()`.
      super.addListener(eventType, listener, context);
      return {
        remove: () => {
          this.removeListener(eventType, listener);
        },
      };
    }
  }

  return {__esModule: true, default: MockNativeEventEmitter};
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
  return {__esModule: true, default: mock, ...mock};
});

// Mock Keyboard to avoid AggregateError (ScrollView calls Keyboard.metrics in componentDidMount)
// Also mock isVisible for KeyboardAvoidingView which calls it in componentDidMount
jest.mock("react-native/Libraries/Components/Keyboard/Keyboard", () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({remove: jest.fn()})),
    removeListener: jest.fn(),
    dismiss: jest.fn(),
    metrics: jest.fn(() => ({height: 0, screenY: 0})),
    isVisible: jest.fn(() => false),
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
        {testID: props.testID ?? "mock-modal", "data-modal-visible": props.visible},
        props.visible ? props.children : null,
      );
    },
  };
});

jest.mock("@react-native-firebase/functions", () => {
  const mockCallable = jest.fn(() => Promise.resolve({data: {}}));
  return {
    __esModule: true,
    getFunctions: jest.fn(() => ({})),
    httpsCallable: jest.fn(() => mockCallable),
  };
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
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
    cb?.({setExtras: jest.fn()});
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

jest.mock("@react-native-firebase/storage", () => {
  const mockRef = {
    putFile: jest.fn(() => Promise.resolve()),
    getDownloadURL: jest.fn(() => Promise.resolve("https://example.com/avatar.jpg")),
  };

  return {
    __esModule: true,
    getStorage: jest.fn(() => ({
      ref: jest.fn(() => mockRef),
    })),
  };
});

jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => ({__type: "serverTimestamp"})),
  FirebaseFirestoreTypes: {},
}));

jest.mock("react-native-google-mobile-ads", () => {
  const createRewardedAdMock = () => {
    const listeners = new Map();
    const addAdEventListener = jest.fn((eventType, listener) => {
      const existing = listeners.get(eventType) ?? new Set();
      existing.add(listener);
      listeners.set(eventType, existing);
      return () => {
        const current = listeners.get(eventType);
        current?.delete(listener);
      };
    });

    const emit = (eventType, payload) => {
      const handlers = listeners.get(eventType);
      handlers?.forEach((handler) => handler(payload));
    };

    return {
      addAdEventListener,
      load: jest.fn(() => {
        emit("loaded");
      }),
      show: jest.fn(async () => {
        emit("earned_reward", {amount: 1, type: "coin"});
        emit("closed");
      }),
    };
  };

  const initialize = jest.fn(() => Promise.resolve({}));
  const mobileAdsFactory = jest.fn(() => ({initialize}));

  return {
    __esModule: true,
    default: mobileAdsFactory,
    mobileAds: mobileAdsFactory,
    RewardedAd: {
      createForAdRequest: jest.fn(() => createRewardedAdMock()),
    },
    RewardedAdEventType: {
      LOADED: "loaded",
      EARNED_REWARD: "earned_reward",
    },
    AdEventType: {
      CLOSED: "closed",
      ERROR: "error",
    },
  };
});

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() => Promise.resolve({isConnected: true, isInternetReachable: true})),
  },
}));
