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
  /** Subscription syncs publish durable grants before returning catalog or checkout results. */
  private readonly subscriptionBackend: Pick<JestBackendPort, "syncSubscriptions">;
  /** Holds the whole preflight, checkout, and entitlement verification sequence. */
  private subscriptionCheckoutPending = false;

  /** Creates a jest purchase coordinator instance. */
  constructor(platform: JestPlatformPort, backend: JestBackendPort, options: {
    /** Captures the account before verification so a later grant cannot refresh a replacement session. */
    captureSubscriptionGrantRefresh?: (playerId: string) => (() => Promise<unknown>) | undefined;
  } = {}) {
    this.platform = platform;
    this.backend = backend;
    this.subscriptionBackend = {
      syncSubscriptions: async (signed, playerId) => {
        const refreshProfile = options.captureSubscriptionGrantRefresh?.(playerId);
        const verified = await backend.syncSubscriptions(signed, playerId);
        if ((verified.premiumCoinsAwarded ?? 0) > 0 && refreshProfile) {
          try {
            await refreshProfile();
          } catch (error) {
            // The durable grant remains successful; normal recovery wakes retry the profile read.
            captureBrowserException(error, {component: "jest_purchases", operation: "refresh_subscription_grant"});
          }
        }
        return verified;
      },
    };
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
    return loadSubscriptionCatalog({platform: this.platform, backend: this.subscriptionBackend, playerId, locale});
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
        backend: this.subscriptionBackend,
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
    if (!initialPage) {
      const result = await this.platform.getIncompletePurchases();
      if (result.status !== "success") return result;
      initialPage = result.value;
    }
    if (initialPage.purchases.length === 0 && !initialPage.hasMore) return {status: "success", value: 0};
    const {reconcileJestPurchases} = await import("./purchaseReconciliation");
    return reconcileJestPurchases({platform: this.platform, backend: this.backend, playerId, initialPage});
  }
}
