/* eslint-disable no-undef */
import "react-native-gesture-handler/jestSetup";

jest.mock("react-native/Libraries/TurboModule/TurboModuleRegistry", () => ({
  getEnforcing: () => {},
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

jest.mock("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          unloadAsync: jest.fn(),
          playAsync: jest.fn(),
          pauseAsync: jest.fn(),
          stopAsync: jest.fn(),
          getStatusAsync: jest.fn(() => Promise.resolve({ isLoaded: true })),
        })
      ),
    },
    setAudioModeAsync: jest.fn(),
  },
}));

jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.Dimensions.get = () => ({
    width: 375,
    height: 812,
    scale: 2,
    fontScale: 1,
  });
  return RN;
});

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
