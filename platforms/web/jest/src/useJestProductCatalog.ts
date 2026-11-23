import {useCallback, useEffect, useRef, useState} from "react";
import type {ProductSummary} from "../../../../src/hosted/hostTypes";
import type {JestPurchaseCoordinator} from "./purchases";
import type {JestSession} from "./types";

/** Describes with platform activity. */
type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;
/** Describes track funnel. */
type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;
/** Background wakes share the existing subscription-panel polling interval. */
const BACKGROUND_CATALOG_FRESHNESS_MS = 10_000;
/** Provider and backend identity that owns one admitted catalog read. */
type CatalogOwner = Pick<JestSession, "firebaseUid"> & Pick<JestSession["player"], "playerId" | "registered">;
/** Prevents a pending read or recent catalog from crossing an account replacement. */
const ownsCatalog = (owner: CatalogOwner, session: JestSession) =>
  owner.playerId === session.player.playerId && owner.firebaseUid === session.firebaseUid &&
  owner.registered === session.player.registered;

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
  const confirmed = useRef({playerId: session?.player.playerId, firebaseUid: session?.firebaseUid, products: catalog[0]});
  if (confirmed.current.playerId === session?.player.playerId && confirmed.current.firebaseUid === session?.firebaseUid) {
    confirmed.current.products = catalog[0];
  }
  /** Distinguishes an unavailable refresh from an empty provider catalog. */
  const [catalogState, setCatalogState] = useState({loading: false, error: false});
  /** Rejects responses from superseded refreshes and departed sessions. */
  const generation = useRef(0);
  /** Background signals can await an already admitted read for the same committed account. */
  const pending = useRef<(CatalogOwner & {
    /** Generation that admitted this read. */
    generation: number;
    /** Catalog publication awaited by every overlapping caller. */
    promise: Promise<void>;
  }) | null>(null);
  /** Background freshness never prevents an explicit catalog refresh. */
  const lastRead = useRef<(CatalogOwner & {
    /** Start time bounds provider-read frequency during rapid browser focus changes. */
    startedAt: number;
  }) | null>(null);
  /** Reloads authoritative catalog presentation without restarting the session. */
  const refresh = useCallback((): Promise<void> => {
    if (!session) return Promise.resolve();
    /** Identifies this refresh for last-request-wins publication. */
    const request = ++generation.current;
    if (confirmed.current.playerId !== session.player.playerId || confirmed.current.firebaseUid !== session.firebaseUid) {
      confirmed.current = {playerId: session.player.playerId, firebaseUid: session.firebaseUid, products: []};
      setProducts([]);
    }
    setCatalogState((current) => ({...current, loading: true}));
    /** Exact account captured before admitting provider and backend work. */
    const owner = {playerId: session.player.playerId, registered: session.player.registered, firebaseUid: session.firebaseUid};
    lastRead.current = {...owner, startedAt: Date.now()};
    /** Provider reads and publication share one account-owned completion. */
    const promise = withPlatformActivity(async () => {
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
    /** Exact admitted read whose settlement may clear the shared slot. */
    const admitted = {...owner, generation: request, promise};
    pending.current = admitted;
    void promise.then(() => { if (pending.current === admitted) pending.current = null; });
    return promise;
  }, [
    purchases,
    session?.player.playerId,
    session?.player.registered,
    session?.firebaseUid,
    setProducts,
    subscriptionsEnabled,
    trackFunnel,
    withPlatformActivity,
  ]);
  /** Routine browser wakes reuse recent reads while explicit checkout and UI refreshes stay fresh. */
  const refreshBackground = useCallback((): Promise<void> => {
    if (!session || (typeof document !== "undefined" && document.visibilityState === "hidden")) return Promise.resolve();
    if (pending.current && pending.current.generation === generation.current && ownsCatalog(pending.current, session)) {
      return pending.current.promise;
    }
    /** A backwards wall-clock adjustment must not preserve a catalog indefinitely. */
    const elapsed = lastRead.current ? Date.now() - lastRead.current.startedAt : -1;
    if (lastRead.current && ownsCatalog(lastRead.current, session) && elapsed >= 0 &&
      elapsed < BACKGROUND_CATALOG_FRESHNESS_MS) return Promise.resolve();
    return refresh();
  }, [refresh, session?.player.playerId, session?.player.registered, session?.firebaseUid]);
  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);
  return [...catalog, refresh, catalogState, refreshBackground] as const;
}
