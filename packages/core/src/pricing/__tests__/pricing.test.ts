import {cloneProductPricingCatalog, DEFAULT_PRODUCT_PRICING} from "../catalog";
import {parseProductPricing} from "../productPricing";

describe("product pricing", () => {
  it("clones the default catalog without sharing nested prices", () => {
    const clone = cloneProductPricingCatalog();
    expect(clone).toEqual(DEFAULT_PRODUCT_PRICING);
    expect(clone).not.toBe(DEFAULT_PRODUCT_PRICING);
    expect(clone[0]).not.toBe(DEFAULT_PRODUCT_PRICING[0]);
    expect(clone[0].regionalPrices[0]).not.toBe(DEFAULT_PRODUCT_PRICING[0].regionalPrices[0]);
  });

  it("deep-clones an optional special offer", () => {
    const product = {
      ...DEFAULT_PRODUCT_PRICING[0],
      specialOffer: {
        badgeText: "SAVE",
        description: "Temporary offer",
        discountPercentage: 20,
        isActive: true,
        validFrom: 1,
        validTo: 2,
      },
    };
    const [clone] = cloneProductPricingCatalog([product]);
    expect(clone.specialOffer).toEqual(product.specialOffer);
    expect(clone.specialOffer).not.toBe(product.specialOffer);
  });

  it("parses valid products, preserves extensions, and rejects invalid grants", () => {
    expect(parseProductPricing({...DEFAULT_PRODUCT_PRICING[0], platformMetadata: "kept"})).toMatchObject({
      productId: DEFAULT_PRODUCT_PRICING[0].productId,
      platformMetadata: "kept",
    });
    expect(() => parseProductPricing({...DEFAULT_PRODUCT_PRICING[0], coins: -1})).toThrow();
  });
});
