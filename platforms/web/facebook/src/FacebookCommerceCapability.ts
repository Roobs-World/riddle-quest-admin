import {FACEBOOK_PRODUCTS} from "./commerce/facebookCatalog";
import type {CommerceCapability, CommerceProduct, PlatformResult} from "../../../../src/platform/contracts/capabilities";
import {
  FacebookPurchaseRecovery,
  parseFacebookUnconsumedPurchases,
  type FacebookSignedPurchaseGrant,
  type FacebookPurchaseGrant,
  type FacebookPurchaseCompletion,
  type FacebookRecoverableCharge,
} from "./FacebookPurchaseRecovery";
import type {FacebookInstantPayments, FacebookInstantProduct} from "./fbinstant";

/** Provides bounded behavior. */
const bounded = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && new TextEncoder().encode(value).length <= max;
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Parses facebook catalog. */
export function parseFacebookCatalog(value: unknown): Array<FacebookInstantProduct & {description: string; priceAmount: number}> {
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
    const keys = ["title", "productID", "price", "priceCurrencyCode", "priceAmount"];
    if (
      !keys.every((key) => Object.hasOwn(item, key)) ||
      Object.keys(item).some((key) => ![...keys, "description", "imageURI"].includes(key)) ||
      !bounded(item.title, 512) ||
      !bounded(item.productID, 256) ||
      !Object.hasOwn(FACEBOOK_PRODUCTS, item.productID) ||
      (item.description !== undefined && (typeof item.description !== "string" ||
        new TextEncoder().encode(item.description).length > 2_048)) ||
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
    return {
      title: item.title,
      productID: item.productID,
      description: item.description ?? "",
      price: item.price,
      priceCurrencyCode: item.priceCurrencyCode,
      priceAmount,
      ...(typeof item.imageURI === "string" ? {imageURI: item.imageURI} : {}),
    };
  });
  if (new Set(products.map(({productID}) => productID)).size !== products.length) {
    throw new Error("facebook-products-duplicate");
  }
  return products;
}

/** Projects the authoritative receipt and balances returned to the host. */
type PurchaseValue = Pick<FacebookPurchaseGrant, "providerReceiptId" | "newCoins" | "coinsAwarded">;

/** Meta checkout consumes purchases only after the authoritative grant commits. */
export class FacebookCommerceCapability implements CommerceCapability {
  /** Stores recovery. */
  private readonly recovery: FacebookPurchaseRecovery;
  /** Stores payments. */
  private readonly payments: FacebookInstantPayments;
  private readonly isActive: () => boolean;
  /** Stores operation tail. */
  private operationTail: Promise<void> = Promise.resolve();
  /** Stores active purchase. */
  private activePurchase?: Promise<PlatformResult<PurchaseValue>>;
  /** Stores active recovery. */
  private activeRecovery?: Promise<PlatformResult<void>>;
  /** Retains an unsettled charge so an explicit retry cannot charge the player again. */
  private readonly pendingPurchases = new Map<string, FacebookRecoverableCharge>();

  /** Creates a facebook commerce capability instance. */
  constructor(payments: FacebookInstantPayments, grant: FacebookSignedPurchaseGrant, isActive: () => boolean = () => true) {
    this.payments = payments;
    this.recovery = new FacebookPurchaseRecovery(payments, grant);
    this.isActive = isActive;
  }

  /** Lists products. */
  async listProducts(): Promise<PlatformResult<Array<CommerceProduct & {priceAmount: number; currency: string}>>> {
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
          priceAmount: product.priceAmount,
          currency: product.priceCurrencyCode,
          kind: FACEBOOK_PRODUCTS[product.productID].kind,
        })),
      };
    } catch (error) {
      return {status: "retryable-failure", message: error instanceof Error ? error.message : "facebook-catalog-failed"};
    }
  }

  /** Provides purchase behavior. */
  purchase(productId: string): Promise<PlatformResult<PurchaseValue>> {
    if (!Object.hasOwn(FACEBOOK_PRODUCTS, productId)) {
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
  private async runPurchase(productId: string): Promise<PlatformResult<PurchaseValue>> {
    try {
      if (!this.isActive()) return {status: "cancelled"};
      /** A temporary grant or consumption failure always retries its original charge first. */
      const cachedPurchase = this.pendingPurchases.get(productId);
      if (cachedPurchase && !this.recovery.isQuarantined(cachedPurchase)) {
        /** Known permanent rejections permit checking other existing same-SKU receipts. */
        const completion = await this.completePurchase(cachedPurchase);
        if (completion.status !== "rejected") return this.purchaseResult(completion);
      }
      this.pendingPurchases.delete(productId);
      /** Meta may retain receipts belonging to a deleted game-account generation. */
      const pendingPurchases = parseFacebookUnconsumedPurchases(await this.payments.getPurchasesAsync());
      for (const pendingPurchase of pendingPurchases) {
        if (pendingPurchase.productID !== productId || this.recovery.isQuarantined(pendingPurchase)) continue;
        /** Existing receipts are attempted before any new paid dialog can open. */
        const completion = await this.completePurchase(pendingPurchase);
        if (completion.status !== "rejected") return this.purchaseResult(completion);
      }
      /** One explicit user action may create at most one new provider charge. */
      if (!this.isActive()) return {status: "cancelled"};
      const [purchase] = parseFacebookUnconsumedPurchases([await this.payments.purchaseAsync({productID: productId})]);
      if (!purchase) return {status: "terminal-failure", message: "facebook-purchase-invalid"};
      if (purchase.productID !== productId) {
        return {status: "terminal-failure", message: "facebook-purchase-product-mismatch"};
      }
      return this.purchaseResult(await this.completePurchase(purchase));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error &&
        (error.code === "USER_INPUT" || error.code === "USER_CANCELLED")) return {status: "cancelled"};
      return {
        status: "retryable-failure",
        message: error instanceof Error ? error.message : "facebook-purchase-failed",
      };
    }
  }

  /** Keeps retryable charges pending while sharing recovery's permanent-rejection quarantine. */
  private async completePurchase(purchase: FacebookRecoverableCharge): Promise<FacebookPurchaseCompletion> {
    this.pendingPurchases.set(purchase.productID, purchase);
    /** Fulfillment consumes only after a durable, validated server grant. */
    const completion = await this.recovery.complete(purchase);
    if (completion.status !== "invalid-grant") this.pendingPurchases.delete(purchase.productID);
    return completion;
  }

  /** Converts fulfillment outcomes without starting another checkout after a newly created charge fails. */
  private purchaseResult(completion: FacebookPurchaseCompletion): PlatformResult<PurchaseValue> {
    switch (completion.status) {
      case "granted":
        return {status: "success", value: {
          providerReceiptId: completion.grant.providerReceiptId,
          newCoins: completion.grant.newCoins,
          coinsAwarded: completion.grant.coinsAwarded,
        }};
      case "rejected":
        return {status: "terminal-failure", message: completion.message};
      case "invalid-grant":
        return {status: "terminal-failure", message: "facebook-purchase-grant-invalid"};
      default: {
        /** Makes future fulfillment states require an explicit host result. */
        const unreachable: never = completion;
        return unreachable;
      }
    }
  }

  /** Provides recover behavior. */
  recover(): Promise<PlatformResult<void>> {
    if (this.activeRecovery) return this.activeRecovery;
    /** Provides operation behavior. */
    const operation = this.runExclusive(async () => {
      /** Retires cached transient receipts only after recovery has completed safely. */
      const result = await this.recovery.recover();
      if (result.status === "success") this.pendingPurchases.clear();
      return result;
    });
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
