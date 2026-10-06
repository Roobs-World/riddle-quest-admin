"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.minimizeRaceReceiptResponse = minimizeRaceReceiptResponse;
exports.hydrateRaceReceiptResponse = hydrateRaceReceiptResponse;
exports.raceReceiptExpiresAt = raceReceiptExpiresAt;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
/** Neutral opponent projection persisted in idempotency receipts. */
const PRIVATE_RECEIPT_OPPONENT_NAME = "Riddle Quest player";
/** Returns an object value without trusting its prototype or fields. */
const objectValue = (value) => typeof value === "object" && value !== null ? value : undefined;
/** Copies a response while transforming its optional run/opponent projection. */
function mapResponseOpponent(response, transform) {
    /** Provides response object behavior. */
    const responseObject = objectValue(response);
    /** Provides run behavior. */
    const run = objectValue(responseObject?.run);
    /** Provides opponent behavior. */
    const opponent = objectValue(run?.opponent);
    if (!responseObject || !run || !opponent)
        return response;
    return { ...responseObject, run: { ...run, opponent: transform(opponent) } };
}
/** Removes copied opponent identity before an idempotency response is stored. */
function minimizeRaceReceiptResponse(response) {
    return mapResponseOpponent(response, (opponent) => {
        /** Provides minimized behavior. */
        const minimized = { ...opponent, displayName: PRIVATE_RECEIPT_OPPONENT_NAME };
        delete minimized.avatarUrl;
        return minimized;
    });
}
/** Restores only the parent's current privacy-safe opponent projection on replay. */
function hydrateRaceReceiptResponse(response, run) {
    /** Provides current opponent behavior. */
    const currentOpponent = run.opponent;
    if (!currentOpponent?.subjectUserId)
        return minimizeRaceReceiptResponse(response);
    return mapResponseOpponent(response, (opponent) => {
        /** Provides hydrated behavior. */
        const hydrated = { ...opponent, displayName: currentOpponent.displayName };
        delete hydrated.avatarUrl;
        if (currentOpponent.avatarUrl)
            hydrated.avatarUrl = currentOpponent.avatarUrl;
        return hydrated;
    });
}
/** Extracts a finite timestamp-like value without trusting arbitrary data. */
const timestampMilliseconds = (value) => {
    if (typeof value !== "object" || value === null || !("toMillis" in value))
        return undefined;
    /** Provides to millis behavior. */
    const toMillis = value.toMillis;
    if (typeof toMillis !== "function")
        return undefined;
    /** Provides milliseconds behavior. */
    const milliseconds = toMillis.call(value);
    return typeof milliseconds === "number" && Number.isFinite(milliseconds) ? milliseconds : undefined;
};
/** Caps a nested receipt's TTL to its parent run's persisted expiry. */
function raceReceiptExpiresAt(parentExpiresAt, fallbackExpiresAtMs) {
    /** Provides parent expires at ms behavior. */
    const parentExpiresAtMs = timestampMilliseconds(parentExpiresAt);
    return firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(parentExpiresAtMs === undefined ? fallbackExpiresAtMs : Math.min(parentExpiresAtMs, fallbackExpiresAtMs));
}
//# sourceMappingURL=raceReceiptPrivacy.js.map