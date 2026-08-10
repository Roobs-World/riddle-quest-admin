import type {ProductPricing, RegionalPrice, SpecialOffer} from "./types";

export type {ProductPricing, RegionalPrice, SpecialOffer};

/** Defines the default product pricing value. */
export const DEFAULT_PRODUCT_PRICING: ProductPricing[] = [
  {
    productId: "com.roobsworld.riddlequest.coinpack1",
    productKey: "COIN_PACK_TINY",
    name: "Starter Pack",
    description: "A small refill for a quick hint or two.",
    coins: 250,
    isActive: true,
    sortOrder: 1,
    featuredOrder: 1,
    featuredBadge: "STARTER",
    regionalPrices: [{amount: 0.99, currency: "USD", displayPrice: "$0.99", symbol: "$"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack2",
    productKey: "COIN_PACK_SMALL",
    name: "Small Pack",
    description: "A balanced refill for regular play.",
    coins: 550,
    isActive: true,
    sortOrder: 2,
    regionalPrices: [{amount: 1.99, currency: "USD", displayPrice: "$1.99", symbol: "$"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack3",
    productKey: "COIN_PACK_MID",
    name: "Mid Pack",
    description: "A solid boost for a longer session.",
    coins: 900,
    isActive: true,
    sortOrder: 3,
    regionalPrices: [{amount: 2.99, currency: "USD", displayPrice: "$2.99", symbol: "$"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack4",
    productKey: "COIN_PACK_LARGE",
    name: "Large Pack",
    description: "A popular option for extra flexibility.",
    coins: 1600,
    isActive: true,
    sortOrder: 4,
    featuredOrder: 2,
    featuredBadge: "POPULAR",
    regionalPrices: [{amount: 4.99, currency: "USD", displayPrice: "$4.99", symbol: "$"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack5",
    productKey: "COIN_PACK_HUGE",
    name: "Huge Pack",
    description: "Strong value for players who keep coming back.",
    coins: 3400,
    isActive: true,
    sortOrder: 5,
    regionalPrices: [{amount: 9.99, currency: "USD", displayPrice: "$9.99", symbol: "$"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack6",
    productKey: "COIN_PACK_MEGA",
    name: "Mega Pack",
    description: "The best-value bundle for the long haul.",
    coins: 7000,
    isActive: true,
    sortOrder: 6,
    featuredOrder: 3,
    featuredBadge: "BEST VALUE",
    regionalPrices: [{amount: 19.99, currency: "USD", displayPrice: "$19.99", symbol: "$"}],
  },
];

/** Provides clone product pricing catalog behavior. */
export const cloneProductPricingCatalog = (products: ProductPricing[] = DEFAULT_PRODUCT_PRICING): ProductPricing[] => {
  return products.map((product) => ({
    ...product,
    regionalPrices: product.regionalPrices.map((price) => ({...price})),
    specialOffer: product.specialOffer ? {...product.specialOffer} : undefined,
  }));
};
