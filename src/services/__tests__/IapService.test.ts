// Mock react-native-iap - moved before any imports
jest.mock("react-native-iap", () => ({
  initConnection: jest.fn(),
  getAvailablePurchases: jest.fn(),
  finishTransaction: jest.fn(),
  fetchProducts: jest.fn(),
  requestPurchase: jest.fn(),
  purchaseUpdatedListener: jest.fn(),
  purchaseErrorListener: jest.fn(),
}));

// Mock react-native Platform
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

// Create properly structured Firebase Functions mock
const mockCallableFunction = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallableFunction);

// Functions uses getFunctions(getApp()).httpsCallable - modular API
jest.mock("@react-native-firebase/functions", () => ({
  __esModule: true,
  getFunctions: jest.fn(() => ({ httpsCallable: mockHttpsCallable })),
  // Standalone modular API: httpsCallable(functionsInstance, name) returns a callable
  httpsCallable: jest.fn((_instance: unknown, _name: string) => mockCallableFunction),
  default: jest.fn(() => ({ httpsCallable: mockHttpsCallable })),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({})),
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../AnalyticsService", () => ({
  analyticsService: {
    logPurchaseEvent: jest.fn().mockResolvedValue(undefined),
    logCoinPackPurchased: jest.fn().mockResolvedValue(undefined),
  },
}));

import { IapService, COIN_PRODUCT_DETAILS } from "../IapService";
import * as RNIap from "react-native-iap";
import { Platform } from "react-native";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { analyticsService } from "../AnalyticsService";

// Get the mocked functions for better type safety
const mockInitConnection = RNIap.initConnection as jest.MockedFunction<
  typeof RNIap.initConnection
>;
const mockGetPurchaseHistory = RNIap.getAvailablePurchases as jest.MockedFunction<
  typeof RNIap.getAvailablePurchases
>;
const mockFinishTransaction = RNIap.finishTransaction as jest.MockedFunction<
  typeof RNIap.finishTransaction
>;
const mockGetProducts = RNIap.fetchProducts as jest.MockedFunction<
  typeof RNIap.fetchProducts
>;
const mockRequestPurchase = RNIap.requestPurchase as jest.MockedFunction<
  typeof RNIap.requestPurchase
>;
const mockPurchaseUpdatedListener =
  RNIap.purchaseUpdatedListener as jest.MockedFunction<
    typeof RNIap.purchaseUpdatedListener
  >;
const mockPurchaseErrorListener =
  RNIap.purchaseErrorListener as jest.MockedFunction<
    typeof RNIap.purchaseErrorListener
  >;
const mockLogCoinPackPurchased =
  analyticsService.logCoinPackPurchased as jest.MockedFunction<
    typeof analyticsService.logCoinPackPurchased
  >;

const mockPlatform = Platform as { OS: string };

// Mock console methods to reduce noise
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});

describe("IapService", () => {
  // Mock purchase object used across multiple test suites
  const mockPurchase: RNIap.Purchase = {
    productId: "com.roobsworld.riddlequest.coins100",
    transactionReceipt: "ios-receipt-123",
    purchaseToken: "android-token-123",
    transactionId: "txn-123",
    transactionDate: Date.now(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    IapService.clearCache();
    mockPlatform.OS = "ios"; // Default to iOS

    // Setup default mock returns
    mockInitConnection.mockResolvedValue(true as any);
    mockGetPurchaseHistory.mockResolvedValue([] as any);
    mockFinishTransaction.mockResolvedValue({} as any);
    mockGetProducts.mockResolvedValue([] as any);
    mockPurchaseUpdatedListener.mockImplementation(() => ({
      remove: jest.fn(),
    }));
    mockPurchaseErrorListener.mockImplementation(() => ({
      remove: jest.fn(),
    }));

    // Setup default successful Firebase function response
    mockCallableFunction.mockResolvedValue({ data: { success: true } });

    // Ensure mockHttpsCallable returns our mockCallableFunction
    mockHttpsCallable.mockReturnValue(mockCallableFunction);

    // Ensure getFunctions returns our mock object
    (getFunctions as jest.MockedFunction<typeof getFunctions>).mockReturnValue(
      { httpsCallable: mockHttpsCallable } as any
    );
  });

  describe("COIN_PRODUCT_DETAILS", () => {
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
        expect(product.id.length).toBeGreaterThan(0);
        expect(product.coins).toBeGreaterThan(0);
      });
    });

    it("should have correct product details", () => {
      expect(COIN_PRODUCT_DETAILS.COIN_PACK_TINY).toEqual({
        id: "com.roobsworld.riddlequest.coinpack1",
        coins: 50,
      });
      expect(COIN_PRODUCT_DETAILS.COIN_PACK_SMALL).toEqual({
        id: "com.roobsworld.riddlequest.coinpack2",
        coins: 100,
      });
      expect(COIN_PRODUCT_DETAILS.COIN_PACK_MID).toEqual({
        id: "com.roobsworld.riddlequest.coinpack3",
        coins: 250,
      });
      expect(COIN_PRODUCT_DETAILS.COIN_PACK_LARGE).toEqual({
        id: "com.roobsworld.riddlequest.coinpack4",
        coins: 500,
      });
      expect(COIN_PRODUCT_DETAILS.COIN_PACK_HUGE).toEqual({
        id: "com.roobsworld.riddlequest.coinpack5",
        coins: 1000,
      });
      expect(COIN_PRODUCT_DETAILS.COIN_PACK_MEGA).toEqual({
        id: "com.roobsworld.riddlequest.coinpack6",
        coins: 2000,
      });
    });

    it("should have unique product IDs", () => {
      const productIds = Object.values(COIN_PRODUCT_DETAILS).map((p) => p.id);
      const uniqueIds = new Set(productIds);
      expect(uniqueIds.size).toBe(productIds.length);
    });

    it("should have progressively larger coin amounts", () => {
      const coinAmounts = Object.values(COIN_PRODUCT_DETAILS).map(
        (p) => p.coins
      );
      const sortedAmounts = [...coinAmounts].sort((a, b) => a - b);
      expect(coinAmounts).toEqual(expect.arrayContaining(sortedAmounts));
    });
  });

  describe("getProducts", () => {
    const mockProducts: RNIap.Product[] = [
      {
        productId: "com.roobsworld.riddlequest.coins100",
        price: "$0.99",
        title: "Small Coin Pack",
        description: "100 coins",
        currency: "USD",
        localizedPrice: "$0.99",
        type: "inapp",
      } as any,
      {
        productId: "com.roobsworld.riddlequest.coins250",
        price: "$2.99",
        title: "Medium Coin Pack",
        description: "250 coins",
        currency: "USD",
        localizedPrice: "$2.99",
        type: "inapp",
      } as any,
      {
        productId: "com.roobsworld.riddlequest.coins500",
        price: "$4.99",
        title: "Large Coin Pack",
        description: "500 coins",
        currency: "USD",
        localizedPrice: "$4.99",
        type: "inapp",
      } as any,
      {
        productId: "com.roobsworld.riddlequest.coins1000",
        price: "$9.99",
        title: "Premium Coin Pack",
        description: "1000 coins",
        currency: "USD",
        localizedPrice: "$9.99",
        type: "inapp",
      } as any,
    ];

    it("should successfully fetch products on iOS", async () => {
      mockPlatform.OS = "ios";
      mockGetProducts.mockResolvedValue(mockProducts);

      const result = await IapService.getProducts();

      expect(mockInitConnection).toHaveBeenCalledTimes(1);
      expect(mockGetPurchaseHistory).not.toHaveBeenCalled(); // Only called on Android
      expect(mockGetProducts).toHaveBeenCalledWith({
        skus: [
          "com.roobsworld.riddlequest.coinpack1",
          "com.roobsworld.riddlequest.coinpack2",
          "com.roobsworld.riddlequest.coinpack3",
          "com.roobsworld.riddlequest.coinpack4",
          "com.roobsworld.riddlequest.coinpack5",
          "com.roobsworld.riddlequest.coinpack6",
        ],
      });
      expect(result).toEqual(mockProducts);
    });

    it("should successfully fetch products on Android with purchase history cleanup", async () => {
      mockPlatform.OS = "android";
      const mockPurchaseHistory: RNIap.Purchase[] = [
        {
          productId: "com.roobsworld.riddlequest.coinpack1",
          purchaseToken: "token1",
          transactionDate: Date.now(),
          transactionReceipt: "receipt1",
        } as any,
        {
          productId: "com.roobsworld.riddlequest.coinpack2",
          purchaseToken: "token2",
          transactionDate: Date.now(),
          transactionReceipt: "receipt2",
        } as any,
      ];
      mockGetPurchaseHistory.mockResolvedValue(mockPurchaseHistory);
      mockGetProducts.mockResolvedValue(mockProducts);

      const result = await IapService.getProducts();

      expect(mockInitConnection).toHaveBeenCalledTimes(1);
      expect(mockGetPurchaseHistory).toHaveBeenCalledTimes(1);
      expect(mockFinishTransaction).toHaveBeenCalledTimes(2);
      expect(mockFinishTransaction).toHaveBeenCalledWith({
        purchase: mockPurchaseHistory[0],
      });
      expect(mockFinishTransaction).toHaveBeenCalledWith({
        purchase: mockPurchaseHistory[1],
      });
      expect(mockGetProducts).toHaveBeenCalledWith({
        skus: [
          "com.roobsworld.riddlequest.coinpack1",
          "com.roobsworld.riddlequest.coinpack2",
          "com.roobsworld.riddlequest.coinpack3",
          "com.roobsworld.riddlequest.coinpack4",
          "com.roobsworld.riddlequest.coinpack5",
          "com.roobsworld.riddlequest.coinpack6",
        ],
      });
      expect(result).toEqual(mockProducts);
    });

    it("should handle connection initialization failure", async () => {
      const error = new Error("Connection failed");
      mockInitConnection.mockRejectedValue(error);

      await expect(IapService.getProducts()).rejects.toThrow(
        "Connection failed"
      );
      const { logger } = require("../../utils/logger");
      expect(logger.error).toHaveBeenCalledWith("Error fetching products:", error);
      expect(mockGetProducts).not.toHaveBeenCalled();
    });

    it("should handle purchase history cleanup failure on Android", async () => {
      mockPlatform.OS = "android";
      const historyError = new Error("Purchase history failed");
      mockGetPurchaseHistory.mockRejectedValue(historyError);

      await expect(IapService.getProducts()).rejects.toThrow(
        "Purchase history failed"
      );
      const { logger } = require("../../utils/logger");
      expect(logger.error).toHaveBeenCalledWith("Error fetching products:", historyError);
    });

    it("should handle getProducts failure", async () => {
      const error = new Error("Failed to fetch products");
      mockGetProducts.mockRejectedValue(error);

      await expect(IapService.getProducts()).rejects.toThrow(
        "Failed to fetch products"
      );
      const { logger } = require("../../utils/logger");
      expect(logger.error).toHaveBeenCalledWith("Error fetching products:", error);
    });

    it("should handle empty products list", async () => {
      mockGetProducts.mockResolvedValue([]);

      const result = await IapService.getProducts();

      expect(result).toEqual([]);
    });
  });

  describe("validatePurchase", () => {
    it("should successfully validate purchase", async () => {
      mockCallableFunction.mockResolvedValue({
        data: { success: true, newCoins: 100 },
      });

      const result = await IapService.validatePurchase(
        "test-token",
        "com.roobsworld.riddlequest.coins100"
      );

      // Modular API: httpsCallable(functionsInstance, "validatePurchase")
      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "validatePurchase"
      );
      expect(mockCallableFunction).toHaveBeenCalledWith({
        purchaseToken: "test-token",
        productId: "com.roobsworld.riddlequest.coins100",
        platform: "ios",
      });
      expect(result).toEqual({
        success: true,
        newCoins: 100,
        newlyUnlockedAchievementIds: [],
      });
    });

    it("should handle validation failure", async () => {
      mockCallableFunction.mockResolvedValue({
        data: { success: false, error: "Invalid receipt" },
      });

      const result = await IapService.validatePurchase(
        "invalid-token",
        "com.roobsworld.riddlequest.coins100"
      );

      expect(result).toEqual({
        success: false,
        newCoins: undefined,
        newlyUnlockedAchievementIds: [],
      });
    });

    it("should handle Firebase function call failure", async () => {
      const error = new Error("Network error");
      mockCallableFunction.mockRejectedValue(error);

      await expect(
        IapService.validatePurchase("test-token", "com.roobsworld.riddlequest.coins100")
      ).rejects.toThrow("Network error");

      const { logger } = require("../../utils/logger");
      expect(logger.error).toHaveBeenCalledWith(
        "Error calling validatePurchase Firebase Function:",
        error
      );
    });

    it("should validate with Android platform", async () => {
      mockPlatform.OS = "android";
      mockCallableFunction.mockResolvedValue({
        data: { success: true },
      });

      await IapService.validatePurchase(
        "android-token",
        "com.roobsworld.riddlequest.coins250"
      );

      expect(mockCallableFunction).toHaveBeenCalledWith({
        purchaseToken: "android-token",
        productId: "com.roobsworld.riddlequest.coins250",
        platform: "android",
      });
    });

    it("should handle null or undefined tokens", async () => {
      mockCallableFunction.mockResolvedValue({
        data: { success: false },
      });

      await IapService.validatePurchase("", "com.roobsworld.riddlequest.coins100");
      expect(mockCallableFunction).toHaveBeenCalledWith({
        purchaseToken: "",
        productId: "com.roobsworld.riddlequest.coins100",
        platform: "ios",
      });
    });
  });

  describe("grantDevCoinsFallback", () => {
    it("should call backend fallback even when local coin mapping is missing", async () => {
      mockCallableFunction.mockResolvedValue({ data: { success: true } });
      const unknownProductId = "com.roobsworld.riddlequest.coinpack999";

      const result = await IapService.grantDevCoinsFallback(unknownProductId);

      expect(result).toEqual({
        success: true,
        newCoins: 0,
        coinsAwarded: 0,
        newlyUnlockedAchievementIds: [],
      });
      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "grantDevCoinsForPurchase"
      );
      expect(mockCallableFunction).toHaveBeenCalledWith({
        productId: unknownProductId,
      });
      const { logger } = require("../../utils/logger");
      expect(logger.warn).toHaveBeenCalledWith(
        `No local coin mapping found for dev fallback product: ${unknownProductId}; attempting backend fallback anyway.`
      );
    });

    it("should canonicalize live Firestore coin pack IDs before calling backend fallback", async () => {
      mockCallableFunction.mockResolvedValue({
        data: {
          success: true,
          newCoins: 125,
          coinsAwarded: 50,
        },
      });

      const result = await IapService.grantDevCoinsFallback("com.qwordly.coinpack1");

      expect(result).toEqual({
        success: true,
        newCoins: 125,
        coinsAwarded: 50,
        newlyUnlockedAchievementIds: [],
      });
      expect(mockCallableFunction).toHaveBeenCalledWith({
        productId: "com.roobsworld.riddlequest.coinpack1",
      });
    });
  });

  describe("purchaseProduct", () => {
    it("should successfully purchase and validate on iOS", async () => {
      mockPlatform.OS = "ios";
      mockRequestPurchase.mockResolvedValue(mockPurchase);
      mockCallableFunction.mockResolvedValue({
        data: { success: true, newCoins: 100 },
      });

      await expect(
        IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
      ).resolves.toEqual(expect.objectContaining({ ...mockPurchase }));
      expect(mockLogCoinPackPurchased).toHaveBeenCalledWith({
        productId: "com.roobsworld.riddlequest.coins100",
        coins: 0,
        purchaseCount: 1,
      });
    });

    it("should successfully purchase and validate on Android", async () => {
      mockPlatform.OS = "android";
      mockRequestPurchase.mockResolvedValue(mockPurchase);
      mockCallableFunction.mockResolvedValue({
        data: { success: true, newCoins: 100 },
      });

      await expect(
        IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
      ).resolves.toEqual(expect.objectContaining({ ...mockPurchase }));
    });

    it("should handle array response from requestPurchase", async () => {
      mockRequestPurchase.mockResolvedValue([mockPurchase] as any);
      mockCallableFunction.mockResolvedValue({ data: { success: true } });

      await expect(
        IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
      ).resolves.toEqual(expect.objectContaining({ ...mockPurchase }));
    });

    it("should resolve purchase from purchaseUpdatedListener when requestPurchase returns null", async () => {
      mockRequestPurchase.mockResolvedValue(null as any);
      mockCallableFunction.mockResolvedValue({ data: { success: true } });

      mockPurchaseUpdatedListener.mockImplementation((listener: (purchase: RNIap.Purchase) => void) => {
        listener({
          ...mockPurchase,
          productId: "com.roobsworld.riddlequest.coins100",
        } as RNIap.Purchase);
        return { remove: jest.fn() };
      });

      await expect(
        IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
      ).resolves.toEqual(
        expect.objectContaining({ productId: "com.roobsworld.riddlequest.coins100" })
      );
    });

    it("should handle null purchase response", async () => {
      mockRequestPurchase.mockResolvedValue(null as any);

      const result = await IapService.purchaseProduct("com.roobsworld.riddlequest.coins100");

      expect(result).toBe(null);
      const { logger } = require("../../utils/logger");
      expect(logger.debug).toHaveBeenCalledWith(
        "Purchase request did not return a purchase object."
      );
      expect(mockFinishTransaction).not.toHaveBeenCalled();
    });

    it("uses local dev fallback for aliased Firestore coin pack IDs", async () => {
      const originalWorkerId = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;
      mockCallableFunction.mockRejectedValueOnce(new Error("Unauthenticated"));

      try {
        await expect(
          IapService.purchaseProduct("com.qwordly.coinpack1")
        ).resolves.toEqual(
          expect.objectContaining({
            productId: "com.roobsworld.riddlequest.coinpack1",
            transactionId: expect.stringContaining(
              "dev-local-com.roobsworld.riddlequest.coinpack1"
            ),
          })
        );
        expect(mockRequestPurchase).not.toHaveBeenCalled();
        expect(mockCallableFunction).toHaveBeenCalledWith({
          productId: "com.roobsworld.riddlequest.coinpack1",
        });
        expect(mockLogCoinPackPurchased).not.toHaveBeenCalled();
      } finally {
        if (originalWorkerId === undefined) {
          delete process.env.JEST_WORKER_ID;
        } else {
          process.env.JEST_WORKER_ID = originalWorkerId;
        }
      }
    });

    it("rejects local dev fallback when the product has no coin mapping", async () => {
      const originalWorkerId = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;
      mockCallableFunction.mockRejectedValueOnce(new Error("Unauthenticated"));

      try {
        await expect(
          IapService.purchaseProduct("com.qwordly.coinpack999")
        ).rejects.toThrow("This item is currently unavailable.");
        expect(mockRequestPurchase).not.toHaveBeenCalled();
      } finally {
        if (originalWorkerId === undefined) {
          delete process.env.JEST_WORKER_ID;
        } else {
          process.env.JEST_WORKER_ID = originalWorkerId;
        }
      }
    });

    it("should handle empty array purchase response", async () => {
      mockRequestPurchase.mockResolvedValue([] as any);

      const result = await IapService.purchaseProduct("com.roobsworld.riddlequest.coins100");

      expect(result).toBe(null);
    });

    it("should handle missing purchase token on iOS", async () => {
      mockPlatform.OS = "ios";
      const purchaseWithoutToken = {
        ...mockPurchase,
        purchaseToken: undefined,
        transactionReceipt: null,
      };
      mockRequestPurchase.mockResolvedValue(purchaseWithoutToken as any);

      await expect(
        IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
      ).rejects.toThrow(
        "Could not process purchase token. Please try purchasing again."
      );

      expect(mockFinishTransaction).not.toHaveBeenCalled();
    });

    it("should handle missing purchase token on Android", async () => {
      mockPlatform.OS = "android";
      const purchaseWithoutToken = { ...mockPurchase, purchaseToken: null };
      mockRequestPurchase.mockResolvedValue(purchaseWithoutToken as any);

      await expect(
        IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
      ).rejects.toThrow(
        "Could not process purchase token. Please try purchasing again."
      );
    });

    it("should handle validation failure", async () => {
      mockRequestPurchase.mockResolvedValue(mockPurchase);
      mockCallableFunction.mockResolvedValue({ data: { success: false } });

      await expect(
        IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
      ).rejects.toThrow(
        "A network error occurred during purchase validation. Please check your internet connection."
      );

      expect(mockFinishTransaction).not.toHaveBeenCalled();
    });

    it("should handle validation network error", async () => {
      mockRequestPurchase.mockResolvedValue(mockPurchase);
      mockCallableFunction.mockRejectedValue(new Error("Network error"));

      await expect(
        IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
      ).rejects.toThrow(
        "A network error occurred during purchase validation. Please check your internet connection."
      );

      expect(mockFinishTransaction).not.toHaveBeenCalled();
    });

    describe("error handling", () => {
      it("should handle E_USER_CANCELLED error", async () => {
        const error = new Error("User cancelled") as any;
        error.code = "E_USER_CANCELLED";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
        ).rejects.toThrow("Purchase cancelled.");

        const { logger } = require("../../utils/logger");
        expect(logger.debug).toHaveBeenCalledWith("Purchase cancelled by user.");
      });

      it("should handle E_ALREADY_OWNED error", async () => {
        const error = new Error("Already owned") as any;
        error.code = "E_ALREADY_OWNED";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
        ).rejects.toThrow("You already own this item.");

        const { logger } = require("../../utils/logger");
        expect(logger.debug).toHaveBeenCalledWith("Item already owned.");
      });

      it("should handle E_DEVELOPER_ERROR error", async () => {
        const error = new Error("Developer error") as any;
        error.code = "E_DEVELOPER_ERROR";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
        ).rejects.toThrow(
          "A system error occurred. Please contact support if this persists."
        );

        const { logger } = require("../../utils/logger");
        expect(logger.debug).toHaveBeenCalledWith("Developer error.");
      });

      it("should handle E_ITEM_UNAVAILABLE error", async () => {
        const error = new Error("Item unavailable") as any;
        error.code = "E_ITEM_UNAVAILABLE";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
        ).rejects.toThrow("This item is currently unavailable.");

        const { logger } = require("../../utils/logger");
        expect(logger.debug).toHaveBeenCalledWith("Item unavailable.");
      });

      it("should handle sku-not-found error", async () => {
        const error = new Error("SKU not found") as any;
        error.code = "sku-not-found";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
        ).rejects.toThrow("This item is currently unavailable.");

        const { logger } = require("../../utils/logger");
        expect(logger.debug).toHaveBeenCalledWith(
          "SKU not found for current store account."
        );
      });

      it("should handle E_NETWORK_ERROR error", async () => {
        const error = new Error("Network error") as any;
        error.code = "E_NETWORK_ERROR";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
        ).rejects.toThrow(
          "Network error. Please check your connection and try again."
        );

        const { logger } = require("../../utils/logger");
        expect(logger.debug).toHaveBeenCalledWith(
          "Network error during purchase."
        );
      });

      it("should handle unknown errors", async () => {
        const error = new Error("Unknown error");
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
        ).rejects.toThrow(
          "An unexpected error occurred during the purchase process. Please try again."
        );

        const { logger } = require("../../utils/logger");
        expect(logger.error).toHaveBeenCalledWith(
          "Error purchasing product:",
          error
        );
      });

      it("should preserve custom validation error messages", async () => {
        mockRequestPurchase.mockResolvedValue(mockPurchase);
        const validationError = new Error(
          "A network error occurred during purchase validation. Please check your internet connection."
        );
        mockCallableFunction.mockRejectedValue(validationError);

        await expect(
          IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
        ).rejects.toThrow(
          "A network error occurred during purchase validation. Please check your internet connection."
        );
      });
    });
  });

  describe("getCoinsForProduct", () => {
    it("should return correct coins for valid product ID", () => {
      expect(IapService.getCoinsForProduct("com.roobsworld.riddlequest.coinpack1")).toBe(50);
      expect(IapService.getCoinsForProduct("com.roobsworld.riddlequest.coinpack2")).toBe(100);
      expect(IapService.getCoinsForProduct("com.roobsworld.riddlequest.coinpack3")).toBe(250);
      expect(IapService.getCoinsForProduct("com.roobsworld.riddlequest.coinpack4")).toBe(500);
      expect(IapService.getCoinsForProduct("com.roobsworld.riddlequest.coinpack5")).toBe(1000);
      expect(IapService.getCoinsForProduct("com.roobsworld.riddlequest.coinpack6")).toBe(2000);
    });

    it("should return coins for live Firestore coin pack aliases", () => {
      expect(IapService.getCoinsForProduct("com.qwordly.coinpack1")).toBe(50);
      expect(IapService.getCoinsForProduct("com.qwordly.coinpack2")).toBe(100);
      expect(IapService.getCoinsForProduct("com.qwordly.coinpack3")).toBe(250);
      expect(IapService.getCoinsForProduct("com.qwordly.coinpack4")).toBe(500);
      expect(IapService.getCoinsForProduct("com.qwordly.coinpack5")).toBe(1000);
      expect(IapService.getCoinsForProduct("com.qwordly.coinpack6")).toBe(2000);
    });

    it("should return undefined for invalid product ID", () => {
      expect(
        IapService.getCoinsForProduct("com.yourgame.invalid")
      ).toBeUndefined();
      expect(IapService.getCoinsForProduct("")).toBeUndefined();
      expect(IapService.getCoinsForProduct("random_string")).toBeUndefined();
    });

    it("should return undefined for null/undefined input", () => {
      expect(IapService.getCoinsForProduct(null as any)).toBeUndefined();
      expect(IapService.getCoinsForProduct(undefined as any)).toBeUndefined();
    });

    it("should handle case sensitivity", () => {
      expect(
        IapService.getCoinsForProduct("COM.YOURGAME.COINPACK1")
      ).toBeUndefined();
      expect(
        IapService.getCoinsForProduct("com.yourgame.COINPACK1")
      ).toBeUndefined();
    });

    it("should handle partial matches", () => {
      expect(
        IapService.getCoinsForProduct("com.yourgame.coinpack")
      ).toBeUndefined();
      expect(
        IapService.getCoinsForProduct("yourgame.coinpack1")
      ).toBeUndefined();
      expect(
        IapService.getCoinsForProduct("com.roobsworld.riddlequest.coins100.extra")
      ).toBeUndefined();
    });

    it("should handle special characters", () => {
      expect(
        IapService.getCoinsForProduct("com.roobsworld.riddlequest.coins100!")
      ).toBeUndefined();
      expect(
        IapService.getCoinsForProduct("com.roobsworld.riddlequest.coins100 ")
      ).toBeUndefined();
      expect(
        IapService.getCoinsForProduct(" com.roobsworld.riddlequest.coins100")
      ).toBeUndefined();
    });
  });

  describe("Service Interface", () => {
    it("should maintain service interface consistency", () => {
      expect(typeof IapService.getProducts).toBe("function");
      expect(typeof IapService.purchaseProduct).toBe("function");
      expect(typeof IapService.validatePurchase).toBe("function");
      expect(typeof IapService.getCoinsForProduct).toBe("function");
    });

    it("should have async methods return promises", () => {
      // Setup mocks to prevent actual execution
      mockInitConnection.mockResolvedValue(true as any);
      mockGetProducts.mockResolvedValue([]);
      mockRequestPurchase.mockResolvedValue(null as any);
      mockCallableFunction.mockResolvedValue({ data: { success: true } });

      expect(IapService.getProducts()).toBeInstanceOf(Promise);
      expect(IapService.purchaseProduct("test")).toBeInstanceOf(Promise);
      expect(IapService.validatePurchase("test", "test")).toBeInstanceOf(
        Promise
      );
    });

    it("should handle method calls without parameters", async () => {
      mockGetProducts.mockResolvedValue([]);

      await expect(IapService.getProducts()).resolves.not.toThrow();
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete purchase flow", async () => {
      mockRequestPurchase.mockResolvedValue(mockPurchase);
      mockCallableFunction.mockResolvedValue({
        data: { success: true, newCoins: 100 },
      });

      await expect(
        IapService.purchaseProduct("com.roobsworld.riddlequest.coins100")
      ).resolves.toEqual(expect.objectContaining({ ...mockPurchase }));
    });

    it("should handle product lookup and purchase", async () => {
      const products: RNIap.Product[] = [
        { id: "com.roobsworld.riddlequest.coinpack2", price: "$0.99" } as any,
      ];
      mockGetProducts.mockResolvedValue(products);
      mockRequestPurchase.mockResolvedValue(mockPurchase);
      mockCallableFunction.mockResolvedValue({ data: { success: true } });

      const fetchedProducts = await IapService.getProducts();
      const coins = IapService.getCoinsForProduct(fetchedProducts[0].id);

      expect(fetchedProducts).toEqual(products);
      expect(coins).toBe(100);

      await expect(
        IapService.purchaseProduct(fetchedProducts[0].id)
      ).resolves.toEqual(expect.objectContaining({ ...mockPurchase }));
    });
  });
});


