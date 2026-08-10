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
  return (
    <div>
      <div className="shop-balance">
        <img src={coinUrl} alt="" />
        <span>{tr("CoinShop.YOUR_BALANCE")}</span>
        <strong>{balance.toLocaleString()}</strong>
      </div>
      <div className="game-shop-grid">
        {products.length === 0 ? <p>{tr("CoinShop.NO_PACKS_AVAILABLE")}</p> : null}
        {products.map((product) => (
          <article
            key={product.productId}
            className={product.productType === "subscription" ? "shop-subscription-card" : undefined}
          >
            {product.featuredBadge ? <em>{product.featuredBadge}</em> : null}
            {product.productType === "subscription"
              ? <span className="shop-subscription-icon" aria-hidden="true">★</span>
              : <img className="shop-product-coins" src={coinUrl} alt="" />}
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
            <button
              className="play-primary compact"
              disabled={product.subscriptionStatus === "active"}
              onClick={() => onPurchase(product.productId)}
            >
              {product.productType === "subscription" ? (
                product.subscriptionStatus === "active"
                  ? tr("CoinShop.SUBSCRIBED_BUTTON")
                  : product.trialEligible
                    ? tr("CoinShop.START_TRIAL_BUTTON")
                    : tr("CoinShop.SUBSCRIBE_BUTTON")
              ) : (
                <>
                  <span className="shop-purchase-label">{tr("CoinShop.PURCHASE_BUTTON")} </span>
                  {product.displayPrice}
                </>
              )}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
