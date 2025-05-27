// NOTE: Removed @testing-library/react-native/extend-expect import
// since we're using custom Jest config with jsdom environment

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", function () {
  return {};
}); // Simplified mock

// Mock Firebase services
jest.mock("@react-native-firebase/app", function () {
  var appMock = {
    name: "[DEFAULT]",
    options: {},
  };
  return {
    __esModule: true,
    default: {
      app: jest.fn(function () {
        return appMock;
      }),
      apps: [appMock],
      SDK_VERSION: "mockSDKVersion",
      initializeApp: jest.fn().mockReturnValue(appMock),
      NativeModules: {
        RNFBAppModule: {
          NATIVE_FIREBASE_APPS: JSON.stringify([
            { name: "[DEFAULT]", options: {} },
          ]),
          FIREBASE_RAW_JSON: "{}",
          addListener: jest.fn(),
          removeListeners: jest.fn(),
        },
      },
    },
    app: jest.fn(function () {
      return appMock;
    }),
    apps: [appMock],
    SDK_VERSION: "mockSDKVersion",
    initializeApp: jest.fn().mockReturnValue(appMock),
    NativeModules: {
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

var mockCurrentAuthUser = null;
var mockOnAuthStateChangedListeners = new Set();

jest.mock("@react-native-firebase/auth", function () {
  var mockAuthSingleton = {
    signInWithEmailAndPassword: jest
      .fn()
      .mockImplementation(function (email, password) {
        return Promise.resolve().then(function () {
          var user = { uid: "test-uid-from-email", email: email };
          mockCurrentAuthUser = user;
          mockOnAuthStateChangedListeners.forEach(function (cb) {
            cb(mockCurrentAuthUser);
          });
          return { user: user };
        });
      }),
    createUserWithEmailAndPassword: jest
      .fn()
      .mockImplementation(function (email, password) {
        return Promise.resolve().then(function () {
          var user = { uid: "new-user-uid", email: email };
          mockCurrentAuthUser = user;
          mockOnAuthStateChangedListeners.forEach(function (cb) {
            cb(mockCurrentAuthUser);
          });
          return { user: user };
        });
      }),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    signInWithCredential: jest.fn().mockImplementation(function (credential) {
      return Promise.resolve().then(function () {
        var user = { uid: "cred-user-uid", email: "cred@example.com" };
        mockCurrentAuthUser = user;
        mockOnAuthStateChangedListeners.forEach(function (cb) {
          cb(mockCurrentAuthUser);
        });
        return { user: user };
      });
    }),
    signOut: jest.fn().mockImplementation(function () {
      mockCurrentAuthUser = null;
      mockOnAuthStateChangedListeners.forEach(function (cb) {
        cb(mockCurrentAuthUser);
      });
      return Promise.resolve(undefined);
    }),
    onAuthStateChanged: jest.fn(function (callback) {
      if (typeof callback === "function") {
        mockOnAuthStateChangedListeners.add(callback);
        Promise.resolve().then(function () {
          callback(mockCurrentAuthUser);
        });
      }
      return function () {
        mockOnAuthStateChangedListeners.delete(callback);
      };
    }),
    get currentUser() {
      return mockCurrentAuthUser;
    },
    __setMockUser: function (user) {
      mockCurrentAuthUser = user;
      mockOnAuthStateChangedListeners.forEach(function (cb) {
        cb(mockCurrentAuthUser);
      });
    },
    __clearMockUser: function () {
      mockCurrentAuthUser = null;
      mockOnAuthStateChangedListeners.forEach(function (cb) {
        cb(mockCurrentAuthUser);
      });
    },
  };

  var mockAuthModule = function () {
    return mockAuthSingleton;
  };

  mockAuthModule.GoogleAuthProvider = {
    credential: jest
      .fn()
      .mockReturnValue({ type: "google.com-mock-credential" }),
    PROVIDER_ID: "google.com",
  };
  mockAuthModule.FacebookAuthProvider = {
    credential: jest
      .fn()
      .mockReturnValue({ type: "facebook.com-mock-credential" }),
    PROVIDER_ID: "facebook.com",
  };

  return mockAuthModule;
});

jest.mock("@react-native-firebase/firestore", function () {
  // --- Helper Mocks for Firestore ---
  function createMockFirestoreDocumentSnapshot(exists, data) {
    if (exists === undefined) exists = true;
    if (data === undefined) data = { defaultMockField: "defaultDocValue" };

    return {
      exists: exists,
      data: function () {
        return exists ? data : undefined;
      },
      id: "mockDocId",
    };
  }

  function createMockFirestoreQuerySnapshot(docs) {
    if (docs === undefined) docs = [createMockFirestoreDocumentSnapshot()];

    return {
      empty: docs.length === 0,
      docs: docs,
      forEach: function (callback) {
        docs.forEach(callback);
      },
      size: docs.length,
    };
  }

  var mockFirestoreGet = jest.fn().mockImplementation(function (options) {
    return Promise.resolve(
      createMockFirestoreDocumentSnapshot(true, { fromGet: "default" })
    );
  });

  var mockFirestoreCollectionRef = {
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn(function () {
      return Promise.resolve(createMockFirestoreQuerySnapshot());
    }),
    onSnapshot: jest.fn(function () {
      return jest.fn();
    }),
    add: jest
      .fn()
      .mockResolvedValue(
        createMockFirestoreDocumentSnapshot(true, { newlyAdded: true })
      ),
  };

  var mockFirestoreDocumentRef = {
    collection: jest.fn(function () {
      return mockFirestoreCollectionRef;
    }),
    get: mockFirestoreGet,
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    onSnapshot: jest.fn(function () {
      return jest.fn();
    }),
  };

  // Overwrite doc to return the full DocumentReference mock
  mockFirestoreCollectionRef.doc = jest.fn(function () {
    return mockFirestoreDocumentRef;
  });

  // --- End Helper Mocks for Firestore ---

  return function () {
    return {
      collection: jest.fn(function () {
        return mockFirestoreCollectionRef;
      }),
      doc: jest.fn(function () {
        return mockFirestoreDocumentRef;
      }),
      batch: jest.fn(function () {
        return {
          set: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
          commit: jest.fn().mockResolvedValue(undefined),
        };
      }),
      runTransaction: jest.fn(function (updateFunction) {
        return Promise.resolve()
          .then(function () {
            var mockTransaction = {
              get: jest
                .fn()
                .mockResolvedValue(createMockFirestoreDocumentSnapshot()),
              set: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            };
            return updateFunction(mockTransaction);
          })
          .then(function () {
            return undefined; // Transactions typically return undefined on success
          })
          .catch(function (error) {
            throw error;
          });
      }),
      FieldValue: {
        increment: jest.fn(function (value) {
          return value;
        }),
        serverTimestamp: jest.fn(function () {
          return "mockServerTimestamp";
        }),
        arrayUnion: jest.fn(function () {
          for (
            var _len = arguments.length, elements = new Array(_len), _key = 0;
            _key < _len;
            _key++
          ) {
            elements[_key] = arguments[_key];
          }
          return elements;
        }),
        arrayRemove: jest.fn(function () {
          for (
            var _len2 = arguments.length,
              elements = new Array(_len2),
              _key2 = 0;
            _key2 < _len2;
            _key2++
          ) {
            elements[_key2] = arguments[_key2];
          }
          return elements;
        }),
        delete: jest.fn(function () {
          return "mockDeleteFieldValue";
        }),
      },
      Filter: {
        where: jest.fn(function (fieldPath, opStr, value) {
          return { fieldPath: fieldPath, opStr: opStr, value: value };
        }),
      },
      mockCollection: function (collectionPath) {
        return mockFirestoreCollectionRef;
      },
      mockDocument: function (documentPath) {
        return mockFirestoreDocumentRef;
      },
      mockGet: mockFirestoreGet,
      mockQuerySnapshot: createMockFirestoreQuerySnapshot,
      mockDocumentSnapshot: createMockFirestoreDocumentSnapshot,
    };
  };
});

jest.mock("@react-native-firebase/functions", function () {
  return function () {
    return {
      httpsCallable: jest.fn(function (functionName) {
        return jest.fn().mockImplementation(function (data) {
          return Promise.resolve().then(function () {
            if (functionName === "submitGuess") {
              return {
                data: {
                  feedback: [],
                  isCorrect: false,
                  coinsEarned: 0,
                },
              };
            }
            if (functionName === "validatePurchase") {
              return { data: { success: true, newCoins: 100 } };
            }
            if (functionName === "generateClassicRiddles") {
              return { data: { success: true, newRiddlesAdded: 1 } };
            }
            return { data: { success: true } };
          });
        });
      }),
    };
  };
});

jest.mock("@react-native-firebase/storage", function () {
  var mockStorageRef = {
    child: jest.fn().mockReturnThis(),
    putFile: jest.fn(function () {
      return Promise.resolve({ metadata: { fullPath: "mock/path.jpg" } });
    }),
    getDownloadURL: jest.fn(function () {
      return Promise.resolve("https://mockurl.com/image.jpg");
    }),
    delete: jest.fn(function () {
      return Promise.resolve();
    }),
  };
  return function () {
    return {
      ref: jest.fn(function (path) {
        return mockStorageRef;
      }),
    };
  };
});

// Mock React Navigation

// First, mock the specific navigators and hooks used
jest.mock("@react-navigation/native-stack", function () {
  return {
    createNativeStackNavigator: jest.fn(function () {
      return {
        Navigator: function (props) {
          return props.children;
        },
        Screen: function (props) {
          return props.children;
        },
      };
    }),
  };
});

jest.mock("@react-navigation/native", function () {
  var actualNav = jest.requireActual("@react-navigation/native");
  return Object.assign({}, actualNav, {
    useNavigation: function () {
      return {
        navigate: jest.fn(),
        goBack: jest.fn(),
        dispatch: jest.fn(),
        setOptions: jest.fn(),
      };
    },
    useRoute: function () {
      return {
        params: {},
      };
    },
    NavigationContainer: function (props) {
      return props.children;
    },
  });
});

// Mock NativeWind's styled HOC if it causes issues in tests
// (usually not needed if transforms are set up correctly, but good to have as an option)
// jest.mock('nativewind', () => ({
//   styled: (Component) => Component, // Pass-through mock
// }));

// Mock React Native modules potentially used by React Navigation
jest.mock("react-native", function () {
  var reactNative = jest.requireActual("react-native");
  return Object.defineProperty(reactNative, "NativeModules", {
    enumerable: true,
    get: function () {
      var nativeModules = {};
      for (var key in reactNative.NativeModules) {
        if (
          Object.prototype.hasOwnProperty.call(reactNative.NativeModules, key)
        ) {
          nativeModules[key] = reactNative.NativeModules[key];
        }
      }

      // Add specific mocks
      nativeModules.UIManager = {
        getViewManagerConfig: jest.fn(function () {
          return {};
        }),
      };
      nativeModules.RNGestureHandlerModule = {
        attachGestureHandler: jest.fn(),
        createGestureHandler: jest.fn(),
        dropGestureHandler: jest.fn(),
        updateGestureHandler: jest.fn(),
        State: {
          UNDETERMINED: 0,
          BEGAN: 2,
          ACTIVE: 4,
          END: 5,
          FAILED: 1,
          CANCELLED: 3,
        },
        Directions: { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 },
      };
      nativeModules.PlatformConstants = {
        forceTouchAvailable: false,
      };
      nativeModules.RNPermissions = {
        checkPermission: jest.fn(),
        requestPermission: jest.fn(),
        checkMultiplePermissions: jest.fn(),
        requestMultiplePermissions: jest.fn(),
      };
      nativeModules.RNCNetInfo = {
        getCurrentState: jest
          .fn()
          .mockResolvedValue({ type: "wifi", isConnected: true }),
        addListener: jest.fn(),
        removeListeners: jest.fn(),
      };
      nativeModules.LottieAnimationView = {
        play: jest.fn(),
        reset: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        setSpeed: jest.fn(),
        setProgress: jest.fn(),
        setLoop: jest.fn(),
        setSourceDotlottie: jest.fn(),
        setSourceURL: jest.fn(),
        setSourceDir: jest.fn(),
        setSourceName: jest.fn(),
        cancelAnimation: jest.fn(),
        getConstants: jest.fn(function () {
          return {};
        }),
      };

      return nativeModules;
    },
  });
});

// Mock react-native-safe-area-context
jest.mock("react-native-safe-area-context", function () {
  var inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    __esModule: true,
    SafeAreaProvider: function (_ref) {
      var children = _ref.children;
      return children;
    },
    SafeAreaView: function (_ref2) {
      var children = _ref2.children;
      return children;
    },
    useSafeAreaInsets: function () {
      return inset;
    },
    useSafeAreaFrame: function () {
      return { x: 0, y: 0, width: 320, height: 640 };
    },
    withSafeAreaInsets: function (Component) {
      return function (props) {
        var combinedProps = Object.assign({}, props, { insets: inset });
        return Component(combinedProps);
      };
    },
  };
});

// Mock react-native-haptic-feedback
jest.mock("react-native-haptic-feedback", function () {
  return {
    __esModule: true,
    default: {
      trigger: jest.fn(),
      isSupported: jest.fn().mockResolvedValue(true),
    },
  };
});

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/MaterialCommunityIcons", function () {
  return "MaterialCommunityIcons"; // Mocked component name
});
jest.mock("react-native-vector-icons/MaterialIcons", function () {
  return "MaterialIcons"; // Mocked component name
});
jest.mock("react-native-vector-icons/FontAwesome5", function () {
  return "FontAwesome5"; // Mocked component name
});

// Mock react-native-reanimated
jest.mock("react-native-reanimated", function () {
  var Reanimated = jest.requireActual("react-native-reanimated");
  return {
    ...Object.assign({}, Reanimated),
    useSharedValue: jest.fn(Reanimated.useSharedValue),
    useAnimatedStyle: jest.fn(Reanimated.useAnimatedStyle),
    withTiming: jest.fn(Reanimated.withTiming),
    withSpring: jest.fn(Reanimated.withSpring),
    runOnUI: jest.fn(function (fn) {
      return fn;
    }),
    createAnimatedPropAdapter: jest.fn().mockImplementation(function (adapter) {
      return adapter;
    }),
  };
});

// Mock expo-av
jest.mock("expo-av", function () {
  return {
    __esModule: true,
    Audio: {
      Sound: jest.fn(function () {
        return {
          loadAsync: jest.fn().mockResolvedValue({}),
          playAsync: jest.fn().mockResolvedValue({}),
          pauseAsync: jest.fn().mockResolvedValue({}),
          stopAsync: jest.fn().mockResolvedValue({}),
          unloadAsync: jest.fn().mockResolvedValue({}),
          getStatusAsync: jest
            .fn()
            .mockResolvedValue({ isLoaded: true, isPlaying: false }),
          setOnPlaybackStatusUpdate: jest.fn(),
        };
      }),
    },
  };
});

// Mock zustand
jest.mock("zustand", function () {
  return function (creator) {
    var store = creator(function () {});
    return function () {
      return store;
    };
  };
});

// Mock react-native-gesture-handler
jest.mock("react-native-gesture-handler", function () {
  var View = jest.requireActual("react-native").View;
  return {
    __esModule: true,
    GestureHandlerRootView: View,
    // Add other mocks as needed for specific handlers
    TapGestureHandler: "TapGestureHandler",
    State: {
      UNDETERMINED: 0,
      BEGAN: 2,
      ACTIVE: 4,
      END: 5,
      FAILED: 1,
      CANCELLED: 3,
    },
    Directions: { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 },
  };
});

// Mock react-native-code-push
jest.mock("react-native-code-push", function () {
  return {
    __esModule: true,
    default: jest.fn(function () {
      return function (App) {
        return App;
      };
    }),
    CheckFrequency: { ON_APP_START: 0, EACH_APP_RESUME: 1, MANUAL: 2 },
    InstallMode: { IMMEDIATE: 0, ON_NEXT_RESTART: 1, ON_NEXT_RESUME: 2 },
    SyncStatus: {
      UP_TO_DATE: 0,
      UPDATE_INSTALLED: 1,
      UPDATE_AVAILABLE: 2,
      SYNC_IN_PROGRESS: 3,
      CHECKING_FOR_UPDATE: 4,
      AWAITING_USER_ACTION: 5,
      DOWNLOADING_PACKAGE: 6,
      INSTALLING_UPDATE: 7,
    },
    DeploymentKey: "mock-deployment-key",
  };
});

// Mock react-native-iap
jest.mock("react-native-iap", function () {
  return {
    initConnection: jest.fn().mockResolvedValue(true),
    endConnection: jest.fn().mockResolvedValue(true),
    getProducts: jest.fn().mockResolvedValue([]),
    getSubscriptions: jest.fn().mockResolvedValue([]),
    getAvailablePurchases: jest.fn().mockResolvedValue([]),
    getPurchaseHistory: jest.fn().mockResolvedValue([]),
    consumePurchase: jest.fn().mockResolvedValue(true),
    requestSubscription: jest.fn().mockResolvedValue({}),
    requestPurchase: jest.fn().mockResolvedValue({}),
    RNIap: {
      buyProduct: jest.fn().mockResolvedValue({}),
      buySubscription: jest.fn().mockResolvedValue({}),
      consumeProduct: jest.fn().mockResolvedValue({}),
      getProducts: jest.fn().mockResolvedValue([]),
      getSubscriptions: jest.fn().mockResolvedValue([]),
      getPurchaseHistory: jest.fn().mockResolvedValue([]),
      getAvailablePurchases: jest.fn().mockResolvedValue([]),
      syncPurchases: jest.fn().mockResolvedValue({}),
      initConnection: jest.fn().mockResolvedValue({}),
      endConnection: jest.fn().mockResolvedValue({}),
      clearProducts: jest.fn().mockResolvedValue({}),
      clearTransaction: jest.fn().mockResolvedValue({}),
      // Add any other methods you use from RNIap
    },
    PurchaseError: {
      ASYNC_EXECUTION_ERROR: "ASYNC_EXECUTION_ERROR",
      E_AD_METHOD_NOT_AVAILABLE: "E_AD_METHOD_NOT_AVAILABLE",
      E_ALREADY_OWNED: "E_ALREADY_OWNED",
      E_DEVELOPER_ERROR: "E_DEVELOPER_ERROR",
      E_ITEM_UNAVAILABLE: "E_ITEM_UNAVAILABLE",
      E_NETWORK_ERROR: "E_NETWORK_ERROR",
      E_PLAY_STORE_ERROR: "E_PLAY_STORE_ERROR",
      E_SERVICE_ERROR: "E_SERVICE_ERROR",
      E_UNKNOWN: "E_UNKNOWN",
      E_USER_CANCELLED: "E_USER_CANCELLED",
    },
    // Add any other exports you use from react-native-iap
  };
});

// Mock react-native-device-info
jest.mock("react-native-device-info", function () {
  return {
    __esModule: true,
    default: {
      getUniqueId: jest.fn().mockResolvedValue("mock-device-id"),
      getDeviceId: jest.fn().mockResolvedValue("mock-device-id"),
      getManufacturer: jest.fn().mockResolvedValue("mock-manufacturer"),
      getModel: jest.fn().mockResolvedValue("mock-model"),
      getSystemName: jest.fn().mockResolvedValue("mock-system-name"),
      getSystemVersion: jest.fn().mockResolvedValue("mock-system-version"),
      getBundleId: jest.fn().mockResolvedValue("mock-bundle-id"),
      getApplicationName: jest.fn().mockResolvedValue("mock-app-name"),
      getVersion: jest.fn().mockResolvedValue("mock-version"),
      getReadableVersion: jest.fn().mockResolvedValue("mock-readable-version"),
      getBuildNumber: jest.fn().mockResolvedValue("mock-build-number"),
      getDeviceName: jest.fn().mockResolvedValue("mock-device-name"),
      getCarrier: jest.fn().mockResolvedValue("mock-carrier"),
      getTimezone: jest.fn().mockResolvedValue("mock-timezone"),
      getInstanceId: jest.fn().mockResolvedValue("mock-instance-id"),
      getInstallReferrer: jest.fn().mockResolvedValue("mock-install-referrer"),
      isEmulator: jest.fn().mockResolvedValue(false),
      isTablet: jest.fn().mockResolvedValue(false),
      getFontScale: jest.fn().mockResolvedValue(1),
      hasNotch: jest.fn().mockResolvedValue(false),
      getFirstInstallTime: jest.fn().mockResolvedValue(Date.now()),
      getLastUpdateTime: jest.fn().mockResolvedValue(Date.now()),
      getSerialNumber: jest.fn().mockResolvedValue("mock-serial-number"),
      getAPILevel: jest.fn().mockResolvedValue(30),
      getBaseOs: jest.fn().mockResolvedValue("mock-base-os"),
      getPreviewSdkInt: jest.fn().mockResolvedValue(30),
      getSecurityPatch: jest.fn().mockResolvedValue("mock-security-patch"),
      getTags: jest.fn().mockResolvedValue("mock-tags"),
      getType: jest.fn().mockResolvedValue("mock-type"),
      getFingerprint: jest.fn().mockResolvedValue("mock-fingerprint"),
      getBrand: jest.fn().mockResolvedValue("mock-brand"),
      getSystemAvailableFeatures: jest.fn().mockResolvedValue([]),
      getIncremental: jest.fn().mockResolvedValue("mock-incremental"),
      getCodename: jest.fn().mockResolvedValue("mock-codename"),
      getInstallerPackageName: jest
        .fn()
        .mockResolvedValue("mock-installer-package-name"),
      isCameraPresent: jest.fn().mockResolvedValue(true),
      supported32BitAbis: jest.fn().mockResolvedValue([]),
      supported64BitAbis: jest.fn().mockResolvedValue([]),
      supportedAbis: jest.fn().mockResolvedValue([]),
      isLandscape: jest.fn().mockResolvedValue(false),
      isPortrait: jest.fn().mockResolvedValue(true),
      getIpAddress: jest.fn().mockResolvedValue("192.168.1.1"),
      getMacAddress: jest.fn().mockResolvedValue("00:00:00:00:00:00"),
      getPhoneNumber: jest.fn().mockResolvedValue("mock-phone-number"),
      getFreeDiskStorage: jest.fn().mockResolvedValue(1000000000),
      getTotalDiskCapacity: jest.fn().mockResolvedValue(1000000000),
      getBatteryLevel: jest.fn().mockResolvedValue(0.9),
      getPowerState: jest.fn().mockResolvedValue({
        batteryLevel: 0.9,
        lowPowerMode: false,
        batteryState: "full",
      }),
      isBatteryCharging: jest.fn().mockResolvedValue(false),
      isAirplaneMode: jest.fn().mockResolvedValue(false),
      getCarrierContentShortIdentifier: jest
        .fn()
        .mockResolvedValue("mock-identifier"),
      getBuildId: jest.fn().mockResolvedValue("mock-build-id"),
      getAppleDeviceIdentificationGroup: jest
        .fn()
        .mockResolvedValue("mock-group"),
      getAppleDeviceName: jest.fn().mockResolvedValue("mock-device-name"),
      getAppleLocalizedModel: jest
        .fn()
        .mockResolvedValue("mock-localized-model"),
      getAppleMarketingName: jest.fn().mockResolvedValue("mock-marketing-name"),
      getAppleModelId: jest.fn().mockResolvedValue("mock-model-id"),
      getAppleMobileCountryCode: jest.fn().mockResolvedValue("mock-mcc"),
      getAppleMobileNetworkCode: jest.fn().mockResolvedValue("mock-mnc"),
      getAppleCarrierName: jest.fn().mockResolvedValue("mock-carrier-name"),
      getAppleTimeZone: jest.fn().mockResolvedValue("mock-timezone"),
      getAndroidId: jest.fn().mockResolvedValue("mock-android-id"),
      getActionPerformed: jest.fn().mockResolvedValue("mock-action-performed"),
      supportedRsaAlgorithms: jest.fn().mockResolvedValue([]),
      supportedEcAlgorithms: jest.fn().mockResolvedValue([]),
      isDisplayZoomEnabled: jest.fn().mockResolvedValue(false),
      isHeadphonesConnected: jest.fn().mockResolvedValue(false),
      getUsedMemory: jest.fn().mockResolvedValue(500000),
      syncUniqueId: jest.fn().mockResolvedValue("mock-sync-id"),
      getSystemSecurityPatch: jest
        .fn()
        .mockResolvedValue("mock-security-patch"),
      // ... existing code ...
    },
  };
});

console.log("Jest setup file loaded successfully with all mocks configured");
