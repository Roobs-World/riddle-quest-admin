import {deleteAndroidReferralData} from "../../android/androidReferralDeletion";
import {anonymizeAndroidPurchaseGrants} from "../../android/androidPurchaseDeletion";
import {admin} from "../../shared/firebaseAdmin";
import {createJestPurchaseGrantId} from "../../jest/jestPurchaseReceipts";
import {createJestReferralVerificationId} from "../../jest/jestReferralReceipts";
import {recordJestAccountDeletion} from "../../jest/jestAccountDeletion";
import {isJestFirebaseUid} from "../../jest/jestSecurity";
import {hashRaceCohortUser} from "../../race/raceRollout";
import {deleteUsernameReservationAndProfiles} from "../usernameReservations";
import {deletePresenceForUser} from "../../presence/presenceVisibility";
import {removeUserFromFacebookContextCompetitions} from "../../race/facebookContextService";
import {
  deleteMatchingCollectionGroupDocuments,
  deleteMatchingDocuments,
  SINGLE_WRITE_BATCH_SIZE,
} from "./accountDeletionBatches";
import {removeCrossUserRaceIdentitySnapshots} from "./raceAccountDeletion";
export {removeCrossUserRaceIdentitySnapshots} from "./raceAccountDeletion";

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
  {collection: "socialModerationQueue", field: "reporterId"},
  {collection: "socialReportRateLimits", field: "reporterId"},
];

/** Defines the maximum number of legacy purchase receipts migrated in one Firestore batch. */
const PURCHASE_MIGRATION_BATCH_SIZE = 200;

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
  /** Provides db behavior. */
  const db = admin.firestore();
  /** Provides collection behavior. */
  const collection = db.collection("jestPurchaseGrants");
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await collection.where("uid", "==", userId).limit(PURCHASE_MIGRATION_BATCH_SIZE).get();
    if (snapshot.empty) return;
    /** Provides batch behavior. */
    const batch = db.batch();
    snapshot.docs.forEach((document) => {
      /** Provides data behavior. */
      const data = document.data();
      /** Stores d hash. */
      const storedHash = data.purchaseTokenHash;
      /** Provides purchase token hash behavior. */
      const purchaseTokenHash =
        typeof storedHash === "string" && /^[0-9a-f]{64}$/.test(storedHash)
          ? storedHash
          : createJestPurchaseGrantId(document.id);
      /** Provides target behavior. */
      const target = collection.doc(purchaseTokenHash);
      batch.set(target, purchaseGrantTombstone(purchaseTokenHash, data));
      if (target.path !== document.ref.path) batch.delete(document.ref);
    });
    await batch.commit();
  }
}

/** Retains only provider-scoped hashes needed to reject a replay after account deletion. */
async function anonymizeFacebookCommerceDocuments(
  collectionName: "facebookCommerceReceipts" | "facebookCommerceRefunds",
  userId: string,
): Promise<void> {
  /** Provides collection behavior. */
  const collection = admin.firestore().collection(collectionName);
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await collection.where("uid", "==", userId).limit(SINGLE_WRITE_BATCH_SIZE).get();
    if (snapshot.empty) return;
    /** Provides batch behavior. */
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((document) => {
      /** Provides data behavior. */
      const data = document.data();
      batch.set(document.ref, {
        provider: "facebook",
        replayProtection: true,
        ...(typeof data.paymentIdHash === "string" ? {paymentIdHash: data.paymentIdHash} : {}),
        ...(typeof data.purchaseReceiptId === "string" ? {purchaseReceiptId: data.purchaseReceiptId} : {}),
        ...(typeof data.purchaseTokenHash === "string" ? {purchaseTokenHash: data.purchaseTokenHash} : {}),
        ...(typeof data.productId === "string" ? {productId: data.productId} : {}),
        ...(data.refundedAtMs === undefined ? {} : {refundedAtMs: data.refundedAtMs}),
      });
    });
    await batch.commit();
  }
}

/** Retains only non-identifying Reddit order facts needed to reject provider retries after deletion. */
async function anonymizeRedditCommerceDocuments(
  collectionName: "redditCommerceReceipts" | "redditCommerceRefunds",
  userId: string,
): Promise<void> {
  /** Provides collection behavior. */
  const collection = admin.firestore().collection(collectionName);
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await collection.where("uid", "==", userId).limit(SINGLE_WRITE_BATCH_SIZE).get();
    if (snapshot.empty) return;
    /** Provides batch behavior. */
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((document) => {
      /** Provides data behavior. */
      const data = document.data();
      batch.set(document.ref, {
        provider: "reddit",
        replayProtection: true,
        ...(typeof data.orderIdHash === "string" ? {orderIdHash: data.orderIdHash} : {}),
        ...(typeof data.environment === "string" ? {environment: data.environment} : {}),
        ...(typeof data.productId === "string" ? {productId: data.productId} : {}),
        ...(data.purchasedAtMs === undefined ? {} : {purchasedAtMs: data.purchasedAtMs}),
        ...(data.refundedAtMs === undefined ? {} : {refundedAtMs: data.refundedAtMs}),
      });
    });
    await batch.commit();
  }
}

/** Removes both identities while preserving one referral settlement replay tombstone. */
async function anonymizeFacebookReferralSettlements(field: "inviteeUid" | "inviterUid", userId: string): Promise<void> {
  /** Provides collection behavior. */
  const collection = admin.firestore().collection("facebookReferralSettlements");
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await collection.where(field, "==", userId).limit(SINGLE_WRITE_BATCH_SIZE).get();
    if (snapshot.empty) return;
    /** Provides batch behavior. */
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((document) => {
      /** Provides data behavior. */
      const data = document.data();
      batch.set(document.ref, {
        provider: "facebook",
        replayProtection: true,
        ...(typeof data.inviteeCoins === "number" ? {inviteeCoins: data.inviteeCoins} : {}),
        ...(typeof data.inviterCoins === "number" ? {inviterCoins: data.inviterCoins} : {}),
        ...(data.settledAtMs === undefined ? {} : {settledAtMs: data.settledAtMs}),
        ...(typeof data.completionReceiptId === "string" && /^[0-9a-f]{64}$/.test(data.completionReceiptId)
          ? {completionReceiptId: data.completionReceiptId} : {}),
      });
    });
    await batch.commit();
  }
}

/** Removes both Reddit identities while preserving one referral settlement replay tombstone. */
async function anonymizeRedditReferralSettlements(field: "inviteeUid" | "inviterUid", userId: string): Promise<void> {
  /** Provides collection behavior. */
  const collection = admin.firestore().collection("redditReferralSettlements");
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await collection.where(field, "==", userId).limit(SINGLE_WRITE_BATCH_SIZE).get();
    if (snapshot.empty) return;
    /** Provides batch behavior. */
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((document) => {
      /** Provides data behavior. */
      const data = document.data();
      batch.set(document.ref, {
        provider: "reddit",
        replayProtection: true,
        ...(typeof data.inviteeCoins === "number" ? {inviteeCoins: data.inviteeCoins} : {}),
        ...(typeof data.inviterCoins === "number" ? {inviterCoins: data.inviterCoins} : {}),
        ...(data.settledAtMs === undefined ? {} : {settledAtMs: data.settledAtMs}),
        ...(typeof data.completionReceiptId === "string" && /^[0-9a-f]{64}$/.test(data.completionReceiptId)
          ? {completionReceiptId: data.completionReceiptId} : {}),
      });
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
  /** Provides db behavior. */
  const db = admin.firestore();
  /** Provides collection behavior. */
  const collection = db.collection("jestReferralRewards");
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await collection.where(field, "==", jestPlayerId).limit(SINGLE_WRITE_BATCH_SIZE).get();
    if (snapshot.empty) return;
    /** Provides batch behavior. */
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.set(document.ref, referralRewardTombstone(document.data())));
    await batch.commit();
  }
}

/** Removes Jest referral records or identity linkage owned by one platform player. */
async function removeJestReferralIdentity(jestPlayerId: string): Promise<void> {
  await deleteMatchingDocuments("jestReferralVerifications", "playerId", jestPlayerId);
  await admin
    .firestore()
    .collection("jestReferralVerifications")
    .doc(createJestReferralVerificationId(jestPlayerId))
    .delete();
  await anonymizeReferralRewardDocuments("playerId", jestPlayerId);
  await anonymizeReferralRewardDocuments("referredPlayerId", jestPlayerId);
}

/** Returns whether an error reports that Firebase Storage has no configured default bucket. */
function isMissingStorageBucket(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  /** Provider error code returned by Cloud Storage or the Firebase Admin SDK. */
  const code = (
    error as {
      /** Stores code. */
      code?: unknown;
    }
  ).code;
  return code === 404 || code === "404" || code === "storage/bucket-not-found";
}

/** Removes player-owned files when the project has a Firebase Storage bucket. */
async function deletePlayerStorageFiles(userId: string): Promise<void> {
  try {
    await Promise.all(
      ["avatars", "exports"].map((folder) =>
        admin
          .storage()
          .bucket()
          .deleteFiles({prefix: `${folder}/${userId}/`}),
      ),
    );
  } catch (error) {
    if (!isMissingStorageBucket(error)) throw error;
  }
}

/** Permanently removes an authenticated player's Riddle Quest data and Firebase identity. */
export async function deleteAccountForUser(userId: string, jestPlayerId?: string): Promise<void> {
  /** Provides db behavior. */
  const db = admin.firestore();
  // This permanent pseudonymous guard is written first so another device or
  // an older build/token cannot recreate account data while the remaining
  // idempotent cleanup is in progress or after it completes.
  await recordJestAccountDeletion(userId);
  await removeCrossUserRaceIdentitySnapshots(userId);
  await removeUserFromFacebookContextCompetitions(userId, db);
  await Promise.all([
    ...USER_OWNED_COLLECTIONS.map(({collection, field}) => deleteMatchingDocuments(collection, field, userId)),
    deleteMatchingDocuments("raceAnalytics", "cohortUserHash", hashRaceCohortUser(userId)),
    deleteMatchingDocuments("socialModerationQueue", "targetUserId", userId),
    deleteMatchingCollectionGroupDocuments("knownRivals", "targetUserId", userId),
    deleteMatchingCollectionGroupDocuments("blockedRivals", "targetUserId", userId),
    deleteMatchingDocuments("facebookReferralTokens", "inviterUid", userId),
    deleteMatchingDocuments("facebookReferralBindings", "inviterUid", userId),
    deleteMatchingDocuments("facebookReferralDailyCaps", "inviterUid", userId),
    deleteMatchingDocuments("redditReferralTokens", "inviterUid", userId),
    deleteMatchingDocuments("redditReferralBindings", "inviterUid", userId),
    deleteMatchingDocuments("redditReferralDailyCaps", "inviterUid", userId),
    db.collection("tutorialProgress").doc(userId).delete(),
    db.collection("redditPlayerStorage").doc(userId).delete(),
    db.collection("redditCommerceAccounts").doc(userId).delete(),
    db.collection("facebookCommerceAccounts").doc(userId).delete(),
    db.collection("androidCommerceAccounts").doc(userId).delete(),
    db.collection("facebookNotificationPromptLeases").doc(userId).delete(),
    db.collection("facebookReferralBindings").doc(userId).delete(),
    db.collection("redditReferralBindings").doc(userId).delete(),
    anonymizePurchaseGrantDocuments(userId),
    anonymizeAndroidPurchaseGrants(userId),
    deleteAndroidReferralData(userId),
    anonymizeFacebookCommerceDocuments("facebookCommerceReceipts", userId),
    anonymizeFacebookCommerceDocuments("facebookCommerceRefunds", userId),
    anonymizeRedditCommerceDocuments("redditCommerceReceipts", userId),
    anonymizeRedditCommerceDocuments("redditCommerceRefunds", userId),
    anonymizeFacebookReferralSettlements("inviteeUid", userId),
    anonymizeFacebookReferralSettlements("inviterUid", userId),
    anonymizeRedditReferralSettlements("inviteeUid", userId),
    anonymizeRedditReferralSettlements("inviterUid", userId),
    deletePresenceForUser(userId, admin.database()),
  ]);
  if (jestPlayerId) await removeJestReferralIdentity(jestPlayerId);
  /** Provides r ref. */
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
      if (!(
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (
          error as {
            /** Stores code. */
            code?: string;
          }
        ).code === "auth/user-not-found"
      ))
        throw error;
    }
  }
}
