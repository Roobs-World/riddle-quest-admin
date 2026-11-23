import {BlockSocialRivalRequestSchema, ReportSocialRivalRequestSchema} from "@riddle-quest/core/race";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest} from "../validation/callableValidation";
import {blockKnownRival, reportKnownRival} from "./socialSafety";

/** Provides require user id behavior. */
const requireUserId = (request: CallableRequest<unknown>): string => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required.");
  return request.auth.uid;
};

/** Immediately blocks one established rival for the authenticated player. */
export const blockRival = onCallWithSentry(
  "blockRival",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(BlockSocialRivalRequestSchema, request.data, "blockRival");
    return blockKnownRival(userId, "targetUserId" in input ? input.targetUserId : input);
  },
);

/** Queues one bounded, categorized report for an established rival. */
export const reportRival = onCallWithSentry(
  "reportRival",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requireUserId(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(ReportSocialRivalRequestSchema, request.data, "reportRival");
    return reportKnownRival(userId, input);
  },
);
