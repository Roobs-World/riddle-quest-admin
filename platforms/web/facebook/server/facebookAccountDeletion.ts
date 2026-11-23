import {createHash} from "node:crypto";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {facebookFirebaseUid, isFacebookFirebaseUid, MAX_FACEBOOK_ACCOUNT_GENERATION} from "./facebookSecurity";
import {deleteAccountForUser} from "../../../../firebase-functions/src/profile/accountDeletion/deleteAccountData";

/** Defines the identity collection value. */
const IDENTITY_COLLECTION = "providerIdentities";

/** Describes facebook deletion identity. */
export type FacebookDeletionIdentity = {
  /** Stores uid. */
  uid: string;
  /** Stores account generation. */
  accountGeneration: number;
};

/** Provides provider identity id behavior. */
const providerIdentityId = (appId: string, playerId: string): string =>
  createHash("sha256").update(`${appId}\0${playerId}`).digest("hex");

/** Provides require provider scope behavior. */
const requireProviderScope = (
  provider: FirebaseFirestore.DocumentData | undefined,
  documentId: string,
  identity: FacebookDeletionIdentity,
  uidSecret: string,
): void => {
  /** Provides app id behavior. */
  const appId = typeof provider?.appId === "string" ? provider.appId : "";
  /** Provides player id behavior. */
  const playerId = typeof provider?.providerPlayerId === "string" ? provider.providerPlayerId : "";
  if (
    !appId ||
    appId.length > 256 ||
    !/^[A-Za-z0-9_-]{1,256}$/.test(playerId) ||
    documentId !== providerIdentityId(appId, playerId) ||
    facebookFirebaseUid(playerId, uidSecret, identity.accountGeneration) !== identity.uid
  )
    throw new Error("facebook-provider-identity-conflict");
};

/** Provides valid generation behavior. */
const validGeneration = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= MAX_FACEBOOK_ACCOUNT_GENERATION;

/** Deletes one Facebook generation, then atomically advances the provider identity to a blank generation. */
export async function deleteFacebookAccountGeneration(
  identity: FacebookDeletionIdentity,
  {
    uidSecret,
  }: {
    /** Stores uid secret. */
    uidSecret: string;
  },
): Promise<number> {
  if (!isFacebookFirebaseUid(identity.uid) || !validGeneration(identity.accountGeneration)) {
    throw new Error("invalid-facebook-deletion-identity");
  }
  /** Provides db behavior. */
  const db = admin.firestore();
  /** Deletes d uid hash. */
  const deletedUidHash = createHash("sha256").update(identity.uid).digest("hex");
  /** Provides generation exhausted behavior. */
  const generationExhausted = identity.accountGeneration === MAX_FACEBOOK_ACCOUNT_GENERATION;
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
    if (completed.size !== 1) throw new Error("facebook-provider-identity-not-found");
    /** Provides provider behavior. */
    const provider = completed.docs[0].data();
    /** Provides player id behavior. */
    const playerId = typeof provider?.providerPlayerId === "string" ? provider.providerPlayerId : "";
    /** Provides next uid behavior. */
    const nextUid = generationExhausted ? null : facebookFirebaseUid(playerId, uidSecret, nextGeneration);
    if (
      provider?.provider !== "facebook" ||
      (provider.uid !== null && provider.uid !== nextUid) ||
      provider.status !== nextStatus ||
      provider.accountGeneration !== nextGeneration ||
      provider.lastDeletedUidHash !== deletedUidHash
    )
      throw new Error("facebook-provider-identity-conflict");
    requireProviderScope(provider, completed.docs[0].ref.id, identity, uidSecret);
    return nextGeneration;
  }
  if (matches.size !== 1) throw new Error("facebook-provider-identity-not-found");
  /** Provides provider ref behavior. */
  const providerRef = matches.docs[0].ref;

  await db.runTransaction(async (transaction) => {
    /** Provides snapshot behavior. */
    const snapshot = await transaction.get(providerRef);
    /** Provides provider behavior. */
    const provider = snapshot.data();
    if (
      !snapshot.exists ||
      provider?.provider !== "facebook" ||
      provider.uid !== identity.uid ||
      provider.accountGeneration !== identity.accountGeneration ||
      (provider.status !== undefined && provider.status !== "active" && provider.status !== "deleting")
    )
      throw new Error("facebook-provider-identity-conflict");
    requireProviderScope(provider, providerRef.id, identity, uidSecret);
    if (provider.status !== "deleting") {
      transaction.update(providerRef, {
        status: "deleting",
        deletionStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  await deleteAccountForUser(identity.uid);
  await db.runTransaction(async (transaction) => {
    /** Provides snapshot behavior. */
    const snapshot = await transaction.get(providerRef);
    /** Provides provider behavior. */
    const provider = snapshot.data();
    if (
      !snapshot.exists ||
      provider?.provider !== "facebook" ||
      provider.uid !== identity.uid ||
      provider.accountGeneration !== identity.accountGeneration ||
      provider.status !== "deleting"
    )
      throw new Error("facebook-provider-identity-conflict");
    requireProviderScope(provider, providerRef.id, identity, uidSecret);
    transaction.update(providerRef, {
      uid: null,
      accountGeneration: nextGeneration,
      status: nextStatus,
      lastDeletedUidHash: deletedUidHash,
      lastDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletionStartedAt: admin.firestore.FieldValue.delete(),
    });
  });
  return nextGeneration;
}
