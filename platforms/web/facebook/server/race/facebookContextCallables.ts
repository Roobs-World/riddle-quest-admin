import {z} from "zod";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {SUPPORTED_LOCALES} from "../../../../../src/core/validation/index.js";
import {
  ListFacebookContextBoardRequestSchema,
  ListFacebookContextBoardResponseSchema,
  RecordFacebookContextRunRequestSchema,
  RecordFacebookContextRunResponseSchema,
} from "../../../../../src/core/race/index.js";
import {browserCallableSecurityOptions} from "../../../../../firebase-functions/src/shared/callableSecurity";
import {onCallWithSentry} from "../../../../../firebase-functions/src/shared/sentryHandlers";
import {validateCallableRequest, validateCallableResponse} from "../../../../../firebase-functions/src/validation/callableValidation";
import {isFacebookFeatureEnabled} from "../facebookFeatureFlags";
import {isFacebookFirebaseUid} from "../facebookSecurity";
import {joinFacebookContextCompetition, leaveFacebookContextCompetition} from "./facebookContextService";
import {
  FACEBOOK_CONTEXT_BOARD_SORT_ORDER,
  listFacebookContextBoard as listFacebookContextBoardService,
  recordFacebookContextBoardRun,
} from "./facebookContextBoard";

/** Renders the context id interface. */
const ContextId = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9._:-]+$/);
/** Validates the join data shape. */
const JoinSchema = z
  .object({
    contextId: ContextId,
    contextType: z.enum(["THREAD", "GROUP"]),
    locale: z.enum(SUPPORTED_LOCALES),
  })
  .strict();
/** Validates the leave data shape. */
const LeaveSchema = z.object({contextId: ContextId}).strict();

/** Provides require facebook user behavior. */
const requireFacebookUser = (request: CallableRequest<unknown>): string => {
  if (!request.auth || request.auth.token.provider !== "facebook" || !isFacebookFirebaseUid(request.auth.uid)) {
    throw new HttpsError("unauthenticated", "Facebook authentication is required.");
  }
  if (!isFacebookFeatureEnabled("matchmaking")) {
    throw new HttpsError("unavailable", "Facebook matchmaking is temporarily unavailable.");
  }
  return request.auth.uid;
};

/** Joins the authenticated player to their current SDK context competition. */
export const joinFacebookContext = onCallWithSentry(
  "joinFacebookContext",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireFacebookUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(JoinSchema, request.data, "joinFacebookContext");
    return joinFacebookContextCompetition({...input, userId});
  },
);

/** Leaves the authenticated player's current context and elects the next host. */
export const leaveFacebookContext = onCallWithSentry(
  "leaveFacebookContext",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireFacebookUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(LeaveSchema, request.data, "leaveFacebookContext");
    return leaveFacebookContextCompetition({...input, userId});
  },
);

/** Records a completed authoritative run on the authenticated player's active context board. */
export const recordFacebookContextRun = onCallWithSentry(
  "recordFacebookContextRun",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireFacebookUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(
      RecordFacebookContextRunRequestSchema,
      request.data,
      "recordFacebookContextRun",
    );
    /** Provides result behavior. */
    const result = await recordFacebookContextBoardRun(userId, input);
    return validateCallableResponse(
      RecordFacebookContextRunResponseSchema,
      {
        locale: result.entry.locale,
        runId: result.entry.runId,
        adjustedTimeMs: result.entry.adjustedTimeMs,
        completedAtMs: result.entry.completedAtMs,
        improved: result.improved,
        sortOrder: FACEBOOK_CONTEXT_BOARD_SORT_ORDER,
        rewardsEnabled: false,
      },
      "recordFacebookContextRun",
    );
  },
);

/** Lists the active player's current context board without provider or game-owned identities. */
export const listFacebookContextBoard = onCallWithSentry(
  "listFacebookContextBoard",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireFacebookUser(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(
      ListFacebookContextBoardRequestSchema,
      request.data,
      "listFacebookContextBoard",
    );
    return validateCallableResponse(
      ListFacebookContextBoardResponseSchema,
      await listFacebookContextBoardService(userId, input),
      "listFacebookContextBoard",
    );
  },
);
