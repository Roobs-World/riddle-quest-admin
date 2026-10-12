"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFacebookTournament = exports.recordFacebookTournament = void 0;
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const facebookFeatureFlags_1 = require("../facebook/facebookFeatureFlags");
const facebookSecurity_1 = require("../facebook/facebookSecurity");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const callableValidation_1 = require("../validation/callableValidation");
const facebookTournament_1 = require("./facebookTournament");
/** Provides require facebook tournament identity behavior. */
const requireFacebookTournamentIdentity = (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Authentication is required.");
    if (request.auth.token.provider !== "facebook" || !(0, facebookSecurity_1.isFacebookFirebaseUid)(request.auth.uid)) {
        throw new https_1.HttpsError("permission-denied", "A Facebook player identity is required.");
    }
    if (!(0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("tournaments")) {
        throw new https_1.HttpsError("unavailable", "Facebook tournaments are temporarily unavailable.");
    }
    return request.auth.uid;
};
/** Records an official score while rejecting non-Facebook identities and client-provided score fields. */
exports.recordFacebookTournament = (0, sentryHandlers_1.onCallWithSentry)("recordFacebookTournament", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides r id. */
    const userId = requireFacebookTournamentIdentity(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.RecordFacebookTournamentRunRequestSchema, request.data, "recordFacebookTournament");
    /** Provides result behavior. */
    const result = await (0, facebookTournament_1.recordFacebookTournamentRun)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_1.RecordFacebookTournamentRunResponseSchema, {
        tournamentId: result.entry.tournamentId,
        locale: result.entry.locale,
        runId: result.entry.runId,
        adjustedTimeMs: result.entry.adjustedTimeMs,
        completedAtMs: result.entry.completedAtMs,
        improved: result.improved,
        sortOrder: facebookTournament_1.FACEBOOK_TOURNAMENT_SORT_ORDER,
        rewardsEnabled: false,
    }, "recordFacebookTournament");
});
/** Returns only bounded, identity-free authoritative standings for the active locale window. */
exports.listFacebookTournament = (0, sentryHandlers_1.onCallWithSentry)("listFacebookTournament", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides r id. */
    const userId = requireFacebookTournamentIdentity(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.ListFacebookTournamentRequestSchema, request.data, "listFacebookTournament");
    return (0, callableValidation_1.validateCallableResponse)(race_1.ListFacebookTournamentResponseSchema, await (0, facebookTournament_1.listFacebookTournamentStandings)(userId, input.locale), "listFacebookTournament");
});
//# sourceMappingURL=facebookTournamentCallable.js.map