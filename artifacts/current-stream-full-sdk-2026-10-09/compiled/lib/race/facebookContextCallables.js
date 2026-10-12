"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFacebookContextBoard = exports.recordFacebookContextRun = exports.leaveFacebookContext = exports.joinFacebookContext = void 0;
const zod_1 = require("zod");
const https_1 = require("firebase-functions/v2/https");
const validation_1 = require("@qwordly/core/validation");
const race_1 = require("@qwordly/core/race");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const callableValidation_1 = require("../validation/callableValidation");
const facebookFeatureFlags_1 = require("../facebook/facebookFeatureFlags");
const facebookSecurity_1 = require("../facebook/facebookSecurity");
const facebookContextService_1 = require("./facebookContextService");
const facebookContextBoard_1 = require("./facebookContextBoard");
/** Renders the context id interface. */
const ContextId = zod_1.z
    .string()
    .min(1)
    .max(256)
    .regex(/^[A-Za-z0-9._:-]+$/);
/** Validates the join data shape. */
const JoinSchema = zod_1.z
    .object({
    contextId: ContextId,
    contextType: zod_1.z.enum(["THREAD", "GROUP"]),
    locale: zod_1.z.enum(validation_1.SUPPORTED_LOCALES),
})
    .strict();
/** Validates the leave data shape. */
const LeaveSchema = zod_1.z.object({ contextId: ContextId }).strict();
/** Provides require facebook user behavior. */
const requireFacebookUser = (request) => {
    if (!request.auth || request.auth.token.provider !== "facebook" || !(0, facebookSecurity_1.isFacebookFirebaseUid)(request.auth.uid)) {
        throw new https_1.HttpsError("unauthenticated", "Facebook authentication is required.");
    }
    if (!(0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("matchmaking")) {
        throw new https_1.HttpsError("unavailable", "Facebook matchmaking is temporarily unavailable.");
    }
    return request.auth.uid;
};
/** Joins the authenticated player to their current SDK context competition. */
exports.joinFacebookContext = (0, sentryHandlers_1.onCallWithSentry)("joinFacebookContext", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides r id. */
    const userId = requireFacebookUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(JoinSchema, request.data, "joinFacebookContext");
    return (0, facebookContextService_1.joinFacebookContextCompetition)({ ...input, userId });
});
/** Leaves the authenticated player's current context and elects the next host. */
exports.leaveFacebookContext = (0, sentryHandlers_1.onCallWithSentry)("leaveFacebookContext", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides r id. */
    const userId = requireFacebookUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(LeaveSchema, request.data, "leaveFacebookContext");
    return (0, facebookContextService_1.leaveFacebookContextCompetition)({ ...input, userId });
});
/** Records a completed authoritative run on the authenticated player's active context board. */
exports.recordFacebookContextRun = (0, sentryHandlers_1.onCallWithSentry)("recordFacebookContextRun", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides r id. */
    const userId = requireFacebookUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.RecordFacebookContextRunRequestSchema, request.data, "recordFacebookContextRun");
    /** Provides result behavior. */
    const result = await (0, facebookContextBoard_1.recordFacebookContextBoardRun)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_1.RecordFacebookContextRunResponseSchema, {
        locale: result.entry.locale,
        runId: result.entry.runId,
        adjustedTimeMs: result.entry.adjustedTimeMs,
        completedAtMs: result.entry.completedAtMs,
        improved: result.improved,
        sortOrder: facebookContextBoard_1.FACEBOOK_CONTEXT_BOARD_SORT_ORDER,
        rewardsEnabled: false,
    }, "recordFacebookContextRun");
});
/** Lists the active player's current context board without provider or game-owned identities. */
exports.listFacebookContextBoard = (0, sentryHandlers_1.onCallWithSentry)("listFacebookContextBoard", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides r id. */
    const userId = requireFacebookUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.ListFacebookContextBoardRequestSchema, request.data, "listFacebookContextBoard");
    return (0, callableValidation_1.validateCallableResponse)(race_1.ListFacebookContextBoardResponseSchema, await (0, facebookContextBoard_1.listFacebookContextBoard)(userId, input), "listFacebookContextBoard");
});
//# sourceMappingURL=facebookContextCallables.js.map