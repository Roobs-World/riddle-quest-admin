"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_USERNAME_MIGRATION_PAGE_SIZE = void 0;
exports.migrateUsernameReservationPage = migrateUsernameReservationPage;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const usernameReservations_1 = require("./usernameReservations");
/** Maximum legacy user documents migrated by one operator invocation. */
exports.MAX_USERNAME_MIGRATION_PAGE_SIZE = 200;
/** Atomically claims and annotates one legacy user's current username. */
async function migrateUsernameDocument(db, document) {
    /** Provides r ref. */
    const userRef = document.ref;
    await db.runTransaction(async (transaction) => {
        /** Provides r snapshot. */
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists)
            return;
        /** Parses d username. */
        const parsedUsername = requestSchemas_1.UsernameSchema.safeParse(userSnapshot.data()?.username);
        if (!parsedUsername.success) {
            throw new https_1.HttpsError("failed-precondition", `Legacy user ${JSON.stringify(userRef.id)} has an invalid username.`);
        }
        /** Provides rname. */
        const username = parsedUsername.data;
        /** Provides fields behavior. */
        const fields = (0, usernameReservations_1.createUsernameReservationFields)(username);
        /** Provides reservation ref behavior. */
        const reservationRef = db.collection(usernameReservations_1.USERNAME_RESERVATIONS_COLLECTION).doc(fields.usernameReservationId);
        /** Provides previous reservation id behavior. */
        const previousReservationId = (0, usernameReservations_1.reservationIdForUserData)(userSnapshot.data());
        /** Provides previous reservation ref behavior. */
        const previousReservationRef = previousReservationId && previousReservationId !== fields.usernameReservationId
            ? db.collection(usernameReservations_1.USERNAME_RESERVATIONS_COLLECTION).doc(previousReservationId)
            : undefined;
        /** Provides reservation snapshot behavior. */
        const reservationSnapshot = await transaction.get(reservationRef);
        /** Provides previous reservation snapshot behavior. */
        const previousReservationSnapshot = previousReservationRef
            ? await transaction.get(previousReservationRef)
            : undefined;
        if (reservationSnapshot.exists && reservationSnapshot.data()?.userId !== userRef.id) {
            throw new https_1.HttpsError("already-exists", `Legacy username collision for user ${JSON.stringify(userRef.id)}; resolve it before continuing migration.`);
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
        transaction.update(userRef, { username, ...fields });
        transaction.set(db.collection("leaderboard").doc(userRef.id), {
            userId: userRef.id,
            subjectUserId: userRef.id,
            username,
            updatedAt: Date.now(),
        }, { merge: true });
    });
}
/**
 * Migrates at most one bounded page and persists a monotonic resume cursor.
 *
 * A final empty-page invocation marks the gate complete. Any invalid or
 * colliding legacy username halts before the cursor advances past that user.
 */
async function migrateUsernameReservationPage(db, pageSize = 100) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > exports.MAX_USERNAME_MIGRATION_PAGE_SIZE) {
        throw new Error(`pageSize must be an integer from 1 to ${exports.MAX_USERNAME_MIGRATION_PAGE_SIZE}.`);
    }
    /** Provides state ref behavior. */
    const stateRef = (0, usernameReservations_1.usernameReservationMigrationRef)(db);
    /** Provides state snapshot behavior. */
    const stateSnapshot = await stateRef.get();
    /** Provides state behavior. */
    const state = stateSnapshot.data();
    if (stateSnapshot.exists && state?.complete === true)
        return { complete: true, processed: 0 };
    /** Provides query behavior. */
    let query = db.collection("users").orderBy(firestore_1.FieldPath.documentId()).limit(pageSize);
    /** Provides last user id behavior. */
    const lastUserId = typeof state?.lastUserId === "string" ? state.lastUserId : undefined;
    if (lastUserId)
        query = query.startAfter(lastUserId);
    /** Provides rs. */
    const users = await query.get();
    if (users.empty) {
        await stateRef.set({ complete: true, completedAt: Date.now(), updatedAt: Date.now() }, { merge: true });
        return { complete: true, lastUserId, processed: 0 };
    }
    /** Provides processed behavior. */
    let processed = 0;
    /** Provides next cursor behavior. */
    let nextCursor = lastUserId;
    for (const document of users.docs) {
        await migrateUsernameDocument(db, document);
        processed += 1;
        nextCursor = document.id;
        await stateRef.set({ complete: false, lastUserId: nextCursor, updatedAt: Date.now() }, { merge: true });
    }
    return { complete: false, lastUserId: nextCursor, processed };
}
//# sourceMappingURL=usernameReservationMigration.js.map