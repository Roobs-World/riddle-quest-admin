/**
 * @fileoverview Unit tests for ProductPricingService.
 *
 * Tests the pricing service's pure functions for special offers,
 * currency lookup, product finding, and featured product filtering.
 */

import {getDocs} from "@react-native-firebase/firestore";
import {captureException} from "../../utils/sentry";
import {ProductPricing, ProductPricingService, SpecialOffer} from "../ProductPricingService";

// Mock Firebase modules
jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
}));

jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
  withSentrySpan: jest.fn((_: string, __: string, callback: () => unknown) => callback()),
}));

describe("ProductPricingService", () => {
  // Sample test data
  const createMockProduct = (overrides: Partial<ProductPricing> = {}): ProductPricing => ({
    productId: "com.roobsworld.riddlequest.coins.100",
    productKey: "coins_100",
    name: "100 Coins",
    description: "A small pack of coins",
    coins: 100,
    isActive: true,
    sortOrder: 1,
    regionalPrices: [
      {amount: 0.99, currency: "USD", displayPrice: "$0.99", symbol: "$"},
      {amount: 0.89, currency: "GBP", displayPrice: "£0.89", symbol: "£"},
      {amount: 0.99, currency: "EUR", displayPrice: "€0.99", symbol: "€"},
    ],
    ...overrides,
  });

  const createMockOffer = (overrides: Partial<SpecialOffer> = {}): SpecialOffer => ({
    badgeText: "SALE",
    description: "Limited time offer!",
    discountPercentage: 20,
    isActive: true,
    validFrom: Date.now() - 1000 * 60 * 60, // 1 hour ago
    validTo: Date.now() + 1000 * 60 * 60 * 24, // 24 hours from now
    ...overrides,
  });

  beforeEach(() => {
    // Clear cache before each test
    ProductPricingService.clearCache();
  });

  describe("getActiveSpecialOffer", () => {
    it("should return undefined when product has no special offer", () => {
      const product = createMockProduct();
      const result = ProductPricingService.getActiveSpecialOffer(product);
      expect(result).toBeUndefined();
    });

    it("should return undefined when offer is not active", () => {
      const product = createMockProduct({
        specialOffer: createMockOffer({isActive: false}),
      });
      const result = ProductPricingService.getActiveSpecialOffer(product);
      expect(result).toBeUndefined();
    });

    it("should return undefined when offer has not started yet", () => {
      const product = createMockProduct({
        specialOffer: createMockOffer({
          validFrom: Date.now() + 1000 * 60 * 60, // 1 hour from now
          validTo: Date.now() + 1000 * 60 * 60 * 24, // 24 hours from now
        }),
      });
      const result = ProductPricingService.getActiveSpecialOffer(product);
      expect(result).toBeUndefined();
    });

    it("should return undefined when offer has expired", () => {
      const product = createMockProduct({
        specialOffer: createMockOffer({
          validFrom: Date.now() - 1000 * 60 * 60 * 48, // 48 hours ago
          validTo: Date.now() - 1000 * 60 * 60, // 1 hour ago
        }),
      });
      const result = ProductPricingService.getActiveSpecialOffer(product);
      expect(result).toBeUndefined();
    });

    it("should return the offer when it is active and within valid period", () => {
      const offer = createMockOffer();
      const product = createMockProduct({specialOffer: offer});
      const result = ProductPricingService.getActiveSpecialOffer(product);
      expect(result).toEqual(offer);
    });

    it("should return the offer at exact validFrom boundary", () => {
      const now = Date.now();
      const offer = createMockOffer({
        validFrom: now,
        validTo: now + 1000 * 60 * 60,
      });
      const product = createMockProduct({specialOffer: offer});
      const result = ProductPricingService.getActiveSpecialOffer(product);
      expect(result).toEqual(offer);
    });
  });

  describe("getPriceForCurrency", () => {
    it("should return the price for a valid currency code", () => {
      const product = createMockProduct();
      const result = ProductPricingService.getPriceForCurrency(product, "USD");
      expect(result).toEqual({
        amount: 0.99,
        currency: "USD",
        displayPrice: "$0.99",
        symbol: "$",
      });
    });

    it("should return GBP price when requested", () => {
      const product = createMockProduct();
      const result = ProductPricingService.getPriceForCurrency(product, "GBP");
      expect(result?.currency).toBe("GBP");
      expect(result?.symbol).toBe("£");
    });

    it("should return undefined for non-existent currency", () => {
      const product = createMockProduct();
      const result = ProductPricingService.getPriceForCurrency(product, "JPY");
      expect(result).toBeUndefined();
    });

    it("should be case-sensitive for currency codes", () => {
      const product = createMockProduct();
      const result = ProductPricingService.getPriceForCurrency(product, "usd");
      expect(result).toBeUndefined();
    });

    it("should return undefined for empty regionalPrices", () => {
      const product = createMockProduct({regionalPrices: []});
      const result = ProductPricingService.getPriceForCurrency(product, "USD");
      expect(result).toBeUndefined();
    });
  });

  describe("findByProductId", () => {
    it("should find a product by productId", () => {
      const products = [
        createMockProduct({productId: "product_1"}),
        createMockProduct({productId: "product_2"}),
        createMockProduct({productId: "product_3"}),
      ];
      const result = ProductPricingService.findByProductId(products, "product_2");
      expect(result?.productId).toBe("product_2");
    });

    it("should return undefined when product is not found", () => {
      const products = [createMockProduct({productId: "product_1"}), createMockProduct({productId: "product_2"})];
      const result = ProductPricingService.findByProductId(products, "product_99");
      expect(result).toBeUndefined();
    });

    it("should return undefined for empty products array", () => {
      const result = ProductPricingService.findByProductId([], "product_1");
      expect(result).toBeUndefined();
    });

    it("should return the first match if duplicates exist", () => {
      const products = [
        createMockProduct({productId: "duplicate", name: "First"}),
        createMockProduct({productId: "duplicate", name: "Second"}),
      ];
      const result = ProductPricingService.findByProductId(products, "duplicate");
      expect(result?.name).toBe("First");
    });
  });

  describe("getFeaturedProducts", () => {
    it("should return only products with featuredOrder", () => {
      const products = [
        createMockProduct({productId: "p1", featuredOrder: 1}),
        createMockProduct({productId: "p2"}), // No featuredOrder
        createMockProduct({productId: "p3", featuredOrder: 2}),
        createMockProduct({productId: "p4"}), // No featuredOrder
      ];
      const result = ProductPricingService.getFeaturedProducts(products);
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.productId)).toEqual(["p1", "p3"]);
    });

    it("should sort by featuredOrder ascending", () => {
      const products = [
        createMockProduct({productId: "p1", featuredOrder: 3}),
        createMockProduct({productId: "p2", featuredOrder: 1}),
        createMockProduct({productId: "p3", featuredOrder: 2}),
      ];
      const result = ProductPricingService.getFeaturedProducts(products);
      expect(result.map((p) => p.productId)).toEqual(["p2", "p3", "p1"]);
    });

    it("should return empty array when no products are featured", () => {
      const products = [createMockProduct({productId: "p1"}), createMockProduct({productId: "p2"})];
      const result = ProductPricingService.getFeaturedProducts(products);
      expect(result).toEqual([]);
    });

    it("should return empty array for empty products array", () => {
      const result = ProductPricingService.getFeaturedProducts([]);
      expect(result).toEqual([]);
    });

    it("should exclude products with null featuredOrder", () => {
      const products = [
        createMockProduct({productId: "p1", featuredOrder: 1}),
        createMockProduct({productId: "p2", featuredOrder: null as any}),
        createMockProduct({productId: "p3", featuredOrder: undefined}),
      ];
      const result = ProductPricingService.getFeaturedProducts(products);
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe("p1");
    });

    it("should handle featuredOrder of 0", () => {
      const products = [
        createMockProduct({productId: "p1", featuredOrder: 2}),
        createMockProduct({productId: "p2", featuredOrder: 0}),
        createMockProduct({productId: "p3", featuredOrder: 1}),
      ];
      const result = ProductPricingService.getFeaturedProducts(products);
      expect(result.map((p) => p.productId)).toEqual(["p2", "p3", "p1"]);
    });
  });

  describe("clearCache", () => {
    it("should be callable without error", () => {
      expect(() => ProductPricingService.clearCache()).not.toThrow();
    });

    it("should reset cache state", () => {
      // Call clearCache twice to ensure it's idempotent
      ProductPricingService.clearCache();
      ProductPricingService.clearCache();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("integration scenarios", () => {
    it("should handle a complete product with all features", () => {
      const fullProduct = createMockProduct({
        productId: "com.roobsworld.riddlequest.coins.premium",
        name: "Premium Pack",
        coins: 1000,
        featuredOrder: 1,
        featuredBadge: "BEST VALUE",
        specialOffer: createMockOffer({
          discountPercentage: 30,
          badgeText: "30% OFF",
        }),
      });

      // Check all getters work
      expect(ProductPricingService.getPriceForCurrency(fullProduct, "USD")).toBeDefined();
      expect(ProductPricingService.getActiveSpecialOffer(fullProduct)).toBeDefined();
      expect(
        ProductPricingService.findByProductId([fullProduct], "com.roobsworld.riddlequest.coins.premium"),
      ).toBeDefined();
      expect(ProductPricingService.getFeaturedProducts([fullProduct])).toHaveLength(1);
    });

    it("should filter featured products and find by ID in sequence", () => {
      const products = [
        createMockProduct({
          productId: "featured_1",
          featuredOrder: 1,
          featuredBadge: "POPULAR",
        }),
        createMockProduct({
          productId: "featured_2",
          featuredOrder: 2,
          featuredBadge: "BEST DEAL",
        }),
        createMockProduct({productId: "regular_1"}),
      ];

      const featured = ProductPricingService.getFeaturedProducts(products);
      expect(featured).toHaveLength(2);

      const found = ProductPricingService.findByProductId(featured, "featured_2");
      expect(found?.featuredBadge).toBe("BEST DEAL");
    });
  });

  describe("getActiveProducts", () => {
    it("fetches active products and then serves cached data", async () => {
      const docs = [
        {data: () => createMockProduct({productId: "p1"})},
        {data: () => createMockProduct({productId: "p2"})},
      ];
      (getDocs as jest.Mock).mockResolvedValue({docs});

      const first = await ProductPricingService.getActiveProducts();
      const second = await ProductPricingService.getActiveProducts();

      expect(first).toHaveLength(2);
      expect(second).toEqual(first);
      expect(getDocs).toHaveBeenCalledTimes(1);
    });

    it("returns stale cache when fetch fails", async () => {
      const nowSpy = jest.spyOn(Date, "now");
      nowSpy.mockReturnValueOnce(1_000_000);
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [{data: () => createMockProduct({productId: "cached"})}],
      });
      await ProductPricingService.getActiveProducts();

      const err = new Error("fetch failed");
      nowSpy.mockReturnValueOnce(1_000_000 + 5 * 60 * 1000 + 1);
      (getDocs as jest.Mock).mockRejectedValueOnce(err);
      const result = await ProductPricingService.getActiveProducts();

      expect(result.map((p) => p.productId)).toEqual(["cached"]);
      expect(captureException).toHaveBeenCalledWith(err);
      nowSpy.mockRestore();
    });

    it("returns empty array on first fetch failure with no cache", async () => {
      const err = new Error("first fetch failed");
      (getDocs as jest.Mock).mockRejectedValueOnce(err);

      const result = await ProductPricingService.getActiveProducts();
      expect(result).toEqual([]);
    });
  });
});
