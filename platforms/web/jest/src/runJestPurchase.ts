import {tr} from "../../../../src/localization/browser/i18n";
import {trackEvent, trackPurchase} from "../../../../src/observability/analytics/events";
import type {PurchaseResult} from "../../../../src/platform/contracts/hostServices";
import type {JestPurchaseOptions} from "./useJestPurchase";

/** Loads the paid flow only after a player explicitly requests checkout. */
export async function runJestPurchase({productId, products, purchases, session, setProducts, subscriptionsEnabled = false, trackFunnel}: JestPurchaseOptions & {productId: string}): Promise<PurchaseResult> {
  if (!session) throw new Error("Jest session is not ready.");
  /** Provides product behavior. */
  const product = products.find((candidate) => candidate.productId === productId);
  if (product?.productType === "subscription" && !subscriptionsEnabled) {
    throw new Error("Subscriptions are not available.");
  }
  /** Records checkout intent only after the requested offer is available. */
  const trackCheckout = () => trackEvent("begin_checkout", {
    value: product?.price,
    currency: product?.currency,
    items: [
      {
        item_id: productId,
        item_category: product?.productType ?? "consumable",
        price: product?.price ?? 0,
        quantity: 1,
      },
    ],
  });
  if (product?.productType === "subscription") {
    if (product.subscriptionStatus === "active") {
      return {success: false, cancelled: true, productId, purchaseType: "subscription"};
    }
    /** Distinguishes catalog verification failure from a later checkout failure. */
    let catalogVerified = false;
    /** Allows cancellation telemetry only when a payable offer was presented. */
    let checkoutAvailable = false;
    /** Provides subscribed behavior. */
    const subscribed = await purchases.subscribe(productId, session.player.playerId, {
      locale: "en",
      onCatalog: (catalog) => {
        catalogVerified = true;
        setProducts((current) => [...catalog, ...current.filter((entry) => entry.productType !== "subscription")]);
        /** Refreshed offer used to decide whether checkout can proceed. */
        const offer = catalog.find((entry) => entry.productId === productId);
        if (offer && offer.subscriptionStatus !== "active") {
          checkoutAvailable = true;
          trackCheckout();
        }
      },
    });
    if (subscribed.status === "cancelled" ||
      (subscribed.status === "unavailable" && subscribed.message === "guest_not_allowed")) {
      if (checkoutAvailable) trackFunnel("subscription_cancelled", {productId});
      return {success: false, cancelled: true, productId, purchaseType: "subscription"};
    }
    if (subscribed.status !== "success") {
      throw new Error(catalogVerified ? subscribed.message : tr("ErrorMessages.FAILED_TO_LOAD_SHOP_PRODUCTS"));
    }
    setProducts((current) => current
      .filter((candidate) => candidate.productType !== "subscription" ||
        candidate.productId === subscribed.value.activeSku)
      .map((candidate) => candidate.productId === subscribed.value.activeSku
        ? {...candidate, subscriptionStatus: "active", trialEligible: false}
        : candidate));
    if (subscribed.value.recoveredExistingSubscription === true) {
      return {success: false, cancelled: true, productId, purchaseType: "subscription"};
    }
    trackFunnel("subscription_completed", {productId});
    if (subscribed.value.sandbox !== true) {
      trackPurchase({
        productId,
        transactionId: subscribed.value.analyticsTransactionId,
        purchaseType: "subscription",
        price: product.price,
        currency: product.currency,
      });
    }
    return {
      success: true,
      productId,
      purchaseType: "subscription",
      ...(subscribed.value.premiumCoinsAwarded > 0 && subscribed.value.newCoins !== undefined
        ? {coinsAwarded: subscribed.value.premiumCoinsAwarded, newCoins: subscribed.value.newCoins}
        : {}),
    };
  }
  trackCheckout();
  /** Provides result behavior. */
  const result = await purchases.purchase(productId, session.player.playerId);
  if (result.status === "cancelled") {
    trackFunnel("purchase_cancelled", {productId});
    return {success: false, cancelled: true, productId, purchaseType: "consumable"};
  }
  if (result.status !== "success") {
    throw new Error(result.message);
  }
  trackFunnel("purchase_completed", {productId});
  if (result.value.sandbox !== true) {
    trackPurchase({
      productId,
      transactionId: result.value.analyticsTransactionId,
      purchaseType: "consumable",
      price: product?.price,
      currency: product?.currency,
    });
  }
  return {
    success: true,
    productId,
    purchaseType: "consumable",
    coinsAwarded: result.value.coinsAwarded,
    newCoins: result.value.newCoins,
    newlyUnlockedAchievementIds: result.value.newlyUnlockedAchievementIds,
  };
}
