/** Describes a localized price for a product. */
export type RegionalPrice = {
  /** Stores the numeric purchase amount. */
  amount: number;
  /** Stores the ISO currency code. */
  currency: string;
  /** Stores the platform-formatted price. */
  displayPrice: string;
  /** Stores the currency symbol. */
  symbol: string;
  /** Preserves platform-specific price metadata. */
  [key: string]: unknown;
};

/** Describes a time-limited product offer. */
export type SpecialOffer = {
  /** Stores the offer badge copy. */
  badgeText: string;
  /** Stores the offer description. */
  description: string;
  /** Stores the percentage discount. */
  discountPercentage: number;
  /** Indicates whether the offer is active. */
  isActive: boolean;
  /** Stores the offer start time in milliseconds. */
  validFrom: number;
  /** Stores the offer end time in milliseconds. */
  validTo: number;
  /** Preserves platform-specific offer metadata. */
  [key: string]: unknown;
};

/** Describes an item in the product pricing catalog. */
export type ProductPricing = {
  /** Stores the platform product identifier. */
  productId: string;
  /** Stores the stable application product key. */
  productKey: string;
  /** Stores the product display name. */
  name: string;
  /** Stores the product description. */
  description: string;
  /** Stores the number of granted coins. */
  coins: number;
  /** Indicates whether the product is available. */
  isActive: boolean;
  /** Stores the catalog sort order. */
  sortOrder: number;
  /** Stores the regional prices. */
  regionalPrices: RegionalPrice[];
  /** Stores an optional promotional offer. */
  specialOffer?: SpecialOffer;
  /** Stores the optional featured sort order. */
  featuredOrder?: number;
  /** Stores the optional featured badge copy. */
  featuredBadge?: string;
  /** Preserves platform-specific product metadata. */
  [key: string]: unknown;
};
