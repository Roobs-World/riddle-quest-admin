"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_CLASSIC_LOAD_INDEX = void 0;
exports.parseSinglePlayerResumeFields = parseSinglePlayerResumeFields;
exports.parseClassicLoadIndex = parseClassicLoadIndex;
const https_1 = require("firebase-functions/v2/https");
/** Maximum accepted Classic entitlement index in a direct load request. */
exports.MAX_CLASSIC_LOAD_INDEX = 1_000_000;
/** Parses the optional opaque session/riddle pair used for reload recovery. */
function parseSinglePlayerResumeFields(data) {
    /** Provides session token behavior. */
    const sessionToken = data?.sessionToken;
    /** Provides riddle id behavior. */
    const riddleId = data?.riddleId;
    if (sessionToken === undefined && riddleId === undefined)
        return undefined;
    if (typeof sessionToken !== "string" ||
        sessionToken.length < 20 ||
        sessionToken.length > 128 ||
        typeof riddleId !== "string" ||
        riddleId.length < 1 ||
        riddleId.length > 160) {
        throw new https_1.HttpsError("invalid-argument", "A valid resume token and riddle id must be supplied together.");
    }
    return { sessionToken, riddleId };
}
/** Parses a bounded non-negative Classic load index. */
function parseClassicLoadIndex(value) {
    if (!Number.isInteger(value) || value < 0 || value > exports.MAX_CLASSIC_LOAD_INDEX) {
        throw new https_1.HttpsError("invalid-argument", "A bounded non-negative classicIndex is required.");
    }
    return value;
}
//# sourceMappingURL=singlePlayerLoadRequest.js.map