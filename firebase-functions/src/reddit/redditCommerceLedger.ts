import {createHash} from "node:crypto";
import type {Firestore} from "firebase-admin/firestore";
import {resolveRedditGoldProduct} from "@qwordly/core/pricing";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {isRedditCommerceEnabled} from "./redditFeatureFlags";
import {isRedditFirebaseUid} from "./redditSecurity";

/** Renders the provider interface. */
const PROVIDER = "reddit" as const;
/** Describes reddit commerce environment. */
export type RedditCommerceEnvironment = "sandbox" | "production";
/** Describes verified reddit order. */
export type VerifiedRedditOrder = {/** Stores uid. */
/** Stores uid. */
uid: string; /** Stores order id. */
/** Stores order id. */
orderId: string; /** Stores product id. */
/** Stores product id. */
productId: string;
  /** Stores environment. */
  environment: RedditCommerceEnvironment; /** Stores purchased at ms. */
  /** Stores purchased at ms. */
  purchasedAtMs: number};
/** Describes verified reddit refund. */
export type VerifiedRedditRefund = {/** Stores order id. */
/** Stores order id. */
orderId: string; /** Stores product id. */
/** Stores product id. */
productId: string;
  /** Stores environment. */
  environment: RedditCommerceEnvironment; /** Stores refunded at ms. */
  /** Stores refunded at ms. */
  refundedAtMs: number};

/** Provides require commerce behavior. */
const requireCommerce = (environment: RedditCommerceEnvironment) => {
  if (!isRedditCommerceEnabled(environment)) throw new Error("reddit-commerce-disabled");
};
/** Provides bounded behavior. */
const bounded = (value: string, bytes = 512) => {
  if (!value || Buffer.byteLength(value, "utf8") > bytes) throw new Error("invalid-reddit-commerce-id");
};
/** Provides non negative behavior. */
const nonNegative = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid-reddit-commerce-${name}`);
  }
  return value;
};
/** Provides safe add behavior. */
const safeAdd = (left: number, right: number) => {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid-reddit-commerce-balance");
  return value;
};

/** Provider/environment namespacing prevents cross-platform and sandbox receipt collisions. */
export function redditCommerceReceiptId(environment: RedditCommerceEnvironment, orderId: string): string {
  bounded(orderId);
  return createHash("sha256").update(`${PROVIDER}\0${environment}\0order\0${orderId}`).digest("hex");
}

/** Provides grant verified reddit order behavior. */
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

/** Provides refund verified reddit order behavior. */
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
