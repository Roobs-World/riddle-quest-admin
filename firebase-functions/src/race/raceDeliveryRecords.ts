import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import {RaceCategoryIdSchema} from "@riddle-quest/core/race";
import {admin} from "../shared/firebaseAdmin";
import {FacebookLiveContextBindingSchema} from "./facebookLiveContextBinding";

/** Only opaque single-path IDs can be used to read delivery source/owner documents. */
const Id = z.string().min(1).max(160).refine(value => !value.includes("/"));
/** Enqueue/retry clocks cannot contain negative or non-finite storage values. */
const Ms = z.number().int().nonnegative();
/** Storage retention is a real Firestore timestamp, rather than user-supplied presentation. */
const Timestamp = z.custom<FirebaseFirestore.Timestamp>(value => value instanceof admin.firestore.Timestamp);
/** Legacy delivered flag remains supported while explicit states distinguish processing outcomes. */
const Receipt = z.looseObject({runId: Id, userId: Id, createdAtMs: Ms, expiresAt: Timestamp,
  delivered: z.boolean(), deliveryState: z.enum(["pending", "delivered", "suppressed", "quarantined"]).optional(),
  deliveryAttempts: z.number().int().min(0).max(20).optional(), nextAttemptAtMs: Ms.optional(),
  deliveredAtMs: Ms.optional(), lastFailureAtMs: Ms.optional(), quarantinedAtMs: Ms.optional(), replayedAtMs: Ms.optional(), replayId: Id.optional(),
  quarantined: z.boolean().optional(), suppressed: z.boolean().optional(),
}).superRefine((receipt, context) => {
  if (receipt.deliveryState !== undefined && receipt.delivered !== (receipt.deliveryState !== "pending") ||
    receipt.quarantined === true && !receipt.delivered || receipt.suppressed === true && !receipt.delivered)
    context.addIssue({code: "custom", message: "Inconsistent delivery processing state."});
});
/** Creator-facing projection metadata is validated before any identity/reward writes. */
const Settlement = Receipt.safeExtend({creatorId: Id, challengeId: Id, categoryId: RaceCategoryIdSchema,
  result: z.enum(["win", "loss", "tie"]), adjustedDeltaMs: z.number().int()});
/** A Facebook reward retry can retain an already-committed owner projection. */
const Performance = Receipt.safeExtend({facebookPerformanceRecorded: z.literal(true).optional(),
  facebookContext: FacebookLiveContextBindingSchema.optional(),
  source: z.enum(["facebook_live", "reddit_live"]).optional(), liveTicketId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  liveMatchId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).superRefine((receipt, context) => {
  if (receipt.facebookContext !== undefined && receipt.source !== "facebook_live")
    context.addIssue({code: "custom", message: "Inconsistent Facebook context source."});
  if (receipt.source !== undefined ? !receipt.liveTicketId || !receipt.liveMatchId || receipt.facebookPerformanceRecorded !== undefined :
    receipt.liveTicketId !== undefined || receipt.liveMatchId !== undefined)
    context.addIssue({code: "custom", message: "Inconsistent live referral source."});
});

/** Rejects corrupt creator receipts with generic answer-free diagnostics. */
export function parseRaceSettlementEvent(value: unknown, eventId: string) {
  /** Full supported delivery metadata must match its opaque document identity. */
  const parsed = Settlement.safeParse(value);
  if (!parsed.success || parsed.data.runId !== eventId) throw new HttpsError("data-loss", "Stored race settlement receipt is invalid.");
  return parsed.data;
}

/** Rejects corrupt owner-performance receipts before updating rating evidence. */
export function parseRacePerformanceEvent(value: unknown, eventId: string) {
  /** Popular recording replays cannot attribute evidence to another owner. */
  const parsed = Performance.safeParse(value);
  if (!parsed.success || parsed.data.runId !== eventId) throw new HttpsError("data-loss", "Stored race performance receipt is invalid.");
  return parsed.data;
}
