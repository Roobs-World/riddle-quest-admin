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

import { COIN_PRODUCT_DETAILS } from "../IapService";

describe("IapService", () => {
  it("should export COIN_PRODUCT_DETAILS", () => {
    expect(COIN_PRODUCT_DETAILS).toBeDefined();
    expect(typeof COIN_PRODUCT_DETAILS).toBe("object");
  });

  it("should have valid product details structure", () => {
    const productKeys = Object.keys(COIN_PRODUCT_DETAILS);
    expect(productKeys.length).toBeGreaterThan(0);

    productKeys.forEach((key) => {
      const product = COIN_PRODUCT_DETAILS[key];
      expect(product).toHaveProperty("id");
      expect(product).toHaveProperty("coins");
      expect(typeof product.id).toBe("string");
      expect(typeof product.coins).toBe("number");
    });
  });
});
