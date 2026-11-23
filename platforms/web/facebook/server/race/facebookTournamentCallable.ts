import {
  ListFacebookTournamentRequestSchema,
  ListFacebookTournamentResponseSchema,
  RecordFacebookTournamentRunRequestSchema,
  RecordFacebookTournamentRunResponseSchema,
} from "@riddle-quest/core/race";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {isFacebookFeatureEnabled} from "../facebookFeatureFlags";
import {isFacebookFirebaseUid} from "../facebookSecurity";
import {browserCallableSecurityOptions} from "../../../../../firebase-functions/src/shared/callableSecurity";
import {onCallWithSentry} from "../../../../../firebase-functions/src/shared/sentryHandlers";
import {validateCallableRequest, validateCallableResponse} from "../../../../../firebase-functions/src/validation/callableValidation";
import {
  FACEBOOK_TOURNAMENT_SORT_ORDER,
  listFacebookTournamentStandings,
  recordFacebookTournamentRun,
} from "./facebookTournament";

/** Provides require facebook tournament identity behavior. */
const requireFacebookTournamentIdentity = (request: CallableRequest<unknown>): string => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required.");
  if (request.auth.token.provider !== "facebook" || !isFacebookFirebaseUid(request.auth.uid)) {
    throw new HttpsError("permission-denied", "A Facebook player identity is required.");
  }
  if (!isFacebookFeatureEnabled("tournaments")) {
    throw new HttpsError("unavailable", "Facebook tournaments are temporarily unavailable.");
  }
  return request.auth.uid;
};

/** Records an official score while rejecting non-Facebook identities and client-provided score fields. */
export const recordFacebookTournament = onCallWithSentry(
  "recordFacebookTournament",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireFacebookTournamentIdentity(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(
      RecordFacebookTournamentRunRequestSchema,
      request.data,
      "recordFacebookTournament",
    );
    /** Provides result behavior. */
    const result = await recordFacebookTournamentRun(userId, input);
    return validateCallableResponse(
      RecordFacebookTournamentRunResponseSchema,
      {
        tournamentId: result.entry.tournamentId,
        locale: result.entry.locale,
        runId: result.entry.runId,
        adjustedTimeMs: result.entry.adjustedTimeMs,
        completedAtMs: result.entry.completedAtMs,
        improved: result.improved,
        sortOrder: FACEBOOK_TOURNAMENT_SORT_ORDER,
        rewardsEnabled: false,
      },
      "recordFacebookTournament",
    );
  },
);

/** Returns only bounded, identity-free authoritative standings for the active locale window. */
export const listFacebookTournament = onCallWithSentry(
  "listFacebookTournament",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireFacebookTournamentIdentity(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(ListFacebookTournamentRequestSchema, request.data, "listFacebookTournament");
    return validateCallableResponse(
      ListFacebookTournamentResponseSchema,
      await listFacebookTournamentStandings(userId, input.locale),
      "listFacebookTournament",
    );
  },
);
