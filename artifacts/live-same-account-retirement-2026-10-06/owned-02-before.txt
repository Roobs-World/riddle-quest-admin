import {streamLiveRaceChanges} from "./raceLiveStream";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {JoinLiveRaceSchema, UpdateLiveRaceSchema, LiveRaceViewSchema, GetLiveRaceChallengeSchema, LiveRaceChallengeSchema,
  SendLiveRaceChallengeSchema, SendLiveRaceChallengeResponseSchema, ListLiveRaceHistoryRequestSchema, ListLiveRaceHistoryResponseSchema} from "@qwordly/core/race";
import {listLiveRaceHistoryForUser} from "./raceLiveHistory";
import {admin} from "../shared/firebaseAdmin";
import {listLiveRaceChallengesForUser, sendLiveRaceChallengeForUser} from "./raceLiveChallengeNotifications";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {assertRaceAccess} from "./raceRollout";
import {getLiveRaceChallengeForUser} from "./raceLiveInvitation";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "./raceLiveService";

/** Live transport uses the same authenticated regional boundary as recorded races. */
const options = {...browserCallableSecurityOptions, region: ["us-central1", "europe-west1"]};
/** Repeated input and matchmaking use the existing interactive race warm-instance policy. */
const interactiveOptions = {...options, minInstances: 1};
/** Retained results are private, language-bound observations and never settle a match. */
export const listLiveRaceHistory = onCallWithSentry("listLiveRaceHistory", options, async request => {
  /** Strict bounded input carries no account or opponent identifier. */
  const input = validateCallableRequest(ListLiveRaceHistoryRequestSchema, request.data, "listLiveRaceHistory");
  /** Verified caller owns every projected ticket. */
  const userId = owner(request);
  await assertRaceAccess(userId, input.locale);
  return validateCallableResponse(ListLiveRaceHistoryResponseSchema,
    await listLiveRaceHistoryForUser(userId, input), "listLiveRaceHistory");
});
/** No identity supplied by the browser is accepted. */
function owner(request: CallableRequest<unknown>): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  return request.auth.uid;
}
/** Starts an authenticated live PvP search. */
export const joinLiveRace = onCallWithSentry("joinLiveRace", interactiveOptions, async request => {
  /** Provides input behavior. */
  const input = validateCallableRequest(JoinLiveRaceSchema, request.data, "joinLiveRace");
  /** Provides user id behavior. */
  const userId = owner(request);
  await assertRaceAccess(userId, input.locale);
  return validateCallableResponse(LiveRaceViewSchema, await joinLiveRaceForUser(userId, input), "joinLiveRace");
});
/** Reads progress or accepts one idempotent live action. */
export const updateLiveRace = onCallWithSentry("updateLiveRace", interactiveOptions, async (request, response) => {
  /** Provides input behavior. */
  const input = validateCallableRequest(UpdateLiveRaceSchema, request.data, "updateLiveRace");
  /** Provides user id behavior. */
  const userId = owner(request);
  if (request.acceptsStreaming) {
    if (input.action !== "poll" || !response) throw new HttpsError("invalid-argument", "Streaming requires a read-only observation.");
    await assertRaceAccess(userId);
    await streamLiveRaceChanges(admin.firestore(), userId, input.ticketId, response);
    return null;
  }
  return validateCallableResponse(LiveRaceViewSchema,
    await updateLiveRaceForUser(userId, input, {authorize: () => assertRaceAccess(userId)}), "updateLiveRace");
}, {skipJestAccountOperationLease: request => request.acceptsStreaming === true});

/** Validates incoming SDK entry data without reserving the recipient seat. */
export const getLiveRaceChallenge = onCallWithSentry("getLiveRaceChallenge", options, async request => {
  /** Untrusted launch data contains only an opaque invitation handle. */
  const input = validateCallableRequest(GetLiveRaceChallengeSchema, request.data, "getLiveRaceChallenge");
  /** Caller identity comes exclusively from verified authentication. */
  const userId = owner(request);
  await assertRaceAccess(userId);
  return validateCallableResponse(LiveRaceChallengeSchema,
    await getLiveRaceChallengeForUser(userId, input.challengeId), "getLiveRaceChallenge");
});

/** Addresses a creator-owned private lobby and atomically enqueues offline notification work. */
export const sendLiveRaceChallenge = onCallWithSentry("sendLiveRaceChallenge", options, async request => {
  /** Provides input behavior. */
  const input = validateCallableRequest(SendLiveRaceChallengeSchema, request.data, "sendLiveRaceChallenge");
  /** Provides user id behavior. */
  const userId = owner(request);
  await assertRaceAccess(userId);
  return validateCallableResponse(SendLiveRaceChallengeResponseSchema,
    await sendLiveRaceChallengeForUser(admin.firestore(), userId, input), "sendLiveRaceChallenge");
});

/** Lists direct invitations on the initial multiplayer screen without occupying a seat. */
export const listLiveRaceChallenges = onCallWithSentry("listLiveRaceChallenges", options, async request => {
  validateCallableRequest(z.object({}).strict(), request.data, "listLiveRaceChallenges");
  /** Provides user id behavior. */
  const userId = owner(request);
  await assertRaceAccess(userId);
  return validateCallableResponse(z.array(LiveRaceChallengeSchema).max(10),
    await listLiveRaceChallengesForUser(admin.firestore(), userId), "listLiveRaceChallenges");
});
