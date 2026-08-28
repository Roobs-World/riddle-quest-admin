import {createHash} from "node:crypto";

/** Defines the maximum UTF-8 byte length accepted by Firestore for one document ID. */
const FIRESTORE_DOCUMENT_ID_MAX_BYTES = 1_500;

/** Creates the opaque Firestore document ID used for a signed Jest purchase receipt. */
export function createJestPurchaseGrantId(purchaseToken: string): string {
  return createHash("sha256").update(purchaseToken).digest("hex");
}

/**
 * Returns whether an older raw purchase token can be addressed as one Firestore document ID.
 *
 * New writes never use raw tokens. This check exists only so receipts written by an older
 * deployment can be found once and migrated to their hashed identifier without allowing a
 * slash, reserved path segment, or oversized token to reach Firestore's `doc()` API.
 */
export function isSafeLegacyJestPurchaseGrantId(purchaseToken: string): boolean {
  return (
    purchaseToken.length > 0 &&
    purchaseToken !== "." &&
    purchaseToken !== ".." &&
    !purchaseToken.includes("/") &&
    Buffer.byteLength(purchaseToken, "utf8") <= FIRESTORE_DOCUMENT_ID_MAX_BYTES
  );
}

/** Reads the authoritative current coin balance used in an idempotent purchase response. */
export function currentJestCoinBalance(user: Record<string, unknown> | undefined): number {
  return typeof user?.coins === "number" && Number.isFinite(user.coins) ? user.coins : 0;
}
