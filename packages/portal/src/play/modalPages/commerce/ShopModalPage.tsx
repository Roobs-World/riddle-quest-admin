import {useContext, useEffect, useRef, useState} from "react";
import {ShopSubscriptionContext} from "./ShopSubscriptionContext";
import coinUrl from "../../../../../../assets/images/coin.svg";
import {tr} from "../../i18n";
import type {ProductSummary} from "../../types";

/** Inputs required to display the platform product catalog. */
export type ShopModalPageProps = {
  /** Stores balance. */
  balance: number;
  /** Stores products. */
  products: readonly ProductSummary[];
  /** Stores on purchase. */
  onPurchase: (productId: string) => void;
};

/** Renders products supplied by the Jest platform purchase catalog. */
export function ShopModalPage({balance, products, onPurchase}: ShopModalPageProps) {
  /** Reads the current target’s subscription operations. */
  const subscriptions = useContext(ShopSubscriptionContext);
  /** Hides stale subscription offers during the initial shop refresh. */
  const [loading, setLoading] = useState(Boolean(subscriptions));
  /** Disables cancellation controls during provider confirmation. */
  const [pending, setPending] = useState<string | null>(null);
  /** Records successful cancellations for this shop visit. */
  const [cancelled, setCancelled] = useState<string[]>([]);
  /** Displays localized cancellation failure feedback. */
  const [error, setError] = useState(false);
  /** Prevents duplicate cancellation and competing periodic refreshes. */
  const busy = useRef(false);
  useEffect(() => {
    if (!subscriptions) return;
    /** Prevents updates after the shop closes. */
    let disposed = false;
    /** Avoids overlapping periodic catalog requests. */
    let refreshing = false;
    /** Reconciles external subscription changes while the shop is visible. */
    const refresh = async () => {
      if (refreshing || busy.current) return;
      refreshing = true;
      try {
        await subscriptions.refresh();
      } finally {
        refreshing = false;
        if (!disposed) setLoading(false);
      }
    };
    void refresh();
    /** Checks for Config-panel changes that do not generate a focus event. */
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 2000);
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [subscriptions]);
  /** Cancels renewal without changing the entitlement locally. */
  const cancel = async (sku: string) => {
    if (!subscriptions || busy.current) return;
    busy.current = true;
    setPending(sku);
    setError(false);
    try {
      /** Distinguishes confirmation, dismissal and failure. */
      const result = await subscriptions.cancel(sku);
      if (result === "success") setCancelled((current) => [...current, sku]);
      if (result === "error") setError(true);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <div>
      <div className="shop-balance">
        <img src={coinUrl} alt="" />
        <span>{tr("CoinShop.YOUR_BALANCE")}</span>
        <strong>{balance.toLocaleString()}</strong>
      </div>
      {error ? <p role="alert">{tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR")}</p> : null}
      <div className="game-shop-grid" aria-busy={loading}>
        {products.length === 0 ? <p>{tr("CoinShop.NO_PACKS_AVAILABLE")}</p> : null}
        {products.filter((product) => !loading || product.productType !== "subscription").map((product) => (
          <article
            key={product.productId}
            className={product.productType === "subscription" ? "shop-subscription-card" : undefined}
          >
            {product.featuredBadge ? <em>{product.featuredBadge}</em> : null}
            {product.productType === "subscription" ? (
              <span className="shop-subscription-icon" aria-hidden="true">
                ★
              </span>
            ) : (
              <img className="shop-product-coins" src={coinUrl} alt="" />
            )}
            <strong className="shop-product-name">{product.name}</strong>
            {product.productType === "subscription" ? (
              <span className="shop-product-amount">
                {product.subscriptionStatus === "active"
                  ? tr("CoinShop.SUBSCRIPTION_ACTIVE")
                  : `${product.displayPrice} / ${tr(`CoinShop.PERIOD_${product.billingPeriod?.toUpperCase() ?? "MONTHLY"}`)}`}
              </span>
            ) : (
              <span className="shop-product-amount">
                {product.coins.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}
              </span>
            )}
            <small className="shop-product-description">{product.description}</small>
            {product.subscriptionStatus === "active" && subscriptions ? (
              <>
                <button className="play-primary compact" disabled={pending !== null || cancelled.includes(product.productId)}
                  onClick={() => void cancel(product.productId)}>
                  {tr("CoinShop.CANCEL_SUBSCRIPTION")}
                </button>
                {cancelled.includes(product.productId) ? <small role="status">{tr("CoinShop.SUBSCRIPTION_CANCELLED_NOTICE")}</small> : null}
              </>
            ) : (
            <button
              className="play-primary compact"
              disabled={product.subscriptionStatus === "active"}
              onClick={() => onPurchase(product.productId)}
            >
              {product.productType === "subscription" ? (
                product.subscriptionStatus === "active" ? (
                  tr("CoinShop.SUBSCRIBED_BUTTON")
                ) : product.trialEligible ? (
                  tr("CoinShop.START_TRIAL_BUTTON")
                ) : (
                  tr("CoinShop.SUBSCRIBE_BUTTON")
                )
              ) : (
                <>
                  <span className="shop-purchase-label">{tr("CoinShop.PURCHASE_BUTTON")} </span>
                  {product.displayPrice}
                </>
              )}
            </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
