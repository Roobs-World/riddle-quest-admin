"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeCrossUserRaceIdentitySnapshots = void 0;
exports.deleteAccountForUser = deleteAccountForUser;
const firebaseAdmin_1 = require("../../shared/firebaseAdmin");
const jestPurchaseReceipts_1 = require("../../jest/jestPurchaseReceipts");
const jestReferralReceipts_1 = require("../../jest/jestReferralReceipts");
const jestAccountDeletion_1 = require("../../jest/jestAccountDeletion");
const jestSecurity_1 = require("../../jest/jestSecurity");
const raceRollout_1 = require("../../race/raceRollout");
const usernameReservations_1 = require("../usernameReservations");
const presenceVisibility_1 = require("../../presence/presenceVisibility");
const facebookContextService_1 = require("../../race/facebookContextService");
const accountDeletionBatches_1 = require("./accountDeletionBatches");
const raceAccountDeletion_1 = require("./raceAccountDeletion");
var raceAccountDeletion_2 = require("./raceAccountDeletion");
Object.defineProperty(exports, "removeCrossUserRaceIdentitySnapshots", { enumerable: true, get: function () { return raceAccountDeletion_2.removeCrossUserRaceIdentitySnapshots; } });
/** Top-level collections containing documents owned directly by a player. */
const USER_OWNED_COLLECTIONS = [
    { collection: "purchaseAnalytics", field: "userId" },
    { collection: "notificationHistory", field: "userId" },
    { collection: "userClassicProgress", field: "userId" },
    { collection: "userDailyChallengeAttempts", field: "userId" },
    { collection: "raceStartRequests", field: "userId" },
    { collection: "gameCompletionReceipts", field: "userId" },
    { collection: "leaderboard", field: "subjectUserId" },
    { collection: "socialModerationQueue", field: "reporterId" },
    { collection: "socialReportRateLimits", field: "reporterId" },
];
/** Defines the maximum number of legacy purchase receipts migrated in one Firestore batch. */
const PURCHASE_MIGRATION_BATCH_SIZE = 200;
/** Copies non-identifying purchase receipt fields into a permanent anti-replay tombstone. */
function purchaseGrantTombstone(purchaseTokenHash, data) {
    return {
        purchaseTokenHash,
        replayProtection: true,
        ...(typeof data.productSku === "string" ? { productSku: data.productSku } : {}),
        ...(typeof data.coins === "number" && Number.isFinite(data.coins) ? { coins: data.coins } : {}),
        ...(data.grantedAt === undefined ? {} : { grantedAt: data.grantedAt }),
    };
}
/** Replaces identity-linked legacy purchase grants with hashed, non-identifying tombstones. */
async function anonymizePurchaseGrantDocuments(userId) {
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    /** Provides collection behavior. */
    const collection = db.collection("jestPurchaseGrants");
    while (true) {
        /** Provides snapshot behavior. */
        const snapshot = await collection.where("uid", "==", userId).limit(PURCHASE_MIGRATION_BATCH_SIZE).get();
        if (snapshot.empty)
            return;
        /** Provides batch behavior. */
        const batch = db.batch();
        snapshot.docs.forEach((document) => {
            /** Provides data behavior. */
            const data = document.data();
            /** Stores d hash. */
            const storedHash = data.purchaseTokenHash;
            /** Provides purchase token hash behavior. */
            const purchaseTokenHash = typeof storedHash === "string" && /^[0-9a-f]{64}$/.test(storedHash)
                ? storedHash
                : (0, jestPurchaseReceipts_1.createJestPurchaseGrantId)(document.id);
            /** Provides target behavior. */
            const target = collection.doc(purchaseTokenHash);
            batch.set(target, purchaseGrantTombstone(purchaseTokenHash, data));
            if (target.path !== document.ref.path)
                batch.delete(document.ref);
        });
        await batch.commit();
    }
}
/** Retains only provider-scoped hashes needed to reject a replay after account deletion. */
async function anonymizeFacebookCommerceDocuments(collectionName, userId) {
    /** Provides collection behavior. */
    const collection = firebaseAdmin_1.admin.firestore().collection(collectionName);
    while (true) {
        /** Provides snapshot behavior. */
        const snapshot = await collection.where("uid", "==", userId).limit(accountDeletionBatches_1.SINGLE_WRITE_BATCH_SIZE).get();
        if (snapshot.empty)
            return;
        /** Provides batch behavior. */
        const batch = firebaseAdmin_1.admin.firestore().batch();
        snapshot.docs.forEach((document) => {
            /** Provides data behavior. */
            const data = document.data();
            batch.set(document.ref, {
                provider: "facebook",
                replayProtection: true,
                ...(typeof data.paymentIdHash === "string" ? { paymentIdHash: data.paymentIdHash } : {}),
                ...(typeof data.purchaseReceiptId === "string" ? { purchaseReceiptId: data.purchaseReceiptId } : {}),
                ...(typeof data.purchaseTokenHash === "string" ? { purchaseTokenHash: data.purchaseTokenHash } : {}),
                ...(typeof data.productId === "string" ? { productId: data.productId } : {}),
                ...(data.refundedAtMs === undefined ? {} : { refundedAtMs: data.refundedAtMs }),
            });
        });
        await batch.commit();
    }
}
/** Retains only non-identifying Reddit order facts needed to reject provider retries after deletion. */
async function anonymizeRedditCommerceDocuments(collectionName, userId) {
    /** Provides collection behavior. */
    const collection = firebaseAdmin_1.admin.firestore().collection(collectionName);
    while (true) {
        /** Provides snapshot behavior. */
        const snapshot = await collection.where("uid", "==", userId).limit(accountDeletionBatches_1.SINGLE_WRITE_BATCH_SIZE).get();
        if (snapshot.empty)
            return;
        /** Provides batch behavior. */
        const batch = firebaseAdmin_1.admin.firestore().batch();
        snapshot.docs.forEach((document) => {
            /** Provides data behavior. */
            const data = document.data();
            batch.set(document.ref, {
                provider: "reddit",
                replayProtection: true,
                ...(typeof data.orderIdHash === "string" ? { orderIdHash: data.orderIdHash } : {}),
                ...(typeof data.environment === "string" ? { environment: data.environment } : {}),
                ...(typeof data.productId === "string" ? { productId: data.productId } : {}),
                ...(data.purchasedAtMs === undefined ? {} : { purchasedAtMs: data.purchasedAtMs }),
                ...(data.refundedAtMs === undefined ? {} : { refundedAtMs: data.refundedAtMs }),
            });
        });
        await batch.commit();
    }
}
/** Removes both identities while preserving one referral settlement replay tombstone. */
async function anonymizeFacebookReferralSettlements(field, userId) {
    /** Provides collection behavior. */
    const collection = firebaseAdmin_1.admin.firestore().collection("facebookReferralSettlements");
    while (true) {
        /** Provides snapshot behavior. */
        const snapshot = await collection.where(field, "==", userId).limit(accountDeletionBatches_1.SINGLE_WRITE_BATCH_SIZE).get();
        if (snapshot.empty)
            return;
        /** Provides batch behavior. */
        const batch = firebaseAdmin_1.admin.firestore().batch();
        snapshot.docs.forEach((document) => {
            /** Provides data behavior. */
            const data = document.data();
            batch.set(document.ref, {
                provider: "facebook",
                replayProtection: true,
                ...(typeof data.inviteeCoins === "number" ? { inviteeCoins: data.inviteeCoins } : {}),
                ...(typeof data.inviterCoins === "number" ? { inviterCoins: data.inviterCoins } : {}),
                ...(data.settledAtMs === undefined ? {} : { settledAtMs: data.settledAtMs }),
            });
        });
        await batch.commit();
    }
}
/** Removes both Reddit identities while preserving one referral settlement replay tombstone. */
async function anonymizeRedditReferralSettlements(field, userId) {
    /** Provides collection behavior. */
    const collection = firebaseAdmin_1.admin.firestore().collection("redditReferralSettlements");
    while (true) {
        /** Provides snapshot behavior. */
        const snapshot = await collection.where(field, "==", userId).limit(accountDeletionBatches_1.SINGLE_WRITE_BATCH_SIZE).get();
        if (snapshot.empty)
            return;
        /** Provides batch behavior. */
        const batch = firebaseAdmin_1.admin.firestore().batch();
        snapshot.docs.forEach((document) => {
            /** Provides data behavior. */
            const data = document.data();
            batch.set(document.ref, {
                provider: "reddit",
                replayProtection: true,
                ...(typeof data.inviteeCoins === "number" ? { inviteeCoins: data.inviteeCoins } : {}),
                ...(typeof data.inviterCoins === "number" ? { inviterCoins: data.inviterCoins } : {}),
                ...(data.settledAtMs === undefined ? {} : { settledAtMs: data.settledAtMs }),
            });
        });
        await batch.commit();
    }
}
/** Copies non-identifying referral reward fields into a permanent anti-replay tombstone. */
function referralRewardTombstone(data) {
    return {
        replayProtection: true,
        ...(typeof data.reference === "string" ? { reference: data.reference } : {}),
        ...(typeof data.inviterCoins === "number" && Number.isFinite(data.inviterCoins)
            ? { inviterCoins: data.inviterCoins }
            : {}),
        ...(typeof data.referredCoins === "number" && Number.isFinite(data.referredCoins)
            ? { referredCoins: data.referredCoins }
            : {}),
        ...(data.grantedAt === undefined ? {} : { grantedAt: data.grantedAt }),
    };
}
/** Removes a platform player ID from existing referral reward receipts without enabling replay. */
async function anonymizeReferralRewardDocuments(field, jestPlayerId) {
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    /** Provides collection behavior. */
    const collection = db.collection("jestReferralRewards");
    while (true) {
        /** Provides snapshot behavior. */
        const snapshot = await collection.where(field, "==", jestPlayerId).limit(accountDeletionBatches_1.SINGLE_WRITE_BATCH_SIZE).get();
        if (snapshot.empty)
            return;
        /** Provides batch behavior. */
        const batch = db.batch();
        snapshot.docs.forEach((document) => batch.set(document.ref, referralRewardTombstone(document.data())));
        await batch.commit();
    }
}
/** Removes Jest referral records or identity linkage owned by one platform player. */
async function removeJestReferralIdentity(jestPlayerId) {
    await (0, accountDeletionBatches_1.deleteMatchingDocuments)("jestReferralVerifications", "playerId", jestPlayerId);
    await firebaseAdmin_1.admin
        .firestore()
        .collection("jestReferralVerifications")
        .doc((0, jestReferralReceipts_1.createJestReferralVerificationId)(jestPlayerId))
        .delete();
    await anonymizeReferralRewardDocuments("playerId", jestPlayerId);
    await anonymizeReferralRewardDocuments("referredPlayerId", jestPlayerId);
}
/** Returns whether an error reports that Firebase Storage has no configured default bucket. */
function isMissingStorageBucket(error) {
    if (typeof error !== "object" || error === null || !("code" in error))
        return false;
    /** Provider error code returned by Cloud Storage or the Firebase Admin SDK. */
    const code = error.code;
    return code === 404 || code === "404" || code === "storage/bucket-not-found";
}
/** Removes player-owned files when the project has a Firebase Storage bucket. */
async function deletePlayerStorageFiles(userId) {
    try {
        await Promise.all(["avatars", "exports"].map((folder) => firebaseAdmin_1.admin
            .storage()
            .bucket()
            .deleteFiles({ prefix: `${folder}/${userId}/` })));
    }
    catch (error) {
        if (!isMissingStorageBucket(error))
            throw error;
    }
}
/** Permanently removes an authenticated player's Riddle Quest data and Firebase identity. */
async function deleteAccountForUser(userId, jestPlayerId) {
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    // This permanent pseudonymous guard is written first so another device or
    // an older build/token cannot recreate account data while the remaining
    // idempotent cleanup is in progress or after it completes.
    await (0, jestAccountDeletion_1.recordJestAccountDeletion)(userId);
    await (0, raceAccountDeletion_1.removeCrossUserRaceIdentitySnapshots)(userId);
    await (0, facebookContextService_1.removeUserFromFacebookContextCompetitions)(userId, db);
    await Promise.all([
        ...USER_OWNED_COLLECTIONS.map(({ collection, field }) => (0, accountDeletionBatches_1.deleteMatchingDocuments)(collection, field, userId)),
        (0, accountDeletionBatches_1.deleteMatchingDocuments)("raceAnalytics", "cohortUserHash", (0, raceRollout_1.hashRaceCohortUser)(userId)),
        (0, accountDeletionBatches_1.deleteMatchingDocuments)("socialModerationQueue", "targetUserId", userId),
        (0, accountDeletionBatches_1.deleteMatchingCollectionGroupDocuments)("knownRivals", "targetUserId", userId),
        (0, accountDeletionBatches_1.deleteMatchingCollectionGroupDocuments)("blockedRivals", "targetUserId", userId),
        (0, accountDeletionBatches_1.deleteMatchingDocuments)("facebookReferralTokens", "inviterUid", userId),
        (0, accountDeletionBatches_1.deleteMatchingDocuments)("facebookReferralBindings", "inviterUid", userId),
        (0, accountDeletionBatches_1.deleteMatchingDocuments)("facebookReferralDailyCaps", "inviterUid", userId),
        (0, accountDeletionBatches_1.deleteMatchingDocuments)("redditReferralTokens", "inviterUid", userId),
        (0, accountDeletionBatches_1.deleteMatchingDocuments)("redditReferralBindings", "inviterUid", userId),
        (0, accountDeletionBatches_1.deleteMatchingDocuments)("redditReferralDailyCaps", "inviterUid", userId),
        db.collection("tutorialProgress").doc(userId).delete(),
        db.collection("redditPlayerStorage").doc(userId).delete(),
        db.collection("redditCommerceAccounts").doc(userId).delete(),
        db.collection("facebookCommerceAccounts").doc(userId).delete(),
        db.collection("facebookNotificationPromptLeases").doc(userId).delete(),
        db.collection("facebookReferralBindings").doc(userId).delete(),
        db.collection("redditReferralBindings").doc(userId).delete(),
        anonymizePurchaseGrantDocuments(userId),
        anonymizeFacebookCommerceDocuments("facebookCommerceReceipts", userId),
        anonymizeFacebookCommerceDocuments("facebookCommerceRefunds", userId),
        anonymizeRedditCommerceDocuments("redditCommerceReceipts", userId),
        anonymizeRedditCommerceDocuments("redditCommerceRefunds", userId),
        anonymizeFacebookReferralSettlements("inviteeUid", userId),
        anonymizeFacebookReferralSettlements("inviterUid", userId),
        anonymizeRedditReferralSettlements("inviteeUid", userId),
        anonymizeRedditReferralSettlements("inviterUid", userId),
        (0, presenceVisibility_1.deletePresenceForUser)(userId, firebaseAdmin_1.admin.database()),
    ]);
    if (jestPlayerId)
        await removeJestReferralIdentity(jestPlayerId);
    /** Provides r ref. */
    const userRef = db.collection("users").doc(userId);
    await (0, usernameReservations_1.deleteUsernameReservationAndProfiles)(userId);
    // The transaction removes the top-level user document. recursiveDelete then
    // removes any remaining private subcollection documents under that path.
    await db.recursiveDelete(userRef);
    await deletePlayerStorageFiles(userId);
    if (!(0, jestSecurity_1.isJestFirebaseUid)(userId)) {
        try {
            await firebaseAdmin_1.admin.auth().deleteUser(userId);
        }
        catch (error) {
            if (!(typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "auth/user-not-found"))
                throw error;
        }
    }
}
//# sourceMappingURL=deleteAccountData.js.map