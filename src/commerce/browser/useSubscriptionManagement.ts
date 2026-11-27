import {trackEvent} from "../../observability/analytics/events";
import {useContext, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {ShopSubscriptionContext} from "./ShopSubscriptionContext";

/** Refreshes authoritative offers and tracks cancellation without revoking current access. */
export function useSubscriptionManagement() {
  /** Reads the current target’s subscription operations. */
  const subscriptions = useContext(ShopSubscriptionContext);
  const lifetime = useMemo(() => ({active: false}), [subscriptions]);
  useLayoutEffect(() => {
    lifetime.active = true;
    return () => {lifetime.active = false;};
  }, [lifetime]);
  /** Current target's authoritative catalog refresh operation. */
  const refreshCatalog = subscriptions?.refresh;
  /** Exposes the opening provider refresh to assistive technology. */
  const [loading, setLoading] = useState(Boolean(subscriptions));
  /** Disables cancellation controls during provider confirmation. */
  const [pending, setPending] = useState<string | null>(null);
  /** Records successful cancellations for this modal visit. */
  const [cancelled, setCancelled] = useState<string[]>([]);
  /** Stops repeated requests when the provider has no cancellable subscription. */
  const [unavailable, setUnavailable] = useState<string[]>([]);
  /** Displays localized cancellation failure feedback. */
  const [error, setError] = useState(false);
  /** Prevents duplicate cancellation and competing periodic refreshes. */
  const busy = useRef(false);
  useEffect(() => {
    if (!refreshCatalog) return;
    /** Prevents updates after the modal closes. */
    let disposed = false;
    /** Avoids overlapping periodic catalog requests. */
    let refreshing = false;
    /** Reconciles external subscription changes while the modal is visible. */
    const refresh = async () => {
      if (refreshing || busy.current) return;
      refreshing = true;
      try {
        await refreshCatalog();
      } finally {
        refreshing = false;
        if (!disposed) setLoading(false);
      }
    };
    void refresh();
    /** Leaves room below the signed endpoint’s 30/minute limit for focus and user actions. */
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10_000);
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refreshCatalog]);
  /** Cancels renewal without changing the entitlement locally. */
  const cancel = async (sku: string) => {
    if (!subscriptions || busy.current) return;
    busy.current = true;
    if (lifetime.active) trackEvent("subscription_cancellation_requested", {product_id: sku});
    setPending(sku);
    setError(false);
    try {
      /** Distinguishes confirmation, dismissal and failure. */
      const result = await subscriptions.cancel(sku);
      if (lifetime.active) trackEvent("subscription_cancellation_result", {product_id: sku, status: result});
      if (result === "success") setCancelled((current) => [...current, sku]);
      if (result === "unavailable") setUnavailable((current) => [...current, sku]);
      if (result === "error") setError(true);
    } catch {
      if (lifetime.active) trackEvent("subscription_cancellation_result", {product_id: sku, status: "error"});
      setError(true);
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return {loading: loading || Boolean(subscriptions?.catalogLoading), pending, cancelled, unavailable, error, cancel,
    subscriptionsEnabled: Boolean(subscriptions?.subscriptionsEnabled),
    catalogError: Boolean(subscriptions?.catalogError), retryCatalog: subscriptions?.refresh,
    products: subscriptions?.products ?? []};
}
