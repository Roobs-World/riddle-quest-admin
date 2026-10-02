import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {JoinLiveRaceSchema, UpdateLiveRaceSchema, LiveRaceViewSchema} from "@qwordly/core/race";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {assertRaceAccess} from "./raceRollout";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "./raceLiveService";

/** Live transport uses the same authenticated regional boundary as recorded races. */
const options = {...browserCallableSecurityOptions, region: ["us-central1", "europe-west1"]};
/** No identity supplied by the browser is accepted. */
function owner(request: CallableRequest<unknown>): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  return request.auth.uid;
}
/** Starts an authenticated live PvP search. */
export const joinLiveRace = onCallWithSentry("joinLiveRace", options, async request => {
  /** Provides input behavior. */
  const input = validateCallableRequest(JoinLiveRaceSchema, request.data, "joinLiveRace");
  /** Provides user id behavior. */
  const userId = owner(request);
  await assertRaceAccess(userId, input.locale);
  return validateCallableResponse(LiveRaceViewSchema, await joinLiveRaceForUser(userId, input), "joinLiveRace");
});
/** Reads progress or accepts one idempotent live action. */
export const updateLiveRace = onCallWithSentry("updateLiveRace", options, async request => {
  /** Provides input behavior. */
  const input = validateCallableRequest(UpdateLiveRaceSchema, request.data, "updateLiveRace");
  /** Provides user id behavior. */
  const userId = owner(request);
  await assertRaceAccess(userId);
  return validateCallableResponse(LiveRaceViewSchema, await updateLiveRaceForUser(userId, input), "updateLiveRace");
});
