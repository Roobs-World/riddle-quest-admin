import {createHash} from "node:crypto";
import type {Firestore} from "firebase-admin/firestore";
import {resolveRedditGoldProduct} from "@qwordly/core/pricing";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {isRedditCommerceEnabled} from "./redditFeatureFlags";
import {isRedditFirebaseUid} from "./redditSecurity";

/** Provider discriminator persisted in every Reddit commerce ledger record. */
const PROVIDER = "reddit" as const;

/** Deployment environment that scopes orders so sandbox grants cannot collide with production. */
export type RedditCommerceEnvironment = "sandbox" | "production";

/** Trusted purchase fields projected from a verified Reddit payment order. */
export type VerifiedRedditOrder = {
  /** Provider-scoped Firebase UID that receives the purchased coins. */
  uid: string;
  /** Reddit order identifier used as the idempotency key. */
  orderId: string;
  /** Product identifier resolved against the server-owned Reddit Gold catalog. */
  productId: string;
  /** Environment in which Reddit issued the order. */
  environment: RedditCommerceEnvironment;
  /** Positive Unix timestamp, in milliseconds, at which Reddit created the purchase. */
  purchasedAtMs: number;
};

/** Trusted refund fields projected from a verified Reddit payment reversal. */
export type VerifiedRedditRefund = {
  /** Original Reddit order identifier used to locate the purchase receipt. */
  orderId: string;
  /** Product identifier that must match the original receipt and current server catalog. */
  productId: string;
  /** Environment in which Reddit issued both the purchase and refund. */
  environment: RedditCommerceEnvironment;
  /** Positive Unix timestamp, in milliseconds, at which Reddit recorded the refund. */
  refundedAtMs: number;
};

/** Fails closed unless commerce is enabled for the order's deployment environment. */
const requireCommerce = (environment: RedditCommerceEnvironment) => {
  if (!isRedditCommerceEnabled(environment)) throw new Error("reddit-commerce-disabled");
};

/** Rejects empty or oversized provider identifiers before they reach Firestore. */
const bounded = (value: string, bytes = 512) => {
  if (!value || Buffer.byteLength(value, "utf8") > bytes) throw new Error("invalid-reddit-commerce-id");
};

/** Reads a persisted balance field while enforcing the ledger's non-negative safe-integer invariant. */
const nonNegative = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid-reddit-commerce-${name}`);
  }
  return value;
};

/** Adds ledger amounts without permitting overflow or a negative result. */
const safeAdd = (left: number, right: number) => {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid-reddit-commerce-balance");
  return value;
};

/**
 * Derives the opaque Firestore receipt identifier for one Reddit order.
 *
 * Provider and environment namespacing prevent cross-platform and sandbox
 * orders from sharing an idempotency record. The raw provider order ID is not
 * persisted as the document ID.
 *
 * @param environment - Environment in which Reddit issued the order.
 * @param orderId - Non-empty Reddit order identifier, bounded to 512 UTF-8 bytes.
 * @returns A deterministic lowercase SHA-256 digest for the receipt document.
 * @throws When `orderId` is empty or exceeds the identifier limit.
 */
export function redditCommerceReceiptId(environment: RedditCommerceEnvironment, orderId: string): string {
  bounded(orderId);
  return createHash("sha256").update(`${PROVIDER}\0${environment}\0order\0${orderId}`).digest("hex");
}

/**
 * Grants a verified Reddit purchase exactly once in a Firestore transaction.
 *
 * The transaction validates the provider-scoped account and deletion guard,
 * repays any refund-created coin debt before increasing the spendable balance,
 * and creates a receipt whose grant identity is immutable. Replaying the same
 * verified order returns the current balance without granting coins again;
 * conflicting data for the same receipt ID fails closed.
 *
 * @param db - Firestore instance that owns the canonical user and commerce ledgers.
 * @param input - Server-verified order fields; browser-supplied identity is not accepted here.
 * @returns The resulting coin balance, remaining debt, and whether the receipt was already processed.
 * @throws When commerce is disabled, input or persisted ledger data is invalid,
 * the account is missing or deleted, the product is unknown, or an existing
 * receipt conflicts with the verified order.
 */
export async function grantVerifiedRedditOrder(db: Firestore, input: VerifiedRedditOrder) {
  requireCommerce(input.environment);
  if (!isRedditFirebaseUid(input.uid)) throw new Error("invalid-reddit-commerce-uid");
  bounded(input.orderId);
  if (!Number.isSafeInteger(input.purchasedAtMs) || input.purchasedAtMs <= 0) throw new Error("invalid-reddit-purchase-time");
  const product = resolveRedditGoldProduct(input.productId);
  const receiptId = redditCommerceReceiptId(input.environment, input.orderId);
  const userRef = db.collection("users").doc(input.uid);
  const accountRef = db.collection("redditCommerceAccounts").doc(input.uid);
  const receiptRef = db.collection("redditCommerceReceipts").doc(receiptId);
  return db.runTransaction(async (transaction) => {
    const [user, account, receipt, deletion] = await Promise.all([
      transaction.get(userRef), transaction.get(accountRef), transaction.get(receiptRef),
      transaction.get(getJestAccountDeletionRef(db, input.uid)),
    ]);
    assertJestAccountActive(deletion);
    if (!user.exists) throw new Error("reddit-commerce-user-not-found");
    const coins = nonNegative(user.data()?.coins, "coins");
    const debt = account.exists ? nonNegative(account.data()?.coinDebt, "debt") : 0;
    if (receipt.exists) {
      const value = receipt.data();
      if (value?.provider !== PROVIDER || value.environment !== input.environment || value.uid !== input.uid ||
        value.orderIdHash !== receiptId || value.productId !== input.productId || value.grossCoins !== product.coins ||
        value.goldCost !== product.goldCost || value.purchasedAtMs !== input.purchasedAtMs) {
        throw new Error("reddit-purchase-receipt-conflict");
      }
      return {alreadyProcessed: true, coins, coinDebt: debt};
    }
    const debtRepaid = Math.min(debt, product.coins);
    const coinsGranted = product.coins - debtRepaid;
    const nextCoins = safeAdd(coins, coinsGranted);
    const nextDebt = debt - debtRepaid;
    transaction.update(userRef, {coins: nextCoins, hasPurchasedApp: true});
    transaction.set(accountRef, {coinDebt: nextDebt, updatedAtMs: input.purchasedAtMs}, {merge: true});
    transaction.create(receiptRef, {provider: PROVIDER, environment: input.environment, uid: input.uid,
      orderIdHash: receiptId, productId: input.productId, grossCoins: product.coins, goldCost: product.goldCost,
      coinsGranted, debtRepaid, purchasedAtMs: input.purchasedAtMs, refundedAtMs: null});
    return {alreadyProcessed: false, coins: nextCoins, coinDebt: nextDebt};
  });
}

/**
 * Reverses a verified Reddit purchase exactly once in a Firestore transaction.
 *
 * Available coins are removed first. Any unrecoverable amount becomes account
 * debt so a refund cannot create a negative spendable balance and later grants
 * repay that debt before crediting coins. The original receipt and a dedicated
 * refund record provide replay protection; a mismatched replay fails closed.
 *
 * @param db - Firestore instance that owns the canonical user and commerce ledgers.
 * @param input - Server-verified refund fields tied to the original Reddit order.
 * @returns The affected UID, resulting balance and debt, removed coin count,
 * and whether the refund had already been processed.
 * @throws When commerce is disabled, the original purchase or account is
 * missing, input or ledger data is invalid, the product/receipt does not match,
 * or an existing refund record conflicts with this event.
 */
export async function refundVerifiedRedditOrder(db: Firestore, input: VerifiedRedditRefund) {
  requireCommerce(input.environment);
  bounded(input.orderId);
  if (!Number.isSafeInteger(input.refundedAtMs) || input.refundedAtMs <= 0) throw new Error("invalid-reddit-refund-time");
  const product = resolveRedditGoldProduct(input.productId);
  const receiptId = redditCommerceReceiptId(input.environment, input.orderId);
  const receiptRef = db.collection("redditCommerceReceipts").doc(receiptId);
  const refundRef = db.collection("redditCommerceRefunds").doc(receiptId);
  return db.runTransaction(async (transaction) => {
    const [receipt, refund] = await Promise.all([transaction.get(receiptRef), transaction.get(refundRef)]);
    if (!receipt.exists) throw new Error("reddit-purchase-not-found");
    const value = receipt.data();
    const uid = typeof value?.uid === "string" ? value.uid : "";
    if (!isRedditFirebaseUid(uid) || value?.provider !== PROVIDER || value.environment !== input.environment ||
      value.orderIdHash !== receiptId || value.productId !== input.productId || value.grossCoins !== product.coins ||
      value.goldCost !== product.goldCost || !Number.isSafeInteger(value.purchasedAtMs) ||
      input.refundedAtMs < value.purchasedAtMs) throw new Error("reddit-refund-receipt-conflict");
    const userRef = db.collection("users").doc(uid);
    const accountRef = db.collection("redditCommerceAccounts").doc(uid);
    const [user, account] = await Promise.all([transaction.get(userRef), transaction.get(accountRef)]);
    if (!user.exists) throw new Error("reddit-commerce-user-not-found");
    const coins = nonNegative(user.data()?.coins, "coins");
    const debt = account.exists ? nonNegative(account.data()?.coinDebt, "debt") : 0;
    if (refund.exists) {
      const prior = refund.data();
      if (prior?.provider !== PROVIDER || prior.environment !== input.environment || prior.uid !== uid ||
        prior.productId !== input.productId || prior.refundedAtMs !== input.refundedAtMs) {
        throw new Error("reddit-refund-event-conflict");
      }
      return {alreadyProcessed: true, uid, coins, coinsRemoved: 0, coinDebt: debt};
    }
    if (value.refundedAtMs !== null) throw new Error("reddit-refund-event-conflict");
    const coinsRemoved = Math.min(coins, product.coins);
    const debtAdded = product.coins - coinsRemoved;
    const nextCoins = coins - coinsRemoved;
    const nextDebt = safeAdd(debt, debtAdded);
    transaction.update(userRef, {coins: nextCoins});
    transaction.set(accountRef, {coinDebt: nextDebt, updatedAtMs: input.refundedAtMs}, {merge: true});
    transaction.update(receiptRef, {refundedAtMs: input.refundedAtMs});
    transaction.create(refundRef, {provider: PROVIDER, environment: input.environment, uid,
      orderIdHash: receiptId, productId: input.productId, coinsRemoved, debtAdded,
      refundedAtMs: input.refundedAtMs});
    return {alreadyProcessed: false, uid, coins: nextCoins, coinsRemoved, coinDebt: nextDebt};
  });
}
