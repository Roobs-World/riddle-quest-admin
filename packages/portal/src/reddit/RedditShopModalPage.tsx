import coinUrl from "../../../../assets/images/coin.svg";
import type {ProductSummary} from "../play/types";
import {tr} from "../play/i18n";

/** Describes props. */
type Props = {
  /** Stores balance. */
  balance: number;
  /** Stores products. */
  products: readonly ProductSummary[];
  /** Stores on purchase. */
  onPurchase: (productId: string) => void;
};

/** Reddit Gold shop surface. It accepts consumable coin grants only. */
export function ShopModalPage({balance, products, onPurchase}: Props) {
  const coinPacks = products.filter((product) => product.productType === undefined || product.productType === "consumable");
  return <div>
    <div className="shop-balance">
      <img src={coinUrl} alt="" />
      <span>{tr("CoinShop.YOUR_BALANCE")}</span>
      <strong>{balance.toLocaleString()}</strong>
    </div>
    <div className="game-shop-grid">
      {coinPacks.length === 0 ? <p>{tr("CoinShop.NO_PACKS_AVAILABLE")}</p> : null}
      {coinPacks.map((product) => <article key={product.productId}>
        {product.featuredBadge ? <em>{product.featuredBadge}</em> : null}
        <img className="shop-product-coins" src={coinUrl} alt="" />
        <strong className="shop-product-name">{product.name}</strong>
        <span className="shop-product-amount">
          {product.coins.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}
        </span>
        <small className="shop-product-description">{product.description}</small>
        <button className="play-primary compact" onClick={() => onPurchase(product.productId)}>
          <span className="shop-purchase-label">{tr("CoinShop.PURCHASE_BUTTON")} </span>{product.displayPrice}
        </button>
      </article>)}
    </div>
  </div>;
}
