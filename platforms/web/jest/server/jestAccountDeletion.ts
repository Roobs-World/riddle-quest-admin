import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {assertNoActiveJestAccountOperations, getJestAccountDeletionRef} from "../../../../firebase-functions/src/shared/accountDeletion";

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
  await assertNoActiveJestAccountOperations(deletionRef);
}
