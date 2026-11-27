import {createHash} from "node:crypto";
import type {Firestore} from "firebase-admin/firestore";
import {assertAccountActive, getAccountDeletionRef} from "../../../../firebase-functions/src/shared/accountDeletion";
import {resolveYahooStripeProduct} from "./yahooStripeCatalog";

/** Trusted fields projected from a Stripe Checkout Session. */
export type VerifiedYahooStripePurchase = Readonly<{
  /** Provides uid behavior. */
  uid: string;
  /** Provides checkout session id behavior. */
  checkoutSessionId: string;
  /** Provides payment intent id behavior. */
  paymentIntentId: string;
  /** Provides product id behavior. */
  productId: string;
  /** Provides purchased at ms behavior. */
  purchasedAtMs: number;
}>;

/** Trusted fields projected from a fully refunded Stripe Charge. */
export type VerifiedYahooStripeRefund = Readonly<{
  /** Provides payment intent id behavior. */
  paymentIntentId: string;
  /** Provides refunded at ms behavior. */
  refundedAtMs: number;
}>;

/** Provides bounded behavior. */
const bounded = (value: string, name: string): void => {
  if (!value || Buffer.byteLength(value, "utf8") > 512) throw new Error(`invalid-yahoo-stripe-${name}`);
};

/** Provides non negative behavior. */
const nonNegative = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid-yahoo-stripe-${name}`);
  }
  return value;
};

/** Provides safe add behavior. */
const safeAdd = (left: number, right: number): number => {
  /** Provides result behavior. */
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("invalid-yahoo-stripe-balance");
  return result;
};

/** Hashes provider identifiers before using them as Firestore document IDs. */
export const yahooStripeLedgerId = (kind: "checkout" | "payment", id: string): string => {
  bounded(id, kind);
  return createHash("sha256").update(`yahoo\0stripe\0${kind}\0${id}`).digest("hex");
};

/** Grants a verified Yahoo Stripe Checkout Session exactly once. */
export async function grantVerifiedYahooStripePurchase(db: Firestore, input: VerifiedYahooStripePurchase) {
  bounded(input.uid, "uid");
  bounded(input.checkoutSessionId, "checkout-session");
  bounded(input.paymentIntentId, "payment-intent");
  if (!Number.isSafeInteger(input.purchasedAtMs) || input.purchasedAtMs <= 0) {
    throw new Error("invalid-yahoo-stripe-purchase-time");
  }
  /** Provides product behavior. */
  const product = resolveYahooStripeProduct(input.productId);
  /** Provides checkout hash behavior. */
  const checkoutHash = yahooStripeLedgerId("checkout", input.checkoutSessionId);
  /** Provides payment hash behavior. */
  const paymentHash = yahooStripeLedgerId("payment", input.paymentIntentId);
  /** Provides user ref behavior. */
  const userRef = db.collection("users").doc(input.uid);
  /** Provides account ref behavior. */
  const accountRef = db.collection("yahooStripeAccounts").doc(input.uid);
  /** Provides receipt ref behavior. */
  const receiptRef = db.collection("yahooStripeReceipts").doc(checkoutHash);
  /** Provides payment ref behavior. */
  const paymentRef = db.collection("yahooStripePayments").doc(paymentHash);

  return db.runTransaction(async (transaction) => {
    /** Provides user and account and receipt and payment and deletion behavior. */
    const [user, account, receipt, payment, deletion] = await Promise.all([
      transaction.get(userRef),
      transaction.get(accountRef),
      transaction.get(receiptRef),
      transaction.get(paymentRef),
      transaction.get(getAccountDeletionRef(db, input.uid)),
    ]);
    assertAccountActive(deletion);
    if (!user.exists) throw new Error("yahoo-stripe-user-not-found");
    /** Provides coins behavior. */
    const coins = nonNegative(user.data()?.coins, "coins");
    /** Provides debt behavior. */
    const debt = account.exists ? nonNegative(account.data()?.coinDebt, "debt") : 0;
    if (receipt.exists || payment.exists) {
      /** Provides existing behavior. */
      const existing = receipt.exists ? receipt.data() : payment.data();
      if (
        existing?.provider !== "stripe" ||
        existing.uid !== input.uid ||
        existing.checkoutHash !== checkoutHash ||
        existing.paymentHash !== paymentHash ||
        existing.productId !== product.productId ||
        existing.grossCoins !== product.coins
      )
        throw new Error("yahoo-stripe-receipt-conflict");
      return {alreadyProcessed: true, coins, coinDebt: debt};
    }
    /** Provides debt repaid behavior. */
    const debtRepaid = Math.min(debt, product.coins);
    /** Provides coins granted behavior. */
    const coinsGranted = product.coins - debtRepaid;
    /** Provides next coins behavior. */
    const nextCoins = safeAdd(coins, coinsGranted);
    /** Provides next debt behavior. */
    const nextDebt = debt - debtRepaid;
    /** Provides receipt data behavior. */
    const receiptData = {
      provider: "stripe",
      uid: input.uid,
      checkoutHash,
      paymentHash,
      productId: product.productId,
      grossCoins: product.coins,
      coinsGranted,
      debtRepaid,
      purchasedAtMs: input.purchasedAtMs,
      refundedAtMs: null,
    };
    transaction.update(userRef, {coins: nextCoins, hasPurchasedApp: true, lastLogin: Date.now()});
    transaction.set(accountRef, {coinDebt: nextDebt, updatedAtMs: Date.now()}, {merge: true});
    transaction.create(receiptRef, receiptData);
    transaction.create(paymentRef, receiptData);
    return {alreadyProcessed: false, coins: nextCoins, coinDebt: nextDebt};
  });
}

/** Reverses a fully refunded Stripe purchase exactly once. */
export async function refundVerifiedYahooStripePurchase(db: Firestore, input: VerifiedYahooStripeRefund) {
  bounded(input.paymentIntentId, "payment-intent");
  if (!Number.isSafeInteger(input.refundedAtMs) || input.refundedAtMs <= 0) {
    throw new Error("invalid-yahoo-stripe-refund-time");
  }
  /** Provides payment hash behavior. */
  const paymentHash = yahooStripeLedgerId("payment", input.paymentIntentId);
  /** Provides payment ref behavior. */
  const paymentRef = db.collection("yahooStripePayments").doc(paymentHash);
  return db.runTransaction(async (transaction) => {
    /** Provides payment behavior. */
    const payment = await transaction.get(paymentRef);
    if (!payment.exists) throw new Error("yahoo-stripe-payment-not-found");
    /** Provides value behavior. */
    const value = payment.data();
    if (value?.provider !== "stripe" || value.paymentHash !== paymentHash || typeof value.uid !== "string") {
      throw new Error("yahoo-stripe-receipt-conflict");
    }
    /** Provides user ref behavior. */
    const userRef = db.collection("users").doc(value.uid);
    /** Provides account ref behavior. */
    const accountRef = db.collection("yahooStripeAccounts").doc(value.uid);
    /** Provides receipt ref behavior. */
    const receiptRef = db.collection("yahooStripeReceipts").doc(value.checkoutHash);
    /** Provides user and account and receipt behavior. */
    const [user, account, receipt] = await Promise.all([
      transaction.get(userRef),
      transaction.get(accountRef),
      transaction.get(receiptRef),
    ]);
    if (!user.exists || !receipt.exists) throw new Error("yahoo-stripe-receipt-conflict");
    if (value.refundedAtMs !== null) return {alreadyProcessed: true};
    /** Provides coins behavior. */
    const coins = nonNegative(user.data()?.coins, "coins");
    /** Provides debt behavior. */
    const debt = account.exists ? nonNegative(account.data()?.coinDebt, "debt") : 0;
    /** Provides gross coins behavior. */
    const grossCoins = nonNegative(value.grossCoins, "gross-coins");
    /** Provides coins removed behavior. */
    const coinsRemoved = Math.min(coins, grossCoins);
    /** Provides debt added behavior. */
    const debtAdded = grossCoins - coinsRemoved;
    transaction.update(userRef, {coins: coins - coinsRemoved, lastLogin: Date.now()});
    transaction.set(accountRef, {coinDebt: safeAdd(debt, debtAdded), updatedAtMs: Date.now()}, {merge: true});
    transaction.update(paymentRef, {refundedAtMs: input.refundedAtMs, coinsRemoved, debtAdded});
    transaction.update(receiptRef, {refundedAtMs: input.refundedAtMs, coinsRemoved, debtAdded});
    return {alreadyProcessed: false};
  });
}
