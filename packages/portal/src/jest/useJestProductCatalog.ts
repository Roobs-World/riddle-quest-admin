import {useCallback, useEffect, useRef, useState} from "react";
import type {ProductSummary} from "@riddle-quest/hosted/hostTypes";
import type {JestPurchaseCoordinator} from "./purchases";
import type {JestSession} from "./types";

/** Describes with platform activity. */
type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;
/** Describes track funnel. */
type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;

/** Loads Jest consumables and subscription offers into one UI catalog. */
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
  /** Confirmed consumables remain owned by one platform player across transient failures. */
  const confirmed = useRef({playerId: session?.player.playerId, products: catalog[0]});
  if (confirmed.current.playerId === session?.player.playerId) confirmed.current.products = catalog[0];
  /** Distinguishes an unavailable refresh from an empty provider catalog. */
  const [catalogState, setCatalogState] = useState({loading: false, error: false});
  /** Rejects responses from superseded refreshes and departed sessions. */
  const generation = useRef(0);
  /** Reloads authoritative catalog presentation without restarting the session. */
  const refresh = useCallback(async () => {
    if (!session) return;
    /** Identifies this refresh for last-request-wins publication. */
    const request = ++generation.current;
    if (confirmed.current.playerId !== session.player.playerId) {
      confirmed.current = {playerId: session.player.playerId, products: []};
      setProducts([]);
    }
    setCatalogState((current) => ({...current, loading: true}));
    await withPlatformActivity(async () => {
      /** Independent provider catalogs share one background loading lifetime. */
      const [products, subscriptions] = await Promise.all([
        purchases.getProducts("en"),
        subscriptionsEnabled
          ? purchases.getSubscriptions(session.player.playerId, "en")
          : Promise.resolve({status: "success", value: []} as const),
      ]);
      return {products, subscriptions};
    }).then(({products, subscriptions}) => {
      if (request !== generation.current) return;
      /** Provides next products behavior. */
      const nextProducts = products.status === "success" ? products.value :
        confirmed.current.products.filter((product) => product.productType !== "subscription");
      /** Provides next subscriptions behavior. */
      const nextSubscriptions = subscriptions.status === "success" ? subscriptions.value : [];
      /** Combines confirmed subscription offers with the current consumable catalog. */
      const nextCatalog = [...nextSubscriptions, ...nextProducts];
      confirmed.current.products = nextCatalog;
      setProducts(nextCatalog);
      setCatalogState({loading: false, error: products.status !== "success" || subscriptions.status !== "success"});
      if (products.status !== "success") trackFunnel("products_load_failed", {status: products.status});
      if (subscriptions.status !== "success") {
        trackFunnel("subscriptions_load_failed", {status: subscriptions.status});
      }
    }).catch(() => {
      if (request === generation.current) {
        /** Preserves confirmed consumables while hiding unconfirmed subscription offers. */
        const consumables = confirmed.current.products.filter((product) => product.productType !== "subscription");
        confirmed.current.products = consumables;
        setProducts(consumables);
        setCatalogState({loading: false, error: true});
      }
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
  return [...catalog, refresh, catalogState] as const;
}
