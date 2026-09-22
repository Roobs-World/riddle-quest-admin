import {describe, expect, jest, test} from "@jest/globals";
import {FacebookCommerceCapability, parseFacebookCatalog} from "../FacebookCommerceCapability";

/** Provides coin product id behavior. */
const coinProductId = "com.roobsworld.riddlequest.coinpack1";
/** Provides durable product id behavior. */
const durableProductId = "com.roobsworld.riddlequest.remove_interstitial_ads";
/** Provides configured products behavior. */
const configuredProducts = [
  [coinProductId, 0.99],
  ["com.roobsworld.riddlequest.coinpack2", 1.99],
  ["com.roobsworld.riddlequest.coinpack3", 2.99],
  ["com.roobsworld.riddlequest.coinpack4", 4.99],
  ["com.roobsworld.riddlequest.coinpack5", 9.99],
  ["com.roobsworld.riddlequest.coinpack6", 19.99],
  [durableProductId, 4.99],
] as const;
/** Provides product behavior. */
const product = (overrides: Record<string, unknown> = {}) => ({
  title: "250 coins",
  productID: coinProductId,
  description: "250 Riddle Quest coins",
  imageURI: "https://lookaside.fbsbx.com/product.png",
  price: "$0.99",
  priceCurrencyCode: "USD",
  priceAmount: 0.99,
  ...overrides,
});
/** Provides catalog behavior. */
const catalog = () =>
  configuredProducts.map(([productID, priceAmount]) =>
    product({
      productID,
      priceAmount,
      price: `$${priceAmount.toFixed(2)}`,
    }),
  );
/** Provides purchase behavior. */
const purchase = (overrides: Record<string, unknown> = {}) => ({
  isConsumed: false,
  paymentActionType: "charge",
  paymentID: "payment-1",
  productID: coinProductId,
  purchasePlatform: "FB",
  purchasePrice: {amount: "0.99", currency: "USD"},
  purchaseTime: "1787220000",
  purchaseToken: "purchase-token-1",
  signedRequest: "signature.payload",
  ...overrides,
});

/** Provides payments behavior. */
const payments = (overrides: Record<string, unknown> = {}) => ({
  getCatalogAsync: jest.fn(async () => catalog()),
  purchaseAsync: jest.fn(async () => purchase()),
  getPurchasesAsync: jest.fn(async () => []),
  consumePurchaseAsync: jest.fn(async () => undefined),
  ...overrides,
});

describe("Facebook commerce capability", () => {
  test("accepts documented decimal-string catalog amounts and preserves localized display prices", async () => {
    /** Catalog using the SDK-documented decimal string format. */
    const products = catalog().map((entry) => ({...entry, priceAmount: String(entry.priceAmount)}));
    /** Exercises provider catalog validation and display projection together. */
    const capability = new FacebookCommerceCapability(payments({getCatalogAsync: async () => products}), jest.fn());
    await expect(capability.listProducts()).resolves.toMatchObject({
      status: "success",
      value: products.map((entry) => ({id: entry.productID, price: entry.price})),
    });
  });

  test.each([
    ["GBP", "£0.89", "0.89"],
    ["EUR", "0,99 €", "0.99"],
    ["JPY", "￥150", "150"],
  ])("preserves Meta's %s checkout price without a USD fallback", async (currency, price, amount) => {
    /** Catalog entries returned by the provider. */
    const products = catalog().map((entry) => ({
      ...entry, price, priceCurrencyCode: currency, priceAmount: amount,
    }));
    /** Commerce adapter exercised by this test. */
    const capability = new FacebookCommerceCapability(payments({getCatalogAsync: async () => products}), jest.fn());
    /** Result returned by the operation under test. */
    const result = await capability.listProducts();
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Catalog unavailable");
    expect(result.value).toHaveLength(7);
    expect(result.value.map((product) => product.price)).toEqual(Array(7).fill(price));
  });

  test.each(["", " ", "0x1", "Infinity", "1e2", "0,99", "-0.99", null, true])(
    "rejects malformed decimal price %p",
    (priceAmount) => {
      expect(() => parseFacebookCatalog(catalog().map((entry) => ({...entry, priceAmount})))).toThrow();
    },
  );

  test("maps only exact allowlisted SDK catalog entries to platform products", async () => {
    /** Provides sdk behavior. */
    const sdk = payments();
    /** Provides capability behavior. */
    const capability = new FacebookCommerceCapability(sdk, jest.fn());
    await expect(capability.listProducts()).resolves.toEqual({
      status: "success",
      value: catalog().map((entry) => ({
        id: entry.productID,
        title: entry.title,
        description: entry.description,
        price: entry.price,
        kind: entry.productID === durableProductId ? "durable" : "consumable",
      })),
    });
  });

  test.each([
    null,
    {},
    [],
    catalog().slice(0, 6),
    catalog().map((entry, index) => (index === 0 ? {...entry, productID: "attacker-product"} : entry)),
    catalog().map((entry, index) => (index === 0 ? {...entry, priceAmount: Number.NaN} : entry)),
    catalog().map((entry, index) => (index === 0 ? {...entry, subscriptionPeriod: "P1M"} : entry)),
    [...catalog().slice(0, 6), product()],
  ])("fails closed for malformed, unknown, subscription-like, or duplicate catalog data", async (catalog) => {
    /** Provides capability behavior. */
    const capability = new FacebookCommerceCapability(payments({getCatalogAsync: async () => catalog}), jest.fn());
    await expect(capability.listProducts()).resolves.toMatchObject({status: "retryable-failure"});
    expect(() => parseFacebookCatalog(catalog)).toThrow();
  });

  test("rejects an incorrect USD base price but permits Meta-localized non-USD prices", () => {
    /** Provides incorrect usd behavior. */
    const incorrectUsd = catalog().map((entry, index) => (index === 0 ? {...entry, priceAmount: 1.49} : entry));
    expect(() => parseFacebookCatalog(incorrectUsd)).toThrow("facebook-product-usd-price-mismatch");
    /** Provides localized behavior. */
    const localized = catalog().map((entry, index) =>
      index === 0
        ? {
            ...entry,
            price: "£0.89",
            priceCurrencyCode: "GBP",
            priceAmount: 0.89,
          }
        : entry,
    );
    expect(parseFacebookCatalog(localized)[0]).toMatchObject({
      productID: coinProductId,
      price: "£0.89",
      priceCurrencyCode: "GBP",
      priceAmount: 0.89,
    });
  });

  test("grants from only the signed request before consuming a server-classified consumable", async () => {
    /** Provides events behavior. */
    const events: string[] = [];
    /** Provides sdk behavior. */
    const sdk = payments({
      purchaseAsync: jest.fn(async () => {
        events.push("purchase");
        return purchase();
      }),
      consumePurchaseAsync: jest.fn(async () => {
        events.push("consume");
      }),
    });
    /** Provides grant behavior. */
    const grant = jest.fn(
      async (input: {
        /** Stores signed request. */
        /** Stores signed request. */
        signedRequest: string;
      }) => {
        events.push("grant");
        return {granted: true as const, providerReceiptId: "receipt-1", consume: true};
      },
    );
    /** Provides capability behavior. */
    const capability = new FacebookCommerceCapability(sdk, grant);

    await expect(capability.purchase(coinProductId)).resolves.toEqual({
      status: "success",
      value: {providerReceiptId: "receipt-1"},
    });
    expect(sdk.purchaseAsync).toHaveBeenCalledWith({productID: coinProductId});
    expect(grant).toHaveBeenCalledWith({signedRequest: "signature.payload"});
    expect(events).toEqual(["purchase", "grant", "consume"]);
  });

  test("does not consume a durable purchase when the authoritative response says not to", async () => {
    /** Provides purchase async behavior. */
    const purchaseAsync = jest.fn(async () => purchase({productID: durableProductId}));
    /** Provides sdk behavior. */
    const sdk = payments({purchaseAsync});
    /** Provides capability behavior. */
    const capability = new FacebookCommerceCapability(sdk, async () => ({
      granted: true,
      providerReceiptId: "receipt-durable",
      consume: false,
    }));
    await expect(capability.purchase(durableProductId)).resolves.toEqual({
      status: "success",
      value: {providerReceiptId: "receipt-durable"},
    });
    expect(sdk.consumePurchaseAsync).not.toHaveBeenCalled();
  });

  test("rejects unsupported requests and mismatched SDK results before grant", async () => {
    /** Provides purchase async behavior. */
    const purchaseAsync = jest.fn(async () => purchase({productID: durableProductId}));
    /** Provides sdk behavior. */
    const sdk = payments({purchaseAsync});
    /** Provides grant behavior. */
    const grant = jest.fn();
    /** Provides capability behavior. */
    const capability = new FacebookCommerceCapability(sdk, grant);
    await expect(capability.purchase("subscription_monthly")).resolves.toEqual({
      status: "terminal-failure",
      message: "facebook-product-unsupported",
    });
    expect(purchaseAsync).not.toHaveBeenCalled();
    await expect(capability.purchase(coinProductId)).resolves.toEqual({
      status: "terminal-failure",
      message: "facebook-purchase-product-mismatch",
    });
    expect(grant).not.toHaveBeenCalled();
  });

  test("never consumes when the authoritative verifier fails", async () => {
    /** Provides sdk behavior. */
    const sdk = payments();
    /** Provides capability behavior. */
    const capability = new FacebookCommerceCapability(sdk, async () => {
      throw new Error("verifier-offline");
    });
    await expect(capability.purchase(coinProductId)).resolves.toEqual({
      status: "retryable-failure",
      message: "verifier-offline",
    });
    expect(sdk.consumePurchaseAsync).not.toHaveBeenCalled();
  });

  test("suppresses a concurrent purchase instead of opening a second provider dialog", async () => {
    /** Provides release purchase behavior. */
    let releasePurchase: (() => void) | undefined;
    /** Provides purchase ready behavior. */
    const purchaseReady = new Promise<void>((resolve) => {
      releasePurchase = resolve;
    });
    /** Provides purchase async behavior. */
    const purchaseAsync = jest.fn(async () => {
      await purchaseReady;
      return purchase();
    });
    /** Provides sdk behavior. */
    const sdk = payments({purchaseAsync});
    /** Provides capability behavior. */
    const capability = new FacebookCommerceCapability(sdk, async () => ({
      granted: true,
      providerReceiptId: "receipt-1",
      consume: true,
    }));

    /** Provides first behavior. */
    const first = capability.purchase(coinProductId);
    await expect(capability.purchase(coinProductId)).resolves.toEqual({
      status: "unavailable",
      message: "facebook-purchase-in-progress",
    });
    releasePurchase?.();
    await expect(first).resolves.toEqual({status: "success", value: {providerReceiptId: "receipt-1"}});
    expect(purchaseAsync).toHaveBeenCalledTimes(1);
  });

  test("serializes purchase and recovery so they cannot race a provider token", async () => {
    /** Provides events behavior. */
    const events: string[] = [];
    /** Provides release purchase behavior. */
    let releasePurchase: (() => void) | undefined;
    /** Provides purchase ready behavior. */
    const purchaseReady = new Promise<void>((resolve) => {
      releasePurchase = resolve;
    });
    /** Provides sdk behavior. */
    const sdk = payments({
      purchaseAsync: jest.fn(async () => {
        events.push("purchase:start");
        await purchaseReady;
        events.push("purchase:end");
        return purchase();
      }),
      getPurchasesAsync: jest.fn(async () => {
        events.push("recover:read");
        return [];
      }),
      consumePurchaseAsync: jest.fn(async () => {
        events.push("consume");
      }),
    });
    /** Provides capability behavior. */
    const capability = new FacebookCommerceCapability(sdk, async () => ({
      granted: true,
      providerReceiptId: "receipt-1",
      consume: true,
    }));

    /** Provides purchase result behavior. */
    const purchaseResult = capability.purchase(coinProductId);
    /** Provides recovery result behavior. */
    const recoveryResult = capability.recover();
    /** Provides duplicate recovery behavior. */
    const duplicateRecovery = capability.recover();
    await Promise.resolve();
    expect(events).toEqual(["purchase:start"]);
    releasePurchase?.();

    await expect(Promise.all([purchaseResult, recoveryResult, duplicateRecovery])).resolves.toEqual([
      {status: "success", value: {providerReceiptId: "receipt-1"}},
      {status: "success", value: undefined},
      {status: "success", value: undefined},
    ]);
    expect(events).toEqual(["purchase:start", "purchase:end", "consume", "recover:read"]);
    expect(sdk.getPurchasesAsync).toHaveBeenCalledTimes(1);
  });
});
