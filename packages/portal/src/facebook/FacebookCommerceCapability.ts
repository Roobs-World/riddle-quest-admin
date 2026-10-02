import {FACEBOOK_PRODUCTS} from "@qwordly/core/pricing/facebookCatalog";
import type {CommerceCapability, CommerceProduct, PlatformResult} from "../platform/types";
import {
  FacebookPurchaseRecovery,
  parseFacebookUnconsumedPurchases,
  type FacebookSignedPurchaseGrant,
} from "./FacebookPurchaseRecovery";
import type {FacebookInstantPayments, FacebookInstantProduct} from "./fbinstant";

/** Provides bounded behavior. */
const bounded = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && new TextEncoder().encode(value).length <= max;
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Parses facebook catalog. */
export function parseFacebookCatalog(value: unknown): FacebookInstantProduct[] {
  if (!Array.isArray(value) || value.length !== Object.keys(FACEBOOK_PRODUCTS).length) {
    throw new Error("facebook-catalog-invalid");
  }
  /** Provides products behavior. */
  const products = value.map((item) => {
    if (!isRecord(item)) throw new Error("facebook-product-invalid");
    // Meta documents decimal strings; retain compatibility with numeric SDK responses.
    /** Normalized decimal amount used to validate the configured USD price. */
    const priceAmount =
      typeof item.priceAmount === "number"
        ? item.priceAmount
        : typeof item.priceAmount === "string" && /^\d{1,9}(?:\.\d{1,6})?$/u.test(item.priceAmount)
          ? Number(item.priceAmount)
          : Number.NaN;
    /** Provides keys behavior. */
    const keys = ["title", "productID", "description", "price", "priceCurrencyCode", "priceAmount"];
    if (
      !keys.every((key) => Object.hasOwn(item, key)) ||
      Object.keys(item).some((key) => ![...keys, "imageURI"].includes(key)) ||
      !bounded(item.title, 512) ||
      !bounded(item.productID, 256) ||
      !FACEBOOK_PRODUCTS[item.productID] ||
      !bounded(item.description, 2_048) ||
      (item.imageURI != null && item.imageURI !== "" && !bounded(item.imageURI, 2_048)) ||
      !bounded(item.price, 128) ||
      !bounded(item.priceCurrencyCode, 16) ||
      !Number.isFinite(priceAmount) ||
      priceAmount < 0
    ) {
      throw new Error("facebook-product-invalid");
    }
    if (
      item.priceCurrencyCode === "USD" &&
      Math.abs(priceAmount * 100 - FACEBOOK_PRODUCTS[item.productID].basePriceUsdCents) > 1e-9
    ) {
      throw new Error("facebook-product-usd-price-mismatch");
    }
    return item as unknown as FacebookInstantProduct;
  });
  if (new Set(products.map(({productID}) => productID)).size !== products.length) {
    throw new Error("facebook-products-duplicate");
  }
  return products;
}

/** Staged commerce adapter. Do not expose it until the signed-request grant dependency is live. */
export class FacebookCommerceCapability implements CommerceCapability {
  /** Stores recovery. */
  private readonly recovery: FacebookPurchaseRecovery;
  /** Stores payments. */
  private readonly payments: FacebookInstantPayments;
  /** Stores grant. */
  private readonly grant: FacebookSignedPurchaseGrant;
  /** Stores operation tail. */
  private operationTail: Promise<void> = Promise.resolve();
  /** Stores active purchase. */
  private activePurchase?: Promise<
    PlatformResult<{
      /** Stores provider receipt id. */
      providerReceiptId: string;
    }>
  >;
  /** Stores active recovery. */
  private activeRecovery?: Promise<PlatformResult<void>>;

  /** Creates a facebook commerce capability instance. */
  constructor(payments: FacebookInstantPayments, grant: FacebookSignedPurchaseGrant) {
    this.payments = payments;
    this.grant = grant;
    this.recovery = new FacebookPurchaseRecovery(payments, grant);
  }

  /** Lists products. */
  async listProducts(): Promise<PlatformResult<CommerceProduct[]>> {
    try {
      /** Provides products behavior. */
      const products = parseFacebookCatalog(await this.payments.getCatalogAsync());
      return {
        status: "success",
        value: products.map((product) => ({
          id: product.productID,
          title: product.title,
          description: product.description,
          price: product.price,
          kind: FACEBOOK_PRODUCTS[product.productID].kind,
        })),
      };
    } catch (error) {
      return {status: "retryable-failure", message: error instanceof Error ? error.message : "facebook-catalog-failed"};
    }
  }

  /** Provides purchase behavior. */
  purchase(productId: string): Promise<
    PlatformResult<{
      /** Stores provider receipt id. */
      providerReceiptId: string;
    }>
  > {
    if (!FACEBOOK_PRODUCTS[productId]) {
      return Promise.resolve({status: "terminal-failure", message: "facebook-product-unsupported"});
    }
    if (this.activePurchase) return Promise.resolve({status: "unavailable", message: "facebook-purchase-in-progress"});
    /** Provides operation behavior. */
    const operation = this.runExclusive(() => this.runPurchase(productId));
    this.activePurchase = operation;
    void operation.finally(() => {
      if (this.activePurchase === operation) this.activePurchase = undefined;
    });
    return operation;
  }

  /** Provides run purchase behavior. */
  private async runPurchase(productId: string): Promise<
    PlatformResult<{
      /** Stores provider receipt id. */
      providerReceiptId: string;
    }>
  > {
    try {
      /** Provides [purchase] behavior. */
      const [purchase] = parseFacebookUnconsumedPurchases([await this.payments.purchaseAsync({productID: productId})]);
      if (purchase.productID !== productId) {
        return {status: "terminal-failure", message: "facebook-purchase-product-mismatch"};
      }
      /** Provides result behavior. */
      const result = await this.grant({signedRequest: purchase.signedRequest});
      if (result.granted !== true || !bounded(result.providerReceiptId, 1_024) || typeof result.consume !== "boolean") {
        return {status: "terminal-failure", message: "facebook-purchase-grant-invalid"};
      }
      if (result.consume) await this.payments.consumePurchaseAsync(purchase.purchaseToken);
      return {status: "success", value: {providerReceiptId: result.providerReceiptId}};
    } catch (error) {
      return {
        status: "retryable-failure",
        message: error instanceof Error ? error.message : "facebook-purchase-failed",
      };
    }
  }

  /** Provides recover behavior. */
  recover(): Promise<PlatformResult<void>> {
    if (this.activeRecovery) return this.activeRecovery;
    /** Provides operation behavior. */
    const operation = this.runExclusive(() => this.recovery.recover());
    this.activeRecovery = operation;
    void operation.finally(() => {
      if (this.activeRecovery === operation) this.activeRecovery = undefined;
    });
    return operation;
  }

  /** Provides run exclusive behavior. */
  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    /** Provides previous behavior. */
    const previous = this.operationTail;
    /** Provides release behavior. */
    let release = (): void => undefined;
    this.operationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
