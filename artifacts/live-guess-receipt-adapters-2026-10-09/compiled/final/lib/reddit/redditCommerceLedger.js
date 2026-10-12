"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redditCommerceReceiptId = redditCommerceReceiptId;
exports.grantVerifiedRedditOrder = grantVerifiedRedditOrder;
exports.refundVerifiedRedditOrder = refundVerifiedRedditOrder;
const node_crypto_1 = require("node:crypto");
const pricing_1 = require("@qwordly/core/pricing");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const redditFeatureFlags_1 = require("./redditFeatureFlags");
const redditSecurity_1 = require("./redditSecurity");
/** Provider discriminator persisted in every Reddit commerce ledger record. */
const PROVIDER = "reddit";
/** Fails closed unless commerce is enabled for the order's deployment environment. */
const requireCommerce = (environment) => {
    if (!(0, redditFeatureFlags_1.isRedditCommerceEnabled)(environment))
        throw new Error("reddit-commerce-disabled");
};
/** Rejects empty or oversized provider identifiers before they reach Firestore. */
const bounded = (value, bytes = 512) => {
    if (!value || Buffer.byteLength(value, "utf8") > bytes)
        throw new Error("invalid-reddit-commerce-id");
};
/** Reads a persisted balance field while enforcing the ledger's non-negative safe-integer invariant. */
const nonNegative = (value, name) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`invalid-reddit-commerce-${name}`);
    }
    return value;
};
/** Adds ledger amounts without permitting overflow or a negative result. */
const safeAdd = (left, right) => {
    /** Provides value behavior. */
    const value = left + right;
    if (!Number.isSafeInteger(value) || value < 0)
        throw new Error("invalid-reddit-commerce-balance");
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
function redditCommerceReceiptId(environment, orderId) {
    bounded(orderId);
    return (0, node_crypto_1.createHash)("sha256").update(`${PROVIDER}\0${environment}\0order\0${orderId}`).digest("hex");
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
async function grantVerifiedRedditOrder(db, input) {
    requireCommerce(input.environment);
    if (!(0, redditSecurity_1.isRedditFirebaseUid)(input.uid))
        throw new Error("invalid-reddit-commerce-uid");
    bounded(input.orderId);
    if (!Number.isSafeInteger(input.purchasedAtMs) || input.purchasedAtMs <= 0)
        throw new Error("invalid-reddit-purchase-time");
    /** Provides product behavior. */
    const product = (0, pricing_1.resolveRedditGoldProduct)(input.productId);
    /** Provides receipt id behavior. */
    const receiptId = redditCommerceReceiptId(input.environment, input.orderId);
    /** Provides r ref. */
    const userRef = db.collection("users").doc(input.uid);
    /** Provides account ref behavior. */
    const accountRef = db.collection("redditCommerceAccounts").doc(input.uid);
    /** Provides receipt ref behavior. */
    const receiptRef = db.collection("redditCommerceReceipts").doc(receiptId);
    return db.runTransaction(async (transaction) => {
        /** Provides [user, account, receipt, deletion] behavior. */
        const [user, account, receipt, deletion] = await Promise.all([
            transaction.get(userRef),
            transaction.get(accountRef),
            transaction.get(receiptRef),
            transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, input.uid)),
        ]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
        if (!user.exists)
            throw new Error("reddit-commerce-user-not-found");
        /** Provides coins behavior. */
        const coins = nonNegative(user.data()?.coins, "coins");
        /** Provides debt behavior. */
        const debt = account.exists ? nonNegative(account.data()?.coinDebt, "debt") : 0;
        if (receipt.exists) {
            /** Provides value behavior. */
            const value = receipt.data();
            if (value?.provider !== PROVIDER ||
                value.environment !== input.environment ||
                value.uid !== input.uid ||
                value.orderIdHash !== receiptId ||
                value.productId !== input.productId ||
                value.grossCoins !== product.coins ||
                value.goldCost !== product.goldCost ||
                value.purchasedAtMs !== input.purchasedAtMs) {
                throw new Error("reddit-purchase-receipt-conflict");
            }
            return { alreadyProcessed: true, coins, coinDebt: debt };
        }
        /** Provides debt repaid behavior. */
        const debtRepaid = Math.min(debt, product.coins);
        /** Provides coins granted behavior. */
        const coinsGranted = product.coins - debtRepaid;
        /** Provides next coins behavior. */
        const nextCoins = safeAdd(coins, coinsGranted);
        /** Provides next debt behavior. */
        const nextDebt = debt - debtRepaid;
        transaction.update(userRef, { coins: nextCoins, hasPurchasedApp: true });
        transaction.set(accountRef, { coinDebt: nextDebt, updatedAtMs: input.purchasedAtMs }, { merge: true });
        transaction.create(receiptRef, {
            provider: PROVIDER,
            environment: input.environment,
            uid: input.uid,
            orderIdHash: receiptId,
            productId: input.productId,
            grossCoins: product.coins,
            goldCost: product.goldCost,
            coinsGranted,
            debtRepaid,
            purchasedAtMs: input.purchasedAtMs,
            refundedAtMs: null,
        });
        return { alreadyProcessed: false, coins: nextCoins, coinDebt: nextDebt };
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
async function refundVerifiedRedditOrder(db, input) {
    requireCommerce(input.environment);
    bounded(input.orderId);
    if (!Number.isSafeInteger(input.refundedAtMs) || input.refundedAtMs <= 0)
        throw new Error("invalid-reddit-refund-time");
    /** Provides product behavior. */
    const product = (0, pricing_1.resolveRedditGoldProduct)(input.productId);
    /** Provides receipt id behavior. */
    const receiptId = redditCommerceReceiptId(input.environment, input.orderId);
    /** Provides receipt ref behavior. */
    const receiptRef = db.collection("redditCommerceReceipts").doc(receiptId);
    /** Provides refund ref behavior. */
    const refundRef = db.collection("redditCommerceRefunds").doc(receiptId);
    return db.runTransaction(async (transaction) => {
        /** Provides [receipt, refund] behavior. */
        const [receipt, refund] = await Promise.all([transaction.get(receiptRef), transaction.get(refundRef)]);
        if (!receipt.exists)
            throw new Error("reddit-purchase-not-found");
        /** Provides value behavior. */
        const value = receipt.data();
        /** Provides uid behavior. */
        const uid = typeof value?.uid === "string" ? value.uid : "";
        if (!(0, redditSecurity_1.isRedditFirebaseUid)(uid) ||
            value?.provider !== PROVIDER ||
            value.environment !== input.environment ||
            value.orderIdHash !== receiptId ||
            value.productId !== input.productId ||
            value.grossCoins !== product.coins ||
            value.goldCost !== product.goldCost ||
            !Number.isSafeInteger(value.purchasedAtMs) ||
            input.refundedAtMs < value.purchasedAtMs)
            throw new Error("reddit-refund-receipt-conflict");
        /** Provides r ref. */
        const userRef = db.collection("users").doc(uid);
        /** Provides account ref behavior. */
        const accountRef = db.collection("redditCommerceAccounts").doc(uid);
        /** Provides [user, account] behavior. */
        const [user, account] = await Promise.all([transaction.get(userRef), transaction.get(accountRef)]);
        if (!user.exists)
            throw new Error("reddit-commerce-user-not-found");
        /** Provides coins behavior. */
        const coins = nonNegative(user.data()?.coins, "coins");
        /** Provides debt behavior. */
        const debt = account.exists ? nonNegative(account.data()?.coinDebt, "debt") : 0;
        if (refund.exists) {
            /** Provides prior behavior. */
            const prior = refund.data();
            if (prior?.provider !== PROVIDER ||
                prior.environment !== input.environment ||
                prior.uid !== uid ||
                prior.productId !== input.productId ||
                prior.refundedAtMs !== input.refundedAtMs) {
                throw new Error("reddit-refund-event-conflict");
            }
            return { alreadyProcessed: true, uid, coins, coinsRemoved: 0, coinDebt: debt };
        }
        if (value.refundedAtMs !== null)
            throw new Error("reddit-refund-event-conflict");
        /** Provides coins removed behavior. */
        const coinsRemoved = Math.min(coins, product.coins);
        /** Provides debt added behavior. */
        const debtAdded = product.coins - coinsRemoved;
        /** Provides next coins behavior. */
        const nextCoins = coins - coinsRemoved;
        /** Provides next debt behavior. */
        const nextDebt = safeAdd(debt, debtAdded);
        transaction.update(userRef, { coins: nextCoins });
        transaction.set(accountRef, { coinDebt: nextDebt, updatedAtMs: input.refundedAtMs }, { merge: true });
        transaction.update(receiptRef, { refundedAtMs: input.refundedAtMs });
        transaction.create(refundRef, {
            provider: PROVIDER,
            environment: input.environment,
            uid,
            orderIdHash: receiptId,
            productId: input.productId,
            coinsRemoved,
            debtAdded,
            refundedAtMs: input.refundedAtMs,
        });
        return { alreadyProcessed: false, uid, coins: nextCoins, coinsRemoved, coinDebt: nextDebt };
    });
}
//# sourceMappingURL=redditCommerceLedger.js.map