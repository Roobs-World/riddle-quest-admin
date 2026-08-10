import {admin} from "../../shared/firebaseAdmin";

/** Describes a top-level collection containing documents owned directly by a player. */
interface UserOwnedCollection {
  /** Firestore collection containing player-owned documents. */
  collection: string;
  /** Document field that stores the player's Firebase user ID. */
  field: string;
}

/** Top-level collections containing documents owned directly by a player. */
const USER_OWNED_COLLECTIONS: readonly UserOwnedCollection[] = [
  {collection: "purchaseAnalytics", field: "userId"},
  {collection: "notificationHistory", field: "userId"},
  {collection: "raceRuns", field: "userId"},
  {collection: "raceChallenges", field: "creatorId"},
  {collection: "raceStartRequests", field: "userId"},
  {collection: "raceAttempts", field: "playerId"},
  {collection: "gameCompletionReceipts", field: "userId"},
  {collection: "jestPurchaseGrants", field: "uid"},
];

/** Deletes every matching document in bounded batches. */
async function deleteMatchingDocuments(collection: string, field: string, userId: string): Promise<void> {
  const db = admin.firestore();
  while (true) {
    /** Next bounded page of player-owned documents. */
    const snapshot = await db.collection(collection).where(field, "==", userId).limit(400).get();
    if (snapshot.empty) return;
    /** Batch used to delete the current page atomically. */
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

/** Returns whether an error reports that Firebase Storage has no configured default bucket. */
function isMissingStorageBucket(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  /** Provider error code returned by Cloud Storage or the Firebase Admin SDK. */
  const code = (error as {code?: unknown}).code;
  return code === 404 || code === "404" || code === "storage/bucket-not-found";
}

/** Removes player-owned files when the project has a Firebase Storage bucket. */
async function deletePlayerStorageFiles(userId: string): Promise<void> {
  try {
    await Promise.all(["avatars", "exports"].map((folder) =>
      admin.storage().bucket().deleteFiles({prefix: `${folder}/${userId}/`})));
  } catch (error) {
    if (!isMissingStorageBucket(error)) throw error;
  }
}

/** Permanently removes an authenticated player's Riddle Quest data and Firebase identity. */
export async function deleteAccountForUser(userId: string): Promise<void> {
  const db = admin.firestore();
  await Promise.all(USER_OWNED_COLLECTIONS.map(({collection, field}) =>
    deleteMatchingDocuments(collection, field, userId)));
  await db.recursiveDelete(db.collection("users").doc(userId));
  await db.collection("leaderboard").doc(userId).delete();
  await deletePlayerStorageFiles(userId);
  try {
    await admin.auth().deleteUser(userId);
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error
      && (error as {code?: string}).code === "auth/user-not-found")) throw error;
  }
}
