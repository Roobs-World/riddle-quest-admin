import {cloneProductPricingCatalog, DEFAULT_PRODUCT_PRICING} from "../../../../../../src/core/pricing/catalog";
import {FACEBOOK_PRODUCTS, resolveFacebookProduct} from "../facebookCatalog";

describe("shared Facebook product catalog", () => {
  it("owns the exact six consumable coin grants and base prices", () => {
    /** Provides consumables behavior. */
    const consumables = Object.values(FACEBOOK_PRODUCTS).filter(({kind}) => kind === "consumable");
    expect(consumables.map(({coins}) => coins)).toEqual([250, 550, 900, 1_600, 3_400, 7_000]);
    expect(consumables.map(({basePriceUsdCents}) => basePriceUsdCents)).toEqual([99, 199, 299, 499, 999, 1_999]);
    expect(consumables.every(({entitlement}) => entitlement === undefined)).toBe(true);
  });

  it("derives all six consumables from the canonical pricing catalog", () => {
    /** Provides consumables behavior. */
    const consumables = Object.values(FACEBOOK_PRODUCTS).filter(({kind}) => kind === "consumable");
    expect(consumables).toHaveLength(6);
    expect(consumables).toEqual(
      DEFAULT_PRODUCT_PRICING.map((product) => ({
        productId: product.productId,
        kind: "consumable",
        basePriceUsdCents: Math.round(product.regionalPrices[0].amount * 100),
        coins: product.coins,
      })),
    );
  });

  it("adds exactly one durable product and no subscription", () => {
    expect(Object.values(FACEBOOK_PRODUCTS)).toHaveLength(7);
    expect(resolveFacebookProduct("com.roobsworld.riddlequest.remove_interstitial_ads")).toEqual({
      productId: "com.roobsworld.riddlequest.remove_interstitial_ads",
      kind: "durable",
      basePriceUsdCents: 499,
      coins: 0,
      entitlement: "remove_interstitial_ads",
    });
    expect(Object.values(FACEBOOK_PRODUCTS).some(({kind}) => (kind as string) === "subscription")).toBe(false);
  });

  it("rejects unknown products", () => {
    expect(() => resolveFacebookProduct("com.attacker.unlimited_coins")).toThrow("invalid-facebook-product");
  });

  it.each([
    [
      "duplicate USD prices",
      (catalog: typeof DEFAULT_PRODUCT_PRICING) => {
        catalog[0].regionalPrices.push({...catalog[0].regionalPrices[0]});
      },
      "invalid-facebook-source-product",
    ],
    [
      "missing numeric prices",
      (catalog: typeof DEFAULT_PRODUCT_PRICING) => {
        Reflect.deleteProperty(catalog[0].regionalPrices[0], "amount");
      },
      "invalid-facebook-source-product",
    ],
    [
      "non-finite prices",
      (catalog: typeof DEFAULT_PRODUCT_PRICING) => {
        catalog[0].regionalPrices[0].amount = Number.POSITIVE_INFINITY;
      },
      "invalid-facebook-source-product",
    ],
    [
      "fractional cents",
      (catalog: typeof DEFAULT_PRODUCT_PRICING) => {
        catalog[0].regionalPrices[0].amount = 1.001;
      },
      "invalid-facebook-source-product",
    ],
    [
      "non-positive coin grants",
      (catalog: typeof DEFAULT_PRODUCT_PRICING) => {
        catalog[0].coins = 0;
      },
      "invalid-facebook-source-product",
    ],
    [
      "incomplete catalogs",
      (catalog: typeof DEFAULT_PRODUCT_PRICING) => {
        catalog.pop();
      },
      "invalid-facebook-source-catalog",
    ],
    [
      "duplicate product IDs",
      (catalog: typeof DEFAULT_PRODUCT_PRICING) => {
        catalog[5].productId = catalog[0].productId;
      },
      "invalid-facebook-source-catalog",
    ],
  ])("rejects %s in the canonical source", (_name, mutate, expectedError) => {
    /** Provides catalog behavior. */
    const catalog = cloneProductPricingCatalog();
    mutate(catalog);
    jest.resetModules();
    jest.doMock("../../../../../../src/core/pricing/catalog", () => ({DEFAULT_PRODUCT_PRICING: catalog}));
    try {
      expect(() => jest.isolateModules(() => jest.requireActual("../facebookCatalog"))).toThrow(expectedError);
    } finally {
      jest.dontMock("../catalog");
      jest.resetModules();
    }
  });
});
