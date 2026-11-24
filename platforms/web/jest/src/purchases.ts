import type {JestBackendPort} from "./backend";
import type {JestPlatformPort, PlatformResult} from "./types";
import type {ProductSummary} from "../../../../src/platform/contracts/hostServices";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";

/** Represents a page read from Jest's incomplete-purchase recovery queue. */
type IncompletePurchasePage = {
  /** Purchases returned by the startup recovery check. */
  purchases: Array<{
    /** Stable token used for idempotent grant and completion. */
    purchaseToken: string;
    /** Catalog SKU associated with the recovered purchase. */
    productSku: string;
  }>;
  /** Signed envelope covering the startup recovery page. */
  purchasesSigned: string;
  /** Whether Jest has another recovery page available. */
  hasMore: boolean;
};

export {priceLocale} from "./priceLocale";

/** Provides jest purchase coordinator behavior. */
export class JestPurchaseCoordinator {
  /** Stores platform. */
  private readonly platform: JestPlatformPort;
  /** Stores backend. */
  private readonly backend: JestBackendPort;
  /** Holds the whole preflight, checkout, and entitlement verification sequence. */
  private subscriptionCheckoutPending = false;

  /** Creates a jest purchase coordinator instance. */
  constructor(platform: JestPlatformPort, backend: JestBackendPort) {
    this.platform = platform;
    this.backend = backend;
  }

  /** Gets products. */
  async getProducts(locale?: string): Promise<PlatformResult<ProductSummary[]>> {
    /** Provides result behavior. */
    const result = await this.platform.getProducts();
    if (result.status !== "success") return result;
    const {projectProductCatalog} = await import("./productCatalog");
    return projectProductCatalog(result.value, locale);
  }

  /** Keeps subscription-only verification and projection out of ordinary game startup. */
  async getSubscriptions(playerId: string, locale?: string): Promise<PlatformResult<ProductSummary[]>> {
    const {loadSubscriptionCatalog} = await import("./subscriptionCatalog");
    return loadSubscriptionCatalog({platform: this.platform, backend: this.backend, playerId, locale});
  }

  /** Provides subscribe behavior. */
  async subscribe(
    subscriptionSku: string,
    playerId: string,
    options: {
      /** Locale for the fresh catalog verified after acquiring the checkout lock. */
      locale?: string;
      /** Publishes verified holdings before the provider checkout can start. */
      onCatalog?: (catalog: readonly ProductSummary[]) => void;
    } = {},
  ): Promise<
    PlatformResult<{
      /** Stores active sku. */
      activeSku: string;
      /** Stores blocked skus. */
      blockedSkus: string[];
      /** Premium coins granted when the subscription was verified. */
      premiumCoinsAwarded: number;
      /** Coin balance after verification, when the backend reported it. */
      newCoins?: number;
      /** Excludes provider test transactions from revenue reporting. */
      sandbox?: boolean;
      /** Distinguishes restored access from a newly completed checkout. */
      recoveredExistingSubscription?: true;
      analyticsTransactionId?: string;
    }>
  > {
    if (this.subscriptionCheckoutPending) return {status: "cancelled"};
    this.subscriptionCheckoutPending = true;
    try {
      /** Lazy checkout implementation keeps the cross-tab billing lock with the payment flow. */
      const {checkoutSubscription} = await import("./subscriptionCheckout");
      return await checkoutSubscription({
        platform: this.platform,
        backend: this.backend,
        subscriptionSku,
        playerId,
        getSubscriptions: async () => {
          /** Fresh verified offers read after this checkout acquires its account lock. */
          const catalog = await this.getSubscriptions(playerId, options.locale);
          if (catalog.status === "success") options.onCatalog?.(catalog.value);
          return catalog;
        },
      });
    } catch (error) {
      captureBrowserException(error, {component: "jest_purchases", operation: "subscription_checkout"});
      return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
    } finally {
      this.subscriptionCheckoutPending = false;
    }
  }

  /** Provides purchase behavior. */
  async purchase(
    productSku: string,
    playerId: string,
  ): Promise<
    PlatformResult<{
      /** Stores coins awarded. */
      coinsAwarded: number;
      /** Stores new coins. */
      newCoins: number;
      /** Stores newly unlocked achievement ids. */
      newlyUnlockedAchievementIds?: string[];
      /** Excludes provider test transactions from revenue reporting. */
      sandbox?: boolean;
      analyticsTransactionId?: string;
    }>
  > {
    const {checkoutConsumable} = await import("./purchaseCheckout");
    return checkoutConsumable({platform: this.platform, backend: this.backend, productSku, playerId});
  }

  /** Provides reconcile behavior. */
  async reconcile(
    playerId: string,
    initialPage?: IncompletePurchasePage,
  ): Promise<PlatformResult<number>> {
    /** Provides count behavior. */
    let count = 0;
    for (let page = 0; page < 100; page += 1) {
      /** Provides result behavior. */
      const result =
        page === 0 && initialPage
          ? ({status: "success", value: initialPage} as const)
          : await this.platform.getIncompletePurchases();
      if (result.status !== "success") return result;
      for (const purchase of result.value.purchases) {
        try {
          await this.backend.grantPurchase(result.value.purchasesSigned, playerId, purchase.purchaseToken);
        } catch (error) {
          captureBrowserException(error, {component: "jest_purchases", operation: "reconcile_purchase"});
          return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
        }
        /** Completes d. */
        const completed = await this.platform.completePurchase(purchase.purchaseToken);
        if (completed.status !== "success") return completed;
        count += 1;
      }
      if (!result.value.hasMore) return {status: "success", value: count};
    }
    /** Reports queue exhaustion at its origin, as SDK and grant failures are reported. */
    const error = new Error("Incomplete purchase pagination exceeded safety limit");
    captureBrowserException(error, {component: "jest_purchases", operation: "reconcile_pagination"});
    return {status: "terminal-failure", message: error.message};
  }
}
