"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onCallWithSentry = onCallWithSentry;
exports.onRequestWithSentry = onRequestWithSentry;
exports.onScheduleWithSentry = onScheduleWithSentry;
const contentProtection_1 = require("@qwordly/core/contentProtection");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const callableSecurity_1 = require("./callableSecurity");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const sentry_1 = require("./sentry");
/**
 * Browsers cache a CORS preflight for only five seconds without this header,
 * so every guess spaced further apart paid an extra OPTIONS round trip.
 * Matches the Jest and Facebook identity endpoints.
 */
const CALLABLE_PREFLIGHT_MAX_AGE_SECONDS = "3600";
/**
 * Lets browsers reuse one callable preflight instead of repeating it per request.
 *
 * @param callable Deployable callable produced by the Firebase SDK.
 * @returns The same callable, with its deployment metadata, advertising a preflight cache lifetime.
 */
function withCachedPreflight(callable) {
    if (typeof callable !== "function")
        return callable;
    /** Forwards every request after marking preflight responses cacheable. */
    const cached = (request, response) => {
        if (request.method === "OPTIONS")
            response.setHeader("Access-Control-Max-Age", CALLABLE_PREFLIGHT_MAX_AGE_SECONDS);
        return callable(request, response);
    };
    return Object.defineProperties(cached, Object.getOwnPropertyDescriptors(callable));
}
/**
 * Executes a deployed handler and reports every thrown or rejected value.
 *
 * @param functionName Stable deployed function name used for issue triage.
 * @param handler Original Firebase handler.
 * @param args Invocation arguments supplied by the Firebase runtime.
 * @returns The original handler result.
 */
async function invokeWithSentry(functionName, handler, args) {
    try {
        return await handler(...args);
    }
    catch (error) {
        (0, sentry_1.captureException)(error, { firebaseFunction: functionName });
        await (0, sentry_1.flushSentry)();
        throw error;
    }
}
/**
 * Creates a Firebase callable whose handler failures are always sent to Sentry.
 *
 * @param functionName Stable deployed function name.
 * @param options Firebase callable deployment and security options.
 * @param handler Callable implementation.
 * @returns Deployable Firebase callable function.
 */
function onCallWithSentry(functionName, options, handler, boundaryOptions = {}) {
    return withCachedPreflight((0, https_1.onCall)(options, async (request, response) => {
        /** Negotiates only the transport format before domain validation. */
        const negotiation = (0, contentProtection_1.contentProtectionRequest)(request.data);
        /** Preserves authentication and request metadata. */
        const decodedRequest = negotiation.protected ? { ...request, data: negotiation.data } : request;
        /** Validates and authorizes domain actions before wrapping their response. */
        const invoke = async () => {
            /** Domain response never trusted back from the client. */
            const result = await invokeWithSentry(functionName, handler, [decodedRequest, response]);
            // Transport wrapping happens after handler validation and never changes authoritative state.
            return negotiation.protected ? await (0, contentProtection_1.protectContent)(result) : result;
        };
        /** Only a caller-declared pure observer may skip the mutation lease for a streaming request. */
        const skipLease = typeof boundaryOptions.skipJestAccountOperationLease === "function"
            ? boundaryOptions.skipJestAccountOperationLease(request) : boundaryOptions.skipJestAccountOperationLease;
        if (skipLease || !request.auth) {
            return invoke();
        }
        /** Provides timeout seconds behavior. */
        const timeoutSeconds = typeof options.timeoutSeconds === "number" ? options.timeoutSeconds : callableSecurity_1.BROWSER_CALLABLE_TIMEOUT_SECONDS;
        try {
            return await (0, jestAccountDeletion_1.runWithJestAccountOperationLease)(request.auth.uid, timeoutSeconds, invoke);
        }
        catch (error) {
            if ((0, jestAccountDeletion_1.isJestAccountDeletedError)(error)) {
                throw new https_1.HttpsError("failed-precondition", "This account was permanently deleted.");
            }
            throw error;
        }
    }));
}
/**
 * Creates an HTTP Firebase Function whose handler failures are always sent to Sentry.
 *
 * @param functionName Stable deployed function name.
 * @param options Firebase HTTP deployment and security options.
 * @param handler HTTP request implementation.
 * @returns Deployable Firebase HTTP function.
 */
function onRequestWithSentry(functionName, options, handler) {
    return (0, https_1.onRequest)(options, (request, response) => invokeWithSentry(functionName, handler, [request, response]));
}
/**
 * Creates a scheduled Firebase Function whose handler failures are always sent to Sentry.
 *
 * @param functionName Stable deployed function name.
 * @param options Firebase scheduler deployment options.
 * @param handler Scheduled task implementation.
 * @returns Deployable Firebase scheduled function.
 */
function onScheduleWithSentry(functionName, options, handler) {
    return (0, scheduler_1.onSchedule)(options, (event) => invokeWithSentry(functionName, handler, [event]));
}
//# sourceMappingURL=sentryHandlers.js.map