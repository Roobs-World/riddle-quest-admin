"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isJestFirebaseUid = exports.jestFirebaseUid = void 0;
exports.verifyJestSigned = verifyJestSigned;
const node_crypto_1 = require("node:crypto");
/** Defines the max signed token characters value. */
const MAX_SIGNED_TOKEN_CHARACTERS = 256_000;
/** Defines the max signed part bytes value. */
const MAX_SIGNED_PART_BYTES = 128_000;
/** Provides decode part behavior. */
const decodePart = (part) => {
    if (!part || part.length > MAX_SIGNED_TOKEN_CHARACTERS)
        throw new Error("malformed-token");
    /** Provides decoded behavior. */
    const decoded = Buffer.from(part, "base64url");
    if (decoded.length === 0 || decoded.length > MAX_SIGNED_PART_BYTES)
        throw new Error("malformed-token");
    return JSON.parse(decoded.toString("utf8"));
};
/** Provides verify jest signed behavior. */
function verifyJestSigned(token, secretBase64, expectedGameId, expectedPlayerId, nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = null) {
    if (token.length === 0 || token.length > MAX_SIGNED_TOKEN_CHARACTERS)
        throw new Error("malformed-token");
    /** Provides parts behavior. */
    const parts = token.split(".");
    if (parts.length !== 3)
        throw new Error("malformed-token");
    /** Provides header behavior. */
    const header = decodePart(parts[0]);
    if (header.alg !== "HS256")
        throw new Error("invalid-algorithm");
    /** Provides secret behavior. */
    const secret = Buffer.from(secretBase64, "base64");
    if (secret.length < 32)
        throw new Error("invalid-secret");
    /** Provides expected behavior. */
    const expected = (0, node_crypto_1.createHmac)("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
    /** Provides actual behavior. */
    const actual = Buffer.from(parts[2], "base64url");
    if (actual.length !== expected.length || !(0, node_crypto_1.timingSafeEqual)(actual, expected))
        throw new Error("invalid-signature");
    /** Provides payload behavior. */
    const payload = decodePart(parts[1]);
    if (payload.aud !== expectedGameId)
        throw new Error("invalid-audience");
    if (typeof payload.sub !== "string" || !payload.sub)
        throw new Error("invalid-subject");
    if (expectedPlayerId && payload.sub !== expectedPlayerId)
        throw new Error("invalid-subject");
    if (payload.exp !== undefined &&
        (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= nowSeconds)) {
        throw new Error("expired-token");
    }
    if (payload.nbf !== undefined &&
        (typeof payload.nbf !== "number" || !Number.isFinite(payload.nbf) || payload.nbf > nowSeconds)) {
        throw new Error("token-not-active");
    }
    if (maxAgeSeconds !== null) {
        /** Provides issued at behavior. */
        const issuedAt = payload.iat;
        if (typeof issuedAt !== "number" ||
            !Number.isInteger(issuedAt) ||
            issuedAt > nowSeconds + 60 ||
            nowSeconds - issuedAt > maxAgeSeconds) {
            throw new Error("stale-token");
        }
    }
    if (payload.player && payload.player.playerId !== payload.sub)
        throw new Error("player-subject-mismatch");
    return payload;
}
/** Provides jest firebase uid behavior. */
const jestFirebaseUid = (playerId) => `jest_${(0, node_crypto_1.createHmac)("sha256", "riddle-quest-jest-uid-v1").update(playerId).digest("hex").slice(0, 40)}`;
exports.jestFirebaseUid = jestFirebaseUid;
/** Returns whether a Firebase UID belongs to the deterministic Jest identity namespace. */
const isJestFirebaseUid = (userId) => /^jest_[0-9a-f]{40}$/.test(userId);
exports.isJestFirebaseUid = isJestFirebaseUid;
//# sourceMappingURL=jestSecurity.js.map