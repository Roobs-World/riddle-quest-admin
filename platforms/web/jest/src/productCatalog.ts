import type {JestPlatformPort} from "./types";
import type {ProductSummary} from "../../../../src/platform/contracts/hostServices";
import {DEFAULT_PRODUCT_PRICING} from "../../../../src/commerce/pricing/catalog";
import {priceLocale} from "./priceLocale";

const isCurrency = (value: string) => /^[A-Z]{3}$/.test(value);
type CatalogProducts = Extract<Awaited<ReturnType<JestPlatformPort["getProducts"]>>, {status: "success"}>["value"];

/** Formats a returned shop catalog after the game has already started. */
export function projectProductCatalog(products: CatalogProducts, locale?: string): {status: "success"; value: ProductSummary[]} {
  /** Provides local catalog behavior. */
  const localCatalog = new Map(DEFAULT_PRODUCT_PRICING.map((product) => [product.productId, product]));
  return {
    status: "success",
    value: products.flatMap((product) => {
      /** Provides local behavior. */
      const local = localCatalog.get(product.sku);
      if (!local || !Number.isFinite(product.price) || !isCurrency(product.currency)) return [];
      return [
        {
          productId: product.sku,
          name: product.name || local.name,
          description: product.description || local.description,
          coins: local.coins,
          displayPrice: new Intl.NumberFormat(priceLocale(locale), {
            style: "currency",
            currency: product.currency,
          }).format(product.price),
          price: product.price,
          currency: product.currency,
          featuredBadge: local.featuredBadge,
        },
      ];
    }),
  };
}
