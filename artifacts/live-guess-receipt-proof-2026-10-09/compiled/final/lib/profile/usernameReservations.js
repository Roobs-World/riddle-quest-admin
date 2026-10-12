"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USERNAME_RESERVATION_MIGRATION_ID = exports.USERNAME_RESERVATION_MIGRATIONS_COLLECTION = exports.USERNAME_RESERVATIONS_COLLECTION = void 0;
exports.normalizeUsernameForReservation = normalizeUsernameForReservation;
exports.createUsernameReservationId = createUsernameReservationId;
exports.createUsernameReservationFields = createUsernameReservationFields;
exports.usernameReservationMigrationRef = usernameReservationMigrationRef;
exports.reserveUsernameForNewUser = reserveUsernameForNewUser;
exports.reservationIdForUserData = reservationIdForUserData;
exports.deleteUsernameReservationAndProfiles = deleteUsernameReservationAndProfiles;
const node_crypto_1 = require("node:crypto");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
/** Server-only collection that serializes normalized username ownership. */
exports.USERNAME_RESERVATIONS_COLLECTION = "usernameReservations";
/** Server-only rollout state that keeps username changes fail-closed during backfill. */
exports.USERNAME_RESERVATION_MIGRATIONS_COLLECTION = "usernameReservationMigrations";
/** Versioned migration document for the normalized reservation boundary. */
exports.USERNAME_RESERVATION_MIGRATION_ID = "v1";
/** Produces the canonical case-insensitive username used for uniqueness. */
function normalizeUsernameForReservation(username) {
    return (0, requestSchemas_1.normalizeUsernameDisplay)(username).toLowerCase();
}
/** Produces a path-safe deterministic reservation ID without exposing raw input in a path. */
function createUsernameReservationId(username) {
    return (0, node_crypto_1.createHash)("sha256").update(normalizeUsernameForReservation(username)).digest("hex");
}
/** Creates the canonical uniqueness fields persisted beside a display username. */
function createUsernameReservationFields(username) {
    return {
        usernameNormalized: normalizeUsernameForReservation(username),
        usernameReservationId: createUsernameReservationId(username),
    };
}
/** Returns the migration gate document read by username-change transactions. */
function usernameReservationMigrationRef(db) {
    return db.collection(exports.USERNAME_RESERVATION_MIGRATIONS_COLLECTION).doc(exports.USERNAME_RESERVATION_MIGRATION_ID);
}
/**
 * Atomically claims the initial username for a newly created user document.
 *
 * Firestore's create precondition is the serialization boundary: equivalent
 * NFKC/case-normalized names cannot both create the same reservation document.
 */
function reserveUsernameForNewUser(transaction, db, userId, username) {
    /** Provides fields behavior. */
    const fields = createUsernameReservationFields(username);
    /** Provides reservation ref behavior. */
    const reservationRef = db.collection(exports.USERNAME_RESERVATIONS_COLLECTION).doc(fields.usernameReservationId);
    transaction.create(reservationRef, {
        normalizedUsername: fields.usernameNormalized,
        userId,
        username,
        updatedAt: Date.now(),
    });
    return fields;
}
/** Resolves the reservation ID recorded by a migrated or legacy user profile. */
function reservationIdForUserData(data) {
    /** Stores d id. */
    const storedId = data?.usernameReservationId;
    if (typeof storedId === "string" && /^[0-9a-f]{64}$/.test(storedId))
        return storedId;
    /** Parses d username. */
    const parsedUsername = requestSchemas_1.UsernameSchema.safeParse(data?.username);
    return parsedUsername.success ? createUsernameReservationId(parsedUsername.data) : undefined;
}
/**
 * Atomically deletes profile documents and a reservation still owned by the user.
 *
 * Deleting the top-level user in the same transaction prevents a concurrent
 * rename from committing a new reservation after account deletion wins.
 */
async function deleteUsernameReservationAndProfiles(userId) {
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
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
            ? db.collection(exports.USERNAME_RESERVATIONS_COLLECTION).doc(reservationId)
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
//# sourceMappingURL=usernameReservations.js.map