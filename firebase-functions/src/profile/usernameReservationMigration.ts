import {FieldPath, type Firestore, type Query, type QueryDocumentSnapshot} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {UsernameSchema} from "../validation/requestSchemas";
import {
  createUsernameReservationFields,
  reservationIdForUserData,
  usernameReservationMigrationRef,
  USERNAME_RESERVATIONS_COLLECTION,
} from "./usernameReservations";

/** Maximum legacy user documents migrated by one operator invocation. */
export const MAX_USERNAME_MIGRATION_PAGE_SIZE = 200;

/** Summary returned after one bounded, resumable migration invocation. */
export interface UsernameReservationMigrationResult {
  /** Whether all legacy users have been migrated and username changes may be enabled. */
  complete: boolean;
  /** Last successfully migrated user ID, used as the next page cursor. */
  lastUserId?: string;
  /** Number of user documents migrated during this invocation. */
  processed: number;
}

/** Atomically claims and annotates one legacy user's current username. */
async function migrateUsernameDocument(db: Firestore, document: QueryDocumentSnapshot): Promise<void> {
  const userRef = document.ref;
  await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) return;
    const parsedUsername = UsernameSchema.safeParse(userSnapshot.data()?.username);
    if (!parsedUsername.success) {
      throw new HttpsError("failed-precondition", `Legacy user ${JSON.stringify(userRef.id)} has an invalid username.`);
    }
    const username = parsedUsername.data;
    const fields = createUsernameReservationFields(username);
    const reservationRef = db.collection(USERNAME_RESERVATIONS_COLLECTION).doc(fields.usernameReservationId);
    const previousReservationId = reservationIdForUserData(userSnapshot.data());
    const previousReservationRef = previousReservationId && previousReservationId !== fields.usernameReservationId
      ? db.collection(USERNAME_RESERVATIONS_COLLECTION).doc(previousReservationId)
      : undefined;
    const reservationSnapshot = await transaction.get(reservationRef);
    const previousReservationSnapshot = previousReservationRef
      ? await transaction.get(previousReservationRef)
      : undefined;
    if (reservationSnapshot.exists && reservationSnapshot.data()?.userId !== userRef.id) {
      throw new HttpsError(
        "already-exists",
        `Legacy username collision for user ${JSON.stringify(userRef.id)}; resolve it before continuing migration.`,
      );
    }

    if (previousReservationRef && previousReservationSnapshot?.data()?.userId === userRef.id) {
      transaction.delete(previousReservationRef);
    }
    transaction.set(reservationRef, {
      normalizedUsername: fields.usernameNormalized,
      userId: userRef.id,
      username,
      updatedAt: Date.now(),
    });
    transaction.update(userRef, {username, ...fields});
    transaction.set(db.collection("leaderboard").doc(userRef.id), {
      userId: userRef.id,
      subjectUserId: userRef.id,
      username,
      updatedAt: Date.now(),
    }, {merge: true});
  });
}

/**
 * Migrates at most one bounded page and persists a monotonic resume cursor.
 *
 * A final empty-page invocation marks the gate complete. Any invalid or
 * colliding legacy username halts before the cursor advances past that user.
 */
export async function migrateUsernameReservationPage(
  db: Firestore,
  pageSize = 100,
): Promise<UsernameReservationMigrationResult> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_USERNAME_MIGRATION_PAGE_SIZE) {
    throw new Error(`pageSize must be an integer from 1 to ${MAX_USERNAME_MIGRATION_PAGE_SIZE}.`);
  }
  const stateRef = usernameReservationMigrationRef(db);
  const stateSnapshot = await stateRef.get();
  const state = stateSnapshot.data();
  if (stateSnapshot.exists && state?.complete === true) return {complete: true, processed: 0};

  let query: Query = db.collection("users").orderBy(FieldPath.documentId()).limit(pageSize);
  const lastUserId = typeof state?.lastUserId === "string" ? state.lastUserId : undefined;
  if (lastUserId) query = query.startAfter(lastUserId);
  const users = await query.get();
  if (users.empty) {
    await stateRef.set({complete: true, completedAt: Date.now(), updatedAt: Date.now()}, {merge: true});
    return {complete: true, lastUserId, processed: 0};
  }

  let processed = 0;
  let nextCursor = lastUserId;
  for (const document of users.docs) {
    await migrateUsernameDocument(db, document);
    processed += 1;
    nextCursor = document.id;
    await stateRef.set({complete: false, lastUserId: nextCursor, updatedAt: Date.now()}, {merge: true});
  }
  return {complete: false, lastUserId: nextCursor, processed};
}
