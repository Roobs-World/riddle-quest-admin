import {getCoinPackBuyingPower} from "@qwordly/core/game";
import {DEFAULT_PRODUCT_PRICING} from "@qwordly/core/pricing/catalog";
import {useSubscriptionManagement} from "./useSubscriptionManagement";
import coinUrl from "../../../../../../assets/images/coin.svg";
import {useTranslator} from "../../i18n";
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

/** Localizes game-owned fallback copy while preserving provider-authored descriptions. */
function shopProductCopy(product: ProductSummary, tr: ReturnType<typeof useTranslator>) {
  /** Game-owned pricing metadata used only for localized fallback copy. */
  const local = DEFAULT_PRODUCT_PRICING.find((item) => item.productId === product.productId);
  /** Maps catalog badge codes to the existing translated shop labels. */
  const badgeKeys: Record<string, string> = {
    STARTER: "CoinShop.BADGE_STARTER",
    POPULAR: "CoinShop.BADGE_POPULAR",
    "BEST VALUE": "CoinShop.BADGE_BEST_VALUE",
  };
  return {
    description: local && product.description === local.description
      ? tr("CoinShop.PACK_DESCRIPTION", {coins: product.coins.toLocaleString()}) : product.description,
    badge: local && product.featuredBadge === local.featuredBadge && local.featuredBadge
      ? tr(badgeKeys[local.featuredBadge]) : product.featuredBadge,
  };
}

/**
 * Localized subscription benefits, limited to what the game actually provides.
 *
 * The verified Jest entitlement only records Premium status on the account
 * (`hasActiveSubscription`); it grants no coins, hints or other gameplay items.
 * Add a benefit here only after its server-authoritative grant exists.
 */
export const SUBSCRIPTION_BENEFIT_KEYS = [
  "CoinShop.SUBSCRIPTION_BENEFIT_STATUS",
  "CoinShop.SUBSCRIPTION_BENEFIT_SUPPORT",
  "CoinShop.SUBSCRIPTION_BENEFIT_RENEWAL",
] as const;

/** Renders products supplied by the Jest platform purchase catalog. */
export function ShopModalPage({balance, products, onPurchase}: ShopModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Provider refresh state controls the shop's loading presentation. */
  const {loading, catalogError, retryCatalog} = useSubscriptionManagement();
  /** Whether current catalog entitlements already include an active subscription. */
  const hasActiveSubscription = products.some((product) => product.productType === "subscription" && product.subscriptionStatus === "active");
  /** Offers eligible for display while preserving the currently active subscription. */
  const visibleProducts = products.filter((product) => product.productType !== "subscription" || !hasActiveSubscription || product.subscriptionStatus === "active");
  return (
    <div>
      <div className="shop-balance">
        <img src={coinUrl} alt="" />
        <span>{tr("CoinShop.YOUR_BALANCE")}</span>
        <strong>{balance.toLocaleString()}</strong>
      </div>
      {catalogError ? (
        <div className="shop-catalog-error" role="alert">
          <p>{tr("ErrorMessages.FAILED_TO_LOAD_SHOP_PRODUCTS")}</p>
          <button className="play-secondary compact" disabled={loading} onClick={() => { void retryCatalog?.(); }}>
            {tr("CommonButtons.RETRY")}
          </button>
        </div>
      ) : null}
      <div className="game-shop-grid" aria-busy={loading}>
        {loading && products.length === 0 ? <p role="status">{tr("Accessibility.LOADING")}</p> : null}
        {!loading && !catalogError && products.length === 0 ? <p>{tr("CoinShop.NO_PACKS_AVAILABLE")}</p> : null}
        {visibleProducts.map((product) => {
          /** Localized game-owned labels and provider-authored product description. */
          const copy = shopProductCopy(product, tr);
          /** Whole-action alternatives explain the actual value of the provider coin grant. */
          const buyingPower = getCoinPackBuyingPower(product.coins);
          return (
          <article
            key={product.productId}
            className={product.productType === "subscription" ? "shop-subscription-card" : undefined}
          >
            {copy.badge ? <em>{copy.badge}</em> : null}
            {product.productType === "subscription" ? (
              <span className="shop-subscription-icon" aria-hidden="true">
                ★
              </span>
            ) : (
              <img className="shop-product-coins" src={coinUrl} alt="" />
            )}
            <h3 className="shop-product-name">{product.name}</h3>
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
            <small className="shop-product-description">{copy.description}</small>
            {product.productType === "subscription" ? (
              <div className="shop-subscription-benefits">
                <strong>{tr("CoinShop.SUBSCRIPTION_BENEFITS_TITLE")}</strong>
                <ul>
                  {SUBSCRIPTION_BENEFIT_KEYS.map((key) => <li key={key}>{tr(key)}</li>)}
                </ul>
                <small>{tr("CoinShop.SUBSCRIPTION_COINS_NOTE")}</small>
              </div>
            ) : null}
            {product.productType !== "subscription" && product.coins > 0 ? (
              <small className="shop-product-description">
                {tr("CoinShop.PACK_BUYING_POWER", {
                  hints: buyingPower.hints.toLocaleString(),
                  continues: buyingPower.continues.toLocaleString(),
                })}
              </small>
            ) : null}
            {product.subscriptionStatus !== "active" ? (
            <button
              className="play-primary compact"
              disabled={catalogError}
              onClick={() => onPurchase(product.productId)}
            >
              {product.productType === "subscription" ? (
                product.trialEligible ? (
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
            ) : null}
          </article>
          );
        })}
      </div>
    </div>
  );
}
