"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveRaceGatewayFailure = liveRaceGatewayFailure;
const https_1 = require("firebase-functions/v2/https");
/** Serializes only trusted error categories, without answers, identities or exception details. */
function liveRaceGatewayFailure(error) {
    /** Public HTTP categories have the same meaning as the authenticated callable rejection. */
    const statuses = { "invalid-argument": 400, "failed-precondition": 409,
        "not-found": 404, "permission-denied": 403, "unauthenticated": 401, "resource-exhausted": 429 };
    /** Unrecognized failures retain uncertain delivery and remain retryable. */
    const code = error instanceof https_1.HttpsError && Object.hasOwn(statuses, error.code) ? error.code : "unavailable";
    return { status: statuses[code] ?? 503, body: { error: "live-race-request-failed", code } };
}
//# sourceMappingURL=raceLiveFailures.js.map