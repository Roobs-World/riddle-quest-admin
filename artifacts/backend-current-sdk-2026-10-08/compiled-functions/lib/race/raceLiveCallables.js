"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listLiveRaceChallenges = exports.sendLiveRaceChallenge = exports.getLiveRaceChallenge = exports.updateLiveRace = exports.retireLiveRaceJoin = exports.joinLiveRace = exports.listLiveRaceHistory = void 0;
const raceLiveStream_1 = require("./raceLiveStream");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const race_1 = require("@qwordly/core/race");
const race_2 = require("@qwordly/core/race");
const raceLiveRetirement_1 = require("./raceLiveRetirement");
const raceLiveHistory_1 = require("./raceLiveHistory");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const raceLiveChallengeNotifications_1 = require("./raceLiveChallengeNotifications");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const callableValidation_1 = require("../validation/callableValidation");
const raceRollout_1 = require("./raceRollout");
const raceLiveInvitation_1 = require("./raceLiveInvitation");
const raceLiveService_1 = require("./raceLiveService");
/** Live transport uses the same authenticated regional boundary as recorded races. */
const options = { ...callableSecurity_1.browserCallableSecurityOptions, region: ["us-central1", "europe-west1"] };
/** Repeated input and matchmaking use the existing interactive race warm-instance policy. */
const interactiveOptions = { ...options, minInstances: 1 };
/** Retained results are private, language-bound observations and never settle a match. */
exports.listLiveRaceHistory = (0, sentryHandlers_1.onCallWithSentry)("listLiveRaceHistory", options, async (request) => {
    /** Strict bounded input carries no account or opponent identifier. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.ListLiveRaceHistoryRequestSchema, request.data, "listLiveRaceHistory");
    /** Verified caller owns every projected ticket. */
    const userId = owner(request);
    await (0, raceRollout_1.assertRaceAccess)(userId, input.locale);
    return (0, callableValidation_1.validateCallableResponse)(race_1.ListLiveRaceHistoryResponseSchema, await (0, raceLiveHistory_1.listLiveRaceHistoryForUser)(userId, input), "listLiveRaceHistory");
});
/** No identity supplied by the browser is accepted. */
function owner(request) {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    return request.auth.uid;
}
/** Starts an authenticated live PvP search. */
exports.joinLiveRace = (0, sentryHandlers_1.onCallWithSentry)("joinLiveRace", interactiveOptions, async (request) => {
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.JoinLiveRaceSchema, request.data, "joinLiveRace");
    /** Provides user id behavior. */
    const userId = owner(request);
    await (0, raceRollout_1.assertRaceAccess)(userId, input.locale);
    return (0, callableValidation_1.validateCallableResponse)(race_1.LiveRaceViewSchema, await (0, raceLiveService_1.joinLiveRaceForUser)(userId, input), "joinLiveRace");
});
/** Background cleanup owns a join intent, never the latest account ticket selected by the browser. */
exports.retireLiveRaceJoin = (0, sentryHandlers_1.onCallWithSentry)("retireLiveRaceJoin", interactiveOptions, async (request) => {
    /** Strict input contains only the original join's stable request identity. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_2.RetireLiveRaceJoinSchema, request.data, "retireLiveRaceJoin");
    /** Verified authentication is the sole account authority. */
    const userId = owner(request);
    return (0, callableValidation_1.validateCallableResponse)(race_2.RetireLiveRaceJoinResponseSchema, await (0, raceLiveRetirement_1.retireLiveRaceJoinForUser)(userId, input, { authorize: () => (0, raceRollout_1.assertRaceAccess)(userId) }), "retireLiveRaceJoin");
});
/** Reads progress or accepts one idempotent live action. */
exports.updateLiveRace = (0, sentryHandlers_1.onCallWithSentry)("updateLiveRace", interactiveOptions, async (request, response) => {
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.UpdateLiveRaceSchema, request.data, "updateLiveRace");
    /** Provides user id behavior. */
    const userId = owner(request);
    if (request.acceptsStreaming) {
        if (input.action !== "poll" || !response)
            throw new https_1.HttpsError("invalid-argument", "Streaming requires a read-only observation.");
        await (0, raceRollout_1.assertRaceAccess)(userId);
        await (0, raceLiveStream_1.streamLiveRaceChanges)(firebaseAdmin_1.admin.firestore(), userId, input.ticketId, response);
        return null;
    }
    return (0, callableValidation_1.validateCallableResponse)(race_1.LiveRaceViewSchema, await (0, raceLiveService_1.updateLiveRaceForUser)(userId, input, { authorize: () => (0, raceRollout_1.assertRaceAccess)(userId) }), "updateLiveRace");
}, { skipJestAccountOperationLease: request => request.acceptsStreaming === true });
/** Validates incoming SDK entry data without reserving the recipient seat. */
exports.getLiveRaceChallenge = (0, sentryHandlers_1.onCallWithSentry)("getLiveRaceChallenge", options, async (request) => {
    /** Untrusted launch data contains only an opaque invitation handle. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.GetLiveRaceChallengeSchema, request.data, "getLiveRaceChallenge");
    /** Caller identity comes exclusively from verified authentication. */
    const userId = owner(request);
    await (0, raceRollout_1.assertRaceAccess)(userId);
    return (0, callableValidation_1.validateCallableResponse)(race_1.LiveRaceChallengeSchema, await (0, raceLiveInvitation_1.getLiveRaceChallengeForUser)(userId, input.challengeId), "getLiveRaceChallenge");
});
/** Addresses a creator-owned private lobby and atomically enqueues offline notification work. */
exports.sendLiveRaceChallenge = (0, sentryHandlers_1.onCallWithSentry)("sendLiveRaceChallenge", options, async (request) => {
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(race_1.SendLiveRaceChallengeSchema, request.data, "sendLiveRaceChallenge");
    /** Provides user id behavior. */
    const userId = owner(request);
    await (0, raceRollout_1.assertRaceAccess)(userId);
    return (0, callableValidation_1.validateCallableResponse)(race_1.SendLiveRaceChallengeResponseSchema, await (0, raceLiveChallengeNotifications_1.sendLiveRaceChallengeForUser)(firebaseAdmin_1.admin.firestore(), userId, input), "sendLiveRaceChallenge");
});
/** Lists direct invitations on the initial multiplayer screen without occupying a seat. */
exports.listLiveRaceChallenges = (0, sentryHandlers_1.onCallWithSentry)("listLiveRaceChallenges", options, async (request) => {
    (0, callableValidation_1.validateCallableRequest)(zod_1.z.object({}).strict(), request.data, "listLiveRaceChallenges");
    /** Provides user id behavior. */
    const userId = owner(request);
    await (0, raceRollout_1.assertRaceAccess)(userId);
    return (0, callableValidation_1.validateCallableResponse)(zod_1.z.array(race_1.LiveRaceChallengeSchema).max(10), await (0, raceLiveChallengeNotifications_1.listLiveRaceChallengesForUser)(firebaseAdmin_1.admin.firestore(), userId), "listLiveRaceChallenges");
});
//# sourceMappingURL=raceLiveCallables.js.map