import {admin} from "../../shared/firebaseAdmin";
import {createJestPurchaseGrantId} from "../../jest/jestPurchaseReceipts";
import {createJestReferralVerificationId} from "../../jest/jestReferralReceipts";
import {recordJestAccountDeletion} from "../../jest/jestAccountDeletion";
import {isJestFirebaseUid} from "../../jest/jestSecurity";
import {hashRaceCohortUser} from "../../race/raceRollout";
import {requestDocumentId} from "../../race/raceSetupService";
import {deleteUsernameReservationAndProfiles} from "../usernameReservations";

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
  {collection: "userClassicProgress", field: "userId"},
  {collection: "userDailyChallengeAttempts", field: "userId"},
  {collection: "raceStartRequests", field: "userId"},
  {collection: "gameCompletionReceipts", field: "userId"},
  {collection: "leaderboard", field: "subjectUserId"},
];

/** Defines the maximum number of single-write documents handled in one Firestore batch. */
const SINGLE_WRITE_BATCH_SIZE = 400;
/** Defines the maximum number of legacy purchase receipts migrated in one Firestore batch. */
const PURCHASE_MIGRATION_BATCH_SIZE = 200;
/** Neutral display value retained when another player's run needs its ghost timing but not the deleted identity. */
const DELETED_RACE_OPPONENT_NAME = "Riddle Quest player";

/** Deletes every matching document in bounded batches. */
async function deleteMatchingDocuments(collection: string, field: string, userId: string): Promise<void> {
  const db = admin.firestore();
  while (true) {
    /** Next bounded page of player-owned documents. */
    const snapshot = await db.collection(collection).where(field, "==", userId).limit(SINGLE_WRITE_BATCH_SIZE).get();
    if (snapshot.empty) return;
    /** Batch used to delete the current page atomically. */
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

/** Deletes matching documents from any same-named subcollection in bounded batches. */
async function deleteMatchingCollectionGroupDocuments(
  collectionGroup: string,
  field: string,
  value: string,
): Promise<void> {
  const db = admin.firestore();
  while (true) {
    const snapshot = await db.collectionGroup(collectionGroup)
      .where(field, "==", value)
      .limit(SINGLE_WRITE_BATCH_SIZE)
      .get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

/** Removes copied opponent identity from idempotent responses nested under a race run. */
async function anonymizeRaceRequestReceipts(
  runDocument: FirebaseFirestore.QueryDocumentSnapshot,
): Promise<void> {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let query = runDocument.ref.collection("requests")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(SINGLE_WRITE_BATCH_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) return;
    const targets = snapshot.docs.filter((document) => {
      const response = document.data().response;
      if (typeof response !== "object" || response === null) return false;
      const run = (response as {run?: unknown}).run;
      if (typeof run !== "object" || run === null) return false;
      const opponent = (run as {opponent?: unknown}).opponent;
      return typeof opponent === "object" && opponent !== null;
    });
    if (targets.length > 0) {
      const batch = admin.firestore().batch();
      targets.forEach((document) => batch.update(document.ref, {
        "response.run.opponent.displayName": DELETED_RACE_OPPONENT_NAME,
        "response.run.opponent.avatarUrl": admin.firestore.FieldValue.delete(),
      }));
      await batch.commit();
    }
    cursor = snapshot.docs.at(-1);
    if (snapshot.docs.length < SINGLE_WRITE_BATCH_SIZE) return;
  }
}

/** Removes display/avatar identity while preserving another player's bounded ghost run. */
async function anonymizeRaceRunPage(
  documents: FirebaseFirestore.QueryDocumentSnapshot[],
): Promise<void> {
  const targets = documents.filter((document) => {
    const opponent = document.data().opponent;
    return typeof opponent === "object" && opponent !== null;
  });
  if (targets.length === 0) return;
  const db = admin.firestore();
  // First clear the parent projection while retaining its subject link. Race
  // mutations transactionally read this parent before writing a receipt, so
  // this write conflicts and retries any in-flight identity-bearing response.
  const parentIdentityBatch = db.batch();
  targets.forEach((document) => parentIdentityBatch.update(document.ref, {
    "opponent.displayName": DELETED_RACE_OPPONENT_NAME,
    "opponent.avatarUrl": admin.firestore.FieldValue.delete(),
  }));
  await parentIdentityBatch.commit();

  // Any mutation that starts after the parent update can only persist the
  // generic projection. Existing receipts can therefore be sanitized before
  // the lookup link is removed without opening a write-after-scan race.
  for (const document of targets) await anonymizeRaceRequestReceipts(document);

  const subjectLinkBatch = db.batch();
  targets.forEach((document) => subjectLinkBatch.update(document.ref, {
    "opponent.subjectUserId": admin.firestore.FieldValue.delete(),
  }));
  await subjectLinkBatch.commit();
}

/** Deletes idempotency receipts nested under a race run in bounded pages. */
async function deleteRaceRequestReceipts(
  runDocument: FirebaseFirestore.QueryDocumentSnapshot,
): Promise<void> {
  while (true) {
    const snapshot = await runDocument.ref.collection("requests")
      .limit(SINGLE_WRITE_BATCH_SIZE)
      .get();
    if (snapshot.empty) return;
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

/** Anonymizes new race runs linked directly to the deleted opponent UID. */
async function anonymizeSubjectLinkedRaceRuns(userId: string): Promise<void> {
  const db = admin.firestore();
  while (true) {
    const snapshot = await db.collection("raceRuns")
      .where("opponent.subjectUserId", "==", userId)
      .limit(SINGLE_WRITE_BATCH_SIZE)
      .get();
    if (snapshot.empty) return;
    await anonymizeRaceRunPage(snapshot.docs);
  }
}

/** Best-effort legacy fallback using a deleting creator's still-present challenge link. */
async function anonymizeLegacyRaceRunsForChallenge(challengeId: string): Promise<void> {
  const db = admin.firestore();
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let query = db.collection("raceRuns")
      .where("challengeId", "==", challengeId)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(SINGLE_WRITE_BATCH_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) return;
    await anonymizeRaceRunPage(snapshot.docs);
    cursor = snapshot.docs.at(-1);
    if (snapshot.docs.length < SINGLE_WRITE_BATCH_SIZE) return;
  }
}

/** Deletes legacy inbox snapshots using the deterministic challenge/player item link. */
async function deleteLegacyRaceInboxSnapshot(challengeId: string, userId: string): Promise<void> {
  await deleteMatchingCollectionGroupDocuments(
    "raceInbox",
    "itemId",
    requestDocumentId(challengeId, userId),
  );
}

/** Deletes owned race participation only after using its links to clean legacy inbox snapshots. */
async function deleteOwnedRaceParticipation(
  collection: "raceRuns" | "raceAttempts",
  ownerField: "userId" | "playerId",
  userId: string,
): Promise<void> {
  const db = admin.firestore();
  while (true) {
    const snapshot = await db.collection(collection)
      .where(ownerField, "==", userId)
      .limit(SINGLE_WRITE_BATCH_SIZE)
      .get();
    if (snapshot.empty) return;
    const challengeIds = new Set(snapshot.docs.flatMap((document) => {
      const challengeId = document.data().challengeId;
      return typeof challengeId === "string" && challengeId.length > 0 ? [challengeId] : [];
    }));
    for (const challengeId of challengeIds) await deleteLegacyRaceInboxSnapshot(challengeId, userId);
    if (collection === "raceRuns") {
      // A parent deletion does not remove Firestore subcollections. Clear the
      // replay receipts explicitly so their response snapshots do not survive.
      for (const document of snapshot.docs) await deleteRaceRequestReceipts(document);
    }
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    if (collection === "raceRuns") {
      // Sweep once more after deleting the parents. A mutation that committed
      // during the first scan is now visible, while any transaction that had
      // only read the parent must conflict with its deletion and cannot add a
      // later receipt.
      for (const document of snapshot.docs) await deleteRaceRequestReceipts(document);
    }
  }
}

/** Deletes owned challenges after anonymizing identity copied into other players' legacy runs. */
async function deleteOwnedRaceChallenges(userId: string): Promise<void> {
  const db = admin.firestore();
  while (true) {
    const snapshot = await db.collection("raceChallenges")
      .where("creatorId", "==", userId)
      .limit(SINGLE_WRITE_BATCH_SIZE)
      .get();
    if (snapshot.empty) return;
    const challengeIds = new Set(snapshot.docs.map((document) => {
      const stored = document.data().challengeId;
      return typeof stored === "string" && stored.length > 0 ? stored : document.id;
    }));
    for (const challengeId of challengeIds) await anonymizeLegacyRaceRunsForChallenge(challengeId);
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

/** Removes every targetable cross-user race identity snapshot before its legacy lookup links disappear. */
export async function removeCrossUserRaceIdentitySnapshots(userId: string): Promise<void> {
  await deleteMatchingCollectionGroupDocuments("raceInbox", "opponentUserId", userId);
  await anonymizeSubjectLinkedRaceRuns(userId);
  await deleteOwnedRaceChallenges(userId);
  await deleteOwnedRaceParticipation("raceRuns", "userId", userId);
  await deleteOwnedRaceParticipation("raceAttempts", "playerId", userId);
  // A receipt can outlive a TTL-deleted parent because Firestore does not
  // cascade parent deletion and each action refreshes the child's expiry.
  // The deletion guard/operation lease has already drained this owner, so this
  // final collection-group sweep cannot race a later owned receipt write.
  await deleteMatchingCollectionGroupDocuments("requests", "userId", userId);
}

/** Copies non-identifying purchase receipt fields into a permanent anti-replay tombstone. */
function purchaseGrantTombstone(
  purchaseTokenHash: string,
  data: FirebaseFirestore.DocumentData,
): FirebaseFirestore.DocumentData {
  return {
    purchaseTokenHash,
    replayProtection: true,
    ...(typeof data.productSku === "string" ? {productSku: data.productSku} : {}),
    ...(typeof data.coins === "number" && Number.isFinite(data.coins) ? {coins: data.coins} : {}),
    ...(data.grantedAt === undefined ? {} : {grantedAt: data.grantedAt}),
  };
}

/** Replaces identity-linked legacy purchase grants with hashed, non-identifying tombstones. */
async function anonymizePurchaseGrantDocuments(userId: string): Promise<void> {
  const db = admin.firestore();
  const collection = db.collection("jestPurchaseGrants");
  while (true) {
    const snapshot = await collection.where("uid", "==", userId).limit(PURCHASE_MIGRATION_BATCH_SIZE).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((document) => {
      const data = document.data();
      const storedHash = data.purchaseTokenHash;
      const purchaseTokenHash = typeof storedHash === "string" && /^[0-9a-f]{64}$/.test(storedHash)
        ? storedHash
        : createJestPurchaseGrantId(document.id);
      const target = collection.doc(purchaseTokenHash);
      batch.set(target, purchaseGrantTombstone(purchaseTokenHash, data));
      if (target.path !== document.ref.path) batch.delete(document.ref);
    });
    await batch.commit();
  }
}

/** Copies non-identifying referral reward fields into a permanent anti-replay tombstone. */
function referralRewardTombstone(data: FirebaseFirestore.DocumentData): FirebaseFirestore.DocumentData {
  return {
    replayProtection: true,
    ...(typeof data.reference === "string" ? {reference: data.reference} : {}),
    ...(typeof data.inviterCoins === "number" && Number.isFinite(data.inviterCoins)
      ? {inviterCoins: data.inviterCoins}
      : {}),
    ...(typeof data.referredCoins === "number" && Number.isFinite(data.referredCoins)
      ? {referredCoins: data.referredCoins}
      : {}),
    ...(data.grantedAt === undefined ? {} : {grantedAt: data.grantedAt}),
  };
}

/** Removes a platform player ID from existing referral reward receipts without enabling replay. */
async function anonymizeReferralRewardDocuments(field: string, jestPlayerId: string): Promise<void> {
  const db = admin.firestore();
  const collection = db.collection("jestReferralRewards");
  while (true) {
    const snapshot = await collection.where(field, "==", jestPlayerId).limit(SINGLE_WRITE_BATCH_SIZE).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.set(document.ref, referralRewardTombstone(document.data())));
    await batch.commit();
  }
}

/** Removes Jest referral records or identity linkage owned by one platform player. */
async function removeJestReferralIdentity(jestPlayerId: string): Promise<void> {
  await deleteMatchingDocuments("jestReferralVerifications", "playerId", jestPlayerId);
  await admin.firestore().collection("jestReferralVerifications")
    .doc(createJestReferralVerificationId(jestPlayerId)).delete();
  await anonymizeReferralRewardDocuments("playerId", jestPlayerId);
  await anonymizeReferralRewardDocuments("referredPlayerId", jestPlayerId);
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
export async function deleteAccountForUser(userId: string, jestPlayerId?: string): Promise<void> {
  const db = admin.firestore();
  // This permanent pseudonymous guard is written first so another device or
  // an older build/token cannot recreate account data while the remaining
  // idempotent cleanup is in progress or after it completes.
  await recordJestAccountDeletion(userId);
  await removeCrossUserRaceIdentitySnapshots(userId);
  await Promise.all([
    ...USER_OWNED_COLLECTIONS.map(({collection, field}) =>
      deleteMatchingDocuments(collection, field, userId)),
    deleteMatchingDocuments("raceAnalytics", "cohortUserHash", hashRaceCohortUser(userId)),
    db.collection("tutorialProgress").doc(userId).delete(),
    anonymizePurchaseGrantDocuments(userId),
  ]);
  if (jestPlayerId) await removeJestReferralIdentity(jestPlayerId);
  const userRef = db.collection("users").doc(userId);
  await deleteUsernameReservationAndProfiles(userId);
  // The transaction removes the top-level user document. recursiveDelete then
  // removes any remaining private subcollection documents under that path.
  await db.recursiveDelete(userRef);
  await deletePlayerStorageFiles(userId);
  if (!isJestFirebaseUid(userId)) {
    try {
      await admin.auth().deleteUser(userId);
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error
        && (error as {code?: string}).code === "auth/user-not-found")) throw error;
    }
  }
}
