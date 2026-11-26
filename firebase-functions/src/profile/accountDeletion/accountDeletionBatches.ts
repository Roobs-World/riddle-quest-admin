import {admin} from "../../shared/firebaseAdmin";

/** Defines the maximum number of single-write documents handled in one Firestore batch. */
export const SINGLE_WRITE_BATCH_SIZE = 400;

/** Deletes every matching top-level document in bounded batches. */
export async function deleteMatchingDocuments(collection: string, field: string, userId: string): Promise<void> {
  /** Provides db behavior. */
  const db = admin.firestore();
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await db.collection(collection).where(field, "==", userId).limit(SINGLE_WRITE_BATCH_SIZE).get();
    if (snapshot.empty) return;
    /** Provides batch behavior. */
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

/** Deletes matching documents from any same-named subcollection in bounded batches. */
export async function deleteMatchingCollectionGroupDocuments(
  collectionGroup: string,
  field: string,
  value: string,
): Promise<void> {
  /** Provides db behavior. */
  const db = admin.firestore();
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await db
      .collectionGroup(collectionGroup)
      .where(field, "==", value)
      .limit(SINGLE_WRITE_BATCH_SIZE)
      .get();
    if (snapshot.empty) return;
    /** Provides batch behavior. */
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}
