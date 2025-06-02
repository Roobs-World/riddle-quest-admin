/* eslint-disable */

// Global getColorScheme mock to prevent undefined errors
global.getColorScheme = jest.fn(() => "light");

// Mock the problematic React Native JS polyfills that contain Flow syntax
jest.mock("@react-native/js-polyfills/error-guard", () => ({}));
jest.mock("@react-native/js-polyfills", () => ({}));

// Mock SVG imports
jest.mock(".svg", () => "SvgMock");

// Mock React Native Appearance module to fix getColorScheme issues
jest.mock("react-native/Libraries/Utilities/Appearance", () => ({
  getColorScheme: jest.fn(() => "light"),
  addChangeListener: jest.fn(),
  removeChangeListener: jest.fn(),
}));

// Mock react-native-css-interop with all possible exports
jest.mock("react-native-css-interop", () => {
  // Create a comprehensive mock that covers all possible exports
  const mockCSSInterop = jest.fn();
  const mockStyleSheet = {
    create: (styles) => styles,
    resolve: (styles) => styles,
    flatten: (style) =>
      Array.isArray(style)
        ? Object.assign({}, ...style.filter((s) => s))
        : style,
  };

  return {
    __esModule: true,
    default: mockCSSInterop,
    getColorScheme: jest.fn(() => "light"),
    NativeWindStyleSheet: mockStyleSheet,
    StyleSheet: mockStyleSheet,
    unstable_styled: jest.fn((Component) => Component),
    withExpoSnack: jest.fn((Component) => Component),
    useTailwindFn: jest.fn(() => jest.fn()),
    useColorScheme: jest.fn(() => "light"),
    cssInterop: jest.fn(),
    rem: jest.fn((value) => value * 16),
    vars: jest.fn(() => ({})),
    createInteropElement: jest.fn(),
    interopComponents: {},
    // Add any other exports that might be needed
    remapProps: jest.fn(),
    createRemapProps: jest.fn(),
  };
});

// Also mock the specific modules that might import getColorScheme
jest.mock("react-native-css-interop/src/runtime/web/color-scheme", () => ({
  getColorScheme: jest.fn(() => "light"),
}));

jest.mock("react-native-css-interop/src/runtime/web/api", () => ({
  getColorScheme: jest.fn(() => "light"),
}));
jest.mock("react-native-css-interop/src/runtime/api", () => ({
  getColorScheme: jest.fn(() => "light"),
}));
jest.mock("react-native-css-interop/src/runtime/wrap-jsx", () => ({
  jsx: jest.fn(),
  jsxs: jest.fn(),
  Fragment: jest.fn(),
  getColorScheme: jest.fn(() => "light"),
}));
jest.mock("react-native-css-interop/src/runtime/jsx-runtime", () => ({
  jsx: jest.fn(),
  jsxs: jest.fn(),
  Fragment: jest.fn(),
  getColorScheme: jest.fn(() => "light"),
}));

// Mock any sub-path imports
jest.mock("react-native-css-interop/dist/runtime/web/color-scheme", () => ({
  getColorScheme: jest.fn(() => "light"),
}));

// Mock React Native completely
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: jest.fn((obj) => obj.ios),
  },
  AppState: {
    currentState: "active",
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Appearance: {
    getColorScheme: jest.fn(() => "light"),
    addChangeListener: jest.fn(),
    removeChangeListener: jest.fn(),
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
    isScreenReaderEnabled: jest.fn(() => Promise.resolve(false)),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    announceForAccessibility: jest.fn(),
    setAccessibilityFocus: jest.fn(),
  },
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  Image: "Image",
  ScrollView: "ScrollView",
  Modal: "Modal",
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => {
      // Simple flatten implementation for mocking
      if (!style) return {};
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter((s) => s));
      }
      return style;
    },
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  NativeModules: {
    RNCSafeAreaContext: {
      initialWindowMetrics: {
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
        frame: { x: 0, y: 0, width: 0, height: 0 },
      },
    },
  },
  Animated: {
    Value: jest.fn(() => ({
      setValue: jest.fn(),
    })),
    View: "Animated.View",
    timing: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb()),
    })),
    parallel: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb()),
    })),
  },
}));

// Mock Firebase Auth
const mockAuthInstance = {
  currentUser: null,
  onAuthStateChanged: jest.fn((callback) => {
    // Simulate no user initially
    setTimeout(() => callback(null), 0);
    return jest.fn(); // Return unsubscribe function
  }),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  signInWithCredential: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  __setMockUser: jest.fn((user) => {
    mockAuthInstance.currentUser = user;
  }),
  __clearMockUser: jest.fn(() => {
    mockAuthInstance.currentUser = null;
  }),
};

// Expose mockAuthInstance globally for tests
global.mockAuthInstance = mockAuthInstance;

// Mock Firebase App
jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  default: () => ({
    name: "[DEFAULT]",
    options: {},
  }),
  getApp: jest.fn(() => ({
    name: "[DEFAULT]",
    options: {},
  })),
  firebase: {
    app: jest.fn(() => ({
      name: "[DEFAULT]",
      options: {},
    })),
  },
}));

jest.mock("@react-native-firebase/auth", () => {
  // Create auth function that returns mockAuthInstance
  const authFunction = () => {
    // Return the mockAuthInstance directly
    return {
      currentUser: null,
      onAuthStateChanged: jest.fn((callback) => {
        // Simulate no user initially
        setTimeout(() => callback(null), 0);
        return jest.fn(); // Return unsubscribe function
      }),
      signInWithEmailAndPassword: jest.fn(),
      createUserWithEmailAndPassword: jest.fn(),
      signOut: jest.fn(),
      signInWithCredential: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };
  };

  // Add properties to the function
  authFunction.GoogleAuthProvider = {
    credential: jest.fn((idToken) => ({
      type: "google.com",
      token: idToken,
      providerId: "google.com",
    })),
  };

  authFunction.FacebookAuthProvider = {
    credential: jest.fn((accessToken) => ({
      type: "facebook.com",
      token: accessToken,
      providerId: "facebook.com",
    })),
  };

  return {
    __esModule: true,
    default: authFunction,
  };
});

// Mock Firebase Firestore
jest.mock("@react-native-firebase/firestore", () => {
  const firestoreInstance = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() =>
          Promise.resolve({ exists: false, data: () => null })
        ),
        set: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve()),
      })),
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ empty: true, docs: [] })),
      })),
      add: jest.fn(() => Promise.resolve({ id: "mock-id" })),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ empty: true, docs: [] })),
        })),
      })),
    })),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn(() => Promise.resolve()),
    })),
    runTransaction: jest.fn((updateFunction) =>
      Promise.resolve(
        updateFunction({
          get: jest.fn(() =>
            Promise.resolve({ exists: false, data: () => null })
          ),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        })
      )
    ),
  };

  const firestoreFunction = () => firestoreInstance;

  // Add static properties
  firestoreFunction.FieldValue = {
    serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
    increment: jest.fn((n) => ({ _increment: n })),
    arrayUnion: jest.fn((...args) => ({ _arrayUnion: args })),
    arrayRemove: jest.fn((...args) => ({ _arrayRemove: args })),
  };

  firestoreFunction.Timestamp = {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromDate: jest.fn((date) => ({ toMillis: () => date.getTime() })),
  };

  return {
    __esModule: true,
    default: firestoreFunction,
  };
});

// Mock RiddleInitializationService
jest.mock("./src/services/RiddleInitializationService", () => ({
  RiddleInitializationService: {
    checkAndInitializeRiddles: jest.fn(() => Promise.resolve()),
  },
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

// Global array to track sound instances for tests
global.mockSoundInstances = [];

// Mock expo-av
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
          status: { isLoaded: true },
        });
      }),
    },
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  },
  AVPlaybackStatus: {},
}));

// Set up globals
global.__DEV__ = true;
global.__reanimatedWorkletInit = jest.fn();
global.ReanimatedDataMock = {
  now: jest.fn(),
};

// Mock react-native-svg
jest.mock("react-native-svg", () => ({
  SvgXml: "SvgXml",
  Svg: "Svg",
  Path: "Path",
  Circle: "Circle",
  Rect: "Rect",
  G: "G",
  Text: "Text",
  TSpan: "TSpan",
  TextPath: "TextPath",
  Defs: "Defs",
  LinearGradient: "LinearGradient",
  RadialGradient: "RadialGradient",
  Stop: "Stop",
  ClipPath: "ClipPath",
  Pattern: "Pattern",
  Mask: "Mask",
}));
