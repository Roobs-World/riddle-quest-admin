"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFacebookFirebaseUid = exports.MAX_FACEBOOK_ACCOUNT_GENERATION = void 0;
exports.verifyFacebookSignedPlayer = verifyFacebookSignedPlayer;
exports.facebookFirebaseUid = facebookFirebaseUid;
exports.verifyFacebookDeletionRequest = verifyFacebookDeletionRequest;
const node_crypto_1 = require("node:crypto");
/** Defines the max signed player characters value. */
const MAX_SIGNED_PLAYER_CHARACTERS = 8_192;
/** Defines the max encoded part characters value. */
const MAX_ENCODED_PART_CHARACTERS = 6_144;
/** Defines the max player id characters value. */
const MAX_PLAYER_ID_CHARACTERS = 256;
/** Defines the max nonce characters value. */
const MAX_NONCE_CHARACTERS = 256;
/** Renders the base64 url interface. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;
/** Defines the max facebook account generation value. */
exports.MAX_FACEBOOK_ACCOUNT_GENERATION = 1_000_000;
/** Provides decode base64 url behavior. */
const decodeBase64Url = (part) => {
    if (!part || part.length > MAX_ENCODED_PART_CHARACTERS || !BASE64URL.test(part)) {
        throw new Error("malformed-facebook-signed-player");
    }
    /** Provides decoded behavior. */
    const decoded = Buffer.from(part, "base64url");
    if (!decoded.length || decoded.toString("base64url") !== part) {
        throw new Error("malformed-facebook-signed-player");
    }
    return decoded;
};
/** Provides equal text behavior. */
const equalText = (left, right) => {
    /** Provides left buffer behavior. */
    const leftBuffer = Buffer.from(left, "utf8");
    /** Provides right buffer behavior. */
    const rightBuffer = Buffer.from(right, "utf8");
    return leftBuffer.length === rightBuffer.length && (0, node_crypto_1.timingSafeEqual)(leftBuffer, rightBuffer);
};
/** Verifies one Meta signed-player assertion and consumes its exact request nonce. */
async function verifyFacebookSignedPlayer(signedPlayer, options) {
    if (!signedPlayer || signedPlayer.length > MAX_SIGNED_PLAYER_CHARACTERS) {
        throw new Error("malformed-facebook-signed-player");
    }
    if (!options.expectedAppId || options.configuredAppId !== options.expectedAppId) {
        throw new Error("facebook-app-id-mismatch");
    }
    if (options.appSecret.length < 32)
        throw new Error("invalid-facebook-app-secret");
    if (!options.expectedNonce ||
        options.expectedNonce.length > MAX_NONCE_CHARACTERS ||
        !options.expectedPlayerId ||
        options.expectedPlayerId.length > MAX_PLAYER_ID_CHARACTERS) {
        throw new Error("invalid-facebook-verification-input");
    }
    /** Provides parts behavior. */
    const parts = signedPlayer.split(".");
    if (parts.length !== 2)
        throw new Error("malformed-facebook-signed-player");
    /** Provides actual signature behavior. */
    const actualSignature = decodeBase64Url(parts[0]);
    /** Provides expected signature behavior. */
    const expectedSignature = (0, node_crypto_1.createHmac)("sha256", options.appSecret).update(parts[1]).digest();
    if (actualSignature.length !== expectedSignature.length || !(0, node_crypto_1.timingSafeEqual)(actualSignature, expectedSignature)) {
        throw new Error("invalid-facebook-signature");
    }
    /** Provides payload behavior. */
    let payload;
    try {
        payload = JSON.parse(decodeBase64Url(parts[1]).toString("utf8"));
    }
    catch (error) {
        if (error instanceof Error && error.message === "malformed-facebook-signed-player")
            throw error;
        throw new Error("malformed-facebook-signed-player");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("malformed-facebook-signed-player");
    }
    /** Provides claims behavior. */
    const claims = payload;
    if (claims.algorithm !== "HMAC-SHA256")
        throw new Error("invalid-facebook-algorithm");
    if (typeof claims.player_id !== "string" ||
        !claims.player_id ||
        claims.player_id.length > MAX_PLAYER_ID_CHARACTERS ||
        !/^[A-Za-z0-9_-]+$/.test(claims.player_id))
        throw new Error("invalid-facebook-player-id");
    if (!equalText(claims.player_id, options.expectedPlayerId))
        throw new Error("facebook-player-id-mismatch");
    if (typeof claims.request_payload !== "string" ||
        !claims.request_payload ||
        claims.request_payload.length > MAX_NONCE_CHARACTERS ||
        !equalText(claims.request_payload, options.expectedNonce))
        throw new Error("facebook-nonce-mismatch");
    if (!Number.isSafeInteger(claims.issued_at) || claims.issued_at < 0) {
        throw new Error("invalid-facebook-issued-at");
    }
    /** Provides issued at behavior. */
    const issuedAt = claims.issued_at;
    /** Provides now seconds behavior. */
    const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    /** Provides max age seconds behavior. */
    const maxAgeSeconds = options.maxAgeSeconds ?? 300;
    if (!Number.isSafeInteger(nowSeconds) ||
        nowSeconds < 0 ||
        !Number.isSafeInteger(maxAgeSeconds) ||
        maxAgeSeconds < 1) {
        throw new Error("invalid-facebook-verification-time");
    }
    if (issuedAt > nowSeconds + 60 || nowSeconds - issuedAt > maxAgeSeconds) {
        throw new Error("stale-facebook-signed-player");
    }
    if (options.consumeNonce && !(await options.consumeNonce(options.expectedNonce, claims.player_id, issuedAt))) {
        throw new Error("facebook-nonce-replayed");
    }
    return claims;
}
/** Derives a stable provider-scoped UID using a dedicated, rotatable v1 key. */
function facebookFirebaseUid(playerId, uidSecretBase64, accountGeneration = 1) {
    if (!playerId || playerId.length > MAX_PLAYER_ID_CHARACTERS || !/^[A-Za-z0-9_-]+$/.test(playerId)) {
        throw new Error("invalid-facebook-player-id");
    }
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(uidSecretBase64)) {
        throw new Error("invalid-facebook-uid-secret");
    }
    /** Provides secret behavior. */
    const secret = Buffer.from(uidSecretBase64, "base64");
    if (secret.length < 32 || secret.toString("base64") !== uidSecretBase64) {
        throw new Error("invalid-facebook-uid-secret");
    }
    if (!Number.isSafeInteger(accountGeneration) ||
        accountGeneration < 1 ||
        accountGeneration > exports.MAX_FACEBOOK_ACCOUNT_GENERATION) {
        throw new Error("invalid-facebook-account-generation");
    }
    /** Provides digest behavior. */
    const digest = (0, node_crypto_1.createHmac)("sha256", secret)
        .update("riddle-quest-facebook-uid-v1\0", "utf8")
        .update(String(accountGeneration), "utf8")
        .update("\0", "utf8")
        .update(playerId, "utf8")
        .digest("hex")
        .slice(0, 40);
    return `facebook_${digest}`;
}
/** Indicates whether is facebook firebase uid. */
const isFacebookFirebaseUid = (userId) => /^facebook_[0-9a-f]{40}$/.test(userId);
exports.isFacebookFirebaseUid = isFacebookFirebaseUid;
/** Verifies Meta's app-level data-deletion signed_request without trusting form fields. */
function verifyFacebookDeletionRequest(signedRequest, appSecret) {
    if (!signedRequest || signedRequest.length > MAX_SIGNED_PLAYER_CHARACTERS || appSecret.length < 32) {
        throw new Error("invalid-facebook-deletion-request");
    }
    /** Provides parts behavior. */
    const parts = signedRequest.split(".");
    if (parts.length !== 2)
        throw new Error("invalid-facebook-deletion-request");
    /** Provides actual signature behavior. */
    const actualSignature = decodeBase64Url(parts[0]);
    /** Provides expected signature behavior. */
    const expectedSignature = (0, node_crypto_1.createHmac)("sha256", appSecret).update(parts[1]).digest();
    if (actualSignature.length !== expectedSignature.length || !(0, node_crypto_1.timingSafeEqual)(actualSignature, expectedSignature)) {
        throw new Error("invalid-facebook-deletion-signature");
    }
    /** Provides payload behavior. */
    let payload;
    try {
        payload = JSON.parse(decodeBase64Url(parts[1]).toString("utf8"));
    }
    catch {
        throw new Error("invalid-facebook-deletion-request");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("invalid-facebook-deletion-request");
    }
    /** Provides claims behavior. */
    const claims = payload;
    if (claims.algorithm !== "HMAC-SHA256")
        throw new Error("invalid-facebook-algorithm");
    if (typeof claims.user_id !== "string" ||
        !claims.user_id ||
        claims.user_id.length > MAX_PLAYER_ID_CHARACTERS ||
        !/^[A-Za-z0-9_-]+$/.test(claims.user_id))
        throw new Error("invalid-facebook-player-id");
    if (claims.issued_at !== undefined && (!Number.isSafeInteger(claims.issued_at) || claims.issued_at < 0)) {
        throw new Error("invalid-facebook-issued-at");
    }
    return claims;
}
//# sourceMappingURL=facebookSecurity.js.map