"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregatePresenceStatus = void 0;
exports.aggregatePresenceValue = aggregatePresenceValue;
exports.writeAggregatedPresence = writeAggregatedPresence;
exports.setPresenceConsentForUser = setPresenceConsentForUser;
const database_1 = require("firebase-admin/database");
const database_2 = require("firebase-functions/v2/database");
const facebookFeatureFlags_1 = require("../facebook/facebookFeatureFlags");
/** Provides priority behavior. */
const priority = { online: 1, playing: 2, racing: 3 };
/** Provides presence user id behavior. */
const presenceUserId = /^(?:facebook|jest)_[0-9a-f]{40}$/;
/** Reduces server-observed sessions to one public state without trusting a client aggregate. */
function aggregatePresenceValue(value, facebookPresenceEnabled = true) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return "offline";
    /** Provides highest behavior. */
    let highest = "offline";
    for (const connection of Object.values(value)) {
        if (connection?.platform !== "facebook" && connection?.platform !== "jest")
            continue;
        if (!facebookPresenceEnabled && connection?.platform === "facebook")
            continue;
        /** Provides state behavior. */
        const state = connection?.state;
        if (typeof state === "string" &&
            state in priority &&
            priority[state] > (highest === "offline" ? 0 : priority[highest])) {
            highest = state;
        }
    }
    return highest;
}
/** Writes the aggregate and account-level opt-in bit in one RTDB update. */
async function writeAggregatedPresence(userId, database = (0, database_1.getDatabase)(), now = Date.now()) {
    /** Provides connections behavior. */
    const connections = (await database.ref(`presenceConnections/${userId}`).get()).val();
    /** Provides state behavior. */
    const state = aggregatePresenceValue(connections, (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("presence"));
    await database.ref().update({
        [`presenceStatus/${userId}`]: { state, updatedAt: now },
        [`presenceOptIn/${userId}`]: state !== "offline",
    });
    return state;
}
/** Updates server-owned consent; disabling also atomically clears every live session and rival read bit. */
async function setPresenceConsentForUser(userId, enabled, database = (0, database_1.getDatabase)(), now = Date.now()) {
    if (!presenceUserId.test(userId) || typeof enabled !== "boolean" || !Number.isSafeInteger(now) || now < 0) {
        throw new Error("invalid-presence-consent");
    }
    await database.ref().update(enabled
        ? {
            [`presenceConsent/${userId}`]: true,
        }
        : {
            [`presenceConsent/${userId}`]: false,
            [`presenceConnections/${userId}`]: null,
            [`presenceStatus/${userId}`]: { state: "offline", updatedAt: now },
            [`presenceOptIn/${userId}`]: false,
        });
}
/** Maintains the server-owned aggregate whenever a tab/device connects, changes, or disconnects. */
exports.aggregatePresenceStatus = (0, database_2.onValueWritten)(
// The production RTDB instance is in europe-west1. Database triggers must
// be colocated with the instance or Eventarc cannot resolve the pattern.
{ ref: "/presenceConnections/{userId}/{sessionId}", region: "europe-west1" }, async (event) => {
    /** Provides r id. */
    const userId = event.params.userId;
    await writeAggregatedPresence(userId);
});
//# sourceMappingURL=presenceAggregation.js.map