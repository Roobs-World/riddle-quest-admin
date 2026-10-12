"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeFacebookIdentity = exports.issueFacebookIdentityNonce = exports.consumeFacebookIdentityNonce = exports.facebookProviderIdentityId = exports.parseFacebookExchangeBody = exports.isAllowedFacebookOrigin = exports.consumeFacebookRequestQuota = exports.applyFacebookCors = exports.allowFacebookRequest = exports.acceptFacebookRequest = void 0;
exports.facebookCustomAuthClaims = facebookCustomAuthClaims;
exports.resolveFacebookProviderIdentity = resolveFacebookProviderIdentity;
exports.resolveFacebookIdentityProvisioning = resolveFacebookIdentityProvisioning;
const node_crypto_1 = require("node:crypto");
const app_check_1 = require("firebase-admin/app-check");
const firebase_functions_1 = require("firebase-functions");
const params_1 = require("firebase-functions/params");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentry_1 = require("../shared/sentry");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const facebookSecurity_1 = require("./facebookSecurity");
const facebookUser_1 = require("./facebookUser");
const facebookFeatureFlags_1 = require("./facebookFeatureFlags");
const facebookIdentityNonce_1 = require("./facebookIdentityNonce");
const facebookIdentityRequestSecurity_1 = require("./facebookIdentityRequestSecurity");
var facebookIdentityRequestSecurity_2 = require("./facebookIdentityRequestSecurity");
Object.defineProperty(exports, "acceptFacebookRequest", { enumerable: true, get: function () { return facebookIdentityRequestSecurity_2.acceptFacebookRequest; } });
Object.defineProperty(exports, "allowFacebookRequest", { enumerable: true, get: function () { return facebookIdentityRequestSecurity_2.allowFacebookRequest; } });
Object.defineProperty(exports, "applyFacebookCors", { enumerable: true, get: function () { return facebookIdentityRequestSecurity_2.applyFacebookCors; } });
Object.defineProperty(exports, "consumeFacebookRequestQuota", { enumerable: true, get: function () { return facebookIdentityRequestSecurity_2.consumeFacebookRequestQuota; } });
Object.defineProperty(exports, "isAllowedFacebookOrigin", { enumerable: true, get: function () { return facebookIdentityRequestSecurity_2.isAllowedFacebookOrigin; } });
Object.defineProperty(exports, "parseFacebookExchangeBody", { enumerable: true, get: function () { return facebookIdentityRequestSecurity_2.parseFacebookExchangeBody; } });
/** Provides facebook app secret behavior. */
const facebookAppSecret = (0, params_1.defineSecret)("FACEBOOK_APP_SECRET");
/** Provides facebook uid secret behavior. */
const facebookUidSecret = (0, params_1.defineSecret)("FACEBOOK_UID_SECRET");
/** Provides facebook http options behavior. */
const facebookHttpOptions = { secrets: [facebookAppSecret, facebookUidSecret], invoker: "public" };
/** Defines the identity collection value. */
const IDENTITY_COLLECTION = "providerIdentities";
/** Defines the app check ttl ms value. */
const APP_CHECK_TTL_MS = 60 * 60 * 1_000;
/** Builds the complete, intentionally PII-free claim set for Facebook sessions. */
function facebookCustomAuthClaims(accountGeneration) {
    if (!Number.isSafeInteger(accountGeneration) ||
        accountGeneration < 1 ||
        accountGeneration > facebookSecurity_1.MAX_FACEBOOK_ACCOUNT_GENERATION) {
        throw new Error("invalid-facebook-account-generation");
    }
    return { provider: "facebook", accountGeneration };
}
/** Indicates whether is record. */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Indicates whether is safe non negative integer. */
const isSafeNonNegativeInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
/** Provides nonce id behavior. */
const nonceId = (nonce) => (0, node_crypto_1.createHash)("sha256").update(nonce).digest("hex");
/** Provides facebook provider identity id behavior. */
const facebookProviderIdentityId = (appId, playerId) => (0, node_crypto_1.createHash)("sha256").update(`${appId}\0${playerId}`).digest("hex");
exports.facebookProviderIdentityId = facebookProviderIdentityId;
/** Provides valid deletion timestamp behavior. */
const validDeletionTimestamp = (value) => {
    if (typeof value !== "object" ||
        value === null ||
        !("toMillis" in value) ||
        typeof value.toMillis !== "function")
        return false;
    /** Provides milliseconds behavior. */
    const milliseconds = value.toMillis();
    return typeof milliseconds === "number" && Number.isSafeInteger(milliseconds) && milliseconds >= 0;
};
/** Indicates whether has fresh generation deletion proof. */
const hasFreshGenerationDeletionProof = (value, playerId, uidSecret, accountGeneration) => {
    if (accountGeneration <= 1 || !validDeletionTimestamp(value.lastDeletedAt))
        return false;
    /** Provides prior uid behavior. */
    const priorUid = (0, facebookSecurity_1.facebookFirebaseUid)(playerId, uidSecret, accountGeneration - 1);
    /** Provides expected hash behavior. */
    const expectedHash = (0, node_crypto_1.createHash)("sha256").update(priorUid).digest("hex");
    return value.lastDeletedUidHash === expectedHash;
};
/** Validates the complete server-owned identity record before deriving session credentials. */
function resolveFacebookProviderIdentity(value, { appId, playerId, uidSecret, }) {
    if (!isRecord(value) ||
        value.provider !== "facebook" ||
        value.appId !== appId ||
        value.providerPlayerId !== playerId ||
        !Number.isSafeInteger(value.accountGeneration) ||
        value.accountGeneration < 1 ||
        value.accountGeneration > facebookSecurity_1.MAX_FACEBOOK_ACCOUNT_GENERATION ||
        (value.status !== "active" && value.status !== "deleting")) {
        throw new Error("facebook-provider-identity-conflict");
    }
    if (value.status === "deleting")
        throw new Error("facebook-account-deletion-in-progress");
    /** Provides account generation behavior. */
    const accountGeneration = value.accountGeneration;
    /** Provides uid behavior. */
    const uid = (0, facebookSecurity_1.facebookFirebaseUid)(playerId, uidSecret, accountGeneration);
    if (value.uid !== null && value.uid !== uid)
        throw new Error("facebook-provider-identity-conflict");
    if (value.uid === null && !hasFreshGenerationDeletionProof(value, playerId, uidSecret, accountGeneration)) {
        throw new Error("facebook-provider-identity-conflict");
    }
    return { accountGeneration, uid, needsUidRepair: value.uid === null };
}
/** Prevents orphaned or stale user documents from being adopted or recreated during identity exchange. */
function resolveFacebookIdentityProvisioning({ providerExists, needsUidRepair, userExists, }) {
    if (!providerExists) {
        if (needsUidRepair || userExists)
            throw new Error("facebook-identity-provisioning-conflict");
        return "new_identity";
    }
    if (needsUidRepair) {
        if (userExists)
            throw new Error("facebook-identity-provisioning-conflict");
        return "fresh_generation";
    }
    if (!userExists)
        throw new Error("facebook-identity-provisioning-conflict");
    return "existing_identity";
}
/** Parses empty body. */
const parseEmptyBody = (body) => {
    if (!isRecord(body) || Object.keys(body).length !== 0)
        throw new Error("invalid-request");
};
/** Provides consume facebook identity nonce behavior. */
const consumeFacebookIdentityNonce = async (nonce, playerId, issuedAt, db = firebaseAdmin_1.admin.firestore(), now = Date.now) => {
    /** Fresh server time is bounded after every awaited storage boundary; tests may inject a fixed clock. */
    const readNow = () => {
        try {
            /** A stalled read/commit cannot reuse the request's earlier acceptance time. */
            const value = typeof now === "function" ? now() : now;
            return isSafeNonNegativeInteger(value) && value <= facebookIdentityNonce_1.FACEBOOK_NONCE_TIMESTAMP_MAX_MS ? value : undefined;
        }
        catch {
            return undefined;
        }
    };
    /** Syntax/clock failures stay before all nonce database reads. */
    const startedAtMs = readNow();
    if (!nonce ||
        Buffer.byteLength(nonce, "utf8") > 256 ||
        !playerId ||
        playerId.length > 256 ||
        !/^[A-Za-z0-9_-]+$/.test(playerId) ||
        startedAtMs === undefined ||
        !isSafeNonNegativeInteger(issuedAt) ||
        issuedAt > Math.floor(Number.MAX_SAFE_INTEGER / 1_000))
        return false;
    /** Provides issued at ms behavior. */
    const issuedAtMs = issuedAt * 1_000;
    /** Provides ref behavior. */
    const ref = db.collection(facebookIdentityNonce_1.FACEBOOK_NONCE_COLLECTION).doc(nonceId(nonce));
    /** Only the successful transaction attempt supplies its commit acceptance window. */
    let acceptedAtMs;
    /** Original expiry is never extended to cover storage latency. */
    let acceptedDeadlineMs;
    /** A committed nonce may be spent even when delayed completion makes authentication fail closed. */
    const accepted = await db.runTransaction(async (transaction) => {
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(ref);
        /** Provides data behavior. */
        let data;
        try {
            data = (0, facebookIdentityNonce_1.readFacebookIdentityNonceRecord)(snapshot.data());
        }
        catch {
            return false;
        }
        /** Creates d at ms. */
        const createdAtMs = data?.createdAtMs;
        /** Provides expires at ms behavior. */
        const expiresAtMs = data?.expiresAtMs;
        /** Re-evaluate the server clock after the authoritative read and on every transaction retry. */
        const currentNow = readNow();
        if (data.consumedAtMs !== null ||
            currentNow === undefined || currentNow < startedAtMs ||
            currentNow < createdAtMs ||
            expiresAtMs <= currentNow ||
            issuedAtMs < createdAtMs - 60_000 ||
            issuedAtMs > expiresAtMs)
            return false;
        transaction.update(ref, {
            consumedAtMs: currentNow,
            playerIdHash: (0, node_crypto_1.createHash)("sha256").update(playerId).digest("hex"),
        });
        acceptedAtMs = currentNow;
        acceptedDeadlineMs = expiresAtMs;
        return true;
    });
    if (!accepted || acceptedAtMs === undefined || acceptedDeadlineMs === undefined)
        return false;
    /** An expired or regressed clock after commit cannot authorize a custom token. */
    const completedAtMs = readNow();
    return completedAtMs !== undefined && completedAtMs >= acceptedAtMs && completedAtMs < acceptedDeadlineMs;
};
exports.consumeFacebookIdentityNonce = consumeFacebookIdentityNonce;
/** Provides reject behavior. */
const reject = async (functionName, response, error) => {
    firebase_functions_1.logger.warn("Rejected Facebook platform request", {
        reason: error instanceof Error ? error.message : "invalid-request",
    });
    (0, sentry_1.captureException)(error, { firebaseFunction: functionName });
    await (0, sentry_1.flushSentry)();
    response.status(401).json({ error: "invalid-request" });
};
/** Provides issue facebook identity nonce behavior. */
exports.issueFacebookIdentityNonce = (0, sentryHandlers_1.onRequestWithSentry)("issueFacebookIdentityNonce", facebookHttpOptions, async (request, response) => {
    if (!(0, facebookIdentityRequestSecurity_1.acceptFacebookRequest)(request, response))
        return;
    if (!(0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("identity")) {
        response.status(503).json({ error: "temporarily-unavailable" });
        return;
    }
    try {
        if (!(await (0, facebookIdentityRequestSecurity_1.consumeFacebookRequestQuota)(request.ip ?? "unknown", facebookAppSecret.value()))) {
            response.status(429).json({ error: "rate-limited" });
            return;
        }
        parseEmptyBody(request.body);
        /** Provides nonce behavior. */
        const nonce = (0, node_crypto_1.randomBytes)(32).toString("base64url");
        /** Creates d at ms. */
        const createdAtMs = Date.now();
        /** Shared nonce policy binds physical TTL to the same logical five-minute deadline. */
        const record = (0, facebookIdentityNonce_1.createFacebookIdentityNonceRecord)(createdAtMs);
        await firebaseAdmin_1.admin
            .firestore()
            .collection(facebookIdentityNonce_1.FACEBOOK_NONCE_COLLECTION)
            .doc(nonceId(nonce))
            .create(record);
        response.json({ nonce, expiresAtMs: record.expiresAtMs });
    }
    catch (error) {
        await reject("issueFacebookIdentityNonce", response, error);
    }
});
/** Provides exchange facebook identity behavior. */
exports.exchangeFacebookIdentity = (0, sentryHandlers_1.onRequestWithSentry)("exchangeFacebookIdentity", facebookHttpOptions, async (request, response) => {
    if (!(0, facebookIdentityRequestSecurity_1.acceptFacebookRequest)(request, response))
        return;
    if (!(0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("identity")) {
        response.status(503).json({ error: "temporarily-unavailable" });
        return;
    }
    try {
        if (!(await (0, facebookIdentityRequestSecurity_1.consumeFacebookRequestQuota)(request.ip ?? "unknown", facebookAppSecret.value()))) {
            response.status(429).json({ error: "rate-limited" });
            return;
        }
        /** Provides app id behavior. */
        const appId = process.env.FACEBOOK_APP_ID ?? "";
        /** Provides firebase app id behavior. */
        const firebaseAppId = process.env.FACEBOOK_FIREBASE_APP_ID ?? "";
        if (!appId || !firebaseAppId)
            throw new Error("facebook-identity-not-configured");
        /** Provides input behavior. */
        const input = (0, facebookIdentityRequestSecurity_1.parseFacebookExchangeBody)(request.body);
        /** Provides verified behavior. */
        const verified = await (0, facebookSecurity_1.verifyFacebookSignedPlayer)(input.signedPlayer, {
            appSecret: facebookAppSecret.value(),
            configuredAppId: appId,
            expectedAppId: appId,
            expectedPlayerId: input.playerId,
            expectedNonce: input.nonce,
            consumeNonce: exports.consumeFacebookIdentityNonce,
        });
        /** Provides db behavior. */
        const db = firebaseAdmin_1.admin.firestore();
        /** Provides provider ref behavior. */
        const providerRef = db.collection(IDENTITY_COLLECTION).doc((0, exports.facebookProviderIdentityId)(appId, verified.player_id));
        /** Provides account generation behavior. */
        let accountGeneration = 1;
        /** Provides uid behavior. */
        let uid = "";
        await db.runTransaction(async (transaction) => {
            /** Provides provider snapshot behavior. */
            const providerSnapshot = await transaction.get(providerRef);
            /** Provides existing provider behavior. */
            const existingProvider = providerSnapshot.data();
            /** Provides needs uid repair behavior. */
            let needsUidRepair = false;
            if (providerSnapshot.exists) {
                /** Resolves d. */
                const resolved = resolveFacebookProviderIdentity(existingProvider, {
                    appId,
                    playerId: verified.player_id,
                    uidSecret: facebookUidSecret.value(),
                });
                accountGeneration = resolved.accountGeneration;
                uid = resolved.uid;
                needsUidRepair = resolved.needsUidRepair;
            }
            if (!providerSnapshot.exists) {
                uid = (0, facebookSecurity_1.facebookFirebaseUid)(verified.player_id, facebookUidSecret.value(), accountGeneration);
            }
            /** Provides r ref. */
            const userRef = db.collection("users").doc(uid);
            /** Provides r snapshot. */
            const userSnapshot = await transaction.get(userRef);
            /** Provides provisioning behavior. */
            const provisioning = resolveFacebookIdentityProvisioning({
                providerExists: providerSnapshot.exists,
                needsUidRepair,
                userExists: userSnapshot.exists,
            });
            if (provisioning === "new_identity") {
                transaction.create(providerRef, {
                    provider: "facebook",
                    appId,
                    providerPlayerId: verified.player_id,
                    uid,
                    accountGeneration,
                    status: "active",
                    createdAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            else if (provisioning === "fresh_generation") {
                transaction.update(providerRef, { uid, status: "active" });
            }
            if (provisioning !== "existing_identity") {
                transaction.create(userRef, (0, facebookUser_1.createReservedFacebookUser)(transaction, db, uid));
            }
        });
        /** Provides claims behavior. */
        const claims = facebookCustomAuthClaims(accountGeneration);
        /** Provides [custom token, app check token] behavior. */
        const [customToken, appCheckToken] = await Promise.all([
            firebaseAdmin_1.admin.auth().createCustomToken(uid, claims),
            (0, app_check_1.getAppCheck)().createToken(firebaseAppId, { ttlMillis: APP_CHECK_TTL_MS }),
        ]);
        response.json({
            customToken,
            appCheckToken: appCheckToken.token,
            appCheckExpiresInMs: appCheckToken.ttlMillis,
            uid,
        });
    }
    catch (error) {
        await reject("exchangeFacebookIdentity", response, error);
    }
});
//# sourceMappingURL=facebookEndpoints.js.map