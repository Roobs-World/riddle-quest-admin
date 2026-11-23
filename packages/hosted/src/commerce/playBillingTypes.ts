/** Play product types. */
export type PlayProductType = "inapp" | "subs";
/** One product as Play prices it for the device's account and country. */
export type PlayProduct = Readonly<{
  /** Play product id. */
  productId: string;
  /** In-app product or subscription. */
  type: PlayProductType;
  /** Localized formatted price, for example "£1.99". */
  price: string;
  /** Subscription offer to purchase; `null` for in-app products. */
  offerToken: string | null;
  /** ISO 8601 billing period of the offer, for example "P1M"; `null` for in-app products. */
  billingPeriod: string | null;
}>;
/** One purchase the Play account owns. */
export type PlayPurchase = Readonly<{
  /** Token the backend verifies. */
  purchaseToken: string;
  /** Products the purchase covers. */
  products: readonly string[];
  /** Only `purchased` purchases are granted; `pending` waits for the payment to clear. */
  state: "purchased" | "pending" | "unspecified";
}>;
/** Result of one checkout. */
export type PlayCheckoutResult =
  | {
      /** Play completed the checkout. */
      status: "purchased";
      /** Purchases the checkout produced. */
      purchases: readonly PlayPurchase[];
    }
  | {
      /** The payment is pending, for example a cash payment. */
      status: "pending";
    }
  | {
      /** The player closed the checkout. */
      status: "cancelled";
    };
/** Google Play Billing operations the shop needs; the native module implements it on devices. */
export type PlayBillingPort = Readonly<{
  /** Prices the given products; products Play does not know are omitted. */
  getProducts(inapp: readonly string[], subs: readonly string[]): Promise<PlayProduct[]>;
  /** Opens Play's checkout, binding the purchase to the account through its hashed uid. */
  purchase(product: PlayProduct, accountUid: string): Promise<PlayCheckoutResult>;
  /** Lists purchases the Play account currently owns. */
  getOwnedPurchases(type: PlayProductType): Promise<PlayPurchase[]>;
  /** Observes purchases completed while the app is already open. */
  onPurchasesChanged?: (listener: () => void) => () => void;
  /** Consumes a granted in-app purchase so it can be bought again. */
  consume(purchaseToken: string): Promise<void>;
  /** Opens Play's subscription management for a product. */
  manageSubscription(productId: string): Promise<void>;
}>;
