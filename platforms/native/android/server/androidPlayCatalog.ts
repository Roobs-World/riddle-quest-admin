import {createHash} from "node:crypto";
import {COIN_PRODUCTS, SUBSCRIPTIONS} from "../../../../firebase-functions/src/shared/productCatalog";

/** Google Play package that owns every Android purchase token. */
export const ANDROID_PACKAGE_NAME = "com.roobsworld.riddlequest";

/**
 * Coins granted per Google Play in-app product.
 *
 * @remarks
 * Play Console products use the shared SKUs for consistent coin packs
 * at identical coin values; the server owns the mapping, never the client.
 */
export const ANDROID_COIN_PRODUCTS: Readonly<Record<string, number>> = COIN_PRODUCTS;

/** Google Play subscription products and the entitlement each confers. */
export const ANDROID_SUBSCRIPTIONS: Readonly<Record<string, string>> = SUBSCRIPTIONS;

/**
 * Opaque account binding the app passes to Play as `obfuscatedAccountId`.
 *
 * @remarks
 * Play returns it on every purchase, so the backend grants a token only to the
 * Firebase account that started the checkout. SHA-256 hex is exactly Play's
 * 64-character limit and reveals nothing about the uid.
 */
export function androidPlayAccountId(uid: string): string {
  return createHash("sha256").update(uid).digest("hex");
}

/** Firestore document id for a purchase token; raw tokens never become document paths. */
export function androidPurchaseGrantId(purchaseToken: string): string {
  return createHash("sha256").update(purchaseToken).digest("hex");
}
