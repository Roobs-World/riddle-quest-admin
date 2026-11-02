import {RaceEntryResponseSchema, CancelRaceInviteRequestSchema} from "@riddle-quest/core/race";
import {RaceEntryRequestSchema} from "@riddle-quest/core/race";
import {getRaceEntryForUser, cancelRaceInviteForUser} from "./raceInvitation";
import {
  AbandonRaceRunRequestSchema,
  AbandonRaceRunResponseSchema,
  ListRaceCategoriesRequestSchema,
  ListRaceCategoriesResponseSchema,
  ListRaceInboxRequestSchema,
  ListRaceInboxResponseSchema,
  PublishRaceChallengeRequestSchema,
  PublishRaceChallengeResponseSchema,
  ReserveRaceInviteRequestSchema,
  ReserveRaceInviteResponseSchema,
  RaceAccessRequestSchema,
  RaceAccessResponseSchema,
  RaceAnalyticsEventRequestSchema,
  RaceAnalyticsEventResponseSchema,
  RaceChallengeIdRequestSchema,
  RaceChallengePreviewSchema,
  RaceOutcomeSchema,
  RaceRunIdRequestSchema,
  RaceRunResponseSchema,
  RaceMatchRequestSchema,
  RaceMatchResponseSchema,
  RequestRaceHintRequestSchema,
  RequestRaceHintResponseSchema,
  SkipRaceRiddleRequestSchema,
  SkipRaceRiddleResponseSchema,
  StartRaceRunRequestSchema,
  ReadyRaceRunRequestSchema,
  SubmitRaceGuessRequestSchema,
  SubmitRaceGuessResponseSchema,
} from "@riddle-quest/core/race";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {
  abandonRaceRunForUser,
  getRaceChallengeForUser,
  getRaceOutcomeForUser,
  listRaceCategoriesForLocale,
  listRaceInboxForUser,
  publishRaceChallengeForUser,
  reserveRaceInviteForUser,
  requestRaceHintForUser,
  resumeRaceRunForUser,
  skipRaceRiddleForUser,
  startRaceRunForUser,
  readyRaceRunForUser,
  submitRaceGuessForUser,
} from "./raceService";
import {assertRaceAccess, getRaceAccessForUser, recordRaceAnalyticsForUser} from "./raceRollout";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {findRecordedRaceMatch} from "./raceMatchmaking";
import {onCallWithSentry} from "../shared/sentryHandlers";

/** Keeps browser multiplayer beside eur3 while retaining existing regional clients. */
const jestWebCallableOptions = {...browserCallableSecurityOptions, region: ["us-central1", "europe-west1"]};

/** Interactive race requests scale to zero between use. */
export const raceInteractiveCallableOptions = {
  ...jestWebCallableOptions,
  minInstances: 0,
};

/** Discovery and analytics share the regional request-only capacity policy. */
export const raceDiscoveryCallableOptions = {
  ...raceInteractiveCallableOptions,
};

/** Hint requests share the request-only capacity policy. */
export const raceHintCallableOptions = {
  ...jestWebCallableOptions,
  minInstances: 0,
};

/** Race starts share the request-only capacity policy. */
export const raceStartCallableOptions = {
  ...jestWebCallableOptions,
  minInstances: 0,
};

/** Abandon requests share the request-only capacity policy. */
export const raceAbandonCallableOptions = {
  ...jestWebCallableOptions,
  minInstances: 0,
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

/** Uses authenticated identity to select recorded opponents inside the caller's provider scope. */
export const findRaceMatch = onCallWithSentry("findRaceMatch", raceDiscoveryCallableOptions, async (request: CallableRequest<unknown>) => {
  /** Provides input behavior. */
  const input = validateCallableRequest(RaceMatchRequestSchema, request.data, "findRaceMatch");
  /** Provides user id behavior. */
  const userId = requireUserId(request);
  await assertRaceAccess(userId, input.locale);
  return validateCallableResponse(RaceMatchResponseSchema, await findRecordedRaceMatch(userId, input), "findRaceMatch");
});

/** Records a schema-validated multiplayer analytics event for the player. */
export const recordRaceAnalytics = onCallWithSentry(
  "recordRaceAnalytics",
  raceDiscoveryCallableOptions,
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
  raceInteractiveCallableOptions,
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

/** Schedules a prepared run after content delivery, without resetting an existing scheduled start. */
export const readyRaceRun = onCallWithSentry("readyRaceRun", raceStartCallableOptions, async (request: CallableRequest<unknown>) => {
  /** Provides input behavior. */
  const input = validateCallableRequest(ReadyRaceRunRequestSchema, request.data, "readyRaceRun");
  /** Provides user id behavior. */
  const userId = requireUserId(request);
  /** Provides run behavior. */
  const run = await resumeRaceRunForUser(userId, input.runId);
  await assertRaceAccess(userId, run.run.locale);
  return validateCallableResponse(RaceRunResponseSchema, await readyRaceRunForUser(userId, input), "readyRaceRun");
});

/** Applies a guess to the authenticated player's authoritative active run. */
export const submitRaceGuess = onCallWithSentry(
  "submitRaceGuess",
  raceInteractiveCallableOptions,
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
  raceInteractiveCallableOptions,
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
  raceInteractiveCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(RaceRunIdRequestSchema, request.data, "resumeRaceRun");
    /** Provides response behavior. */
    const response = input.includeEvaluation || input.includeGuessHistory
      ? await resumeRaceRunForUser(userId, input.runId, {includeEvaluation: input.includeEvaluation, includeGuessHistory: input.includeGuessHistory})
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

/** Creates the server-owned two-seat lobby carried by a Jest referral link. */
export const reserveRaceInvite = onCallWithSentry(
  "reserveRaceInvite",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Authenticated internal user issuing the invite. */
    const userId = await requireRaceUser(request);
    /** Validated invite reservation request. */
    const input = validateCallableRequest(ReserveRaceInviteRequestSchema, request.data, "reserveRaceInvite");
    /** Newly reserved or idempotently replayed lobby response. */
    const response = await reserveRaceInviteForUser(userId, input);
    return validateCallableResponse(ReserveRaceInviteResponseSchema, response, "reserveRaceInvite");
  },
);

/** Returns the answer-safe public preview of a multiplayer challenge. */
export const getRaceChallenge = onCallWithSentry(
  "getRaceChallenge",
  jestWebCallableOptions,
  async (request: CallableRequest<unknown>) => {
    /** Authenticated internal user opening the challenge. */
    const userId = await requireRaceUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(RaceChallengeIdRequestSchema, request.data, "getRaceChallenge");
    /** User-bound admission validates original content before any dependent private claim. */
    const response = await getRaceChallengeForUser(userId, input.challengeId, input.locale);
    return validateCallableResponse(RaceChallengePreviewSchema, response, "getRaceChallenge");
  },
);

/** Returns the final outcome for a run owned by the authenticated player. */
export const getRaceOutcome = onCallWithSentry(
  "getRaceOutcome",
  raceInteractiveCallableOptions,
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
  raceInteractiveCallableOptions,
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

/** Typed challenge lifecycle without provider-specific client interpretation. */
export const getRaceEntry = onCallWithSentry("getRaceEntry", jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  /** Authenticated player opening or recovering an invitation. */
  const userId = await requireRaceUser(request);
  /** Answer-free direct-link intent. */
  const input = validateCallableRequest(RaceEntryRequestSchema, request.data, "getRaceEntry");
  /** Independently validated claim and publication facts. */
  const response = await getRaceEntryForUser(userId, input.challengeId, input.locale, {includeViewerRole: input.includeViewerRole, includeExistingAttempt: input.includeExistingAttempt});
  return validateCallableResponse(RaceEntryResponseSchema, response, "getRaceEntry");
});
/** Creator-only cancellation never acts on reusable public challenges. */
export const cancelRaceInvite = onCallWithSentry("cancelRaceInvite", jestWebCallableOptions, async (request: CallableRequest<unknown>) => {
  /** Authenticated invitation owner. */
  const userId = await requireRaceUser(request);
  /** Idempotent cancellation intent. */
  const input = validateCallableRequest(CancelRaceInviteRequestSchema, request.data, "cancelRaceInvite");
  /** Terminal lifecycle view. */
  const response = await cancelRaceInviteForUser(userId, input);
  return validateCallableResponse(RaceEntryResponseSchema, response, "cancelRaceInvite");
});
