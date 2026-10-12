"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.facebookDataDeletionStatus = exports.facebookDataDeletionCallback = void 0;
exports.parseFacebookDeletionBody = parseFacebookDeletionBody;
exports.facebookDeletionConfirmationCode = facebookDeletionConfirmationCode;
exports.resolveFacebookDeletionReceipt = resolveFacebookDeletionReceipt;
exports.resolveFacebookCallbackDeletionIdentity = resolveFacebookCallbackDeletionIdentity;
const node_crypto_1 = require("node:crypto");
const firebase_functions_1 = require("firebase-functions");
const params_1 = require("firebase-functions/params");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentry_1 = require("../shared/sentry");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const facebookAccountDeletion_1 = require("./facebookAccountDeletion");
const facebookEndpoints_1 = require("./facebookEndpoints");
const facebookSecurity_1 = require("./facebookSecurity");
/** Provides facebook app secret behavior. */
const facebookAppSecret = (0, params_1.defineSecret)("FACEBOOK_APP_SECRET");
/** Provides facebook uid secret behavior. */
const facebookUidSecret = (0, params_1.defineSecret)("FACEBOOK_UID_SECRET");
/** Defines the deletion collection value. */
const DELETION_COLLECTION = "facebookDeletionRequests";
/** Defines the max body bytes value. */
const MAX_BODY_BYTES = 12 * 1_024;
/** Defines the code pattern value. */
const CODE_PATTERN = /^[0-9a-f]{32}$/;
/** Indicates whether is record. */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Provides valid deletion timestamp behavior. */
const validDeletionTimestamp = (value) => {
    if (!isRecord(value) || typeof value.toMillis !== "function")
        return false;
    try {
        /** Provides milliseconds behavior. */
        const milliseconds = value.toMillis();
        return typeof milliseconds === "number" && Number.isSafeInteger(milliseconds) && milliseconds >= 0;
    }
    catch {
        return false;
    }
};
/** Applies deletion headers. */
const applyDeletionHeaders = (response) => {
    response.set("Cache-Control", "no-store");
    response.set("Referrer-Policy", "no-referrer");
    response.set("X-Content-Type-Options", "nosniff");
    response.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
};
/** Parses facebook deletion body. */
function parseFacebookDeletionBody(request) {
    if (request.method !== "POST")
        throw new Error("method-not-allowed");
    if (!request.is("application/x-www-form-urlencoded"))
        throw new Error("unsupported-media-type");
    if (request.rawBody && request.rawBody.byteLength > MAX_BODY_BYTES)
        throw new Error("payload-too-large");
    /** Provides body behavior. */
    const body = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1) {
        throw new Error("invalid-request");
    }
    /** Provides signed request behavior. */
    const signedRequest = body.signed_request;
    if (typeof signedRequest !== "string" || !signedRequest || signedRequest.length > 8_192) {
        throw new Error("invalid-request");
    }
    return signedRequest;
}
/** Provides facebook deletion confirmation code behavior. */
function facebookDeletionConfirmationCode(signedRequest, appSecret) {
    return (0, node_crypto_1.createHmac)("sha256", appSecret)
        .update("riddle-quest-facebook-deletion-v1\0")
        .update(signedRequest)
        .digest("hex")
        .slice(0, 32);
}
/** Provides deletion status url behavior. */
const deletionStatusUrl = (code) => {
    /** Provides configured behavior. */
    const configured = process.env.FACEBOOK_DELETION_STATUS_BASE_URL ?? "";
    /** Provides url behavior. */
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
        throw new Error("facebook-deletion-status-url-invalid");
    }
    url.searchParams.set("code", code);
    return url.toString();
};
/** Provides respond with confirmation behavior. */
const respondWithConfirmation = (response, code) => response.status(200).json({ url: deletionStatusUrl(code), confirmation_code: code });
/** Validates an existing callback receipt and restores only its originally frozen generation. */
function resolveFacebookDeletionReceipt(value, { providerIdentityId, playerId, uidSecret, }) {
    if (!isRecord(value) ||
        value.schemaVersion !== 1 ||
        value.providerIdentityId !== providerIdentityId ||
        (value.status !== "processing" && value.status !== "complete") ||
        !validDeletionTimestamp(value.requestedAt) ||
        (value.accountGeneration !== null &&
            (!Number.isSafeInteger(value.accountGeneration) ||
                value.accountGeneration < 1 ||
                value.accountGeneration > facebookSecurity_1.MAX_FACEBOOK_ACCOUNT_GENERATION)) ||
        (value.status === "complete" && !validDeletionTimestamp(value.completedAt)))
        throw new Error("facebook-deletion-receipt-conflict");
    /** Provides account generation behavior. */
    const accountGeneration = value.accountGeneration;
    return {
        complete: value.status === "complete",
        identity: accountGeneration === null
            ? null
            : {
                uid: (0, facebookSecurity_1.facebookFirebaseUid)(playerId, uidSecret, accountGeneration),
                accountGeneration,
            },
    };
}
/** Resolves only the exact deterministic account generation owned by this Meta identity. */
function resolveFacebookCallbackDeletionIdentity(value, { appId, playerId, uidSecret, }) {
    if (!isRecord(value) ||
        value.provider !== "facebook" ||
        value.appId !== appId ||
        value.providerPlayerId !== playerId ||
        !Number.isSafeInteger(value.accountGeneration) ||
        value.accountGeneration < 1 ||
        value.accountGeneration > facebookSecurity_1.MAX_FACEBOOK_ACCOUNT_GENERATION ||
        (value.status !== "active" && value.status !== "deleting" && value.status !== "exhausted") ||
        (value.status === "exhausted" && value.accountGeneration !== facebookSecurity_1.MAX_FACEBOOK_ACCOUNT_GENERATION))
        throw new Error("facebook-provider-identity-conflict");
    if (value.uid === null) {
        if (value.status !== "active" && value.status !== "exhausted") {
            throw new Error("facebook-provider-identity-conflict");
        }
        /** Deletes d generation. */
        const deletedGeneration = value.status === "exhausted" ? value.accountGeneration : value.accountGeneration - 1;
        if (deletedGeneration < 1 || !validDeletionTimestamp(value.lastDeletedAt)) {
            throw new Error("facebook-provider-identity-conflict");
        }
        /** Deletes d uid. */
        const deletedUid = (0, facebookSecurity_1.facebookFirebaseUid)(playerId, uidSecret, deletedGeneration);
        /** Provides expected deleted hash behavior. */
        const expectedDeletedHash = (0, node_crypto_1.createHash)("sha256").update(deletedUid).digest("hex");
        if (value.lastDeletedUidHash !== expectedDeletedHash) {
            throw new Error("facebook-provider-identity-conflict");
        }
        return null;
    }
    if (value.status === "exhausted")
        throw new Error("facebook-provider-identity-conflict");
    /** Provides account generation behavior. */
    const accountGeneration = value.accountGeneration;
    /** Provides expected uid behavior. */
    const expectedUid = (0, facebookSecurity_1.facebookFirebaseUid)(playerId, uidSecret, accountGeneration);
    if (value.uid !== expectedUid)
        throw new Error("facebook-provider-identity-conflict");
    return { uid: expectedUid, accountGeneration };
}
/** Meta app-dashboard callback for an app-secret-authenticated data-deletion request. */
exports.facebookDataDeletionCallback = (0, sentryHandlers_1.onRequestWithSentry)("facebookDataDeletionCallback", { secrets: [facebookAppSecret, facebookUidSecret], invoker: "public", timeoutSeconds: 540 }, async (request, response) => {
    applyDeletionHeaders(response);
    try {
        if (!(0, facebookEndpoints_1.allowFacebookRequest)(`deletion:${request.ip ?? "unknown"}`)) {
            response.status(429).json({ error: "rate-limited" });
            return;
        }
        /** Provides signed request behavior. */
        const signedRequest = parseFacebookDeletionBody(request);
        /** Provides secret behavior. */
        const secret = facebookAppSecret.value();
        /** Provides payload behavior. */
        const payload = (0, facebookSecurity_1.verifyFacebookDeletionRequest)(signedRequest, secret);
        /** Provides app id behavior. */
        const appId = process.env.FACEBOOK_APP_ID ?? "";
        if (!appId)
            throw new Error("facebook-identity-not-configured");
        /** Provides code behavior. */
        const code = facebookDeletionConfirmationCode(signedRequest, secret);
        /** Provides db behavior. */
        const db = firebaseAdmin_1.admin.firestore();
        /** Provides receipt ref behavior. */
        const receiptRef = db.collection(DELETION_COLLECTION).doc(code);
        /** Provides provider ref behavior. */
        const providerRef = db.collection("providerIdentities").doc((0, facebookEndpoints_1.facebookProviderIdentityId)(appId, payload.user_id));
        /** Provides uid secret behavior. */
        const uidSecret = facebookUidSecret.value();
        /** Provides plan behavior. */
        const plan = await db.runTransaction(async (transaction) => {
            /** Provides [receipt, provider snapshot] behavior. */
            const [receipt, providerSnapshot] = await Promise.all([
                transaction.get(receiptRef),
                transaction.get(providerRef),
            ]);
            if (receipt.exists)
                return resolveFacebookDeletionReceipt(receipt.data(), {
                    providerIdentityId: providerRef.id,
                    playerId: payload.user_id,
                    uidSecret,
                });
            /** Provides identity behavior. */
            const identity = providerSnapshot.exists
                ? resolveFacebookCallbackDeletionIdentity(providerSnapshot.data(), {
                    appId,
                    playerId: payload.user_id,
                    uidSecret,
                })
                : null;
            transaction.create(receiptRef, {
                schemaVersion: 1,
                status: "processing",
                providerIdentityId: providerRef.id,
                accountGeneration: identity?.accountGeneration ?? null,
                requestedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            return { complete: false, identity };
        });
        if (plan.complete) {
            respondWithConfirmation(response, code);
            return;
        }
        if (plan.identity)
            await (0, facebookAccountDeletion_1.deleteFacebookAccountGeneration)(plan.identity, { uidSecret });
        await receiptRef.set({
            status: "complete",
            completedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        respondWithConfirmation(response, code);
    }
    catch (error) {
        firebase_functions_1.logger.warn("Rejected Facebook data-deletion callback", {
            reason: error instanceof Error ? error.message : "invalid-request",
        });
        (0, sentry_1.captureException)(error, { firebaseFunction: "facebookDataDeletionCallback" });
        await (0, sentry_1.flushSentry)();
        /** Provides message behavior. */
        const message = error instanceof Error ? error.message : "invalid-request";
        /** Provides status behavior. */
        const status = message === "method-not-allowed"
            ? 405
            : message === "unsupported-media-type"
                ? 415
                : message === "payload-too-large"
                    ? 413
                    : 400;
        response.status(status).json({ error: "invalid-request" });
    }
});
/** PII-free status endpoint referenced by Meta's deletion confirmation response. */
exports.facebookDataDeletionStatus = (0, sentryHandlers_1.onRequestWithSentry)("facebookDataDeletionStatus", { invoker: "public" }, async (request, response) => {
    applyDeletionHeaders(response);
    /** Provides code behavior. */
    const code = typeof request.query.code === "string" ? request.query.code : "";
    if (request.method !== "GET" || !CODE_PATTERN.test(code)) {
        response.status(400).send("Invalid deletion confirmation code.");
        return;
    }
    /** Provides receipt behavior. */
    const receipt = await firebaseAdmin_1.admin.firestore().collection(DELETION_COLLECTION).doc(code).get();
    /** Provides complete behavior. */
    const complete = receipt.data()?.status === "complete";
    response.set("Content-Type", "text/plain; charset=utf-8");
    response
        .status(complete ? 200 : 202)
        .send(complete
        ? "Riddle Quest account data deletion is complete."
        : "Riddle Quest account data deletion is still processing.");
});
//# sourceMappingURL=facebookDataDeletionEndpoints.js.map