import {describe, expect, jest, test} from "@jest/globals";
import {FacebookCommerceCapability, parseFacebookCatalog} from "../FacebookCommerceCapability";

const coinProductId = "com.roobsworld.riddlequest.coinpack1";
const durableProductId = "com.roobsworld.riddlequest.remove_interstitial_ads";
const configuredProducts = [
  [coinProductId, 0.99],
  ["com.roobsworld.riddlequest.coinpack2", 1.99],
  ["com.roobsworld.riddlequest.coinpack3", 2.99],
  ["com.roobsworld.riddlequest.coinpack4", 4.99],
  ["com.roobsworld.riddlequest.coinpack5", 9.99],
  ["com.roobsworld.riddlequest.coinpack6", 19.99],
  [durableProductId, 4.99],
] as const;
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
const catalog = () => configuredProducts.map(([productID, priceAmount]) => product({
  productID,
  priceAmount,
  price: `$${priceAmount.toFixed(2)}`,
}));
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

const payments = (overrides: Record<string, unknown> = {}) => ({
  getCatalogAsync: jest.fn(async () => catalog()),
  purchaseAsync: jest.fn(async () => purchase()),
  getPurchasesAsync: jest.fn(async () => []),
  consumePurchaseAsync: jest.fn(async () => undefined),
  ...overrides,
});

describe("Facebook commerce capability", () => {
  test("maps only exact allowlisted SDK catalog entries to platform products", async () => {
    const sdk = payments();
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
    catalog().map((entry, index) => index === 0 ? {...entry, productID: "attacker-product"} : entry),
    catalog().map((entry, index) => index === 0 ? {...entry, priceAmount: Number.NaN} : entry),
    catalog().map((entry, index) => index === 0 ? {...entry, subscriptionPeriod: "P1M"} : entry),
    [...catalog().slice(0, 6), product()],
  ])("fails closed for malformed, unknown, subscription-like, or duplicate catalog data", async (catalog) => {
    const capability = new FacebookCommerceCapability(payments({getCatalogAsync: async () => catalog}), jest.fn());
    await expect(capability.listProducts()).resolves.toMatchObject({status: "retryable-failure"});
    expect(() => parseFacebookCatalog(catalog)).toThrow();
  });

  test("rejects an incorrect USD base price but permits Meta-localized non-USD prices", () => {
    const incorrectUsd = catalog().map((entry, index) => index === 0 ? {...entry, priceAmount: 1.49} : entry);
    expect(() => parseFacebookCatalog(incorrectUsd)).toThrow("facebook-product-usd-price-mismatch");
    const localized = catalog().map((entry, index) => index === 0 ? {
      ...entry, price: "£0.89", priceCurrencyCode: "GBP", priceAmount: 0.89,
    } : entry);
    expect(parseFacebookCatalog(localized)[0]).toMatchObject({
      productID: coinProductId, price: "£0.89", priceCurrencyCode: "GBP", priceAmount: 0.89,
    });
  });

  test("grants from only the signed request before consuming a server-classified consumable", async () => {
    const events: string[] = [];
    const sdk = payments({
      purchaseAsync: jest.fn(async () => {
        events.push("purchase");
        return purchase();
      }),
      consumePurchaseAsync: jest.fn(async () => { events.push("consume"); }),
    });
    const grant = jest.fn(async (input: {signedRequest: string}) => {
      events.push("grant");
      return {granted: true as const, providerReceiptId: "receipt-1", consume: true};
    });
    const capability = new FacebookCommerceCapability(sdk, grant);

    await expect(capability.purchase(coinProductId)).resolves.toEqual({
      status: "success", value: {providerReceiptId: "receipt-1"},
    });
    expect(sdk.purchaseAsync).toHaveBeenCalledWith({productID: coinProductId});
    expect(grant).toHaveBeenCalledWith({signedRequest: "signature.payload"});
    expect(events).toEqual(["purchase", "grant", "consume"]);
  });

  test("does not consume a durable purchase when the authoritative response says not to", async () => {
    const purchaseAsync = jest.fn(async () => purchase({productID: durableProductId}));
    const sdk = payments({purchaseAsync});
    const capability = new FacebookCommerceCapability(sdk, async () => ({
      granted: true, providerReceiptId: "receipt-durable", consume: false,
    }));
    await expect(capability.purchase(durableProductId)).resolves.toEqual({
      status: "success", value: {providerReceiptId: "receipt-durable"},
    });
    expect(sdk.consumePurchaseAsync).not.toHaveBeenCalled();
  });

  test("rejects unsupported requests and mismatched SDK results before grant", async () => {
    const purchaseAsync = jest.fn(async () => purchase({productID: durableProductId}));
    const sdk = payments({purchaseAsync});
    const grant = jest.fn();
    const capability = new FacebookCommerceCapability(sdk, grant);
    await expect(capability.purchase("subscription_monthly")).resolves.toEqual({
      status: "terminal-failure", message: "facebook-product-unsupported",
    });
    expect(purchaseAsync).not.toHaveBeenCalled();
    await expect(capability.purchase(coinProductId)).resolves.toEqual({
      status: "terminal-failure", message: "facebook-purchase-product-mismatch",
    });
    expect(grant).not.toHaveBeenCalled();
  });

  test("never consumes when the authoritative verifier fails", async () => {
    const sdk = payments();
    const capability = new FacebookCommerceCapability(sdk, async () => {
      throw new Error("verifier-offline");
    });
    await expect(capability.purchase(coinProductId)).resolves.toEqual({
      status: "retryable-failure", message: "verifier-offline",
    });
    expect(sdk.consumePurchaseAsync).not.toHaveBeenCalled();
  });

  test("suppresses a concurrent purchase instead of opening a second provider dialog", async () => {
    let releasePurchase: (() => void) | undefined;
    const purchaseReady = new Promise<void>((resolve) => { releasePurchase = resolve; });
    const purchaseAsync = jest.fn(async () => {
      await purchaseReady;
      return purchase();
    });
    const sdk = payments({purchaseAsync});
    const capability = new FacebookCommerceCapability(sdk, async () => ({
      granted: true, providerReceiptId: "receipt-1", consume: true,
    }));

    const first = capability.purchase(coinProductId);
    await expect(capability.purchase(coinProductId)).resolves.toEqual({
      status: "unavailable", message: "facebook-purchase-in-progress",
    });
    releasePurchase?.();
    await expect(first).resolves.toEqual({status: "success", value: {providerReceiptId: "receipt-1"}});
    expect(purchaseAsync).toHaveBeenCalledTimes(1);
  });

  test("serializes purchase and recovery so they cannot race a provider token", async () => {
    const events: string[] = [];
    let releasePurchase: (() => void) | undefined;
    const purchaseReady = new Promise<void>((resolve) => { releasePurchase = resolve; });
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
      consumePurchaseAsync: jest.fn(async () => { events.push("consume"); }),
    });
    const capability = new FacebookCommerceCapability(sdk, async () => ({
      granted: true, providerReceiptId: "receipt-1", consume: true,
    }));

    const purchaseResult = capability.purchase(coinProductId);
    const recoveryResult = capability.recover();
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
