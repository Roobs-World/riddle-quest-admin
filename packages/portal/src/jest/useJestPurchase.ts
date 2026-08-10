import {useCallback, type Dispatch, type SetStateAction} from "react";
import {trackEvent, trackPurchase} from "../analytics/googleAnalytics";
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
  trackFunnel,
}: {
  products: ProductSummary[];
  purchases: JestPurchaseCoordinator;
  session: JestSession | null;
  setProducts: Dispatch<SetStateAction<ProductSummary[]>>;
  trackFunnel: TrackFunnel;
}) {
  return useCallback(async (productId: string): Promise<PurchaseResult> => {
    if (!session) throw new Error("Jest session is not ready.");
    const product = products.find((candidate) => candidate.productId === productId);
    trackEvent("begin_checkout", {
      value: product?.price,
      currency: product?.currency,
      items: [{
        item_id: productId,
        item_category: product?.productType ?? "consumable",
        price: product?.price ?? 0,
        quantity: 1,
      }],
    });
    if (product?.productType === "subscription") {
      if (!session.player.registered) throw new Error("Registration is required to subscribe.");
      if (product.subscriptionStatus === "active") {
        return {success: true, productId, purchaseType: "subscription"};
      }
      const subscribed = await purchases.subscribe(productId, session.player.playerId);
      if (subscribed.status !== "success") {
        throw new Error("message" in subscribed ? subscribed.message : "Subscription cancelled.");
      }
      setProducts((current) => current
        .filter((candidate) => !subscribed.value.blockedSkus.includes(candidate.productId))
        .map((candidate) => candidate.productType === "subscription"
          ? {
              ...candidate,
              subscriptionStatus: candidate.productId === productId ? "active" : candidate.subscriptionStatus,
              trialEligible: false,
            }
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
    const result = await purchases.purchase(productId, session.player.playerId);
    if (result.status !== "success") {
      throw new Error("message" in result ? result.message : "Purchase cancelled.");
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
  }, [products, purchases, session, setProducts, trackFunnel]);
}
