import {useCallback, type Dispatch, type SetStateAction} from "react";
import {tr} from "../play/i18n";
import {trackEvent, trackPurchase} from "../analytics/events";
import type {ProductSummary, PurchaseResult} from "../play/types";
import type {JestPurchaseCoordinator} from "./purchases";
import type {JestSession} from "./types";

/** Describes track funnel. */
type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;

/** Coordinates catalog purchases and keeps subscription presentation in sync. */
export function useJestPurchase({
  products,
  purchases,
  session,
  setProducts,
  subscriptionsEnabled = false,
  trackFunnel,
}: {
  /** Stores products. */
  products: ProductSummary[];
  /** Stores purchases. */
  purchases: JestPurchaseCoordinator;
  /** Stores session. */
  session: JestSession | null;
  /** Stores set products. */
  setProducts: Dispatch<SetStateAction<ProductSummary[]>>;
  /** Enables the Jest subscription catalog and checkout. */
  subscriptionsEnabled?: boolean;
  /** Stores track funnel. */
  trackFunnel: TrackFunnel;
}) {
  return useCallback(
    async (productId: string): Promise<PurchaseResult> => {
      if (!session) throw new Error("Jest session is not ready.");
      /** Provides product behavior. */
      const product = products.find((candidate) => candidate.productId === productId);
      if (product?.productType === "subscription" && !subscriptionsEnabled) {
        throw new Error("Subscriptions are not available.");
      }
      trackEvent("begin_checkout", {
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
        if (!session.player.registered) throw new Error("Registration is required to subscribe.");
        if (product.subscriptionStatus === "active") {
          return {success: true, productId, purchaseType: "subscription"};
        }
        /** Checks current holdings immediately before checkout. */
        const catalog = await purchases.getSubscriptions(session.player.playerId, navigator.language);
        if (catalog.status !== "success") throw new Error(tr("ErrorMessages.FAILED_TO_LOAD_SHOP_PRODUCTS"));
        setProducts((current) => [...catalog.value, ...current.filter((entry) => entry.productType !== "subscription")]);
        /** Finds the currently purchasable subscription. */
        const offer = catalog.value.find((entry) => entry.productId === productId);
        if (!offer || offer.subscriptionStatus === "active") {
          return {success: false, cancelled: true, productId, purchaseType: "subscription"};
        }
        /** Provides subscribed behavior. */
        const subscribed = await purchases.subscribe(productId, session.player.playerId);
        if (subscribed.status === "cancelled") {
          trackFunnel("subscription_cancelled", {productId});
          return {success: false, cancelled: true, productId, purchaseType: "subscription"};
        }
        if (subscribed.status !== "success") {
          throw new Error(subscribed.message);
        }
        setProducts((current) => current
          .filter((candidate) => candidate.productId === subscribed.value.activeSku ||
            !subscribed.value.blockedSkus.includes(candidate.productId))
          .map((candidate) => candidate.productId === subscribed.value.activeSku
            ? {...candidate, subscriptionStatus: "active", trialEligible: false}
            : candidate));
        trackFunnel("subscription_completed", {productId});
        trackPurchase({
          productId,
          purchaseType: "subscription",
          price: product.price,
          currency: product.currency,
        });
        return {success: true, productId, purchaseType: "subscription"};
      }
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
      trackPurchase({
        productId,
        purchaseType: "consumable",
        price: product?.price,
        currency: product?.currency,
      });
      return {
        success: true,
        productId,
        purchaseType: "consumable",
        coinsAwarded: result.value.coinsAwarded,
        newCoins: result.value.newCoins,
        newlyUnlockedAchievementIds: result.value.newlyUnlockedAchievementIds,
      };
    },
    [products, purchases, session, setProducts, subscriptionsEnabled, trackFunnel],
  );
}
