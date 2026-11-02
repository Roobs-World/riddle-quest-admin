import {Linking, NativeModules} from "react-native";
import {ANDROID_PACKAGE_NAME} from "./catalog";
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
  /** Consumes a granted in-app purchase so it can be bought again. */
  consume(purchaseToken: string): Promise<void>;
  /** Opens Play's subscription management for a product. */
  manageSubscription(productId: string): Promise<void>;
}>;
/** Shape of the `RiddleQuestPlayBilling` native module. */
type NativePlayBilling = {
  /** See {@link PlayBillingPort.getProducts}. */
  getProducts(inapp: string[], subs: string[]): Promise<unknown>;
  /** Native checkout; hashes `accountUid` with SHA-256 into Play's `obfuscatedAccountId`. */
  purchase(productId: string, type: PlayProductType, offerToken: string | null, accountUid: string): Promise<unknown>;
  /** See {@link PlayBillingPort.getOwnedPurchases}. */
  getOwnedPurchases(type: PlayProductType): Promise<unknown>;
  /** See {@link PlayBillingPort.consume}. */
  consume(purchaseToken: string): Promise<void>;
};
/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
/** Validates one native product. */
const toProduct = (value: unknown): PlayProduct | null => {
  if (!isRecord(value) || typeof value.productId !== "string" || typeof value.price !== "string") return null;
  if (value.type !== "inapp" && value.type !== "subs") return null;
  return {
    productId: value.productId,
    type: value.type,
    price: value.price,
    offerToken: typeof value.offerToken === "string" ? value.offerToken : null,
    billingPeriod: typeof value.billingPeriod === "string" ? value.billingPeriod : null,
  };
};
/** Validates one native purchase. */
const toPurchase = (value: unknown): PlayPurchase | null => {
  if (!isRecord(value) || typeof value.purchaseToken !== "string" || !Array.isArray(value.products)) return null;
  /** Reported state. */
  const state = value.state === "purchased" || value.state === "pending" ? value.state : "unspecified";
  return {purchaseToken: value.purchaseToken, products: value.products.filter((id): id is string => typeof id === "string"), state};
};
/** Validates a native list with an item parser. */
const toList = <T>(value: unknown, parse: (item: unknown) => T | null): T[] =>
  Array.isArray(value) ? value.map(parse).filter((item): item is T => item !== null) : [];
/** Wraps a native module, validating everything it returns. */
export function createPlayBillingPort(native: NativePlayBilling, openUrl: (url: string) => Promise<unknown> = (url) => Linking.openURL(url)): PlayBillingPort {
  return {
    getProducts: async (inapp, subs) => toList(await native.getProducts([...inapp], [...subs]), toProduct),
    async purchase(product, accountUid) {
      /** Native checkout result. */
      const result = await native.purchase(product.productId, product.type, product.offerToken, accountUid);
      if (isRecord(result) && result.status === "pending") return {status: "pending"};
      if (isRecord(result) && result.status === "purchased") return {status: "purchased", purchases: toList(result.purchases, toPurchase)};
      return {status: "cancelled"};
    },
    getOwnedPurchases: async (type) => toList(await native.getOwnedPurchases(type), toPurchase),
    consume: (purchaseToken) => native.consume(purchaseToken),
    manageSubscription: async (productId) => {
      await openUrl(
        `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(productId)}&package=${ANDROID_PACKAGE_NAME}`,
      );
    },
  };
}
/** The device's Play Billing port, or `null` when the native module is absent (tests, other platforms). */
export function getPlayBilling(): PlayBillingPort | null {
  /** Registered native module. */
  const native = (NativeModules as Record<string, unknown>).RiddleQuestPlayBilling as NativePlayBilling | undefined;
  return native ? createPlayBillingPort(native) : null;
}
