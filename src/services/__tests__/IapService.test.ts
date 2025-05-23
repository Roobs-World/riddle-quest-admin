jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  default: {
    app: jest.fn(() => ({
      name: "[DEFAULT]",
      options: {},
    })),
    apps: [
      {
        name: "[DEFAULT]",
        options: {},
      },
    ],
    SDK_VERSION: "mockSDKVersion",
    initializeApp: jest.fn().mockReturnValue({
      name: "[DEFAULT]",
      options: {},
    }),
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
}));

describe("IapService", () => {
  it("should have tests", () => {
    // TODO: Write actual tests for IapService
    expect(true).toBe(true);
  });
});
