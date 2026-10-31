"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowFacebookRequest = allowFacebookRequest;
exports.consumeFacebookRequestQuota = consumeFacebookRequestQuota;
exports.isAllowedFacebookOrigin = isAllowedFacebookOrigin;
exports.applyFacebookCors = applyFacebookCors;
exports.acceptFacebookRequest = acceptFacebookRequest;
exports.parseFacebookExchangeBody = parseFacebookExchangeBody;
const node_crypto_1 = require("node:crypto");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
/** Defines the distributed rate-limit collection. */
const RATE_LIMIT_COLLECTION = "facebookIdentityRateLimits";
/** Defines the distributed rate-limit window. */
const RATE_LIMIT_WINDOW_MS = 60_000;
/**
 * Every request from one source contends on one quota document, so a burst queues
 * on its lock. The SDK default of five attempts surfaced as ABORTED errors under
 * a 32-request burst; extra attempts keep the outcome an allow or deny.
 */
const RATE_LIMIT_TRANSACTION_ATTEMPTS = 12;
/** Defines how long distributed rate-limit records are retained. */
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1_000;
/** Defines the maximum Firestore timestamp in milliseconds. */
const MAX_FIRESTORE_MILLISECONDS = 253_402_300_799_999;
/** Defines the maximum accepted identity-request body size. */
const MAX_BODY_BYTES = 24 * 1_024;
/** Defines the maximum number of in-process rate-limit keys. */
const MAX_RATE_LIMIT_KEYS = 10_000;
/** Tracks the fast per-instance request limit. */
const attempts = new Map();
/** Indicates whether a value is a plain record. */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Reads a valid non-negative Firestore timestamp. */
const timestampMilliseconds = (value) => {
    if (typeof value !== "object" ||
        value === null ||
        !("toMillis" in value) ||
        typeof value.toMillis !== "function")
        return undefined;
    try {
        /** Provides milliseconds behavior. */
        const milliseconds = value.toMillis();
        return typeof milliseconds === "number" && Number.isSafeInteger(milliseconds) && milliseconds >= 0
            ? milliseconds
            : undefined;
    }
    catch {
        return undefined;
    }
};
/** Enforces the fast per-instance Facebook request quota. */
function allowFacebookRequest(key, now = Date.now()) {
    if (!key ||
        Buffer.byteLength(key, "utf8") > 256 ||
        !Number.isSafeInteger(now) ||
        now < 0 ||
        now > Number.MAX_SAFE_INTEGER - 60_000)
        return false;
    /** Provides current behavior. */
    const current = attempts.get(key);
    if (current && current.resetAt > now) {
        current.count += 1;
        return current.count <= 20;
    }
    if (current)
        attempts.delete(key);
    if (attempts.size >= MAX_RATE_LIMIT_KEYS) {
        for (const [candidate, value] of attempts) {
            if (value.resetAt > now)
                break;
            attempts.delete(candidate);
        }
    }
    if (attempts.size >= MAX_RATE_LIMIT_KEYS)
        return false;
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
}
/** Enforces one cross-instance identity quota without persisting a reversible client address. */
async function consumeFacebookRequestQuota(key, hmacSecret, db = firebaseAdmin_1.admin.firestore(), now = Date.now()) {
    if (!key ||
        Buffer.byteLength(key, "utf8") > 256 ||
        hmacSecret.length < 32 ||
        !Number.isSafeInteger(now) ||
        now < 0 ||
        now > MAX_FIRESTORE_MILLISECONDS - RATE_LIMIT_RETENTION_MS - RATE_LIMIT_WINDOW_MS)
        return false;
    /** Provides id behavior. */
    const id = (0, node_crypto_1.createHmac)("sha256", hmacSecret)
        .update("riddle-quest-facebook-identity-rate-v1\0", "utf8")
        .update(key, "utf8")
        .digest("hex");
    /** Provides ref behavior. */
    const ref = db.collection(RATE_LIMIT_COLLECTION).doc(id);
    return db.runTransaction(async (transaction) => {
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(ref);
        /** Provides value behavior. */
        const value = snapshot.data();
        /** Provides current count behavior. */
        const currentCount = value?.count;
        /** Provides current reset at ms behavior. */
        const currentResetAtMs = value?.resetAtMs;
        /** Provides current expires at ms behavior. */
        const currentExpiresAtMs = timestampMilliseconds(value?.expiresAt);
        if (snapshot.exists &&
            (!Number.isSafeInteger(currentCount) ||
                currentCount < 1 ||
                currentCount > 20 ||
                !Number.isSafeInteger(currentResetAtMs) ||
                currentResetAtMs < 1 ||
                currentResetAtMs > MAX_FIRESTORE_MILLISECONDS - RATE_LIMIT_RETENTION_MS ||
                currentExpiresAtMs !== currentResetAtMs + RATE_LIMIT_RETENTION_MS))
            throw new Error("invalid-facebook-rate-limit-record");
        if (snapshot.exists && currentResetAtMs > now) {
            if (currentCount >= 20)
                return false;
            transaction.update(ref, { count: currentCount + 1 });
            return true;
        }
        /** Resets at ms. */
        const resetAtMs = now - (now % RATE_LIMIT_WINDOW_MS) + RATE_LIMIT_WINDOW_MS;
        transaction.set(ref, {
            count: 1,
            resetAtMs,
            expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(resetAtMs + RATE_LIMIT_RETENTION_MS),
        });
        return true;
    }, { maxAttempts: RATE_LIMIT_TRANSACTION_ATTEMPTS });
}
/** Returns a canonical HTTPS origin or rejects non-origin URL forms. */
const canonicalHttpsOrigin = (value) => {
    try {
        /** Parses d. */
        const parsed = new URL(value);
        if (parsed.protocol !== "https:" ||
            parsed.username ||
            parsed.password ||
            parsed.pathname !== "/" ||
            parsed.search ||
            parsed.hash ||
            parsed.origin !== value)
            return undefined;
        return parsed.origin;
    }
    catch {
        return undefined;
    }
};
/** Reads the exact configured Facebook origin allowlist. */
const allowedFacebookOrigins = () => new Set((process.env.FACEBOOK_GAME_ORIGINS ?? "")
    .split(",")
    .map((value) => canonicalHttpsOrigin(value.trim()))
    .filter((value) => value !== undefined));
/** Indicates whether an origin exactly matches the Facebook allowlist. */
function isAllowedFacebookOrigin(origin) {
    if (typeof origin !== "string" || canonicalHttpsOrigin(origin) !== origin)
        return false;
    return allowedFacebookOrigins().has(origin);
}
/** Applies the Facebook endpoint CORS and security headers. */
function applyFacebookCors(response, origin) {
    if (isAllowedFacebookOrigin(origin))
        response.set("Access-Control-Allow-Origin", origin);
    response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    response.set("Access-Control-Max-Age", "3600");
    response.set("Vary", "Origin");
    response.set("Cache-Control", "no-store");
    response.set("Referrer-Policy", "no-referrer");
    response.set("X-Content-Type-Options", "nosniff");
}
/** Validates a Facebook identity HTTP request and emits any rejection response. */
function acceptFacebookRequest(request, response) {
    /** Provides origin behavior. */
    const origin = request.get("origin");
    applyFacebookCors(response, origin);
    if (!isAllowedFacebookOrigin(origin)) {
        response.status(403).json({ error: "forbidden-origin" });
        return false;
    }
    if (request.method === "OPTIONS") {
        response.status(204).send("");
        return false;
    }
    if (request.method !== "POST") {
        response.status(405).json({ error: "method-not-allowed" });
        return false;
    }
    if (!request.is("application/json")) {
        response.status(415).json({ error: "unsupported-media-type" });
        return false;
    }
    if (request.rawBody && request.rawBody.byteLength > MAX_BODY_BYTES) {
        response.status(413).json({ error: "payload-too-large" });
        return false;
    }
    if (!allowFacebookRequest(request.ip ?? "unknown")) {
        response.status(429).json({ error: "rate-limited" });
        return false;
    }
    return true;
}
/** Parses the exact bounded Facebook identity-exchange body. */
function parseFacebookExchangeBody(body) {
    if (!isRecord(body) || Object.keys(body).length !== 3)
        throw new Error("invalid-request");
    /** Provides fields behavior. */
    const fields = ["signedPlayer", "playerId", "nonce"];
    if (Object.keys(body).some((field) => !fields.includes(field))) {
        throw new Error("invalid-request");
    }
    /** Provides limits behavior. */
    const limits = { signedPlayer: 8_192, playerId: 256, nonce: 256 };
    /** Parses d. */
    const parsed = {};
    fields.forEach((field) => {
        /** Provides value behavior. */
        const value = body[field];
        if (typeof value !== "string" || !value || Buffer.byteLength(value, "utf8") > limits[field]) {
            throw new Error("invalid-request");
        }
        parsed[field] = value;
    });
    return parsed;
}
//# sourceMappingURL=facebookIdentityRequestSecurity.js.map