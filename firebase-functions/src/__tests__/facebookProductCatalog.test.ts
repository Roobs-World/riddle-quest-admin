import {
  FACEBOOK_PRODUCTS,
  resolveFacebookProduct,
} from "../facebook/facebookProductCatalog";

describe("Facebook product catalog", () => {
  it("owns the exact six consumable coin grants and base prices", () => {
    const consumables = Object.values(FACEBOOK_PRODUCTS).filter(({kind}) => kind === "consumable");
    expect(consumables.map(({coins}) => coins)).toEqual([250, 550, 900, 1_600, 3_400, 7_000]);
    expect(consumables.map(({basePriceUsdCents}) => basePriceUsdCents)).toEqual([99, 199, 299, 499, 999, 1_999]);
    expect(consumables.every(({entitlement}) => entitlement === undefined)).toBe(true);
  });

  it("contains one $4.99 durable ad-free entitlement and no subscription", () => {
    expect(Object.values(FACEBOOK_PRODUCTS)).toHaveLength(7);
    expect(resolveFacebookProduct("com.roobsworld.riddlequest.remove_interstitial_ads")).toEqual({
      productId: "com.roobsworld.riddlequest.remove_interstitial_ads",
      kind: "durable",
      basePriceUsdCents: 499,
      coins: 0,
      entitlement: "remove_interstitial_ads",
    });
    expect(Object.values(FACEBOOK_PRODUCTS).some((product) => (product.kind as string) === "subscription")).toBe(false);
  });

  it("fails closed for an SDK-provided product outside the server allowlist", () => {
    expect(() => resolveFacebookProduct("com.attacker.unlimited_coins")).toThrow("invalid-facebook-product");
  });
});
