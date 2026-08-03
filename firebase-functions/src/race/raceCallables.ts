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

const jestWebCallableOptions = browserCallableSecurityOptions;

export const raceHintCallableOptions = {
  ...jestWebCallableOptions,
  minInstances: 1,
};

export const raceStartCallableOptions = {
  ...jestWebCallableOptions,
  minInstances: 1,
};

const requireUserId = (request: CallableRequest<unknown>): string => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  return request.auth.uid;
};

const requireRaceUser = async (request: CallableRequest<unknown>): Promise<string> => {
  const userId = requireUserId(request);
  await assertRaceAccess(userId);
  return userId;
};

export const getRaceAccess = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = requireUserId(request);
  const input = validateCallableRequest(RaceAccessRequestSchema, request.data, "getRaceAccess");
  return validateCallableResponse(
    RaceAccessResponseSchema,
    await getRaceAccessForUser(userId, input.locale),
    "getRaceAccess",
  );
});

export const recordRaceAnalytics = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = requireUserId(request);
  const input = validateCallableRequest(RaceAnalyticsEventRequestSchema, request.data, "recordRaceAnalytics");
  const response = await recordRaceAnalyticsForUser(userId, input);
  return validateCallableResponse(RaceAnalyticsEventResponseSchema, response, "recordRaceAnalytics");
});

export const listRaceCategories = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const input = validateCallableRequest(ListRaceCategoriesRequestSchema, request.data, "listRaceCategories");
  const userId = requireUserId(request);
  await assertRaceAccess(userId, input.locale);
  const response = await listRaceCategoriesForLocale(input.locale);
  return validateCallableResponse(ListRaceCategoriesResponseSchema, response, "listRaceCategories");
});

export const startRaceRun = onCall(raceStartCallableOptions, async (request: CallableRequest<unknown>) => {
  const input = validateCallableRequest(StartRaceRunRequestSchema, request.data, "startRaceRun");
  const userId = requireUserId(request);
  await assertRaceAccess(userId, input.locale);
  const response = await startRaceRunForUser(userId, input);
  return validateCallableResponse(RaceRunResponseSchema, response, "startRaceRun");
});

export const submitRaceGuess = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(SubmitRaceGuessRequestSchema, request.data, "submitRaceGuess");
  const response = await submitRaceGuessForUser(userId, input);
  return validateCallableResponse(SubmitRaceGuessResponseSchema, response, "submitRaceGuess");
});

export const requestRaceHint = onCall(raceHintCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = requireUserId(request);
  const input = validateCallableRequest(RequestRaceHintRequestSchema, request.data, "requestRaceHint");
  const response = await requestRaceHintForUser(userId, input, {enforceAccess: true});
  return validateCallableResponse(RequestRaceHintResponseSchema, response, "requestRaceHint");
});

export const skipRaceRiddle = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(SkipRaceRiddleRequestSchema, request.data, "skipRaceRiddle");
  const response = await skipRaceRiddleForUser(userId, input);
  return validateCallableResponse(SkipRaceRiddleResponseSchema, response, "skipRaceRiddle");
});

export const resumeRaceRun = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(RaceRunIdRequestSchema, request.data, "resumeRaceRun");
  const response = await resumeRaceRunForUser(userId, input.runId);
  return validateCallableResponse(RaceRunResponseSchema, response, "resumeRaceRun");
});

export const abandonRaceRun = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(AbandonRaceRunRequestSchema, request.data, "abandonRaceRun");
  const response = await abandonRaceRunForUser(userId, input);
  return validateCallableResponse(AbandonRaceRunResponseSchema, response, "abandonRaceRun");
});

export const publishRaceChallenge = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(PublishRaceChallengeRequestSchema, request.data, "publishRaceChallenge");
  const response = await publishRaceChallengeForUser(userId, input);
  return validateCallableResponse(PublishRaceChallengeResponseSchema, response, "publishRaceChallenge");
});

export const getRaceChallenge = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  await requireRaceUser(request);
  const input = validateCallableRequest(RaceChallengeIdRequestSchema, request.data, "getRaceChallenge");
  const response = await getRaceChallengePreview(input.challengeId);
  return validateCallableResponse(RaceChallengePreviewSchema, response, "getRaceChallenge");
});

export const getRaceOutcome = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(RaceRunIdRequestSchema, request.data, "getRaceOutcome");
  const response = await getRaceOutcomeForUser(userId, input.runId);
  return validateCallableResponse(RaceOutcomeSchema, response, "getRaceOutcome");
});

export const listRaceInbox = onCall(jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  const userId = await requireRaceUser(request);
  const input = validateCallableRequest(ListRaceInboxRequestSchema, request.data, "listRaceInbox");
  const response = await listRaceInboxForUser(userId, input);
  return validateCallableResponse(ListRaceInboxResponseSchema, response, "listRaceInbox");
});
