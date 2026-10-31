import type {JestBackendPort} from "./backend";
import type {JestPlatformPort, PlatformResult} from "./types";
import {DEFAULT_PRODUCT_PRICING} from "@qwordly/core/pricing/catalog";
import type {ProductSummary} from "../play/types";
import {captureBrowserException} from "../observability/browserErrorReporter";

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

/** Indicates whether is currency. */
const isCurrency = (value: string) => /^[A-Z]{3}$/.test(value);

/**
 * Returns a locale Intl accepts, or undefined for the runtime default.
 *
 * Browsers can report non-BCP 47 tags such as "en-US@posix"; passing one to
 * Intl.NumberFormat throws and would fail the whole shop catalog.
 */
export const priceLocale = (locale?: string): string | undefined => {
  if (!locale) return undefined;
  try {
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return undefined;
  }
};

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
    /** Provides local catalog behavior. */
    const localCatalog = new Map(DEFAULT_PRODUCT_PRICING.map((product) => [product.productId, product]));
    return {
      status: "success",
      value: result.value.flatMap((product) => {
        /** Provides local behavior. */
        const local = localCatalog.get(product.sku);
        if (!local || !Number.isFinite(product.price) || !isCurrency(product.currency)) return [];
        return [
          {
            productId: product.sku,
            name: product.name || local.name,
            description: product.description || local.description,
            coins: local.coins,
            displayPrice: new Intl.NumberFormat(priceLocale(locale), {
              style: "currency",
              currency: product.currency,
            }).format(product.price),
            price: product.price,
            currency: product.currency,
            featuredBadge: local.featuredBadge,
          },
        ];
      }),
    };
  }

  /** Gets subscriptions. */
  async getSubscriptions(playerId: string, locale?: string): Promise<PlatformResult<ProductSummary[]>> {
    /** Provides result behavior. */
    const result = await this.platform.getSubscriptions();
    if (result.status !== "success") return result;
    if (typeof result.value.subscriptionsSigned !== "string") {
      return {status: "retryable-failure", message: "Jest returned unsigned subscription data"};
    }
    /** Provides active skus behavior. */
    let activeSkus: Set<string>;
    /** Provides blocked skus behavior. */
    let blockedSkus: Set<string>;
    try {
      /** Provides verified behavior. */
      const verified = await this.backend.syncSubscriptions(result.value.subscriptionsSigned, playerId);
      activeSkus = new Set(verified.activeSkus);
      blockedSkus = new Set(verified.blockedSkus ?? []);
    } catch (error) {
      captureBrowserException(error, {component: "jest_purchases", operation: "sync_subscriptions"});
      return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
    }
    /** Any existing holding suppresses alternative offers for the same Premium entitlement. */
    const hasActiveSubscription = activeSkus.size > 0 || result.value.subscriptions.some((entry) =>
      entry.status === "active");
    return {
      status: "success",
      value: result.value.subscriptions.flatMap((subscription) => {
        // SDK state can suppress a sale; only the backend grants paid access.
        /** Suppresses checkout when either source reports an existing holding. */
        const active = activeSkus.has(subscription.sku) || subscription.status === "active";
        if (!active && (hasActiveSubscription || blockedSkus.has(subscription.sku))) return [];
        if (
          !Number.isFinite(subscription.price) ||
          !isCurrency(subscription.currency) ||
          !["weekly", "monthly", "yearly"].includes(subscription.billingPeriod)
        ) {
          return [];
        }
        return [
          {
            productId: subscription.sku,
            productType: "subscription" as const,
            name: subscription.displayName,
            description: subscription.displayDescription ?? "",
            coins: 0,
            displayPrice: new Intl.NumberFormat(priceLocale(locale), {
              style: "currency",
              currency: subscription.currency,
            }).format(subscription.price),
            price: subscription.price,
            currency: subscription.currency,
            billingPeriod: subscription.billingPeriod,
            subscriptionStatus: active ? "active" as const : "inactive" as const,
            trialEligible: !active && subscription.trialEligible,
          },
        ];
      }),
    };
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
    }>
  > {
    /** Starts ed. */
    const started = await this.platform.beginPurchase(productSku);
    if (started.status !== "success") return started;
    try {
      /** Provides grant behavior. */
      const grant = await this.backend.grantPurchase(
        started.value.purchaseSigned,
        playerId,
        started.value.purchase.purchaseToken,
      );
      try {
        /** Provider confirmation cannot undo a grant already accepted by the game authority. */
        const completed = await this.platform.completePurchase(started.value.purchase.purchaseToken);
        if (completed.status !== "success") throw new Error("message" in completed ? completed.message : completed.status);
      } catch (error) {
        captureBrowserException(error, {component: "jest_purchases", operation: "complete_purchase"});
      }
      return {
        status: "success",
        value: {
          coinsAwarded: grant.coinsAwarded,
          newCoins: grant.newCoins,
          newlyUnlockedAchievementIds: grant.newlyUnlockedAchievementIds,
          ...(started.value.purchase.sandbox === true ? {sandbox: true} : {}),
        },
      };
    } catch (error) {
      captureBrowserException(error, {component: "jest_purchases", operation: "purchase"});
      return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
    }
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
    return {status: "terminal-failure", message: "Incomplete purchase pagination exceeded safety limit"};
  }
}
