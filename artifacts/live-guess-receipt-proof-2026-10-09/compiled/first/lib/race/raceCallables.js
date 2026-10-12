"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelRaceInvite = exports.getRaceEntry = exports.listRaceInbox = exports.getRaceOutcome = exports.getRaceChallenge = exports.reserveRaceInvite = exports.publishRaceChallenge = exports.abandonRaceRun = exports.resumeRaceRun = exports.skipRaceRiddle = exports.requestRaceHint = exports.submitRaceGuess = exports.readyRaceRun = exports.startRaceRun = exports.listRaceCategories = exports.recordRaceAnalytics = exports.findRaceMatch = exports.getRaceAccess = exports.raceAbandonCallableOptions = exports.raceStartCallableOptions = exports.raceHintCallableOptions = exports.raceDiscoveryCallableOptions = exports.raceInteractiveCallableOptions = void 0;
const race_1 = require("@qwordly/core/race");
const race_2 = require("@qwordly/core/race");
const raceInvitation_1 = require("./raceInvitation");
const race_3 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const callableValidation_1 = require("../validation/callableValidation");
const raceService_1 = require("./raceService");
const raceRollout_1 = require("./raceRollout");
const callableSecurity_1 = require("../shared/callableSecurity");
const raceMatchmaking_1 = require("./raceMatchmaking");
const sentryHandlers_1 = require("../shared/sentryHandlers");
/** Keeps browser multiplayer beside eur3 while retaining existing regional clients. */
const jestWebCallableOptions = { ...callableSecurity_1.browserCallableSecurityOptions, region: ["us-central1", "europe-west1"] };
/** Keeps discovery, race input and recovery responsive for the first player after idle. */
exports.raceInteractiveCallableOptions = {
    ...jestWebCallableOptions,
    minInstances: 1,
};
/** Discovery and analytics inherit the shared regions and retain their warm instances. */
exports.raceDiscoveryCallableOptions = {
    ...exports.raceInteractiveCallableOptions,
};
/** Deployment options that keep the latency-sensitive hint callable warm. */
exports.raceHintCallableOptions = {
    ...jestWebCallableOptions,
    minInstances: 1,
};
/** Deployment options that keep the countdown-critical start callable warm. */
exports.raceStartCallableOptions = {
    ...jestWebCallableOptions,
    minInstances: 1,
};
/** Deployment options that keep the latency-sensitive abandon callable warm. */
exports.raceAbandonCallableOptions = {
    ...jestWebCallableOptions,
    minInstances: 1,
};
/** Provides require user id behavior. */
const requireUserId = (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    return request.auth.uid;
};
/** Provides require race user behavior. */
const requireRaceUser = async (request) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    await (0, raceRollout_1.assertRaceAccess)(userId);
    return userId;
};
/** Returns whether the authenticated player can access multiplayer. */
exports.getRaceAccess = (0, sentryHandlers_1.onCallWithSentry)("getRaceAccess", jestWebCallableOptions, async (request) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.RaceAccessRequestSchema, request.data, "getRaceAccess");
    return (0, callableValidation_1.validateCallableResponse)(race_3.RaceAccessResponseSchema, await (0, raceRollout_1.getRaceAccessForUser)(userId, input.locale), "getRaceAccess");
});
/** Uses authenticated identity to select recorded opponents inside the caller's provider scope. */
exports.findRaceMatch = (0, sentryHandlers_1.onCallWithSentry)("findRaceMatch", exports.raceDiscoveryCallableOptions, async (request) => {
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.RaceMatchRequestSchema, request.data, "findRaceMatch");
    /** Provides user id behavior. */
    const userId = requireUserId(request);
    await (0, raceRollout_1.assertRaceAccess)(userId, input.locale);
    return (0, callableValidation_1.validateCallableResponse)(race_3.RaceMatchResponseSchema, await (0, raceMatchmaking_1.findRecordedRaceMatch)(userId, input), "findRaceMatch");
});
/** Records a schema-validated multiplayer analytics event for the player. */
exports.recordRaceAnalytics = (0, sentryHandlers_1.onCallWithSentry)("recordRaceAnalytics", exports.raceDiscoveryCallableOptions, async (request) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.RaceAnalyticsEventRequestSchema, request.data, "recordRaceAnalytics");
    /** Provides response behavior. */
    const response = await (0, raceRollout_1.recordRaceAnalyticsForUser)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_3.RaceAnalyticsEventResponseSchema, response, "recordRaceAnalytics");
});
/** Lists server-approved race categories for the requested locale. */
exports.listRaceCategories = (0, sentryHandlers_1.onCallWithSentry)("listRaceCategories", exports.raceInteractiveCallableOptions, async (request) => {
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.ListRaceCategoriesRequestSchema, request.data, "listRaceCategories");
    /** Provides r id. */
    const userId = requireUserId(request);
    await (0, raceRollout_1.assertRaceAccess)(userId, input.locale);
    /** Provides response behavior. */
    const response = await (0, raceService_1.listRaceCategoriesForLocale)(input.locale);
    return (0, callableValidation_1.validateCallableResponse)(race_3.ListRaceCategoriesResponseSchema, response, "listRaceCategories");
});
/** Starts or idempotently resumes creation of an authoritative race run. */
exports.startRaceRun = (0, sentryHandlers_1.onCallWithSentry)("startRaceRun", exports.raceStartCallableOptions, async (request) => {
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.StartRaceRunRequestSchema, request.data, "startRaceRun");
    /** Provides r id. */
    const userId = requireUserId(request);
    await (0, raceRollout_1.assertRaceAccess)(userId, input.locale);
    /** Provides response behavior. */
    const response = await (0, raceService_1.startRaceRunForUser)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_3.RaceRunResponseSchema, response, "startRaceRun");
});
/** Schedules a prepared run after content delivery, without resetting an existing scheduled start. */
exports.readyRaceRun = (0, sentryHandlers_1.onCallWithSentry)("readyRaceRun", exports.raceStartCallableOptions, async (request) => {
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.ReadyRaceRunRequestSchema, request.data, "readyRaceRun");
    /** Provides user id behavior. */
    const userId = requireUserId(request);
    /** Provides run behavior. */
    const run = await (0, raceService_1.resumeRaceRunForUser)(userId, input.runId);
    await (0, raceRollout_1.assertRaceAccess)(userId, run.run.locale);
    return (0, callableValidation_1.validateCallableResponse)(race_3.RaceRunResponseSchema, await (0, raceService_1.readyRaceRunForUser)(userId, input), "readyRaceRun");
});
/** Applies a guess to the authenticated player's authoritative active run. */
exports.submitRaceGuess = (0, sentryHandlers_1.onCallWithSentry)("submitRaceGuess", exports.raceInteractiveCallableOptions, async (request) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.SubmitRaceGuessRequestSchema, request.data, "submitRaceGuess");
    /** Provides response behavior. */
    const response = await (0, raceService_1.submitRaceGuessForUser)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_3.SubmitRaceGuessResponseSchema, response, "submitRaceGuess");
});
/** Reveals a server-selected hint and applies its authoritative penalty. */
exports.requestRaceHint = (0, sentryHandlers_1.onCallWithSentry)("requestRaceHint", exports.raceHintCallableOptions, async (request) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.RequestRaceHintRequestSchema, request.data, "requestRaceHint");
    /** Provides response behavior. */
    const response = await (0, raceService_1.requestRaceHintForUser)(userId, input, { enforceAccess: true });
    return (0, callableValidation_1.validateCallableResponse)(race_3.RequestRaceHintResponseSchema, response, "requestRaceHint");
});
/** Skips the active race riddle and applies the authoritative skip penalty. */
exports.skipRaceRiddle = (0, sentryHandlers_1.onCallWithSentry)("skipRaceRiddle", exports.raceInteractiveCallableOptions, async (request) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.SkipRaceRiddleRequestSchema, request.data, "skipRaceRiddle");
    /** Provides response behavior. */
    const response = await (0, raceService_1.skipRaceRiddleForUser)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_3.SkipRaceRiddleResponseSchema, response, "skipRaceRiddle");
});
/** Restores the authenticated player's current view of an existing run. */
exports.resumeRaceRun = (0, sentryHandlers_1.onCallWithSentry)("resumeRaceRun", exports.raceInteractiveCallableOptions, async (request) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.RaceRunIdRequestSchema, request.data, "resumeRaceRun");
    /** Provides response behavior. */
    const response = input.includeEvaluation || input.includeGuessHistory
        ? await (0, raceService_1.resumeRaceRunForUser)(userId, input.runId, { includeEvaluation: input.includeEvaluation, includeGuessHistory: input.includeGuessHistory })
        : await (0, raceService_1.resumeRaceRunForUser)(userId, input.runId);
    return (0, callableValidation_1.validateCallableResponse)(race_3.RaceRunResponseSchema, response, "resumeRaceRun");
});
/** Abandons the authenticated player's active run without granting a result. */
exports.abandonRaceRun = (0, sentryHandlers_1.onCallWithSentry)("abandonRaceRun", exports.raceAbandonCallableOptions, async (request) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.AbandonRaceRunRequestSchema, request.data, "abandonRaceRun");
    /** Provides response behavior. */
    const response = await (0, raceService_1.abandonRaceRunForUser)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_3.AbandonRaceRunResponseSchema, response, "abandonRaceRun");
});
/** Publishes a verified completed creator run as a multiplayer challenge. */
exports.publishRaceChallenge = (0, sentryHandlers_1.onCallWithSentry)("publishRaceChallenge", jestWebCallableOptions, async (request) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.PublishRaceChallengeRequestSchema, request.data, "publishRaceChallenge");
    /** Provides response behavior. */
    const response = await (0, raceService_1.publishRaceChallengeForUser)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_3.PublishRaceChallengeResponseSchema, response, "publishRaceChallenge");
});
/** Creates the server-owned two-seat lobby carried by a Jest referral link. */
exports.reserveRaceInvite = (0, sentryHandlers_1.onCallWithSentry)("reserveRaceInvite", jestWebCallableOptions, async (request) => {
    /** Authenticated internal user issuing the invite. */
    const userId = await requireRaceUser(request);
    /** Validated invite reservation request. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.ReserveRaceInviteRequestSchema, request.data, "reserveRaceInvite");
    /** Newly reserved or idempotently replayed lobby response. */
    const response = await (0, raceService_1.reserveRaceInviteForUser)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_3.ReserveRaceInviteResponseSchema, response, "reserveRaceInvite");
});
/** Returns the answer-safe public preview of a multiplayer challenge. */
exports.getRaceChallenge = (0, sentryHandlers_1.onCallWithSentry)("getRaceChallenge", jestWebCallableOptions, async (request) => {
    /** Authenticated internal user opening the challenge. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.RaceChallengeIdRequestSchema, request.data, "getRaceChallenge");
    /** User-bound admission validates original content before any dependent private claim. */
    const response = await (0, raceService_1.getRaceChallengeForUser)(userId, input.challengeId, input.locale);
    return (0, callableValidation_1.validateCallableResponse)(race_3.RaceChallengePreviewSchema, response, "getRaceChallenge");
});
/** Returns the final outcome for a run owned by the authenticated player. */
exports.getRaceOutcome = (0, sentryHandlers_1.onCallWithSentry)("getRaceOutcome", exports.raceInteractiveCallableOptions, async (request) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.RaceRunIdRequestSchema, request.data, "getRaceOutcome");
    /** Provides response behavior. */
    const response = await (0, raceService_1.getRaceOutcomeForUser)(userId, input.runId);
    return (0, callableValidation_1.validateCallableResponse)(race_3.RaceOutcomeSchema, response, "getRaceOutcome");
});
/** Lists paginated challenge inbox items for the authenticated player. */
exports.listRaceInbox = (0, sentryHandlers_1.onCallWithSentry)("listRaceInbox", exports.raceInteractiveCallableOptions, async (request) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_3.ListRaceInboxRequestSchema, request.data, "listRaceInbox");
    /** Provides response behavior. */
    const response = await (0, raceService_1.listRaceInboxForUser)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_3.ListRaceInboxResponseSchema, response, "listRaceInbox");
});
/** Typed challenge lifecycle without provider-specific client interpretation. */
exports.getRaceEntry = (0, sentryHandlers_1.onCallWithSentry)("getRaceEntry", jestWebCallableOptions, async (request) => {
    /** Authenticated player opening or recovering an invitation. */
    const userId = await requireRaceUser(request);
    /** Answer-free direct-link intent. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_2.RaceEntryRequestSchema, request.data, "getRaceEntry");
    /** Independently validated claim and publication facts. */
    const response = await (0, raceInvitation_1.getRaceEntryForUser)(userId, input.challengeId, input.locale, { includeViewerRole: input.includeViewerRole, includeExistingAttempt: input.includeExistingAttempt });
    return (0, callableValidation_1.validateCallableResponse)(race_1.RaceEntryResponseSchema, response, "getRaceEntry");
});
/** Creator-only cancellation never acts on reusable public challenges. */
exports.cancelRaceInvite = (0, sentryHandlers_1.onCallWithSentry)("cancelRaceInvite", jestWebCallableOptions, async (request) => {
    /** Authenticated invitation owner. */
    const userId = await requireRaceUser(request);
    /** Idempotent cancellation intent. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.CancelRaceInviteRequestSchema, request.data, "cancelRaceInvite");
    /** Terminal lifecycle view. */
    const response = await (0, raceInvitation_1.cancelRaceInviteForUser)(userId, input);
    return (0, callableValidation_1.validateCallableResponse)(race_1.RaceEntryResponseSchema, response, "cancelRaceInvite");
});
//# sourceMappingURL=raceCallables.js.map