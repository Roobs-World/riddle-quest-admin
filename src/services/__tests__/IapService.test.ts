// Mock the audio files first
jest.mock("../../../assets/audio/Neutral.wav", () => "test-neutral-music");
jest.mock("../../../assets/audio/Success.wav", () => "test-positive-music");
jest.mock("../../../assets/audio/Negative.wav", () => "test-negative-music");

// Mock react-native-iap - moved before any imports
jest.mock("react-native-iap", () => ({
  initConnection: jest.fn(),
  getPurchaseHistory: jest.fn(),
  finishTransaction: jest.fn(),
  getProducts: jest.fn(),
  requestPurchase: jest.fn(),
}));

// Mock react-native Platform
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

// Create properly structured Firebase Functions mock
const mockCallableFunction = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallableFunction);

// Functions is a function that takes an app instance and returns an object with httpsCallable
jest.mock("@react-native-firebase/functions", () => ({
  __esModule: true,
  default: jest.fn(() => ({ httpsCallable: mockHttpsCallable })),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({})),
}));

import { IapService, COIN_PRODUCT_DETAILS } from "../IapService";
import * as RNIap from "react-native-iap";
import { Platform } from "react-native";
import { getFunctions } from "@react-native-firebase/functions";

// Get the mocked functions for better type safety
const mockInitConnection = RNIap.initConnection as jest.MockedFunction<
  typeof RNIap.initConnection
>;
const mockGetPurchaseHistory = RNIap.getPurchaseHistory as jest.MockedFunction<
  typeof RNIap.getPurchaseHistory
>;
const mockFinishTransaction = RNIap.finishTransaction as jest.MockedFunction<
  typeof RNIap.finishTransaction
>;
const mockGetProducts = RNIap.getProducts as jest.MockedFunction<
  typeof RNIap.getProducts
>;
const mockRequestPurchase = RNIap.requestPurchase as jest.MockedFunction<
  typeof RNIap.requestPurchase
>;

const mockPlatform = Platform as { OS: string };

// Mock console methods to reduce noise
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

describe("IapService", () => {
  // Mock purchase object used across multiple test suites
  const mockPurchase: RNIap.ProductPurchase = {
    productId: "com.yourgame.coinpack1",
    transactionReceipt: "ios-receipt-123",
    purchaseToken: "android-token-123",
    transactionId: "txn-123",
    transactionDate: Date.now(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatform.OS = "ios"; // Default to iOS

    // Setup default mock returns
    mockInitConnection.mockResolvedValue(true as any);
    mockGetPurchaseHistory.mockResolvedValue([] as any);
    mockFinishTransaction.mockResolvedValue({} as any);
    mockGetProducts.mockResolvedValue([] as any);

    // Setup default successful Firebase function response
    mockCallableFunction.mockResolvedValue({ data: { success: true } });

    // Ensure mockHttpsCallable returns our mockCallableFunction
    mockHttpsCallable.mockReturnValue(mockCallableFunction);

    // Ensure Firebase functions mock returns our mock object - this is crucial!
    (getFunctions as jest.MockedFunction<typeof getFunctions>).mockReturnValue({
      httpsCallable: mockHttpsCallable,
    } as any);
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
      expect(COIN_PRODUCT_DETAILS.COIN_PACK_SMALL).toEqual({
        id: "com.yourgame.coinpack1",
        coins: 100,
      });
      expect(COIN_PRODUCT_DETAILS.COIN_PACK_MEDIUM).toEqual({
        id: "com.yourgame.coinpack2",
        coins: 500,
      });
      expect(COIN_PRODUCT_DETAILS.COIN_PACK_LARGE).toEqual({
        id: "com.yourgame.coinpack3",
        coins: 1200,
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
        productId: "com.yourgame.coinpack1",
        price: "$0.99",
        title: "Small Coin Pack",
        description: "100 coins",
        currency: "USD",
        localizedPrice: "$0.99",
        type: "inapp",
      } as any,
      {
        productId: "com.yourgame.coinpack2",
        price: "$4.99",
        title: "Medium Coin Pack",
        description: "500 coins",
        currency: "USD",
        localizedPrice: "$4.99",
        type: "inapp",
      } as any,
      {
        productId: "com.yourgame.coinpack3",
        price: "$9.99",
        title: "Large Coin Pack",
        description: "1200 coins",
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
          "com.yourgame.coinpack1",
          "com.yourgame.coinpack2",
          "com.yourgame.coinpack3",
        ],
      });
      expect(result).toEqual(mockProducts);
      expect(console.log).toHaveBeenCalledWith(
        "Fetched products:",
        mockProducts
      );
    });

    it("should successfully fetch products on Android with purchase history cleanup", async () => {
      mockPlatform.OS = "android";
      const mockPurchaseHistory: RNIap.Purchase[] = [
        {
          productId: "com.yourgame.coinpack1",
          purchaseToken: "token1",
          transactionDate: Date.now(),
          transactionReceipt: "receipt1",
        } as any,
        {
          productId: "com.yourgame.coinpack2",
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
          "com.yourgame.coinpack1",
          "com.yourgame.coinpack2",
          "com.yourgame.coinpack3",
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
      expect(console.error).toHaveBeenCalledWith(
        "Error fetching products:",
        error
      );
      expect(mockGetProducts).not.toHaveBeenCalled();
    });

    it("should handle purchase history cleanup failure on Android", async () => {
      mockPlatform.OS = "android";
      const historyError = new Error("Purchase history failed");
      mockGetPurchaseHistory.mockRejectedValue(historyError);

      await expect(IapService.getProducts()).rejects.toThrow(
        "Purchase history failed"
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error fetching products:",
        historyError
      );
    });

    it("should handle getProducts failure", async () => {
      const error = new Error("Failed to fetch products");
      mockGetProducts.mockRejectedValue(error);

      await expect(IapService.getProducts()).rejects.toThrow(
        "Failed to fetch products"
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error fetching products:",
        error
      );
    });

    it("should handle empty products list", async () => {
      mockGetProducts.mockResolvedValue([]);

      const result = await IapService.getProducts();

      expect(result).toEqual([]);
      expect(console.log).toHaveBeenCalledWith("Fetched products:", []);
    });
  });

  describe("validatePurchase", () => {
    it("should successfully validate purchase", async () => {
      mockCallableFunction.mockResolvedValue({
        data: { success: true, newCoins: 100 },
      });

      const result = await IapService.validatePurchase(
        "test-token",
        "com.yourgame.coinpack1"
      );

      expect(mockHttpsCallable).toHaveBeenCalledWith("validatePurchase");
      expect(mockCallableFunction).toHaveBeenCalledWith({
        purchaseToken: "test-token",
        productId: "com.yourgame.coinpack1",
        platform: "ios",
      });
      expect(result).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        "validatePurchase is using a placeholder implementation."
      );
    });

    it("should handle validation failure", async () => {
      mockCallableFunction.mockResolvedValue({
        data: { success: false, error: "Invalid receipt" },
      });

      const result = await IapService.validatePurchase(
        "invalid-token",
        "com.yourgame.coinpack1"
      );

      expect(result).toBe(false);
    });

    it("should handle Firebase function call failure", async () => {
      const error = new Error("Network error");
      mockCallableFunction.mockRejectedValue(error);

      await expect(
        IapService.validatePurchase("test-token", "com.yourgame.coinpack1")
      ).rejects.toThrow("Network error");

      expect(console.error).toHaveBeenCalledWith(
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
        "com.yourgame.coinpack2"
      );

      expect(mockCallableFunction).toHaveBeenCalledWith({
        purchaseToken: "android-token",
        productId: "com.yourgame.coinpack2",
        platform: "android",
      });
    });

    it("should handle null or undefined tokens", async () => {
      mockCallableFunction.mockResolvedValue({
        data: { success: false },
      });

      await IapService.validatePurchase("", "com.yourgame.coinpack1");
      expect(mockCallableFunction).toHaveBeenCalledWith({
        purchaseToken: "",
        productId: "com.yourgame.coinpack1",
        platform: "ios",
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
        IapService.purchaseProduct("com.yourgame.coinpack1")
      ).rejects.toThrow(
        "An unexpected error occurred during the purchase process. Please try again."
      );
    });

    it("should successfully purchase and validate on Android", async () => {
      mockPlatform.OS = "android";
      mockRequestPurchase.mockResolvedValue(mockPurchase);
      mockCallableFunction.mockResolvedValue({
        data: { success: true, newCoins: 100 },
      });

      await expect(
        IapService.purchaseProduct("com.yourgame.coinpack1")
      ).rejects.toThrow(
        "An unexpected error occurred during the purchase process. Please try again."
      );
    });

    it("should handle array response from requestPurchase", async () => {
      mockRequestPurchase.mockResolvedValue([mockPurchase] as any);
      mockCallableFunction.mockResolvedValue({ data: { success: true } });

      await expect(
        IapService.purchaseProduct("com.yourgame.coinpack1")
      ).rejects.toThrow(
        "An unexpected error occurred during the purchase process. Please try again."
      );
    });

    it("should handle null purchase response", async () => {
      mockRequestPurchase.mockResolvedValue(null as any);

      const result = await IapService.purchaseProduct("com.yourgame.coinpack1");

      expect(result).toBe(null);
      expect(console.log).toHaveBeenCalledWith(
        "Purchase request did not return a purchase object."
      );
      expect(mockFinishTransaction).not.toHaveBeenCalled();
    });

    it("should handle empty array purchase response", async () => {
      mockRequestPurchase.mockResolvedValue([] as any);

      const result = await IapService.purchaseProduct("com.yourgame.coinpack1");

      expect(result).toBe(null);
    });

    it("should handle missing purchase token on iOS", async () => {
      mockPlatform.OS = "ios";
      const purchaseWithoutToken = {
        ...mockPurchase,
        transactionReceipt: null,
      };
      mockRequestPurchase.mockResolvedValue(purchaseWithoutToken as any);

      await expect(
        IapService.purchaseProduct("com.yourgame.coinpack1")
      ).rejects.toThrow(
        "An unexpected error occurred during the purchase process. Please try again."
      );

      expect(mockFinishTransaction).not.toHaveBeenCalled();
    });

    it("should handle missing purchase token on Android", async () => {
      mockPlatform.OS = "android";
      const purchaseWithoutToken = { ...mockPurchase, purchaseToken: null };
      mockRequestPurchase.mockResolvedValue(purchaseWithoutToken as any);

      await expect(
        IapService.purchaseProduct("com.yourgame.coinpack1")
      ).rejects.toThrow(
        "An unexpected error occurred during the purchase process. Please try again."
      );
    });

    it("should handle validation failure", async () => {
      mockRequestPurchase.mockResolvedValue(mockPurchase);
      mockCallableFunction.mockResolvedValue({ data: { success: false } });

      await expect(
        IapService.purchaseProduct("com.yourgame.coinpack1")
      ).rejects.toThrow(
        "An unexpected error occurred during the purchase process. Please try again."
      );

      expect(mockFinishTransaction).not.toHaveBeenCalled();
    });

    it("should handle validation network error", async () => {
      mockRequestPurchase.mockResolvedValue(mockPurchase);
      mockCallableFunction.mockRejectedValue(new Error("Network error"));

      await expect(
        IapService.purchaseProduct("com.yourgame.coinpack1")
      ).rejects.toThrow(
        "An unexpected error occurred during the purchase process. Please try again."
      );

      expect(mockFinishTransaction).not.toHaveBeenCalled();
    });

    describe("error handling", () => {
      it("should handle E_USER_CANCELLED error", async () => {
        const error = new Error("User cancelled") as any;
        error.code = "E_USER_CANCELLED";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.yourgame.coinpack1")
        ).rejects.toThrow("Purchase cancelled.");

        expect(console.log).toHaveBeenCalledWith("Purchase cancelled by user.");
      });

      it("should handle E_ALREADY_OWNED error", async () => {
        const error = new Error("Already owned") as any;
        error.code = "E_ALREADY_OWNED";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.yourgame.coinpack1")
        ).rejects.toThrow("You already own this item.");

        expect(console.log).toHaveBeenCalledWith("Item already owned.");
      });

      it("should handle E_DEVELOPER_ERROR error", async () => {
        const error = new Error("Developer error") as any;
        error.code = "E_DEVELOPER_ERROR";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.yourgame.coinpack1")
        ).rejects.toThrow(
          "A system error occurred. Please contact support if this persists."
        );

        expect(console.log).toHaveBeenCalledWith("Developer error.");
      });

      it("should handle E_ITEM_UNAVAILABLE error", async () => {
        const error = new Error("Item unavailable") as any;
        error.code = "E_ITEM_UNAVAILABLE";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.yourgame.coinpack1")
        ).rejects.toThrow("This item is currently unavailable.");

        expect(console.log).toHaveBeenCalledWith("Item unavailable.");
      });

      it("should handle E_NETWORK_ERROR error", async () => {
        const error = new Error("Network error") as any;
        error.code = "E_NETWORK_ERROR";
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.yourgame.coinpack1")
        ).rejects.toThrow(
          "Network error. Please check your connection and try again."
        );

        expect(console.log).toHaveBeenCalledWith(
          "Network error during purchase."
        );
      });

      it("should handle unknown errors", async () => {
        const error = new Error("Unknown error");
        mockRequestPurchase.mockRejectedValue(error);

        await expect(
          IapService.purchaseProduct("com.yourgame.coinpack1")
        ).rejects.toThrow(
          "An unexpected error occurred during the purchase process. Please try again."
        );

        expect(console.error).toHaveBeenCalledWith(
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
          IapService.purchaseProduct("com.yourgame.coinpack1")
        ).rejects.toThrow(
          "An unexpected error occurred during the purchase process. Please try again."
        );
      });
    });
  });

  describe("getCoinsForProduct", () => {
    it("should return correct coins for valid product ID", () => {
      expect(IapService.getCoinsForProduct("com.yourgame.coinpack1")).toBe(100);
      expect(IapService.getCoinsForProduct("com.yourgame.coinpack2")).toBe(500);
      expect(IapService.getCoinsForProduct("com.yourgame.coinpack3")).toBe(
        1200
      );
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
        IapService.getCoinsForProduct("com.yourgame.coinpack1.extra")
      ).toBeUndefined();
    });

    it("should handle special characters", () => {
      expect(
        IapService.getCoinsForProduct("com.yourgame.coinpack1!")
      ).toBeUndefined();
      expect(
        IapService.getCoinsForProduct("com.yourgame.coinpack1 ")
      ).toBeUndefined();
      expect(
        IapService.getCoinsForProduct(" com.yourgame.coinpack1")
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
        IapService.purchaseProduct("com.yourgame.coinpack1")
      ).rejects.toThrow(
        "An unexpected error occurred during the purchase process. Please try again."
      );
    });

    it("should handle product lookup and purchase", async () => {
      const products: RNIap.Product[] = [
        { productId: "com.yourgame.coinpack1", price: "$0.99" } as any,
      ];
      mockGetProducts.mockResolvedValue(products);
      mockRequestPurchase.mockResolvedValue(mockPurchase);
      mockCallableFunction.mockResolvedValue({ data: { success: true } });

      const fetchedProducts = await IapService.getProducts();
      const coins = IapService.getCoinsForProduct(fetchedProducts[0].productId);

      expect(fetchedProducts).toEqual(products);
      expect(coins).toBe(100);

      await expect(
        IapService.purchaseProduct(fetchedProducts[0].productId)
      ).rejects.toThrow(
        "An unexpected error occurred during the purchase process. Please try again."
      );
    });
  });
});
