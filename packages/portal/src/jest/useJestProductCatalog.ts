import {useCallback, useEffect, useRef, useState} from "react";
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
  /** Stores purchases. */
  purchases: JestPurchaseCoordinator;
  /** Stores session. */
  session: JestSession | null;
  /** Enables the Jest subscription entitlement and offer catalog. */
  subscriptionsEnabled?: boolean;
  /** Stores track funnel. */
  trackFunnel: TrackFunnel;
  /** Stores with platform activity. */
  withPlatformActivity: WithPlatformActivity;
}) {
  /** Provides catalog behavior. */
  const catalog = useState<ProductSummary[]>([]);
  /** Provides [, set products] behavior. */
  const [, setProducts] = catalog;
  /** Rejects responses from superseded refreshes and departed sessions. */
  const generation = useRef(0);
  /** Reloads authoritative catalog presentation without restarting the session. */
  const refresh = useCallback(async () => {
    if (!session) return;
    /** Identifies this refresh for last-request-wins publication. */
    const request = ++generation.current;
    await withPlatformActivity(async () => {
      /** Provides products behavior. */
      const products = await purchases.getProducts(navigator.language);
      /** Provides subscriptions behavior. */
      const subscriptions =
        subscriptionsEnabled && session.player.registered
          ? await purchases.getSubscriptions(session.player.playerId, navigator.language)
          : ({status: "success", value: []} as const);
      return {products, subscriptions};
    }).then(({products, subscriptions}) => {
      if (request !== generation.current) return;
      /** Provides next products behavior. */
      const nextProducts = products.status === "success" ? products.value : [];
      /** Provides next subscriptions behavior. */
      const nextSubscriptions = subscriptions.status === "success" ? subscriptions.value : [];
      setProducts([...nextSubscriptions, ...nextProducts]);
      if (products.status !== "success") trackFunnel("products_load_failed", {status: products.status});
      if (subscriptions.status !== "success") {
        trackFunnel("subscriptions_load_failed", {status: subscriptions.status});
      }
    }).catch(() => {
      if (request === generation.current) setProducts([]);
      trackFunnel("subscriptions_load_failed", {status: "retryable-failure"});
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
  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);
  return [...catalog, refresh] as const;
}
