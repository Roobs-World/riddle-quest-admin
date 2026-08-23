import {createHash} from "node:crypto";
import {admin} from "../shared/firebaseAdmin";
import {deleteAccountForUser} from "../profile/accountDeletion/deleteAccountData";
import {MAX_REDDIT_ACCOUNT_GENERATION, redditFirebaseUid} from "./redditSecurity";

/** Provides provider identity id behavior. */
const providerIdentityId = (appName: string, userId: string) => createHash("sha256")
  .update(`reddit\0${appName}\0${userId}`, "utf8").digest("hex");

/** Describes reddit deletion identity. */
export type RedditDeletionIdentity = Readonly<{appName: string; userId: string; accountGeneration: number}>;

/** Provides valid provider scope behavior. */
const validProviderScope = (
  provider: FirebaseFirestore.DocumentData | undefined,
  identity: RedditDeletionIdentity,
): boolean => provider?.provider === "reddit" && provider.appName === identity.appName &&
  provider.providerUserId === identity.userId;

/** Deletes one Reddit account generation and leaves only a hashed recreation proof. */
export async function deleteRedditAccountGeneration(
  identity: RedditDeletionIdentity,
  {uidSecret, deleteUser = deleteAccountForUser}: {
    uidSecret: string;
    deleteUser?: (uid: string) => Promise<void>;
  },
): Promise<number> {
  if (!Number.isSafeInteger(identity.accountGeneration) || identity.accountGeneration < 1 ||
    identity.accountGeneration > MAX_REDDIT_ACCOUNT_GENERATION) throw new Error("invalid-reddit-deletion-identity");
  const db = admin.firestore();
  const providerRef = db.collection("providerIdentities").doc(providerIdentityId(identity.appName, identity.userId));
  const accountGeneration = identity.accountGeneration;
  const uid = redditFirebaseUid(identity.userId, uidSecret, accountGeneration);
  const deletedUidHash = createHash("sha256").update(uid).digest("hex");
  const nextGeneration = accountGeneration === MAX_REDDIT_ACCOUNT_GENERATION ? accountGeneration : accountGeneration + 1;
  const nextStatus = accountGeneration === MAX_REDDIT_ACCOUNT_GENERATION ? "exhausted" : "active";
  let deletionRequired = false;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(providerRef);
    const provider = snapshot.data();
    if (!snapshot.exists || !provider || !validProviderScope(provider, identity)) {
      throw new Error("reddit-provider-identity-conflict");
    }
    const nextUid = nextStatus === "active" ? redditFirebaseUid(identity.userId, uidSecret, nextGeneration) : null;
    const alreadyComplete = provider.accountGeneration === nextGeneration && provider.status === nextStatus &&
      provider.lastDeletedUidHash === deletedUidHash && (provider.uid === null || provider.uid === nextUid);
    if (alreadyComplete) return;
    if (provider.accountGeneration !== accountGeneration || provider.uid !== uid ||
      (provider.status !== "active" && provider.status !== "deleting")) {
      throw new Error("reddit-provider-identity-conflict");
    }
    deletionRequired = true;
    if (provider.status !== "deleting") {
      transaction.update(providerRef, {status: "deleting", deletionStartedAt: admin.firestore.FieldValue.serverTimestamp()});
    }
  });
  if (!deletionRequired) return nextGeneration;
  await deleteUser(uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(providerRef);
    const provider = snapshot.data();
    if (!snapshot.exists || !provider || !validProviderScope(provider, identity)) {
      throw new Error("reddit-provider-identity-conflict");
    }
    const nextUid = nextStatus === "active" ? redditFirebaseUid(identity.userId, uidSecret, nextGeneration) : null;
    const alreadyComplete = provider.accountGeneration === nextGeneration && provider.status === nextStatus &&
      provider.lastDeletedUidHash === deletedUidHash && (provider.uid === null || provider.uid === nextUid);
    if (alreadyComplete) return;
    if (provider.uid !== uid || provider.accountGeneration !== accountGeneration || provider.status !== "deleting") {
      throw new Error("reddit-provider-identity-conflict");
    }
    transaction.update(providerRef, {
      uid: null,
      accountGeneration: nextGeneration,
      status: nextStatus,
      lastDeletedUidHash: deletedUidHash,
      lastDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletionStartedAt: admin.firestore.FieldValue.delete(),
      redditProfile: admin.firestore.FieldValue.delete(),
    });
  });
  return nextGeneration;
}
