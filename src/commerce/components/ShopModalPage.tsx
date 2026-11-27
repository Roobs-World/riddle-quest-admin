import {getCoinPackBuyingPower} from "../../progression/economy/rewardRules";
import {DEFAULT_PRODUCT_PRICING} from "../pricing/catalog";
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

/** Renders the one-time offers supplied by the current platform purchase catalog. */
export function ShopModalPage({balance, products, onPurchase}: ShopModalPageProps) {
  const tr = useTranslator();
  const visibleProducts = products.filter((product) => product.productType !== "subscription");
  return (
    <div>
      <div className="shop-balance">
        <img src={coinUrl} alt="" />
        <span>{tr("CoinShop.YOUR_BALANCE")}</span>
        <strong>{balance.toLocaleString()}</strong>
      </div>
      <div className="game-shop-grid">
        {visibleProducts.length === 0 ? <p>{tr("CoinShop.NO_PACKS_AVAILABLE")}</p> : null}
        {visibleProducts.map((product) => {
          const copy = shopProductCopy(product, tr);
          const buyingPower = getCoinPackBuyingPower(product.coins);
          return (
            <article key={product.productId}>
              {copy.badge ? <em>{copy.badge}</em> : null}
              {product.productType !== "durable" ? <img className="shop-product-coins" src={coinUrl} alt="" /> : null}
              <h3 className="shop-product-name">{product.name}</h3>
              {product.productType === "durable" ? (
                <small className="shop-product-description">{product.description}</small>
              ) : (
                <span className="shop-product-amount">{product.coins.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}</span>
              )}
              {product.coins > 0 ? (
                <small className="shop-product-description">
                  {tr("CoinShop.PACK_BUYING_POWER", {
                    hints: buyingPower.hints.toLocaleString(),
                    continues: buyingPower.continues.toLocaleString(),
                  })}
                </small>
              ) : null}
              <button className="play-primary compact" onClick={() => onPurchase(product.productId)}>
                <span className="shop-purchase-label">{tr("CoinShop.PURCHASE_BUTTON")} </span>
                {product.displayPrice}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
