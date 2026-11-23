import {describe, expect, jest, test} from "@jest/globals";
import {FacebookCommerceCapability, parseFacebookCatalog} from "../FacebookCommerceCapability";
import type {FacebookSignedPurchaseGrant} from "../FacebookPurchaseRecovery";

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
  test.each([undefined, null, ""])("accepts Meta catalogs without deprecated images (%p)", async (imageURI) => {
    /** Meta no longer supports IAP catalog images. */
    const products = catalog().map(entry => {
      /** Preserves the required catalog fields while varying only the legacy image. */
      const product = {...entry, imageURI};
      if (imageURI === undefined) Reflect.deleteProperty(product, "imageURI");
      return product;
    });
    await expect(new FacebookCommerceCapability(payments({getCatalogAsync: async () => products}), jest.fn()).listProducts())
      .resolves.toMatchObject({status: "success"});
  });

  test.each([123, false, {}, "x".repeat(2049)])("rejects malformed legacy image %p", imageURI => {
    expect(() => parseFacebookCatalog(catalog().map(entry => ({...entry, imageURI})))).toThrow("facebook-product-invalid");
  });
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
    /** Signals that checkout started after its pending-receipt read. */
    let markPurchaseStarted: () => void = () => undefined;
    /** Observes the provider checkout phase without counting implementation microtasks. */
    const purchaseStarted = new Promise<void>((resolve) => {
      markPurchaseStarted = resolve;
    });
    /** Provides sdk behavior. */
    const sdk = payments({
      purchaseAsync: jest.fn(async () => {
        events.push("purchase:start");
        markPurchaseStarted();
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
    const capability = new FacebookCommerceCapability(sdk, async () => {
      events.push("grant");
      return {granted: true, providerReceiptId: "receipt-1", consume: true};
    });

    /** Provides purchase result behavior. */
    const purchaseResult = capability.purchase(coinProductId);
    /** Provides recovery result behavior. */
    const recoveryResult = capability.recover();
    /** Provides duplicate recovery behavior. */
    const duplicateRecovery = capability.recover();
    await purchaseStarted;
    expect(events).toEqual(["recover:read", "purchase:start"]);
    releasePurchase?.();

    await expect(Promise.all([purchaseResult, recoveryResult, duplicateRecovery])).resolves.toEqual([
      {status: "success", value: {providerReceiptId: "receipt-1"}},
      {status: "success", value: undefined},
      {status: "success", value: undefined},
    ]);
    expect(events).toEqual(["recover:read", "purchase:start", "purchase:end", "grant", "consume", "recover:read"]);
    expect(sdk.purchaseAsync).toHaveBeenCalledTimes(1);
    expect(sdk.getPurchasesAsync).toHaveBeenCalledTimes(2);
  });

  test("advances past a permanently rejected same-SKU receipt without charging again or consuming it", async () => {
    /** Keeps the deleted generation ahead of a valid current receipt. */
    const oldPurchase = purchase({paymentID: "old-payment", purchaseToken: "old-token", signedRequest: "old.signature"});
    /** Reflects only successfully consumed receipts disappearing from the SDK. */
    let pending = [oldPurchase, purchase()];
    /** Records grant-before-consume ordering and any stale retry. */
    const events: string[] = [];
    /** Refuses a new checkout because an existing valid receipt can fulfill the request. */
    const sdk = payments({
      purchaseAsync: jest.fn(),
      getPurchasesAsync: async () => pending,
      consumePurchaseAsync: async (token: string) => {
        events.push(`consume:${token}`);
        pending = pending.filter(item => item.purchaseToken !== token);
      },
    });
    /** Rejects only the old receipt under the server's permanent owner check. */
    const grant = jest.fn<FacebookSignedPurchaseGrant>(async input => {
      events.push(`grant:${input.signedRequest}`);
      if (input.signedRequest === "old.signature") throw Object.assign(new Error("old-generation"), {code: "functions/failed-precondition"});
      return {granted: true, providerReceiptId: "receipt-1", consume: true};
    });
    /** Shares one quarantine between checkout and later resume recovery. */
    const capability = new FacebookCommerceCapability(sdk, grant);
    await expect(capability.purchase(coinProductId)).resolves.toEqual({status: "success", value: {providerReceiptId: "receipt-1"}});
    await expect(capability.recover()).resolves.toEqual({status: "success", value: undefined});
    expect(events).toEqual(["grant:old.signature", "grant:signature.payload", "consume:purchase-token-1"]);
    expect(sdk.purchaseAsync).not.toHaveBeenCalled();
  });

  test("shares recovery's old-generation quarantine with the next explicit same-SKU checkout", async () => {
    /** Models Meta keeping an unconsumed receipt from a deleted game account. */
    const oldPurchase = purchase({paymentID: "old-payment", purchaseToken: "old-token", signedRequest: "old.signature"});
    /** Captures both old and current authoritative requests. */
    const grant = jest.fn<FacebookSignedPurchaseGrant>(async input => {
      if (input.signedRequest === "old.signature") throw Object.assign(new Error("old-generation"), {code: "functions/failed-precondition"});
      return {granted: true, providerReceiptId: "receipt-1", consume: true};
    });
    /** Keeps the old entry present across recovery and checkout. */
    const sdk = payments({getPurchasesAsync: async () => [oldPurchase]});
    /** Owns the shared quarantine without persisting financial state. */
    const capability = new FacebookCommerceCapability(sdk, grant);
    await expect(capability.recover()).resolves.toEqual({status: "success", value: undefined});
    await expect(capability.purchase(coinProductId)).resolves.toEqual({status: "success", value: {providerReceiptId: "receipt-1"}});
    expect(grant.mock.calls).toEqual([[{signedRequest: "old.signature"}], [{signedRequest: "signature.payload"}]]);
    expect(sdk.purchaseAsync).toHaveBeenCalledTimes(1);
    expect(sdk.consumePurchaseAsync).toHaveBeenCalledWith("purchase-token-1");
  });

  test("never opens another paid checkout automatically after a new charge is permanently rejected", async () => {
    /** Preserves rejected charges in the provider's unconsumed history. */
    const pending: ReturnType<typeof purchase>[] = [];
    /** Counts actual provider checkouts rather than grant retries. */
    let charges = 0;
    /** Returns a distinct receipt only after another explicit purchase call. */
    const sdk = payments({
      getPurchasesAsync: async () => pending,
      purchaseAsync: jest.fn(async () => {
        charges += 1;
        /** Identifies the receipt created by this single provider dialog. */
        const next = purchase({paymentID: `payment-${charges}`, purchaseToken: `token-${charges}`, signedRequest: `signature-${charges}`});
        pending.push(next);
        return next;
      }),
    });
    /** Rejects the first newly created charge without authorizing its consumption. */
    const grant = jest.fn<FacebookSignedPurchaseGrant>(async input => {
      if (input.signedRequest === "signature-1") throw Object.assign(new Error("old-generation"), {code: "functions/failed-precondition"});
      return {granted: true, providerReceiptId: "receipt-2", consume: true};
    });
    /** Allows a later user action while forbidding an implicit second charge. */
    const capability = new FacebookCommerceCapability(sdk, grant);
    await expect(capability.purchase(coinProductId)).resolves.toEqual({status: "terminal-failure", message: "old-generation"});
    expect(charges).toBe(1);
    expect(sdk.consumePurchaseAsync).not.toHaveBeenCalled();
    await expect(capability.purchase(coinProductId)).resolves.toEqual({status: "success", value: {providerReceiptId: "receipt-2"}});
    expect(charges).toBe(2);
    expect(grant.mock.calls).toEqual([[{signedRequest: "signature-1"}], [{signedRequest: "signature-2"}]]);
    expect(sdk.consumePurchaseAsync).toHaveBeenCalledTimes(1);
    expect(sdk.consumePurchaseAsync).toHaveBeenCalledWith("token-2");
  });

  test("retries a new charge's temporary grant failure without opening another provider checkout", async () => {
    /** Returns one new charge and no earlier SDK receipts. */
    const sdk = payments();
    /** Lets the original authoritative request recover on a later explicit retry. */
    const grant = jest.fn<FacebookSignedPurchaseGrant>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({granted: true, providerReceiptId: "receipt-1", consume: true});
    /** Retains the unresolved receipt while the grant service is unavailable. */
    const capability = new FacebookCommerceCapability(sdk, grant);
    await expect(capability.purchase(coinProductId)).resolves.toEqual({status: "retryable-failure", message: "offline"});
    await expect(capability.purchase(coinProductId)).resolves.toEqual({status: "success", value: {providerReceiptId: "receipt-1"}});
    expect(sdk.purchaseAsync).toHaveBeenCalledTimes(1);
    expect(sdk.getPurchasesAsync).toHaveBeenCalledTimes(1);
    expect(grant.mock.calls).toEqual([[{signedRequest: "signature.payload"}], [{signedRequest: "signature.payload"}]]);
    expect(sdk.consumePurchaseAsync).toHaveBeenCalledWith("purchase-token-1");
  });
});
