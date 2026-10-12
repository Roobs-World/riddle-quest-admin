"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFacebookAccountGeneration = deleteFacebookAccountGeneration;
const node_crypto_1 = require("node:crypto");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const facebookSecurity_1 = require("./facebookSecurity");
const deleteAccountData_1 = require("../profile/accountDeletion/deleteAccountData");
/** Defines the identity collection value. */
const IDENTITY_COLLECTION = "providerIdentities";
/** Provides provider identity id behavior. */
const providerIdentityId = (appId, playerId) => (0, node_crypto_1.createHash)("sha256").update(`${appId}\0${playerId}`).digest("hex");
/** Provides require provider scope behavior. */
const requireProviderScope = (provider, documentId, identity, uidSecret) => {
    /** Provides app id behavior. */
    const appId = typeof provider?.appId === "string" ? provider.appId : "";
    /** Provides player id behavior. */
    const playerId = typeof provider?.providerPlayerId === "string" ? provider.providerPlayerId : "";
    if (!appId ||
        appId.length > 256 ||
        !/^[A-Za-z0-9_-]{1,256}$/.test(playerId) ||
        documentId !== providerIdentityId(appId, playerId) ||
        (0, facebookSecurity_1.facebookFirebaseUid)(playerId, uidSecret, identity.accountGeneration) !== identity.uid)
        throw new Error("facebook-provider-identity-conflict");
};
/** Provides valid generation behavior. */
const validGeneration = (value) => Number.isSafeInteger(value) && value >= 1 && value <= facebookSecurity_1.MAX_FACEBOOK_ACCOUNT_GENERATION;
/** Deletes one Facebook generation, then atomically advances the provider identity to a blank generation. */
async function deleteFacebookAccountGeneration(identity, { uidSecret, }) {
    if (!(0, facebookSecurity_1.isFacebookFirebaseUid)(identity.uid) || !validGeneration(identity.accountGeneration)) {
        throw new Error("invalid-facebook-deletion-identity");
    }
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    /** Deletes d uid hash. */
    const deletedUidHash = (0, node_crypto_1.createHash)("sha256").update(identity.uid).digest("hex");
    /** Provides generation exhausted behavior. */
    const generationExhausted = identity.accountGeneration === facebookSecurity_1.MAX_FACEBOOK_ACCOUNT_GENERATION;
    /** Provides next generation behavior. */
    const nextGeneration = generationExhausted ? identity.accountGeneration : identity.accountGeneration + 1;
    /** Provides next status behavior. */
    const nextStatus = generationExhausted ? "exhausted" : "active";
    /** Provides matches behavior. */
    const matches = await db.collection(IDENTITY_COLLECTION).where("uid", "==", identity.uid).limit(2).get();
    if (matches.size === 0) {
        /** Completes d. */
        const completed = await db
            .collection(IDENTITY_COLLECTION)
            .where("lastDeletedUidHash", "==", deletedUidHash)
            .limit(2)
            .get();
        if (completed.size !== 1)
            throw new Error("facebook-provider-identity-not-found");
        /** Provides provider behavior. */
        const provider = completed.docs[0].data();
        /** Provides player id behavior. */
        const playerId = typeof provider?.providerPlayerId === "string" ? provider.providerPlayerId : "";
        /** Provides next uid behavior. */
        const nextUid = generationExhausted ? null : (0, facebookSecurity_1.facebookFirebaseUid)(playerId, uidSecret, nextGeneration);
        if (provider?.provider !== "facebook" ||
            (provider.uid !== null && provider.uid !== nextUid) ||
            provider.status !== nextStatus ||
            provider.accountGeneration !== nextGeneration ||
            provider.lastDeletedUidHash !== deletedUidHash)
            throw new Error("facebook-provider-identity-conflict");
        requireProviderScope(provider, completed.docs[0].ref.id, identity, uidSecret);
        return nextGeneration;
    }
    if (matches.size !== 1)
        throw new Error("facebook-provider-identity-not-found");
    /** Provides provider ref behavior. */
    const providerRef = matches.docs[0].ref;
    await db.runTransaction(async (transaction) => {
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(providerRef);
        /** Provides provider behavior. */
        const provider = snapshot.data();
        if (!snapshot.exists ||
            provider?.provider !== "facebook" ||
            provider.uid !== identity.uid ||
            provider.accountGeneration !== identity.accountGeneration ||
            (provider.status !== undefined && provider.status !== "active" && provider.status !== "deleting"))
            throw new Error("facebook-provider-identity-conflict");
        requireProviderScope(provider, providerRef.id, identity, uidSecret);
        if (provider.status !== "deleting") {
            transaction.update(providerRef, {
                status: "deleting",
                deletionStartedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
    await (0, deleteAccountData_1.deleteAccountForUser)(identity.uid);
    await db.runTransaction(async (transaction) => {
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(providerRef);
        /** Provides provider behavior. */
        const provider = snapshot.data();
        if (!snapshot.exists ||
            provider?.provider !== "facebook" ||
            provider.uid !== identity.uid ||
            provider.accountGeneration !== identity.accountGeneration ||
            provider.status !== "deleting")
            throw new Error("facebook-provider-identity-conflict");
        requireProviderScope(provider, providerRef.id, identity, uidSecret);
        transaction.update(providerRef, {
            uid: null,
            accountGeneration: nextGeneration,
            status: nextStatus,
            lastDeletedUidHash: deletedUidHash,
            lastDeletedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            deletionStartedAt: firebaseAdmin_1.admin.firestore.FieldValue.delete(),
        });
    });
    return nextGeneration;
}
//# sourceMappingURL=facebookAccountDeletion.js.map