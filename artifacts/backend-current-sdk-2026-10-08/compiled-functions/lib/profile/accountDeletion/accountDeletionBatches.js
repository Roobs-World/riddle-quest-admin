"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SINGLE_WRITE_BATCH_SIZE = void 0;
exports.deleteMatchingDocuments = deleteMatchingDocuments;
exports.deleteMatchingCollectionGroupDocuments = deleteMatchingCollectionGroupDocuments;
const firebaseAdmin_1 = require("../../shared/firebaseAdmin");
/** Defines the maximum number of single-write documents handled in one Firestore batch. */
exports.SINGLE_WRITE_BATCH_SIZE = 400;
/** Deletes every matching top-level document in bounded batches. */
async function deleteMatchingDocuments(collection, field, userId) {
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    while (true) {
        /** Provides snapshot behavior. */
        const snapshot = await db.collection(collection).where(field, "==", userId).limit(exports.SINGLE_WRITE_BATCH_SIZE).get();
        if (snapshot.empty)
            return;
        /** Provides batch behavior. */
        const batch = db.batch();
        snapshot.docs.forEach((document) => batch.delete(document.ref));
        await batch.commit();
    }
}
/** Deletes matching documents from any same-named subcollection in bounded batches. */
async function deleteMatchingCollectionGroupDocuments(collectionGroup, field, value) {
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    while (true) {
        /** Provides snapshot behavior. */
        const snapshot = await db
            .collectionGroup(collectionGroup)
            .where(field, "==", value)
            .limit(exports.SINGLE_WRITE_BATCH_SIZE)
            .get();
        if (snapshot.empty)
            return;
        /** Provides batch behavior. */
        const batch = db.batch();
        snapshot.docs.forEach((document) => batch.delete(document.ref));
        await batch.commit();
    }
}
//# sourceMappingURL=accountDeletionBatches.js.map