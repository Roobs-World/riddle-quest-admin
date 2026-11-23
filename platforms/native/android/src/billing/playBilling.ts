import {DeviceEventEmitter, Linking, NativeModules} from "react-native";
import {ANDROID_PACKAGE_NAME} from "./catalog";
export type {PlayProductType, PlayProduct, PlayPurchase, PlayCheckoutResult, PlayBillingPort} from "@riddle-quest/hosted/commerce/playBillingTypes";
import type {PlayProductType, PlayProduct, PlayPurchase, PlayBillingPort} from "@riddle-quest/hosted/commerce/playBillingTypes";
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
    /** Retains purchase for this operation. */
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
  if (!native) return null;
  return {
    ...createPlayBillingPort(native),
    /** Retains on purchases changed for this operation. */
    onPurchasesChanged(listener) {
      /** Retains subscription for this operation. */
      const subscription = DeviceEventEmitter.addListener("RiddleQuestPurchasesChanged", listener);
      return () => subscription.remove();
    },
  };
}
