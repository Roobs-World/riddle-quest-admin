"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACEBOOK_PRESENCE_FEATURE_GATE_PATH = void 0;
exports.syncFacebookPresenceFeatureGate = syncFacebookPresenceFeatureGate;
const database_1 = require("firebase-admin/database");
/** Defines the facebook presence feature gate path value. */
exports.FACEBOOK_PRESENCE_FEATURE_GATE_PATH = "featureGates/facebookPresence";
/** Mirrors the deployed provider switch into the server-only RTDB rules boundary. */
async function syncFacebookPresenceFeatureGate(enabled, database = (0, database_1.getDatabase)()) {
    if (typeof enabled !== "boolean")
        throw new Error("invalid-facebook-presence-feature-gate");
    await database.ref(exports.FACEBOOK_PRESENCE_FEATURE_GATE_PATH).set(enabled);
}
//# sourceMappingURL=presenceFeatureGate.js.map