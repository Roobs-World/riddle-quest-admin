import {
  AbandonRaceRunRequestSchema,
  AbandonRaceRunResponseSchema,
  ListRaceCategoriesRequestSchema,
  ListRaceCategoriesResponseSchema,
  ListRaceInboxRequestSchema,
  ListRaceInboxResponseSchema,
  PublishRaceChallengeRequestSchema,
  PublishRaceChallengeResponseSchema,
  RaceAccessRequestSchema,
  RaceAccessResponseSchema,
  RaceAnalyticsEventRequestSchema,
  RaceAnalyticsEventResponseSchema,
  RaceChallengeIdRequestSchema,
  RaceChallengePreviewSchema,
  RaceOutcomeSchema,
  RaceRunIdRequestSchema,
  RaceRunResponseSchema,
  RequestRaceHintRequestSchema,
  RequestRaceHintResponseSchema,
  SkipRaceRiddleRequestSchema,
  SkipRaceRiddleResponseSchema,
  StartRaceRunRequestSchema,
  SubmitRaceGuessRequestSchema,
  SubmitRaceGuessResponseSchema,
} from "@qwordly/core/race";
import {HttpsError, onCall, type CallableRequest} from "firebase-functions/v2/https";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {
  abandonRaceRunForUser,
  getRaceChallengePreview,
  getRaceOutcomeForUser,
  listRaceCategoriesForLocale,
  listRaceInboxForUser,
  publishRaceChallengeForUser,
  requestRaceHintForUser,
  resumeRaceRunForUser,
  skipRaceRiddleForUser,
  startRaceRunForUser,
  submitRaceGuessForUser,
} from "./raceService";
import {assertRaceAccess, getRaceAccessForUser, recordRaceAnalyticsForUser} from "./raceRollout";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";

/** Provides jest web callable options behavior. */
const jestWebCallableOptions = browserCallableSecurityOptions;

/** Deployment options that keep the latency-sensitive hint callable warm. */
export const raceHintCallableOptions = {
  ...jestWebCallableOptions,
  minInstances: 1,
};

/** Deployment options that keep the countdown-critical start callable warm. */
export const raceStartCallableOptions = {
  ...jestWebCallableOptions,
  minInstances: 1,
};

/** Provides require user id behavior. */
const requireUserId = (request: CallableRequest<unknown>): string => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  return request.auth.uid;
};

/** Provides require race user behavior. */
const requireRaceUser = async (request: CallableRequest<unknown>): Promise<string> => {
  const userId = requireUserId(request);
  await assertRaceAccess(userId);
  return userId;
};

/** Returns whether the authenticated player can access multiplayer. */
export const getRaceAccess = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = requireUserId(request);
  const input = validateCallableRequest(RaceAccessRequestSchema, request.data, "getRaceAccess");
  return validateCallableResponse(
    RaceAccessResponseSchema,
    await getRaceAccessForUser(userId, input.locale),
    "getRaceAccess",
  );
});

/** Records a schema-validated multiplayer analytics event for the player. */
export const recordRaceAnalytics = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = requireUserId(request);
  const input = validateCallableRequest(RaceAnalyticsEventRequestSchema, request.data, "recordRaceAnalytics");
  const response = await recordRaceAnalyticsForUser(userId, input);
  return validateCallableResponse(RaceAnalyticsEventResponseSchema, response, "recordRaceAnalytics");
});

/** Lists server-approved race categories for the requested locale. */
export const listRaceCategories = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const input = validateCallableRequest(ListRaceCategoriesRequestSchema, request.data, "listRaceCategories");
  const userId = requireUserId(request);
  await assertRaceAccess(userId, input.locale);
  const response = await listRaceCategoriesForLocale(input.locale);
  return validateCallableResponse(ListRaceCategoriesResponseSchema, response, "listRaceCategories");
});

/** Starts or idempotently resumes creation of an authoritative race run. */
export const startRaceRun = onCall(raceStartCallableOptions, async (request: CallableRequest<unknown>) => {
  const input = validateCallableRequest(StartRaceRunRequestSchema, request.data, "startRaceRun");
  const userId = requireUserId(request);
  await assertRaceAccess(userId, input.locale);
  const response = await startRaceRunForUser(userId, input);
  return validateCallableResponse(RaceRunResponseSchema, response, "startRaceRun");
});

/** Applies a guess to the authenticated player's authoritative active run. */
export const submitRaceGuess = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(SubmitRaceGuessRequestSchema, request.data, "submitRaceGuess");
  const response = await submitRaceGuessForUser(userId, input);
  return validateCallableResponse(SubmitRaceGuessResponseSchema, response, "submitRaceGuess");
});

/** Reveals a server-selected hint and applies its authoritative penalty. */
export const requestRaceHint = onCall(raceHintCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = requireUserId(request);
  const input = validateCallableRequest(RequestRaceHintRequestSchema, request.data, "requestRaceHint");
  const response = await requestRaceHintForUser(userId, input, {enforceAccess: true});
  return validateCallableResponse(RequestRaceHintResponseSchema, response, "requestRaceHint");
});

/** Skips the active race riddle and applies the authoritative skip penalty. */
export const skipRaceRiddle = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(SkipRaceRiddleRequestSchema, request.data, "skipRaceRiddle");
  const response = await skipRaceRiddleForUser(userId, input);
  return validateCallableResponse(SkipRaceRiddleResponseSchema, response, "skipRaceRiddle");
});

/** Restores the authenticated player's current view of an existing run. */
export const resumeRaceRun = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(RaceRunIdRequestSchema, request.data, "resumeRaceRun");
  const response = await resumeRaceRunForUser(userId, input.runId);
  return validateCallableResponse(RaceRunResponseSchema, response, "resumeRaceRun");
});

/** Abandons the authenticated player's active run without granting a result. */
export const abandonRaceRun = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(AbandonRaceRunRequestSchema, request.data, "abandonRaceRun");
  const response = await abandonRaceRunForUser(userId, input);
  return validateCallableResponse(AbandonRaceRunResponseSchema, response, "abandonRaceRun");
});

/** Publishes a verified completed creator run as a multiplayer challenge. */
export const publishRaceChallenge = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(PublishRaceChallengeRequestSchema, request.data, "publishRaceChallenge");
  const response = await publishRaceChallengeForUser(userId, input);
  return validateCallableResponse(PublishRaceChallengeResponseSchema, response, "publishRaceChallenge");
});

/** Returns the answer-safe public preview of a multiplayer challenge. */
export const getRaceChallenge = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  await requireRaceUser(request);
  const input = validateCallableRequest(RaceChallengeIdRequestSchema, request.data, "getRaceChallenge");
  const response = await getRaceChallengePreview(input.challengeId);
  return validateCallableResponse(RaceChallengePreviewSchema, response, "getRaceChallenge");
});

/** Returns the final outcome for a run owned by the authenticated player. */
export const getRaceOutcome = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(RaceRunIdRequestSchema, request.data, "getRaceOutcome");
  const response = await getRaceOutcomeForUser(userId, input.runId);
  return validateCallableResponse(RaceOutcomeSchema, response, "getRaceOutcome");
});

/** Lists paginated challenge inbox items for the authenticated player. */
export const listRaceInbox = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(ListRaceInboxRequestSchema, request.data, "listRaceInbox");
  const response = await listRaceInboxForUser(userId, input);
  return validateCallableResponse(ListRaceInboxResponseSchema, response, "listRaceInbox");
});
