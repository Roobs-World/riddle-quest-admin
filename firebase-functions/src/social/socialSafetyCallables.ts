import {z} from "zod";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest} from "../validation/callableValidation";
import {SOCIAL_REPORT_CATEGORIES, blockKnownRival, reportKnownRival} from "./socialSafety";

/** Validates the target user id data shape. */
const TargetUserIdSchema = z.string().trim().min(1).max(128);
/** Validates the block known rival request data shape. */
const BlockKnownRivalRequestSchema = z.object({targetUserId: TargetUserIdSchema}).strict();
/** Validates the report known rival request data shape. */
const ReportKnownRivalRequestSchema = z
  .object({
    targetUserId: TargetUserIdSchema,
    category: z.enum(SOCIAL_REPORT_CATEGORIES),
    requestId: z.string().regex(/^[A-Za-z0-9_-]{8,160}$/),
  })
  .strict();

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
    const input = validateCallableRequest(BlockKnownRivalRequestSchema, request.data, "blockRival");
    return blockKnownRival(userId, input.targetUserId);
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
    const input = validateCallableRequest(ReportKnownRivalRequestSchema, request.data, "reportRival");
    return reportKnownRival(userId, input);
  },
);
