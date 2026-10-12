"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRedditAccount = exports.exchangeRedditIdentity = exports.consumeRedditGatewayNonce = exports.parseRedditDeletionPayload = exports.redditProviderIdentityId = exports.parseRedditGatewayEnvelope = exports.parseRedditIdentityPayload = exports.REDDIT_APP_NAME = void 0;
exports.resolveRedditProviderIdentity = resolveRedditProviderIdentity;
exports.provisionRedditIdentity = provisionRedditIdentity;
exports.consumeRedditRequestQuota = consumeRedditRequestQuota;
const node_crypto_1 = require("node:crypto");
const firebase_functions_1 = require("firebase-functions");
const params_1 = require("firebase-functions/params");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const redditUser_1 = require("./redditUser");
const redditSecurity_1 = require("./redditSecurity");
const redditAccountDeletion_1 = require("./redditAccountDeletion");
const redditFeatureFlags_1 = require("./redditFeatureFlags");
/** Provides reddit gateway secret behavior. */
const redditGatewaySecret = (0, params_1.defineSecret)("REDDIT_GATEWAY_SECRET");
/** Provides reddit uid secret behavior. */
const redditUidSecret = (0, params_1.defineSecret)("REDDIT_UID_SECRET");
/** Provides options behavior. */
const options = { secrets: [redditGatewaySecret, redditUidSecret], invoker: "public" };
/** Defines the reddit app name value. */
exports.REDDIT_APP_NAME = "riddle-quest";
/** Defines the nonce retention ms value. */
const NONCE_RETENTION_MS = 24 * 60 * 60 * 1_000;
/** Defines the rate limit retention ms value. */
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1_000;
/** Defines the rate limit window ms value. */
const RATE_LIMIT_WINDOW_MS = 60_000;
/** Defines the rate limit max value. */
const RATE_LIMIT_MAX = 20;
/** Serialize only in-flight writes to one hashed quota row within this runtime; Firestore remains authoritative across runtimes. */
const quotaOperations = new Map();
/** Allows thirty two-second race polls plus bounded state/consent transitions per minute. */
const PRESENCE_POLL_RATE_LIMIT_MAX = 60;
/** Defines the max body bytes value. */
const MAX_BODY_BYTES = 4_096;
/** Defines the reddit profile ttl ms value. */
const REDDIT_PROFILE_TTL_MS = 24 * 60 * 60 * 1_000;
/** Provides valid reddit avatar behavior. */
const validRedditAvatar = (value) => {
    if (value === null)
        return true;
    if (typeof value !== "string" || value.length > 2_048)
        return false;
    try {
        /** Provides url behavior. */
        const url = new URL(value);
        return (url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            new Set(["www.redditstatic.com", "styles.redditmedia.com", "i.redd.it"]).has(url.hostname));
    }
    catch {
        return false;
    }
};
/** Parses reddit identity payload. */
const parseRedditIdentityPayload = (payload) => {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        throw new Error("invalid-reddit-identity-payload");
    }
    /** Provides value behavior. */
    const value = payload;
    if ((value.environment !== "sandbox" && value.environment !== "production") ||
        Object.keys(value).some((key) => key !== "environment" && key !== "profile")) {
        throw new Error("invalid-reddit-identity-payload");
    }
    if (!("profile" in value))
        return { environment: value.environment };
    if (typeof value.profile !== "object" || value.profile === null || Array.isArray(value.profile)) {
        throw new Error("invalid-reddit-identity-payload");
    }
    /** Provides profile behavior. */
    const profile = value.profile;
    if (Object.keys(profile).length !== 2 ||
        typeof profile.username !== "string" ||
        !/^[A-Za-z0-9_-]{3,20}$/.test(profile.username) ||
        !validRedditAvatar(profile.avatarUrl)) {
        throw new Error("invalid-reddit-identity-payload");
    }
    return { environment: value.environment, profile: { username: profile.username, avatarUrl: profile.avatarUrl } };
};
exports.parseRedditIdentityPayload = parseRedditIdentityPayload;
/** Parses reddit gateway envelope. */
const parseRedditGatewayEnvelope = (body) => {
    if (typeof body !== "object" || body === null || Array.isArray(body))
        throw new Error("invalid-reddit-gateway-envelope");
    /** Provides value behavior. */
    const value = body;
    if (Object.keys(value).length !== 2 || !("assertion" in value) || !("payload" in value)) {
        throw new Error("invalid-reddit-gateway-envelope");
    }
    return { assertion: value.assertion, payload: value.payload };
};
exports.parseRedditGatewayEnvelope = parseRedditGatewayEnvelope;
/** Provides reddit provider identity id behavior. */
const redditProviderIdentityId = (appName, userId) => (0, node_crypto_1.createHash)("sha256").update(`reddit\0${appName}\0${userId}`, "utf8").digest("hex");
exports.redditProviderIdentityId = redditProviderIdentityId;
/** Parses reddit deletion payload. */
const parseRedditDeletionPayload = (payload) => {
    if (typeof payload !== "object" ||
        payload === null ||
        Array.isArray(payload) ||
        Object.keys(payload).length !== 1 ||
        !("accountGeneration" in payload) ||
        !Number.isSafeInteger(payload.accountGeneration) ||
        payload.accountGeneration < 1 ||
        payload.accountGeneration > redditSecurity_1.MAX_REDDIT_ACCOUNT_GENERATION) {
        throw new Error("invalid-reddit-deletion-payload");
    }
    return { accountGeneration: payload.accountGeneration };
};
exports.parseRedditDeletionPayload = parseRedditDeletionPayload;
/** Provides valid timestamp behavior. */
const validTimestamp = (value) => timestampMs(value) !== undefined;
/** Validates a provider record, including the intentional blank UID between deleted generations. */
function resolveRedditProviderIdentity(value, { appName, userId, uidSecret, }) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error("reddit-provider-identity-conflict");
    /** Provides provider behavior. */
    const provider = value;
    if (provider.provider !== "reddit" ||
        provider.appName !== appName ||
        provider.providerUserId !== userId ||
        !Number.isSafeInteger(provider.accountGeneration) ||
        provider.accountGeneration < 1 ||
        provider.accountGeneration > redditSecurity_1.MAX_REDDIT_ACCOUNT_GENERATION ||
        provider.status !== "active") {
        throw new Error("reddit-provider-identity-conflict");
    }
    /** Provides account generation behavior. */
    const accountGeneration = provider.accountGeneration;
    /** Provides uid behavior. */
    const uid = (0, redditSecurity_1.redditFirebaseUid)(userId, uidSecret, accountGeneration);
    if (provider.uid !== null && provider.uid !== uid)
        throw new Error("reddit-provider-identity-conflict");
    if (provider.uid === null) {
        if (accountGeneration <= 1 || !validTimestamp(provider.lastDeletedAt))
            throw new Error("reddit-provider-identity-conflict");
        /** Provides prior uid behavior. */
        const priorUid = (0, redditSecurity_1.redditFirebaseUid)(userId, uidSecret, accountGeneration - 1);
        if (provider.lastDeletedUidHash !== (0, node_crypto_1.createHash)("sha256").update(priorUid).digest("hex")) {
            throw new Error("reddit-provider-identity-conflict");
        }
    }
    return { accountGeneration, uid, needsUidRepair: provider.uid === null };
}
/** Provisions or resumes the exact Reddit account generation in one transaction. */
async function provisionRedditIdentity({ appName, userId, uidSecret, profile, }, db = firebaseAdmin_1.admin.firestore(), nowMs = Date.now()) {
    /** Provides provider ref behavior. */
    const providerRef = db.collection("providerIdentities").doc((0, exports.redditProviderIdentityId)(appName, userId));
    /** Provides uid behavior. */
    let uid = "";
    /** Provides account generation behavior. */
    let accountGeneration = 1;
    await db.runTransaction(async (transaction) => {
        /** Provides provider behavior. */
        const provider = await transaction.get(providerRef);
        /** Provides value behavior. */
        const value = provider.data();
        /** Provides needs uid repair behavior. */
        let needsUidRepair = false;
        if (provider.exists) {
            /** Resolves d. */
            const resolved = resolveRedditProviderIdentity(value, { appName, userId, uidSecret });
            accountGeneration = resolved.accountGeneration;
            needsUidRepair = resolved.needsUidRepair;
            uid = resolved.uid;
        }
        if (!provider.exists)
            uid = (0, redditSecurity_1.redditFirebaseUid)(userId, uidSecret, accountGeneration);
        /** Provides r ref. */
        const userRef = db.collection("users").doc(uid);
        /** Provides r. */
        const user = await transaction.get(userRef);
        if (!provider.exists && user.exists)
            throw new Error("reddit-identity-provisioning-conflict");
        if (provider.exists && needsUidRepair && user.exists)
            throw new Error("reddit-identity-provisioning-conflict");
        if (provider.exists && !needsUidRepair && !user.exists)
            throw new Error("reddit-identity-provisioning-conflict");
        /** Provides profile update behavior. */
        const profileUpdate = profile
            ? {
                redditProfile: {
                    username: profile.username,
                    avatarUrl: profile.avatarUrl,
                    refreshedAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nowMs),
                    expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nowMs + REDDIT_PROFILE_TTL_MS),
                },
            }
            : {};
        if (!provider.exists) {
            transaction.create(providerRef, {
                provider: "reddit",
                appName,
                providerUserId: userId,
                uid,
                accountGeneration,
                status: "active",
                createdAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                ...profileUpdate,
            });
            transaction.create(userRef, (0, redditUser_1.createReservedRedditUser)(transaction, db, uid));
        }
        else if (needsUidRepair) {
            transaction.update(providerRef, { uid, ...profileUpdate });
            transaction.create(userRef, (0, redditUser_1.createReservedRedditUser)(transaction, db, uid));
        }
        else {
            if (profile)
                transaction.update(providerRef, profileUpdate);
            transaction.update(userRef, { lastLogin: nowMs });
        }
    });
    return { uid, accountGeneration };
}
/** Provides timestamp ms behavior. */
const timestampMs = (value) => {
    if (typeof value !== "object" ||
        value === null ||
        !("toMillis" in value) ||
        typeof value.toMillis !== "function")
        return undefined;
    try {
        /** Provides result behavior. */
        const result = value.toMillis();
        return typeof result === "number" && Number.isSafeInteger(result) && result >= 0 ? result : undefined;
    }
    catch {
        return undefined;
    }
};
/** Enforces one shared per-user/operation quota across Devvit and Functions instances. */
async function consumeRedditRequestQuota(key, secret, db = firebaseAdmin_1.admin.firestore(), nowMs = Date.now()) {
    if (!key ||
        Buffer.byteLength(key, "utf8") > 1_024 ||
        Buffer.byteLength(secret, "utf8") < 32 ||
        !Number.isSafeInteger(nowMs) ||
        nowMs < 0 ||
        nowMs > Number.MAX_SAFE_INTEGER - RATE_LIMIT_RETENTION_MS - RATE_LIMIT_WINDOW_MS) {
        return false;
    }
    /** Callers construct this key from the verified app, user and signed operation. */
    const keyParts = key.split("\0");
    /** Live polling and schema-validated commands have independent bounded budgets. */
    const maxRequests = keyParts.length === 3 && keyParts[0] === exports.REDDIT_APP_NAME && keyParts[1]
        ? keyParts[2] === "gameplay.race.live.update" || keyParts[2] === "gameplay.race.live.update.command" ? 120
            : keyParts[2] === "gameplay.presence.poll" ? PRESENCE_POLL_RATE_LIMIT_MAX : RATE_LIMIT_MAX
        : RATE_LIMIT_MAX;
    /** Provides id behavior. */
    const id = (0, node_crypto_1.createHmac)("sha256", secret).update("riddle-quest-reddit-rate-v1\0").update(key).digest("hex");
    /** Provides ref behavior. */
    const ref = db.collection("redditGatewayRateLimits").doc(id);
    /** Previous local requests release their turn on both success and failure. */
    const previous = quotaOperations.get(id) ?? Promise.resolve();
    /** This request's turn is never rejected, preventing a failed write from poisoning its successors. */
    let release;
    /** Pending work contains no raw key or stored quota balance. */
    const turn = new Promise(resolve => { release = resolve; });
    quotaOperations.set(id, turn);
    await previous;
    try {
        return await db.runTransaction(async (transaction) => {
            /** Provides snapshot behavior. */
            const snapshot = await transaction.get(ref);
            /** Provides value behavior. */
            const value = snapshot.data();
            /** Provides count behavior. */
            const count = value?.count;
            /** Resets at ms. */
            const resetAtMs = value?.resetAtMs;
            if (snapshot.exists &&
                (!Number.isSafeInteger(count) ||
                    count < 1 ||
                    count > maxRequests ||
                    !Number.isSafeInteger(resetAtMs) ||
                    resetAtMs < 1 ||
                    timestampMs(value?.expiresAt) !== resetAtMs + RATE_LIMIT_RETENTION_MS))
                throw new Error("invalid-reddit-rate-limit-record");
            if (snapshot.exists && resetAtMs > nowMs) {
                if (count >= maxRequests)
                    return false;
                transaction.update(ref, { count: count + 1 });
                return true;
            }
            /** Provides next reset at ms behavior. */
            const nextResetAtMs = nowMs - (nowMs % RATE_LIMIT_WINDOW_MS) + RATE_LIMIT_WINDOW_MS;
            transaction.set(ref, {
                count: 1,
                resetAtMs: nextResetAtMs,
                expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nextResetAtMs + RATE_LIMIT_RETENTION_MS),
            });
            return true;
        });
    }
    finally {
        release();
        if (quotaOperations.get(id) === turn)
            quotaOperations.delete(id);
    }
}
/** Provides consume reddit gateway nonce behavior. */
const consumeRedditGatewayNonce = async (assertion) => {
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    /** Provides ref behavior. */
    const ref = db.collection("redditGatewayNonces").doc((0, node_crypto_1.createHash)("sha256").update(assertion.nonce).digest("hex"));
    try {
        await ref.create({
            userIdHash: (0, node_crypto_1.createHash)("sha256").update(assertion.userId).digest("hex"),
            issuedAtMs: assertion.issuedAtMs,
            expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(assertion.issuedAtMs + NONCE_RETENTION_MS),
        });
        return true;
    }
    catch (error) {
        if (error?.code === 6 ||
            error?.code === "already-exists")
            return false;
        throw error;
    }
};
exports.consumeRedditGatewayNonce = consumeRedditGatewayNonce;
/** Provides exchange reddit identity behavior. */
exports.exchangeRedditIdentity = (0, sentryHandlers_1.onRequestWithSentry)("exchangeRedditIdentity", options, async (request, response) => {
    response.set("Cache-Control", "no-store");
    response.set("X-Content-Type-Options", "nosniff");
    if (request.method !== "POST") {
        response.status(405).json({ error: "method-not-allowed" });
        return;
    }
    if (request.rawBody && request.rawBody.byteLength > MAX_BODY_BYTES) {
        response.status(413).json({ error: "payload-too-large" });
        return;
    }
    if (!(0, redditFeatureFlags_1.isRedditFeatureEnabled)("identity")) {
        response.status(503).json({ error: "reddit-feature-disabled:identity" });
        return;
    }
    try {
        /** Provides signature behavior. */
        const signature = request.get("x-riddle-quest-reddit-signature") ?? "";
        /** Provides envelope behavior. */
        const envelope = (0, exports.parseRedditGatewayEnvelope)(request.body);
        /** Asserts ion. */
        const assertion = await (0, redditSecurity_1.verifyRedditGatewayAssertion)(envelope.assertion, signature, {
            gatewaySecret: redditGatewaySecret.value(),
            expectedAppName: exports.REDDIT_APP_NAME,
            expectedOperation: "identity.exchange",
            expectedPayload: envelope.payload,
            consumeNonce: exports.consumeRedditGatewayNonce,
        });
        /** Provides db behavior. */
        const db = firebaseAdmin_1.admin.firestore();
        /** Provides identity input behavior. */
        const identityInput = (0, exports.parseRedditIdentityPayload)(envelope.payload);
        /** Provides quota key behavior. */
        const quotaKey = `${assertion.appName}\0${assertion.userId}\0${assertion.operation}`;
        if (!(await consumeRedditRequestQuota(quotaKey, redditGatewaySecret.value(), db))) {
            response.status(429).json({ error: "rate-limited" });
            return;
        }
        /** Provides {account generation} behavior. */
        const { accountGeneration } = await provisionRedditIdentity({
            appName: assertion.appName,
            userId: assertion.userId,
            uidSecret: redditUidSecret.value(),
            profile: identityInput.profile,
        }, db);
        response.json({
            ok: true,
            authenticated: true,
            accountGeneration,
            features: (0, redditFeatureFlags_1.resolveRedditClientFeatures)(undefined, undefined, identityInput.environment),
        });
    }
    catch (error) {
        firebase_functions_1.logger.warn("Rejected Reddit gateway identity exchange", {
            reason: error instanceof Error ? error.message : "invalid-request",
        });
        response.status(401).json({ error: "invalid-request" });
    }
});
/** Deletes reddit account. */
exports.deleteRedditAccount = (0, sentryHandlers_1.onRequestWithSentry)("deleteRedditAccount", options, async (request, response) => {
    response.set("Cache-Control", "no-store");
    response.set("X-Content-Type-Options", "nosniff");
    if (request.method !== "POST") {
        response.status(405).json({ error: "method-not-allowed" });
        return;
    }
    if (request.rawBody && request.rawBody.byteLength > MAX_BODY_BYTES) {
        response.status(413).json({ error: "payload-too-large" });
        return;
    }
    try {
        /** Provides envelope behavior. */
        const envelope = (0, exports.parseRedditGatewayEnvelope)(request.body);
        /** Asserts ion. */
        const assertion = await (0, redditSecurity_1.verifyRedditGatewayAssertion)(envelope.assertion, request.get("x-riddle-quest-reddit-signature") ?? "", {
            gatewaySecret: redditGatewaySecret.value(),
            expectedAppName: exports.REDDIT_APP_NAME,
            expectedOperation: "account.delete",
            expectedPayload: envelope.payload,
            consumeNonce: exports.consumeRedditGatewayNonce,
        });
        /** Provides deletion behavior. */
        const deletion = (0, exports.parseRedditDeletionPayload)(envelope.payload);
        if (!(await consumeRedditRequestQuota(`${assertion.appName}\0${assertion.userId}\0${assertion.operation}`, redditGatewaySecret.value()))) {
            response.status(429).json({ error: "rate-limited" });
            return;
        }
        /** Provides next generation behavior. */
        const nextGeneration = await (0, redditAccountDeletion_1.deleteRedditAccountGeneration)({ appName: assertion.appName, userId: assertion.userId, accountGeneration: deletion.accountGeneration }, { uidSecret: redditUidSecret.value() });
        response.json({ ok: true, deleted: true, nextGeneration });
    }
    catch (error) {
        firebase_functions_1.logger.warn("Rejected Reddit account deletion", {
            reason: error instanceof Error ? error.message : "invalid-request",
        });
        response.status(401).json({ error: "invalid-request" });
    }
});
//# sourceMappingURL=redditEndpoints.js.map