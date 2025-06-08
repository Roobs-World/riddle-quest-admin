import "react-native-gesture-handler/jestSetup";

// Mock React Native modules
/*
COMMENTING OUT GLOBAL REANIMATED MOCK TO ALLOW TEST-SPECIFIC MOCKS
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react"); // Keep this if your mock uses React.createElement

  // Mock for Animated.View and other Animated components if needed
  const MockAnimatedComponent = (componentName) => {
    return ({ testID, style, children, ...restProps }) => {
      // Directly use React.createElement to avoid issues with JSX in a .js file if not transpiled for this context
      return React.createElement(
        componentName, // Typically "View", "Text", etc.
        { testID, style, ...restProps },
        children
      );
    };
  };

  return {
    __esModule: true,
    // Animated components
    Animated: {
      View: MockAnimatedComponent("View"),
      Text: MockAnimatedComponent("Text"),
      ScrollView: MockAnimatedComponent("ScrollView"),
      // Add other animated components if used by the app
    },

    // Hooks
    useSharedValue: jest.fn((initialValue) => {
      console.log(
        "!!!!!! [GLOBAL MOCK JEST.SETUP.JS] useSharedValue CALLED - DIRECT EXPORT !!!!!! Initial:",
        initialValue
      );
      throw new Error(
        "!!!!!! CRASH TEST: GLOBAL useSharedValue (DIRECT) WAS CALLED !!!!!!"
      );
      // return { value: initialValue };
    }),
    useAnimatedStyle: jest.fn((styleUpdater) => {
      // Attempt to execute the style updater to catch immediate errors
      // and return a basic style object.
      try {
        if (typeof styleUpdater === "function") {
          return styleUpdater();
        }
        return {}; // Default if not a function (though it should be)
      } catch (e) {
        // console.error("Error in mock useAnimatedStyle:", e);
        return {}; // Fallback in case of error during style update
      }
    }),
    useDerivedValue: jest.fn((processor) => ({ value: processor() })), // Simplified: execute processor once
    useAnimatedScrollHandler: jest.fn(() => jest.fn()), // Returns a mock event handler
    useAnimatedGestureHandler: jest.fn(() => jest.fn()), // Returns a mock event handler
    useAnimatedRef: jest.fn(() => ({ current: null })),

    // Animation functions
    withTiming: jest.fn((toValue, config, callback) => {
      // Immediately invoke callback if it's a function, simulating animation end
      if (typeof callback === "function") {
        callback({ finished: true });
      }
      return toValue; // Returns the target value directly
    }),
    withSpring: jest.fn((toValue, config, callback) => {
      if (typeof callback === "function") {
        callback({ finished: true });
      }
      return toValue;
    }),
    withDecay: jest.fn((config, callback) => {
      if (typeof callback === "function") {
        callback({ finished: true });
      }
      return 0; // Return a sensible default value for decay
    }),
    withRepeat: jest.fn((animation, numberOfReps, reverse, callback) => {
      if (typeof callback === "function") {
        callback({ finished: true });
      }
      // For simplicity, return the initial state of the animation or a mocked value.
      // This might need to be more sophisticated if the actual animated value is inspected.
      if (
        typeof animation === "object" &&
        animation !== null &&
        "value" in animation
      ) {
        return animation.value;
      }
      return animation; // Or just return the animation itself if it's a value
    }),
    cancelAnimation: jest.fn(),
    delay: jest.fn((delayMs, animation) => animation), // Returns the animation itself
    sequence: jest.fn((...animations) => animations[animations.length - 1]), // Returns the last animation's value
    parallel: jest.fn((...animations) =>
      animations.map((anim) =>
        typeof anim === "object" && anim.value !== undefined ? anim.value : anim
      )
    ),

    // Worklet utilities
    runOnJS: jest.fn(
      (fn) =>
        (...args) =>
          fn(...args)
    ), // Ensures the JS function can be called
    runOnUI: jest.fn((fn) => (...args) => {
      // In tests, runOnUI can often just execute the function immediately.
      // If the function is then calling runOnJS, that will also execute.
      try {
        return fn(...args);
      } catch (e) {
        // console.error("Error in mock runOnUI:", e);
        // Depending on what fn is, you might need to return a specific structure
      }
    }),

    // Interpolation and Extrapolation
    interpolate: jest.fn((value, inputRange, outputRange, extrapolate) => {
      // Simplified mock: return the first or last output value based on the input value
      // This is a very basic mock and might not cover all edge cases.
      if (value <= inputRange[0]) {
        if (extrapolate === "clamp") return outputRange[0];
        // Handle other extrapolate options if necessary, or default to outputRange[0]
        return outputRange[0];
      }
      if (value >= inputRange[inputRange.length - 1]) {
        if (extrapolate === "clamp") return outputRange[outputRange.length - 1];
        return outputRange[outputRange.length - 1];
      }
      // For simplicity, just return the first output value if in range
      return outputRange[0];
    }),
    Extrapolate: {
      EXTEND: "extend",
      CLAMP: "clamp",
      IDENTITY: "identity",
    },

    // Easing functions
    Easing: {
      // Common easing functions - returning a simple identity function for tests
      linear: (t) => t,
      quad: (t) => t * t,
      cubic: (t) => t * t * t,
      poly: (n) => (t) => Math.pow(t, n),
      sin: (t) => 1 - Math.cos((t * Math.PI) / 2),
      circle: (t) => 1 - Math.sqrt(1 - t * t),
      exp: (t) => Math.pow(2, 10 * (t - 1)),
      elastic:
        (bounciness = 1) =>
        (t) => {
          // Simplified elastic easing
          if (t === 0 || t === 1) return t;
          return (
            Math.pow(2, -10 * t) *
              Math.sin(((t - 0.075) * (2 * Math.PI)) / 0.3) +
            1
          );
        },
      bounce: (t) => {
        // Simplified bounce easing
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      },
      bezier: jest.fn().mockImplementation(() => ({ factory: () => (t) => t })), // Returns an identity function
      in: (easing) => easing, // Pass through for chained easings
      out: (easing) => easing, // Pass through
      inOut: (easing) => easing, // Pass through
    },

    // Other utilities that might be called
    measure: jest.fn(() => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      pageX: 0,
      pageY: 0,
    })),
    setGestureState: jest.fn(), // From reanimated 1, might not be in v2/v3 but mock just in case

    // For Reanimated 2/3, .default.call is not typically needed for the core mock
    // If specific errors point to it, it might be related to Gesture Handler interaction.
    // Default export might be needed if some part of the code does `import Reanimated from 'react-native-reanimated'`
    // and then `Reanimated.someFunction()`
    default: {
      // Re-exporting the same mocks under default if needed
      useSharedValue: jest.fn((initialValue) => {
        console.log(
          "!!!!!! [GLOBAL MOCK JEST.SETUP.JS] useSharedValue CALLED - DEFAULT EXPORT !!!!!! Initial:",
          initialValue
        );
        throw new Error(
          "!!!!!! CRASH TEST: GLOBAL useSharedValue (DEFAULT) WAS CALLED !!!!!!"
        );
        // return { value: initialValue };
      }),
      useAnimatedStyle: jest.fn((styleUpdater) => {
        try {
          if (typeof styleUpdater === "function") {
            return styleUpdater();
          }
          return {};
        } catch (e) {
          return {};
        }
      }),
      withTiming: jest.fn((toValue, config, callback) => {
        if (typeof callback === "function") {
          callback({ finished: true });
        }
        return toValue;
      }),
      // Add other key exports to default if necessary
    },
  };
});
*/

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
