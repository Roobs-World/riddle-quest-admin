import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {randomUUID} from "node:crypto";
import {getJestAccountDeletionRef, JestAccountDeletionBusyError} from "../../../../firebase-functions/src/shared/accountDeletion";
import {deleteAccountForUser} from "../../../../firebase-functions/src/profile/accountDeletion/deleteAccountData";
import {jestIdentityRef, readJestIdentity} from "./jestIdentity";

/** Deletes exactly the requested generation; an old retry never selects a later active account. */
export async function deleteJestAccountGeneration(playerId: string, deletedUid?: string): Promise<{
  deletedUid: string;
  activeAccountUid?: string;
}> {
  const db = admin.firestore();
  const providerRef = jestIdentityRef(db, playerId);
  const cleanupLeaseId = randomUUID();
  const target = await db.runTransaction(async (transaction) => {
    const identity = readJestIdentity(await transaction.get(providerRef), playerId);
    const currentDeletion = await transaction.get(getJestAccountDeletionRef(db, identity.uid));
    const uid = deletedUid ?? (identity.status !== "active" || currentDeletion.exists
      ? identity.uid : identity.lastDeletedUid ?? (identity.accountGeneration === 1 ? identity.uid : undefined));
    if (!uid) throw new Error("jest-deletion-generation-mismatch");
    const deletion = uid === identity.uid ? currentDeletion : await transaction.get(getJestAccountDeletionRef(db, uid));
    const complete = deletion.get("cleanupComplete") === true;
    if (uid !== identity.uid && (!complete ||
        (uid !== identity.lastDeletedUid && deletion.get("jestIdentityId") !== providerRef.id))) {
      throw new Error("jest-deletion-generation-mismatch");
    }
    if (deletion.get("cleanupLeaseId")) throw new JestAccountDeletionBusyError();
    if (uid === identity.uid && !complete) {
      const user = await transaction.get(db.collection("users").doc(uid));
      const previousGrant = user.get("premiumCoinsGrantedAt");
      const premiumCoinsGrantedAt = Math.max(identity.premiumCoinsGrantedAt ?? 0,
        typeof previousGrant === "number" && Number.isFinite(previousGrant) ? previousGrant : 0);
      transaction.set(providerRef, {
        provider: "jest", ...identity, status: "deleting",
        ...(premiumCoinsGrantedAt > 0 ? {premiumCoinsGrantedAt} : {}),
      });
      transaction.set(getJestAccountDeletionRef(db, uid), {
        jestIdentityId: providerRef.id, cleanupLeaseId,
      }, {merge: true});
    }
    return {uid, complete};
  });
  if (!target.complete) {
    try {
      await deleteAccountForUser(target.uid, playerId);
    } finally {
      // A timeout does not prove this execution stopped. Never steal or expire
      // another sweep's lease; only its owner can release it after settling.
      await db.runTransaction(async (transaction) => {
        const deletionRef = getJestAccountDeletionRef(db, target.uid);
        const deletion = await transaction.get(deletionRef);
        if (deletion.get("cleanupLeaseId") === cleanupLeaseId) {
          transaction.update(deletionRef, {cleanupLeaseId: admin.firestore.FieldValue.delete()});
        }
      });
    }
  }
  return db.runTransaction(async (transaction) => {
    const identity = readJestIdentity(await transaction.get(providerRef), playerId);
    if (identity.uid !== target.uid) return {
      deletedUid: target.uid,
      ...(identity.status === "active" ? {activeAccountUid: identity.uid} : {}),
    };
    transaction.set(providerRef, {
      provider: "jest", ...identity, status: "deleted", lastDeletedUid: target.uid,
    });
    return {deletedUid: target.uid};
  });
}
