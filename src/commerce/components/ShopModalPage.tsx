import {getCoinPackBuyingPower} from "../../progression/economy/rewardRules";
import {DEFAULT_PRODUCT_PRICING, PREMIUM_SUBSCRIPTION_MONTHLY_COINS} from "../pricing/catalog";
import {useSubscriptionManagement} from "../browser/useSubscriptionManagement";
import coinUrl from "../../../assets/images/coin.svg";
import {useTranslator} from "../../localization/browser/i18n";
import type {ProductSummary} from "../../platform/contracts/hostServices";

/** Inputs required to display the platform product catalog. */
export type ShopModalPageProps = {
  /** Stores balance. */
  balance: number;
  /** Stores products. */
  products: readonly ProductSummary[];
  /** Stores on purchase. */
  onPurchase: (productId: string) => void;
};

/** Localizes game-owned product badges. */
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
    badge: local && product.featuredBadge === local.featuredBadge && local.featuredBadge
      ? tr(badgeKeys[local.featuredBadge]) : product.featuredBadge,
  };
}

/**
 * Localized subscription benefits, limited to what the game actually provides.
 *
 * The verified provider entitlement records Premium status on the account
 * (`hasActiveSubscription`) and the server grants
 * `PREMIUM_SUBSCRIPTION_MONTHLY_COINS` every 30 days while it stays active.
 * Add a benefit here only after its server-authoritative grant exists.
 */
export const SUBSCRIPTION_BENEFIT_KEYS = [
  "CoinShop.SUBSCRIPTION_BENEFIT_COINS",
  "CoinShop.SUBSCRIPTION_BENEFIT_STATUS",
  "CoinShop.SUBSCRIPTION_BENEFIT_SUPPORT",
  "CoinShop.SUBSCRIPTION_BENEFIT_RENEWAL",
] as const;

/** Subscription information is available before provider pricing and ownership resolve. */
function SubscriptionBenefits() {
  const tr = useTranslator();
  return (
    <div className="shop-subscription-benefits">
      <strong>{tr("CoinShop.SUBSCRIPTION_BENEFITS_TITLE")}</strong>
      <ul>
        {SUBSCRIPTION_BENEFIT_KEYS.map((key) => (
          <li key={key}>{tr(key, {coins: PREMIUM_SUBSCRIPTION_MONTHLY_COINS.toLocaleString()})}</li>
        ))}
      </ul>
    </div>
  );
}

/** Renders products supplied by the current platform purchase catalog. */
export function ShopModalPage({balance, products, onPurchase}: ShopModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Provider refresh state controls the shop's loading presentation. */
  const {loading, catalogError, retryCatalog, subscriptionsEnabled} = useSubscriptionManagement();
  /** Whether current catalog entitlements already include an active subscription. */
  const hasActiveSubscription = products.some((product) => product.productType === "subscription" && product.subscriptionStatus === "active");
  /** Keep subscription details visible while fresh ownership controls checkout separately. */
  const visibleProducts = products.filter((product) => product.productType !== "subscription" ||
    product.subscriptionStatus === "active" || !hasActiveSubscription);
  const showSubscriptionOverview = subscriptionsEnabled && !products.some((product) => product.productType === "subscription");
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
      <div className="game-shop-grid" aria-busy={loading && !showSubscriptionOverview && visibleProducts.length === 0}>
        {showSubscriptionOverview ? (
          <article className="shop-subscription-card">
            <span className="shop-subscription-icon" aria-hidden="true">★</span>
            <SubscriptionBenefits />
          </article>
        ) : null}
        {loading && products.length === 0 ? <p role="status">{tr("Accessibility.LOADING")}</p> : null}
        {!loading && !catalogError && products.length === 0 ? <p>{tr("CoinShop.NO_PACKS_AVAILABLE")}</p> : null}
        {visibleProducts.map((product) => {
          /** Localized game-owned product badge. */
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
            ) : product.productType === "durable" ? null : (
              <img className="shop-product-coins" src={coinUrl} alt="" />
            )}
            <h3 className="shop-product-name">{product.name}</h3>
            {product.productType === "subscription" ? (
              <span className="shop-product-amount">
                {product.subscriptionStatus === "active"
                  ? tr("CoinShop.SUBSCRIPTION_ACTIVE")
                  : `${product.displayPrice} / ${tr(`CoinShop.PERIOD_${product.billingPeriod?.toUpperCase() ?? "MONTHLY"}`)}`}
              </span>
            ) : product.productType === "durable" ? null : (
              <span className="shop-product-amount">
                {product.coins.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}
              </span>
            )}
            {(product.productType === "subscription" || product.productType === "durable") && product.description ? (
              <small className="shop-product-description">{product.description}</small>
            ) : null}
            {product.productType === "subscription" ? <SubscriptionBenefits /> : null}
            {product.productType !== "subscription" && product.coins > 0 ? (
              <small className="shop-product-description">
                {tr("CoinShop.PACK_BUYING_POWER", {
                  hints: buyingPower.hints.toLocaleString(),
                  continues: buyingPower.continues.toLocaleString(),
                })}
              </small>
            ) : null}
            {product.subscriptionStatus !== "active" &&
              (product.productType !== "subscription" || (!loading && !catalogError)) ? (
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
