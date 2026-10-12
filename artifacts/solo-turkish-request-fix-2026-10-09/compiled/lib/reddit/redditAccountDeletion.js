"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRedditAccountGeneration = deleteRedditAccountGeneration;
const node_crypto_1 = require("node:crypto");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const deleteAccountData_1 = require("../profile/accountDeletion/deleteAccountData");
const redditSecurity_1 = require("./redditSecurity");
/** Provides provider identity id behavior. */
const providerIdentityId = (appName, userId) => (0, node_crypto_1.createHash)("sha256").update(`reddit\0${appName}\0${userId}`, "utf8").digest("hex");
/** Provides valid provider scope behavior. */
const validProviderScope = (provider, identity) => provider?.provider === "reddit" &&
    provider.appName === identity.appName &&
    provider.providerUserId === identity.userId;
/** Deletes one Reddit account generation and leaves only a hashed recreation proof. */
async function deleteRedditAccountGeneration(identity, { uidSecret, deleteUser = deleteAccountData_1.deleteAccountForUser, }) {
    if (!Number.isSafeInteger(identity.accountGeneration) ||
        identity.accountGeneration < 1 ||
        identity.accountGeneration > redditSecurity_1.MAX_REDDIT_ACCOUNT_GENERATION)
        throw new Error("invalid-reddit-deletion-identity");
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    /** Provides provider ref behavior. */
    const providerRef = db.collection("providerIdentities").doc(providerIdentityId(identity.appName, identity.userId));
    /** Provides account generation behavior. */
    const accountGeneration = identity.accountGeneration;
    /** Provides uid behavior. */
    const uid = (0, redditSecurity_1.redditFirebaseUid)(identity.userId, uidSecret, accountGeneration);
    /** Deletes d uid hash. */
    const deletedUidHash = (0, node_crypto_1.createHash)("sha256").update(uid).digest("hex");
    /** Provides next generation behavior. */
    const nextGeneration = accountGeneration === redditSecurity_1.MAX_REDDIT_ACCOUNT_GENERATION ? accountGeneration : accountGeneration + 1;
    /** Provides next status behavior. */
    const nextStatus = accountGeneration === redditSecurity_1.MAX_REDDIT_ACCOUNT_GENERATION ? "exhausted" : "active";
    /** Provides deletion required behavior. */
    let deletionRequired = false;
    await db.runTransaction(async (transaction) => {
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(providerRef);
        /** Provides provider behavior. */
        const provider = snapshot.data();
        if (!snapshot.exists || !provider || !validProviderScope(provider, identity)) {
            throw new Error("reddit-provider-identity-conflict");
        }
        /** Provides next uid behavior. */
        const nextUid = nextStatus === "active" ? (0, redditSecurity_1.redditFirebaseUid)(identity.userId, uidSecret, nextGeneration) : null;
        /** Provides already complete behavior. */
        const alreadyComplete = provider.accountGeneration === nextGeneration &&
            provider.status === nextStatus &&
            provider.lastDeletedUidHash === deletedUidHash &&
            (provider.uid === null || provider.uid === nextUid);
        if (alreadyComplete)
            return;
        if (provider.accountGeneration !== accountGeneration ||
            provider.uid !== uid ||
            (provider.status !== "active" && provider.status !== "deleting")) {
            throw new Error("reddit-provider-identity-conflict");
        }
        deletionRequired = true;
        if (provider.status !== "deleting") {
            transaction.update(providerRef, {
                status: "deleting",
                deletionStartedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
    if (!deletionRequired)
        return nextGeneration;
    await deleteUser(uid);
    await db.runTransaction(async (transaction) => {
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(providerRef);
        /** Provides provider behavior. */
        const provider = snapshot.data();
        if (!snapshot.exists || !provider || !validProviderScope(provider, identity)) {
            throw new Error("reddit-provider-identity-conflict");
        }
        /** Provides next uid behavior. */
        const nextUid = nextStatus === "active" ? (0, redditSecurity_1.redditFirebaseUid)(identity.userId, uidSecret, nextGeneration) : null;
        /** Provides already complete behavior. */
        const alreadyComplete = provider.accountGeneration === nextGeneration &&
            provider.status === nextStatus &&
            provider.lastDeletedUidHash === deletedUidHash &&
            (provider.uid === null || provider.uid === nextUid);
        if (alreadyComplete)
            return;
        if (provider.uid !== uid || provider.accountGeneration !== accountGeneration || provider.status !== "deleting") {
            throw new Error("reddit-provider-identity-conflict");
        }
        transaction.update(providerRef, {
            uid: null,
            accountGeneration: nextGeneration,
            status: nextStatus,
            lastDeletedUidHash: deletedUidHash,
            lastDeletedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            deletionStartedAt: firebaseAdmin_1.admin.firestore.FieldValue.delete(),
            redditProfile: firebaseAdmin_1.admin.firestore.FieldValue.delete(),
        });
    });
    return nextGeneration;
}
//# sourceMappingURL=redditAccountDeletion.js.map