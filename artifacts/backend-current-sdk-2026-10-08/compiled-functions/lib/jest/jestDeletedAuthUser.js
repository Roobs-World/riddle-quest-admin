"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletedJestAuthEmail = void 0;
exports.preserveDeletedJestAuthUser = preserveDeletedJestAuthUser;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
/** Maximum attempts needed to converge after a concurrent Auth create/delete race. */
const AUTH_SENTINEL_ATTEMPTS = 3;
/** Returns a non-deliverable pseudonymous email for the retained disabled Auth record. */
const deletedJestAuthEmail = (userId) => `deleted-${userId}@players.jest.invalid`;
exports.deletedJestAuthEmail = deletedJestAuthEmail;
/** Extracts an Admin Auth error code without trusting an arbitrary thrown value. */
const authErrorCode = (error) => typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
/** Returns the provider identifiers that can be detached from an existing Auth profile. */
const linkedProviderIds = (user) => [
    ...new Set(user.providerData.map(({ providerId }) => providerId).filter(Boolean)),
];
/** Disables and minimizes an Auth record that is known to exist. */
async function minimizeExistingAuthUser(auth, userId) {
    /** Provides r. */
    const user = await auth.getUser(userId);
    await auth.updateUser(userId, {
        disabled: true,
        displayName: null,
        email: (0, exports.deletedJestAuthEmail)(userId),
        emailVerified: false,
        phoneNumber: null,
        photoURL: null,
        multiFactor: { enrolledFactors: null },
        providersToUnlink: linkedProviderIds(user),
    });
}
/** Ensures the disabled record exists despite a concurrent token-redemption create. */
async function ensureDisabledAuthUser(auth, userId) {
    try {
        await minimizeExistingAuthUser(auth, userId);
        return;
    }
    catch (error) {
        if (authErrorCode(error) !== "auth/user-not-found")
            throw error;
    }
    try {
        await auth.createUser({
            uid: userId,
            disabled: true,
            email: (0, exports.deletedJestAuthEmail)(userId),
            emailVerified: false,
        });
    }
    catch (error) {
        if (authErrorCode(error) !== "auth/uid-already-exists")
            throw error;
        await minimizeExistingAuthUser(auth, userId);
    }
}
/**
 * Retains a disabled, pseudonymous Auth sentinel for a deleted Jest identity.
 *
 * Keeping the UID occupied prevents a custom token minted before deletion from
 * recreating an enabled Auth user after Firestore cleanup. The operation is
 * retry-safe and clears profile/provider/custom-claim state before revoking all
 * previously issued refresh tokens.
 */
async function preserveDeletedJestAuthUser(userId) {
    /** Provides auth behavior. */
    const auth = firebaseAdmin_1.admin.auth();
    for (let attempt = 0; attempt < AUTH_SENTINEL_ATTEMPTS; attempt += 1) {
        try {
            await ensureDisabledAuthUser(auth, userId);
            await auth.setCustomUserClaims(userId, null);
            await auth.revokeRefreshTokens(userId);
            return;
        }
        catch (error) {
            if (authErrorCode(error) !== "auth/user-not-found" || attempt === AUTH_SENTINEL_ATTEMPTS - 1)
                throw error;
        }
    }
}
//# sourceMappingURL=jestDeletedAuthUser.js.map