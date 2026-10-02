import {createHash} from "node:crypto";
import type {DocumentReference, Firestore, Transaction} from "firebase-admin/firestore";
import {resolveFacebookProduct} from "@qwordly/core/pricing/facebookCatalog";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";

/** Renders the provider interface. */
const PROVIDER = "facebook" as const;

/** Describes commerce account. */
type CommerceAccount = {
  /** Stores coin debt. */
  coinDebt: number;
  /** Stores remove interstitial ads. */
  removeInterstitialAds: boolean;
};

/** Describes verified facebook purchase. */
export type VerifiedFacebookPurchase = {
  /** Stores uid. */
  uid: string;
  /** Stores payment id. */
  paymentId: string;
  /** Stores product id. */
  productId: string;
  /** Stores purchase token. */
  purchaseToken: string;
  /** Stores purchased at ms. */
  purchasedAtMs: number;
};

/** Describes verified facebook refund. */
export type VerifiedFacebookRefund = {
  /** Stores event id. */
  eventId: string;
  /** Stores payment id. */
  paymentId: string;
  /** Stores product id. */
  productId: string;
  /** Stores refunded at ms. */
  refundedAtMs: number;
};

/** Describes facebook purchase result. */
export type FacebookPurchaseResult = {
  /** Stores already processed. */
  alreadyProcessed: boolean;
  /** Stores coins. */
  coins: number;
  /** Stores coin debt. */
  coinDebt: number;
  /** Stores remove interstitial ads. */
  removeInterstitialAds: boolean;
};

/** Describes facebook refund result. */
export type FacebookRefundResult = FacebookPurchaseResult &
  (
    | {
        /** Stores uid. */
        uid: string; /** Stores coins removed. */
        /** Stores coins removed. */
        coinsRemoved: number; /** Stores account deleted. */
        /** Stores account deleted. */
        accountDeleted: false;
      }
    | {
        /** Stores uid. */
        uid: null; /** Stores coins removed. */
        /** Stores coins removed. */
        coinsRemoved: 0; /** Stores account deleted. */
        /** Stores account deleted. */
        accountDeleted: true;
      }
  );

/** Provides require non negative integer behavior. */
const requireNonNegativeInteger = (name: string, value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid-facebook-commerce-${name}`);
  }
  return value;
};

/** Provides optional non negative integer behavior. */
const optionalNonNegativeInteger = (name: string, value: unknown): number =>
  value === undefined ? 0 : requireNonNegativeInteger(name, value);

/** Provides safe add behavior. */
const safeAdd = (name: string, left: number, right: number): number => {
  /** Provides result behavior. */
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`invalid-facebook-commerce-${name}`);
  return result;
};

/** Provides account from behavior. */
const accountFrom = (value: Record<string, unknown> | undefined): CommerceAccount => {
  if (value?.removeInterstitialAds !== undefined && typeof value.removeInterstitialAds !== "boolean") {
    throw new Error("invalid-facebook-commerce-entitlement");
  }
  return {
    coinDebt: optionalNonNegativeInteger("coin-debt", value?.coinDebt),
    removeInterstitialAds: value?.removeInterstitialAds === true,
  };
};

/** Provides r coins. */
const userCoins = (user: Snapshot): number => requireNonNegativeInteger("coins", user.data()?.coins);

/** Validates purchase accounting. */
const validatePurchaseAccounting = (
  receipt: Record<string, unknown>,
  grossCoins: number,
): {
  /** Stores coins granted. */
  coinsGranted: number; /** Stores debt repaid. */
  /** Stores debt repaid. */
  debtRepaid: number;
} => {
  /** Provides coins granted behavior. */
  const coinsGranted = requireNonNegativeInteger("coins-granted", receipt.coinsGranted);
  /** Provides debt repaid behavior. */
  const debtRepaid = requireNonNegativeInteger("debt-repaid", receipt.debtRepaid);
  if (safeAdd("purchase-accounting", coinsGranted, debtRepaid) !== grossCoins) {
    throw new Error("facebook-purchase-receipt-conflict");
  }
  /** Provides purchased at ms behavior. */
  const purchasedAtMs = requireNonNegativeInteger("purchased-at", receipt.purchasedAtMs);
  if (receipt.refundedAtMs !== null) {
    /** Provides refunded at ms behavior. */
    const refundedAtMs = requireNonNegativeInteger("refunded-at", receipt.refundedAtMs);
    if (refundedAtMs < purchasedAtMs) throw new Error("facebook-purchase-receipt-conflict");
  }
  return {coinsGranted, debtRepaid};
};

/** Validates active refund replay. */
const validateActiveRefundReplay = (
  refund: Record<string, unknown>,
  receipt: Record<string, unknown>,
  grossCoins: number,
): void => {
  /** Provides coins removed behavior. */
  const coinsRemoved = requireNonNegativeInteger("refund-coins-removed", refund.coinsRemoved);
  /** Provides debt added behavior. */
  const debtAdded = requireNonNegativeInteger("refund-debt-added", refund.debtAdded);
  if (refund.alreadyApplied === true) {
    if (coinsRemoved !== 0 || debtAdded !== 0) throw new Error("facebook-refund-event-conflict");
    return;
  }
  if (refund.alreadyApplied !== undefined) throw new Error("facebook-refund-event-conflict");
  if (
    safeAdd("refund-accounting", coinsRemoved, debtAdded) !== grossCoins ||
    refund.refundedAtMs !== receipt.refundedAtMs
  )
    throw new Error("facebook-refund-event-conflict");
};

/** Asserts bounded. */
const assertBounded = (name: string, value: string, maxBytes: number): void => {
  if (!value || Buffer.byteLength(value, "utf8") > maxBytes) throw new Error(`invalid-${name}`);
};

/** Creates an opaque, provider- and purpose-scoped receipt identifier. */
export function facebookCommerceReceiptId(kind: "purchase" | "refund", externalId: string): string {
  assertBounded(`${kind}-id`, externalId, 1_024);
  return createHash("sha256").update(`${PROVIDER}\0${kind}\0${externalId}`).digest("hex");
}

/** Provides token hash behavior. */
const tokenHash = (purchaseToken: string): string => {
  assertBounded("purchase-token", purchaseToken, 8_192);
  return createHash("sha256").update(`${PROVIDER}\0token\0${purchaseToken}`).digest("hex");
};

/** Provides require uid behavior. */
const requireUid = (uid: string): void => {
  if (!/^facebook_[0-9a-f]{40}$/.test(uid)) throw new Error("invalid-facebook-uid");
};

/** Asserts commerce enabled. */
const assertCommerceEnabled = (): void => {
  if (!isFacebookFeatureEnabled("commerce")) throw new Error("facebook-commerce-disabled");
};

/** Describes snapshot. */
type Snapshot = {
  /** Stores exists. */
  /** Stores exists. */
  exists: boolean; /** Provides data behavior. */
  /** Provides data behavior. */
  data(): Record<string, unknown> | undefined;
};

/** Reads commerce state. */
async function readCommerceState(
  transaction: Transaction,
  userRef: DocumentReference,
  accountRef: DocumentReference,
): Promise<{
  /** Stores user. */
  user: Snapshot; /** Stores account. */
  /** Stores account. */
  account: CommerceAccount;
}> {
  /** Provides [user, account] behavior. */
  const [user, account] = await Promise.all([transaction.get(userRef), transaction.get(accountRef)]);
  if (!user.exists) throw new Error("facebook-user-not-found");
  return {user, account: accountFrom(account.exists ? account.data() : undefined)};
}

/**
 * Applies a purchase only after a separate provider verifier has authenticated it.
 * The transaction commits the grant before the caller is allowed to consume the SDK purchase token.
 */
export async function grantVerifiedFacebookPurchase(
  db: Firestore,
  input: VerifiedFacebookPurchase,
): Promise<FacebookPurchaseResult> {
  assertCommerceEnabled();
  requireUid(input.uid);
  assertBounded("payment-id", input.paymentId, 1_024);
  if (!Number.isSafeInteger(input.purchasedAtMs) || input.purchasedAtMs <= 0) throw new Error("invalid-purchase-time");
  /** Provides product behavior. */
  const product = resolveFacebookProduct(input.productId);
  /** Provides receipt id behavior. */
  const receiptId = facebookCommerceReceiptId("purchase", input.paymentId);
  /** Provides purchase token hash behavior. */
  const purchaseTokenHash = tokenHash(input.purchaseToken);
  /** Provides r ref. */
  const userRef = db.collection("users").doc(input.uid);
  /** Provides account ref behavior. */
  const accountRef = db.collection("facebookCommerceAccounts").doc(input.uid);
  /** Provides receipt ref behavior. */
  const receiptRef = db.collection("facebookCommerceReceipts").doc(receiptId);
  /** Provides deletion ref behavior. */
  const deletionRef = getJestAccountDeletionRef(db, input.uid);

  return db.runTransaction(async (transaction) => {
    /** Provides [receipt, deletion, state] behavior. */
    const [receipt, deletion, state] = await Promise.all([
      transaction.get(receiptRef),
      transaction.get(deletionRef),
      readCommerceState(transaction, userRef, accountRef),
    ]);
    assertJestAccountActive(deletion);
    /** Provides current coins behavior. */
    const currentCoins = userCoins(state.user);
    if (receipt.exists) {
      /** Provides existing behavior. */
      const existing = receipt.data();
      if (
        existing?.provider !== PROVIDER ||
        existing.uid !== input.uid ||
        existing.productId !== input.productId ||
        existing.kind !== product.kind ||
        existing.paymentIdHash !== receiptId ||
        existing.purchaseTokenHash !== purchaseTokenHash ||
        existing.grossCoins !== product.coins ||
        existing.purchasedAtMs !== input.purchasedAtMs
      ) {
        throw new Error("facebook-purchase-receipt-conflict");
      }
      validatePurchaseAccounting(existing, product.coins);
      return {
        alreadyProcessed: true,
        coins: currentCoins,
        coinDebt: state.account.coinDebt,
        removeInterstitialAds: state.account.removeInterstitialAds,
      };
    }

    /** Provides debt repaid behavior. */
    const debtRepaid = product.kind === "consumable" ? Math.min(state.account.coinDebt, product.coins) : 0;
    /** Provides coins granted behavior. */
    const coinsGranted = product.coins - debtRepaid;
    /** Provides next account behavior. */
    const nextAccount: CommerceAccount = {
      coinDebt: state.account.coinDebt - debtRepaid,
      removeInterstitialAds: state.account.removeInterstitialAds || product.entitlement === "remove_interstitial_ads",
    };
    /** Provides coins behavior. */
    const coins = safeAdd("coin-balance", currentCoins, coinsGranted);
    transaction.update(userRef, {coins, hasPurchasedApp: true, lastLogin: Date.now()});
    transaction.set(accountRef, {...nextAccount, updatedAtMs: Date.now()}, {merge: true});
    transaction.create(receiptRef, {
      provider: PROVIDER,
      uid: input.uid,
      productId: product.productId,
      kind: product.kind,
      paymentIdHash: receiptId,
      purchaseTokenHash,
      grossCoins: product.coins,
      coinsGranted,
      debtRepaid,
      purchasedAtMs: input.purchasedAtMs,
      refundedAtMs: null,
    });
    return {
      alreadyProcessed: false,
      coins,
      coinDebt: nextAccount.coinDebt,
      removeInterstitialAds: nextAccount.removeInterstitialAds,
    };
  });
}

/** Applies one verified full refund, removing spendable coins before recording hidden debt. */
export async function refundVerifiedFacebookPurchase(
  db: Firestore,
  input: VerifiedFacebookRefund,
): Promise<FacebookRefundResult> {
  assertCommerceEnabled();
  assertBounded("refund-event-id", input.eventId, 1_024);
  if (!Number.isSafeInteger(input.refundedAtMs) || input.refundedAtMs <= 0) throw new Error("invalid-refund-time");
  /** Provides product behavior. */
  const product = resolveFacebookProduct(input.productId);
  /** Provides purchase ref behavior. */
  const purchaseRef = db
    .collection("facebookCommerceReceipts")
    .doc(facebookCommerceReceiptId("purchase", input.paymentId));
  /** Provides refund ref behavior. */
  const refundRef = db.collection("facebookCommerceRefunds").doc(facebookCommerceReceiptId("refund", input.eventId));

  return db.runTransaction(async (transaction) => {
    /** Provides [purchase, prior refund] behavior. */
    const [purchase, priorRefund] = await Promise.all([transaction.get(purchaseRef), transaction.get(refundRef)]);
    if (!purchase.exists) throw new Error("facebook-purchase-not-found");
    /** Provides receipt behavior. */
    const receipt = purchase.data()!;
    /** Provides uid behavior. */
    const uid = typeof receipt.uid === "string" ? receipt.uid : "";
    if (receipt.replayProtection === true && uid === "") {
      if (
        receipt.provider !== PROVIDER ||
        receipt.productId !== input.productId ||
        receipt.paymentIdHash !== purchaseRef.id ||
        typeof receipt.purchaseTokenHash !== "string" ||
        !/^[0-9a-f]{64}$/.test(receipt.purchaseTokenHash)
      ) {
        throw new Error("facebook-refund-receipt-mismatch");
      }
      if (receipt.refundedAtMs !== null) {
        try {
          requireNonNegativeInteger("refunded-at", receipt.refundedAtMs);
        } catch {
          throw new Error("facebook-refund-receipt-mismatch");
        }
      }
      if (priorRefund.exists) {
        /** Provides existing refund behavior. */
        const existingRefund = priorRefund.data();
        if (
          existingRefund?.provider !== PROVIDER ||
          existingRefund.replayProtection !== true ||
          existingRefund.productId !== input.productId ||
          existingRefund.purchaseReceiptId !== purchaseRef.id ||
          existingRefund.refundedAtMs !== input.refundedAtMs
        ) {
          throw new Error("facebook-refund-event-conflict");
        }
      } else {
        if (receipt.refundedAtMs === null) transaction.update(purchaseRef, {refundedAtMs: input.refundedAtMs});
        transaction.create(refundRef, {
          provider: PROVIDER,
          replayProtection: true,
          productId: input.productId,
          purchaseReceiptId: purchaseRef.id,
          refundedAtMs: input.refundedAtMs,
        });
      }
      return {
        alreadyProcessed: priorRefund.exists,
        uid: null,
        coins: 0,
        coinsRemoved: 0,
        coinDebt: 0,
        removeInterstitialAds: false,
        accountDeleted: true,
      };
    }
    requireUid(uid);
    if (
      receipt.provider !== PROVIDER ||
      receipt.productId !== input.productId ||
      receipt.kind !== product.kind ||
      receipt.paymentIdHash !== purchaseRef.id ||
      receipt.grossCoins !== product.coins ||
      typeof receipt.purchaseTokenHash !== "string" ||
      !/^[0-9a-f]{64}$/.test(receipt.purchaseTokenHash)
    ) {
      throw new Error("facebook-refund-receipt-mismatch");
    }
    try {
      validatePurchaseAccounting(receipt, product.coins);
    } catch {
      throw new Error("facebook-refund-receipt-mismatch");
    }
    if (input.refundedAtMs < (receipt.purchasedAtMs as number)) {
      throw new Error("facebook-refund-receipt-mismatch");
    }
    /** Provides r ref. */
    const userRef = db.collection("users").doc(uid);
    /** Provides account ref behavior. */
    const accountRef = db.collection("facebookCommerceAccounts").doc(uid);
    /** Provides state behavior. */
    const state = await readCommerceState(transaction, userRef, accountRef);
    /** Provides current coins behavior. */
    const currentCoins = userCoins(state.user);
    if (priorRefund.exists) {
      /** Provides existing refund behavior. */
      const existingRefund = priorRefund.data();
      if (
        existingRefund?.provider !== PROVIDER ||
        existingRefund.uid !== uid ||
        existingRefund.productId !== input.productId ||
        existingRefund.purchaseReceiptId !== purchaseRef.id ||
        existingRefund.refundedAtMs !== input.refundedAtMs
      ) {
        throw new Error("facebook-refund-event-conflict");
      }
      try {
        validateActiveRefundReplay(existingRefund, receipt, product.coins);
      } catch {
        throw new Error("facebook-refund-event-conflict");
      }
      return {
        alreadyProcessed: true,
        uid,
        coins: currentCoins,
        coinsRemoved: 0,
        coinDebt: state.account.coinDebt,
        removeInterstitialAds: state.account.removeInterstitialAds,
        accountDeleted: false,
      };
    }
    if (receipt.refundedAtMs !== null) {
      transaction.create(refundRef, {
        provider: PROVIDER,
        uid,
        productId: input.productId,
        purchaseReceiptId: purchaseRef.id,
        refundedAtMs: input.refundedAtMs,
        coinsRemoved: 0,
        debtAdded: 0,
        alreadyApplied: true,
      });
      return {
        alreadyProcessed: true,
        uid,
        coins: currentCoins,
        coinsRemoved: 0,
        coinDebt: state.account.coinDebt,
        removeInterstitialAds: state.account.removeInterstitialAds,
        accountDeleted: false,
      };
    }

    /** Provides gross coins behavior. */
    const grossCoins = requireNonNegativeInteger("gross-coins", receipt.grossCoins);
    /** Provides coins removed behavior. */
    const coinsRemoved = Math.min(currentCoins, grossCoins);
    /** Provides debt added behavior. */
    const debtAdded = grossCoins - coinsRemoved;
    /** Provides next account behavior. */
    const nextAccount: CommerceAccount = {
      coinDebt: safeAdd("coin-debt", state.account.coinDebt, debtAdded),
      removeInterstitialAds: receipt.kind === "durable" ? false : state.account.removeInterstitialAds,
    };
    /** Provides coins behavior. */
    const coins = currentCoins - coinsRemoved;
    transaction.update(userRef, {coins, lastLogin: Date.now()});
    transaction.set(accountRef, {...nextAccount, updatedAtMs: Date.now()}, {merge: true});
    transaction.update(purchaseRef, {refundedAtMs: input.refundedAtMs});
    transaction.create(refundRef, {
      provider: PROVIDER,
      uid,
      productId: input.productId,
      purchaseReceiptId: purchaseRef.id,
      refundedAtMs: input.refundedAtMs,
      coinsRemoved,
      debtAdded,
    });
    return {
      alreadyProcessed: false,
      uid,
      coins,
      coinsRemoved,
      coinDebt: nextAccount.coinDebt,
      removeInterstitialAds: nextAccount.removeInterstitialAds,
      accountDeleted: false,
    };
  });
}
