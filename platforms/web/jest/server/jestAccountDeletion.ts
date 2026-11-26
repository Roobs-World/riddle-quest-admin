import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {assertNoActiveJestAccountOperations, getJestAccountDeletionRef} from "../../../../firebase-functions/src/shared/accountDeletion";
import {preserveDeletedJestAuthUser} from "./jestDeletedAuthUser";
import {isJestFirebaseUid} from "./jestSecurity";

/** Persists the guard before any identity-linked account data is removed. */
export async function recordJestAccountDeletion(userId: string): Promise<void> {
  /** Provides deletion ref behavior. */
  const deletionRef = getJestAccountDeletionRef(admin.firestore(), userId);
  await deletionRef.set(
    {
      schemaVersion: 1,
      recreationBlocked: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
  // Deterministic Jest UIDs must remain occupied so even a custom token minted
  // just before deletion cannot recreate an enabled Auth identity. Historical
  // Firebase identities instead retain this Firestore guard and delete Auth.
  if (isJestFirebaseUid(userId)) await preserveDeletedJestAuthUser(userId);
  await assertNoActiveJestAccountOperations(deletionRef);
}
