import {createHash} from "node:crypto";
import type {Firestore, Transaction} from "firebase-admin/firestore";
import {normalizeUsernameDisplay, UsernameSchema} from "../../../src/platform/contracts/requestSchemas.js";
import {admin} from "../shared/firebaseAdmin";

/** Server-only collection that serializes normalized username ownership. */
export const USERNAME_RESERVATIONS_COLLECTION = "usernameReservations";
/** Server-only rollout state that keeps username changes fail-closed during backfill. */
export const USERNAME_RESERVATION_MIGRATIONS_COLLECTION = "usernameReservationMigrations";
/** Versioned migration document for the normalized reservation boundary. */
export const USERNAME_RESERVATION_MIGRATION_ID = "v1";

/** Fields persisted on every profile participating in username uniqueness. */
export interface UsernameReservationFields {
  /** Canonical case-insensitive lookup key. */
  usernameNormalized: string;
  /** Deterministic ownership document ID. */
  usernameReservationId: string;
}

/** Produces the canonical case-insensitive username used for uniqueness. */
export function normalizeUsernameForReservation(username: string): string {
  return normalizeUsernameDisplay(username).toLowerCase();
}

/** Produces a path-safe deterministic reservation ID without exposing raw input in a path. */
export function createUsernameReservationId(username: string): string {
  return createHash("sha256").update(normalizeUsernameForReservation(username)).digest("hex");
}

/** Creates the canonical uniqueness fields persisted beside a display username. */
export function createUsernameReservationFields(username: string): UsernameReservationFields {
  return {
    usernameNormalized: normalizeUsernameForReservation(username),
    usernameReservationId: createUsernameReservationId(username),
  };
}

/** Returns the migration gate document read by username-change transactions. */
export function usernameReservationMigrationRef(db: Firestore): FirebaseFirestore.DocumentReference {
  return db.collection(USERNAME_RESERVATION_MIGRATIONS_COLLECTION).doc(USERNAME_RESERVATION_MIGRATION_ID);
}

/**
 * Atomically claims the initial username for a newly created user document.
 *
 * Firestore's create precondition is the serialization boundary: equivalent
 * NFKC/case-normalized names cannot both create the same reservation document.
 */
export function reserveUsernameForNewUser(
  transaction: Transaction,
  db: Firestore,
  userId: string,
  username: string,
): UsernameReservationFields {
  /** Provides fields behavior. */
  const fields = createUsernameReservationFields(username);
  /** Provides reservation ref behavior. */
  const reservationRef = db.collection(USERNAME_RESERVATIONS_COLLECTION).doc(fields.usernameReservationId);
  transaction.create(reservationRef, {
    normalizedUsername: fields.usernameNormalized,
    userId,
    username,
    updatedAt: Date.now(),
  });
  return fields;
}

/** Resolves the reservation ID recorded by a migrated or legacy user profile. */
export function reservationIdForUserData(data: FirebaseFirestore.DocumentData | undefined): string | undefined {
  /** Stores d id. */
  const storedId = data?.usernameReservationId;
  if (typeof storedId === "string" && /^[0-9a-f]{64}$/.test(storedId)) return storedId;
  /** Parses d username. */
  const parsedUsername = UsernameSchema.safeParse(data?.username);
  return parsedUsername.success ? createUsernameReservationId(parsedUsername.data) : undefined;
}

/**
 * Atomically deletes profile documents and a reservation still owned by the user.
 *
 * Deleting the top-level user in the same transaction prevents a concurrent
 * rename from committing a new reservation after account deletion wins.
 */
export async function deleteUsernameReservationAndProfiles(userId: string): Promise<void> {
  /** Provides db behavior. */
  const db = admin.firestore();
  /** Provides r ref. */
  const userRef = db.collection("users").doc(userId);
  /** Provides leaderboard ref behavior. */
  const leaderboardRef = db.collection("leaderboard").doc(userId);
  await db.runTransaction(async (transaction) => {
    /** Provides r snapshot. */
    const userSnapshot = await transaction.get(userRef);
    /** Provides reservation id behavior. */
    const reservationId = reservationIdForUserData(userSnapshot.exists ? userSnapshot.data() : undefined);
    /** Provides reservation ref behavior. */
    const reservationRef = reservationId
      ? db.collection(USERNAME_RESERVATIONS_COLLECTION).doc(reservationId)
      : undefined;
    /** Provides reservation snapshot behavior. */
    const reservationSnapshot = reservationRef ? await transaction.get(reservationRef) : undefined;

    if (reservationRef && reservationSnapshot?.exists && reservationSnapshot.data()?.userId === userId) {
      transaction.delete(reservationRef);
    }
    transaction.delete(userRef);
    transaction.delete(leaderboardRef);
  });
}
