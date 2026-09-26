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
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
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
import {onCallWithSentry} from "../shared/sentryHandlers";

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

/** Deployment options that keep the latency-sensitive abandon callable warm. */
export const raceAbandonCallableOptions = {
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
  /** Provides r id. */
  const userId = requireUserId(request);
  await assertRaceAccess(userId);
  return userId;
};

/** Returns whether the authenticated player can access multiplayer. */
export const getRaceAccess = onCallWithSentry(
  "getRaceAccess",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(RaceAccessRequestSchema, request.data, "getRaceAccess");
    return validateCallableResponse(
      RaceAccessResponseSchema,
      await getRaceAccessForUser(userId, input.locale),
      "getRaceAccess",
    );
  },
);

/** Records a schema-validated multiplayer analytics event for the player. */
export const recordRaceAnalytics = onCallWithSentry(
  "recordRaceAnalytics",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(RaceAnalyticsEventRequestSchema, request.data, "recordRaceAnalytics");
    /** Provides response behavior. */
    const response = await recordRaceAnalyticsForUser(userId, input);
    return validateCallableResponse(RaceAnalyticsEventResponseSchema, response, "recordRaceAnalytics");
  },
);

/** Lists server-approved race categories for the requested locale. */
export const listRaceCategories = onCallWithSentry(
  "listRaceCategories",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides input behavior. */
    const input = validateCallableRequest(ListRaceCategoriesRequestSchema, request.data, "listRaceCategories");
    /** Provides r id. */
    const userId = requireUserId(request);
    await assertRaceAccess(userId, input.locale);
    /** Provides response behavior. */
    const response = await listRaceCategoriesForLocale(input.locale);
    return validateCallableResponse(ListRaceCategoriesResponseSchema, response, "listRaceCategories");
  },
);

/** Starts or idempotently resumes creation of an authoritative race run. */
export const startRaceRun = onCallWithSentry(
  "startRaceRun",
  raceStartCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides input behavior. */
    const input = validateCallableRequest(StartRaceRunRequestSchema, request.data, "startRaceRun");
    /** Provides r id. */
    const userId = requireUserId(request);
    await assertRaceAccess(userId, input.locale);
    /** Provides response behavior. */
    const response = await startRaceRunForUser(userId, input);
    return validateCallableResponse(RaceRunResponseSchema, response, "startRaceRun");
  },
);

/** Applies a guess to the authenticated player's authoritative active run. */
export const submitRaceGuess = onCallWithSentry(
  "submitRaceGuess",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(SubmitRaceGuessRequestSchema, request.data, "submitRaceGuess");
    /** Provides response behavior. */
    const response = await submitRaceGuessForUser(userId, input);
    return validateCallableResponse(SubmitRaceGuessResponseSchema, response, "submitRaceGuess");
  },
);

/** Reveals a server-selected hint and applies its authoritative penalty. */
export const requestRaceHint = onCallWithSentry(
  "requestRaceHint",
  raceHintCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(RequestRaceHintRequestSchema, request.data, "requestRaceHint");
    /** Provides response behavior. */
    const response = await requestRaceHintForUser(userId, input, {enforceAccess: true});
    return validateCallableResponse(RequestRaceHintResponseSchema, response, "requestRaceHint");
  },
);

/** Skips the active race riddle and applies the authoritative skip penalty. */
export const skipRaceRiddle = onCallWithSentry(
  "skipRaceRiddle",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(SkipRaceRiddleRequestSchema, request.data, "skipRaceRiddle");
    /** Provides response behavior. */
    const response = await skipRaceRiddleForUser(userId, input);
    return validateCallableResponse(SkipRaceRiddleResponseSchema, response, "skipRaceRiddle");
  },
);

/** Restores the authenticated player's current view of an existing run. */
export const resumeRaceRun = onCallWithSentry(
  "resumeRaceRun",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(RaceRunIdRequestSchema, request.data, "resumeRaceRun");
    /** Provides response behavior. */
    const response = input.includeEvaluation
      ? await resumeRaceRunForUser(userId, input.runId, {includeEvaluation: true})
      : await resumeRaceRunForUser(userId, input.runId);
    return validateCallableResponse(RaceRunResponseSchema, response, "resumeRaceRun");
  },
);

/** Abandons the authenticated player's active run without granting a result. */
export const abandonRaceRun = onCallWithSentry(
  "abandonRaceRun",
  raceAbandonCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(AbandonRaceRunRequestSchema, request.data, "abandonRaceRun");
    /** Provides response behavior. */
    const response = await abandonRaceRunForUser(userId, input);
    return validateCallableResponse(AbandonRaceRunResponseSchema, response, "abandonRaceRun");
  },
);

/** Publishes a verified completed creator run as a multiplayer challenge. */
export const publishRaceChallenge = onCallWithSentry(
  "publishRaceChallenge",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(PublishRaceChallengeRequestSchema, request.data, "publishRaceChallenge");
    /** Provides response behavior. */
    const response = await publishRaceChallengeForUser(userId, input);
    return validateCallableResponse(PublishRaceChallengeResponseSchema, response, "publishRaceChallenge");
  },
);

/** Returns the answer-safe public preview of a multiplayer challenge. */
export const getRaceChallenge = onCallWithSentry(
  "getRaceChallenge",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    await requireRaceUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(RaceChallengeIdRequestSchema, request.data, "getRaceChallenge");
    /** Provides response behavior. */
    const response = await getRaceChallengePreview(input.challengeId, input.locale);
    return validateCallableResponse(RaceChallengePreviewSchema, response, "getRaceChallenge");
  },
);

/** Returns the final outcome for a run owned by the authenticated player. */
export const getRaceOutcome = onCallWithSentry(
  "getRaceOutcome",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(RaceRunIdRequestSchema, request.data, "getRaceOutcome");
    /** Provides response behavior. */
    const response = await getRaceOutcomeForUser(userId, input.runId);
    return validateCallableResponse(RaceOutcomeSchema, response, "getRaceOutcome");
  },
);

/** Lists paginated challenge inbox items for the authenticated player. */
export const listRaceInbox = onCallWithSentry(
  "listRaceInbox",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(ListRaceInboxRequestSchema, request.data, "listRaceInbox");
    /** Provides response behavior. */
    const response = await listRaceInboxForUser(userId, input);
    return validateCallableResponse(ListRaceInboxResponseSchema, response, "listRaceInbox");
  },
);
