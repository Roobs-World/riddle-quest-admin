import "@testing-library/react-native/extend-expect";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock Firebase services
// --- Helper Mocks for Firestore ---
const mockFirestoreDocumentSnapshot = (
  exists = true,
  data = { defaultMockField: "defaultDocValue" }
) => ({
  exists,
  data: () => (exists ? data : undefined),
  id: "mockDocId",
});

const mockFirestoreQuerySnapshot = (
  docs = [mockFirestoreDocumentSnapshot()]
) => ({
  empty: docs.length === 0,
  docs,
  forEach: (callback) => docs.forEach(callback),
  size: docs.length,
});

const mockFirestoreGet = jest.fn().mockImplementation((options) => {
  //This default can be overridden by specific tests using mockResolvedValueOnce etc.
  // It tries to intelligently return a doc or query snapshot based on typical usage.
  // For simplicity, let's assume most unqualified .get() calls expect a DocumentSnapshot that exists.
  // Queries (after .where() or .limit()) would also call .get(), and they expect a QuerySnapshot.
  // It's hard to distinguish here without more context, so we provide a plausible default for both.
  return Promise.resolve(
    mockFirestoreDocumentSnapshot(true, { fromGet: "default" })
  );
  // If this causes issues, a more complex mock might be needed or tests must be more specific.
});

const mockFirestoreCollectionRef = {
  doc: jest.fn().mockReturnThis(), // returns DocumentReference-like object
  where: jest.fn().mockReturnThis(), // returns Query-like object
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn(() => Promise.resolve(mockFirestoreQuerySnapshot())), // .collection(...).get()
  onSnapshot: jest.fn(() => jest.fn()), // Returns an unsubscribe function
  add: jest
    .fn()
    .mockResolvedValue(
      mockFirestoreDocumentSnapshot(true, { newlyAdded: true })
    ), // mock for .add()
};

const mockFirestoreDocumentRef = {
  collection: jest.fn(() => mockFirestoreCollectionRef), // .doc(...).collection()
  get: mockFirestoreGet, // .doc(...).get()
  set: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(() => jest.fn()), // Returns an unsubscribe function
};

// Overwrite doc to return the full DocumentReference mock
mockFirestoreCollectionRef.doc = jest.fn(() => mockFirestoreDocumentRef);

// --- End Helper Mocks for Firestore ---

jest.mock("@react-native-firebase/app", () => {
  const appMock = {
    name: "[DEFAULT]",
    options: {},
    // Add any other app instance methods you use
  };
  return {
    __esModule: true, // Ensure ES module interop
    default: {
      app: jest.fn(() => appMock),
      apps: [appMock],
      SDK_VERSION: "mockSDKVersion",
      initializeApp: jest.fn().mockReturnValue(appMock),
      // Mock the NativeModules part that often causes 'RNFBAppModule not found'
      NativeModules: {
        RNFBAppModule: {
          NATIVE_FIREBASE_APPS: JSON.stringify([
            { name: "[DEFAULT]", options: {} },
          ]), // Stringified JSON array
          FIREBASE_RAW_JSON: "{}", // Stringified JSON object for raw config
          addListener: jest.fn(),
          removeListeners: jest.fn(),
          // Add other constants/methods from RNFBAppModule if needed by other modules
        },
      },
    },
    // Also export named things if they are imported like `import { app } from ...`
    app: jest.fn(() => appMock),
    apps: [appMock],
    SDK_VERSION: "mockSDKVersion",
    initializeApp: jest.fn().mockReturnValue(appMock),
    NativeModules: {
      // Repeat NativeModules for named exports if necessary
      RNFBAppModule: {
        NATIVE_FIREBASE_APPS: JSON.stringify([
          { name: "[DEFAULT]", options: {} },
        ]),
        FIREBASE_RAW_JSON: "{}",
        addListener: jest.fn(),
        removeListeners: jest.fn(),
      },
    },
  };
});

let mockCurrentAuthUser = null; // Shared state for the mock auth user
const mockOnAuthStateChangedListeners = new Set();

jest.mock("@react-native-firebase/auth", () => {
  const mockAuthSingleton = {
    signInWithEmailAndPassword: jest
      .fn()
      .mockImplementation(async (email, password) => {
        // Simulate successful login, set user, and notify listeners
        const user = { uid: "test-uid-from-email", email };
        mockCurrentAuthUser = user;
        mockOnAuthStateChangedListeners.forEach((cb) =>
          cb(mockCurrentAuthUser)
        );
        return { user };
      }),
    createUserWithEmailAndPassword: jest
      .fn()
      .mockImplementation(async (email, password) => {
        const user = { uid: "new-user-uid", email };
        mockCurrentAuthUser = user;
        mockOnAuthStateChangedListeners.forEach((cb) =>
          cb(mockCurrentAuthUser)
        );
        return { user };
      }),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    signInWithCredential: jest.fn().mockImplementation(async (credential) => {
      // Simulate successful login with credential
      const user = { uid: "cred-user-uid", email: "cred@example.com" };
      mockCurrentAuthUser = user;
      mockOnAuthStateChangedListeners.forEach((cb) => cb(mockCurrentAuthUser));
      return { user };
    }),
    signOut: jest.fn().mockImplementation(async () => {
      mockCurrentAuthUser = null;
      mockOnAuthStateChangedListeners.forEach((cb) => cb(mockCurrentAuthUser));
      return Promise.resolve(undefined);
    }),
    onAuthStateChanged: jest.fn((callback) => {
      if (typeof callback === "function") {
        mockOnAuthStateChangedListeners.add(callback);
        // Simulate initial call with current state
        Promise.resolve().then(() => callback(mockCurrentAuthUser));
      }
      return () => {
        mockOnAuthStateChangedListeners.delete(callback);
      }; // Returns an unsubscribe function
    }),
    get currentUser() {
      return mockCurrentAuthUser;
    },
    // Test helpers to manipulate the mock state from tests
    __setMockUser: (user) => {
      mockCurrentAuthUser = user;
      // Manually trigger listeners if needed for immediate effect in tests,
      // or rely on onAuthStateChanged initial call / subsequent events
      mockOnAuthStateChangedListeners.forEach((cb) => cb(mockCurrentAuthUser));
    },
    __clearMockUser: () => {
      mockCurrentAuthUser = null;
      mockOnAuthStateChangedListeners.forEach((cb) => cb(mockCurrentAuthUser));
    },
    // Add other methods as needed by your services or components
  };

  // The factory function for the module
  const mockAuthModule = () => mockAuthSingleton; // This is for auth()

  // Add static properties like GoogleAuthProvider to the module itself
  mockAuthModule.GoogleAuthProvider = {
    credential: jest
      .fn()
      .mockReturnValue({ type: "google.com-mock-credential" }),
    PROVIDER_ID: "google.com", // Add other static props if needed
  };
  mockAuthModule.FacebookAuthProvider = {
    credential: jest
      .fn()
      .mockReturnValue({ type: "facebook.com-mock-credential" }),
    PROVIDER_ID: "facebook.com",
  };
  // Add any other static providers if used (e.g., AppleAuthProvider)

  return mockAuthModule;
});

jest.mock("@react-native-firebase/firestore", () => {
  // Return a function that returns the top-level Firestore instance mock
  return () => ({
    collection: jest.fn(() => mockFirestoreCollectionRef),
    doc: jest.fn(() => mockFirestoreDocumentRef),
    // Add any other top-level Firestore methods if used directly, e.g., batch, runTransaction
    // For now, assume most interactions start with .collection() or .doc()
    batch: jest.fn(() => ({
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      commit: jest.fn().mockResolvedValue(undefined),
    })),
    runTransaction: jest.fn(async (updateFunction) => {
      // A basic mock for transactions: execute the updateFunction with a mock transaction object
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(mockFirestoreDocumentSnapshot()), // Mock transaction.get
        set: jest.fn(), // Mock transaction.set
        update: jest.fn(), // Mock transaction.update
        delete: jest.fn(), // Mock transaction.delete
      };
      // warning: this is a simplified transaction mock and may not cover all scenarios
      await updateFunction(mockTransaction);
      return Promise.resolve(); // Transactions usually return a Promise for the result of the update function
    }),
    settings: jest.fn(), // Mock for firestore().settings()
  });
});

jest.mock("@react-native-firebase/functions", () => {
  return () => ({
    httpsCallable: jest.fn((functionName) => {
      // Return a mock function that simulates a callable Cloud Function
      return jest.fn().mockImplementation(async (data) => {
        // console.log(`Mocked Cloud Function '${functionName}' called with:`, data);
        // Default successful response, can be overridden in specific tests
        if (functionName === "submitGuess") {
          return {
            data: {
              feedback: [], // Empty array is fine by schema
              isCorrect: false, // Default value, satisfies schema
              // newStats: {}, // Not in SubmitGuessOutputSchema, remove or make optional if kept
              coinsEarned: 0, // Optional, fine
              // message: "Mock success", // Not in SubmitGuessOutputSchema
            },
          };
        }
        if (functionName === "validatePurchase") {
          return { data: { success: true, newCoins: 100 } };
        }
        if (functionName === "generateClassicRiddles") {
          return { data: { success: true, newRiddlesAdded: 1 } };
        }
        return { data: { success: true } }; // Generic success
      });
    }),
    // Add other Firebase Functions mocks if necessary
  });
});

jest.mock("@react-native-firebase/storage", () => {
  // This is the original storage mock, ensure it's correct and not mixed with Firestore.
  const mockStorageRef = {
    child: jest.fn().mockReturnThis(),
    putFile: jest.fn(() =>
      Promise.resolve({ metadata: { fullPath: "mock/path.jpg" } })
    ),
    getDownloadURL: jest.fn(() =>
      Promise.resolve("https://mockurl.com/image.jpg")
    ),
    delete: jest.fn(() => Promise.resolve()),
    // listAll, etc. if needed
  };
  return () => ({
    ref: jest.fn((path) => mockStorageRef), // ref() should return the mockStorageRef
    // Add other top-level storage methods if used, e.g. setMaxUploadRetryTime
  });
});

// Mock React Navigation

// First, mock the specific navigators and hooks used
jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: ({ children }) => children,
    Screen: ({ children }) => children,
  })),
}));

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native");
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      dispatch: jest.fn(),
      setOptions: jest.fn(),
      // Add any other navigation methods you use
    }),
    useRoute: () => ({
      params: {},
      // Add other route properties you use
    }),
    NavigationContainer: ({ children }) => children, // Simplistic mock
  };
});

// Mock NativeWind's styled HOC if it causes issues in tests
// (usually not needed if transforms are set up correctly, but good to have as an option)
// jest.mock('nativewind', () => ({
//   styled: (Component) => Component, // Pass-through mock
// }));

// Mock react-native-haptic-feedback
jest.mock("react-native-haptic-feedback", () => ({
  trigger: jest.fn(),
}));

// Mock expo-av for SoundManager
jest.mock("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn().mockResolvedValue(undefined),
          stopAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
          setOnPlaybackStatusUpdate: jest.fn(),
          getStatusAsync: jest.fn().mockResolvedValue({
            isLoaded: true,
            durationMillis: 1000,
            positionMillis: 0,
          }),
        },
        status: {
          /* mock status object */
        },
      }),
      // You might need to mock other static methods of Audio.Sound if used
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined), // Mock if used
  },
}));

// Mock react-native-image-picker
jest.mock("react-native-image-picker", () => ({
  launchImageLibrary: jest.fn().mockResolvedValue({
    didCancel: false,
    assets: [
      {
        uri: "file:///mock/image.jpg",
        type: "image/jpeg",
        fileName: "mock.jpg",
      },
    ],
  }),
  launchCamera: jest.fn().mockResolvedValue({
    didCancel: false,
    assets: [
      {
        uri: "file:///mock/camera_image.jpg",
        type: "image/jpeg",
        fileName: "camera_mock.jpg",
      },
    ],
  }),
}));

// Mock @react-native-google-signin/google-signin
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      idToken: "mock-google-id-token",
      user: { email: "googleuser@example.com" },
    }),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
    SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
  },
}));

// Mock react-native-fbsdk-next
jest.mock("react-native-fbsdk-next", () => ({
  LoginManager: {
    logInWithPermissions: jest.fn().mockResolvedValue({
      isCancelled: false,
      grantedPermissions: ["public_profile", "email"],
    }),
    logOut: jest.fn(),
  },
  AccessToken: {
    getCurrentAccessToken: jest.fn().mockResolvedValue({
      accessToken: "mock-fb-access-token",
    }),
  },
  GraphRequest: jest.fn((path, config, callback) => {
    // Simulate a graph request callback with mock user data
    if (path === "/me" && callback) {
      callback(null, {
        id: "fb-user-id",
        email: "fbuser@example.com",
        name: "FB User",
      });
    }
  }),
  GraphRequestManager: jest.fn(() => ({
    addRequest: jest.fn().mockReturnThis(),
    start: jest.fn(),
  })),
}));

// Mock react-native-applovin-max
jest.mock("react-native-applovin-max", () => ({
  initialize: jest.fn().mockResolvedValue(undefined),
  InterstitialAd: jest.fn(() => ({
    loadAd: jest.fn(),
    isAdReady: jest.fn(() => false),
    showAd: jest.fn(),
    addAdLoadedEventListener: jest.fn(),
    addAdLoadFailedEventListener: jest.fn(),
    addAdDisplayFailedEventListener: jest.fn(),
    addAdClickedEventListener: jest.fn(),
    addAdHiddenEventListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
  RewardedAd: jest.fn(() => ({
    loadAd: jest.fn(),
    isAdReady: jest.fn(() => false),
    showAd: jest.fn(),
    addAdLoadedEventListener: jest.fn(),
    addAdLoadFailedEventListener: jest.fn(),
    addAdDisplayFailedEventListener: jest.fn(),
    addAdClickedEventListener: jest.fn(),
    addAdHiddenEventListener: jest.fn(),
    addAdRewardEventListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  isInitialized: jest.fn(() => true),
  showMediationDebugger: jest.fn(),
  setVerboseLogging: jest.fn(),
  setMuted: jest.fn(),
}));

// Mock for react-native-iap
// ... existing code ...

console.log(
  "jest.setup.js loaded with corrected Firestore, Storage, and Auth mocks (listener prefixed)"
);
