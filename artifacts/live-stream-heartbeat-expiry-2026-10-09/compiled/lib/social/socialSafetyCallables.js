"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRival = exports.blockRival = void 0;
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const callableValidation_1 = require("../validation/callableValidation");
const socialSafety_1 = require("./socialSafety");
/** Provides require user id behavior. */
const requireUserId = (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Authentication is required.");
    return request.auth.uid;
};
/** Immediately blocks one established rival for the authenticated player. */
exports.blockRival = (0, sentryHandlers_1.onCallWithSentry)("blockRival", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.BlockSocialRivalRequestSchema, request.data, "blockRival");
    return (0, socialSafety_1.blockKnownRival)(userId, "targetUserId" in input ? input.targetUserId : input);
});
/** Queues one bounded, categorized report for an established rival. */
exports.reportRival = (0, sentryHandlers_1.onCallWithSentry)("reportRival", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.ReportSocialRivalRequestSchema, request.data, "reportRival");
    return (0, socialSafety_1.reportKnownRival)(userId, input);
});
//# sourceMappingURL=socialSafetyCallables.js.map