import {useEffect, useState} from "react";
import type {ProductSummary} from "../play/types";
import type {JestPurchaseCoordinator} from "./purchases";
import type {JestSession} from "./types";

/** Describes with platform activity. */
type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;
/** Describes track funnel. */
type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;

/** Loads Jest consumables and registered-player subscriptions into one UI catalog. */
export function useJestProductCatalog({
  purchases,
  session,
  subscriptionsEnabled = false,
  trackFunnel,
  withPlatformActivity,
}: {
  purchases: JestPurchaseCoordinator;
  session: JestSession | null;
  /** Enables the beta subscription offer only in trusted test runtimes. */
  subscriptionsEnabled?: boolean;
  trackFunnel: TrackFunnel;
  withPlatformActivity: WithPlatformActivity;
}) {
  const catalog = useState<ProductSummary[]>([]);
  const [, setProducts] = catalog;
  useEffect(() => {
    if (!session) return;
    void withPlatformActivity(async () => {
      const products = await purchases.getProducts(navigator.language);
      const subscriptions = subscriptionsEnabled && session.player.registered
        ? await purchases.getSubscriptions(session.player.playerId, navigator.language)
        : ({status: "success", value: []} as const);
      return {products, subscriptions};
    }).then(({products, subscriptions}) => {
      const nextProducts = products.status === "success" ? products.value : [];
      const nextSubscriptions = subscriptions.status === "success" ? subscriptions.value : [];
      setProducts([...nextSubscriptions, ...nextProducts]);
      if (products.status !== "success") trackFunnel("products_load_failed", {status: products.status});
      if (subscriptions.status !== "success") {
        trackFunnel("subscriptions_load_failed", {status: subscriptions.status});
      }
    });
  }, [
    purchases,
    session?.player.playerId,
    session?.player.registered,
    setProducts,
    subscriptionsEnabled,
    trackFunnel,
    withPlatformActivity,
  ]);
  return catalog;
}
