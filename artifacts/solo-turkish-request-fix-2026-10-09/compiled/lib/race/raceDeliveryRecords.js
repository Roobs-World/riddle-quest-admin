"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRaceSettlementEvent = parseRaceSettlementEvent;
exports.parseRacePerformanceEvent = parseRacePerformanceEvent;
const zod_1 = require("zod");
const https_1 = require("firebase-functions/v2/https");
const race_1 = require("@qwordly/core/race");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const facebookLiveContextBinding_1 = require("./facebookLiveContextBinding");
/** Only opaque single-path IDs can be used to read delivery source/owner documents. */
const Id = zod_1.z.string().min(1).max(160).refine(value => !value.includes("/"));
/** Enqueue/retry clocks cannot contain negative or non-finite storage values. */
const Ms = zod_1.z.number().int().nonnegative();
/** Storage retention is a real Firestore timestamp, rather than user-supplied presentation. */
const Timestamp = zod_1.z.custom(value => value instanceof firebaseAdmin_1.admin.firestore.Timestamp);
/** Legacy delivered flag remains supported while explicit states distinguish processing outcomes. */
const Receipt = zod_1.z.looseObject({ runId: Id, userId: Id, createdAtMs: Ms, expiresAt: Timestamp,
    delivered: zod_1.z.boolean(), deliveryState: zod_1.z.enum(["pending", "delivered", "suppressed", "quarantined"]).optional(),
    deliveryAttempts: zod_1.z.number().int().min(0).max(20).optional(), nextAttemptAtMs: Ms.optional(),
    deliveredAtMs: Ms.optional(), lastFailureAtMs: Ms.optional(), quarantinedAtMs: Ms.optional(), replayedAtMs: Ms.optional(), replayId: Id.optional(),
    quarantined: zod_1.z.boolean().optional(), suppressed: zod_1.z.boolean().optional(),
}).superRefine((receipt, context) => {
    if (receipt.deliveryState !== undefined && receipt.delivered !== (receipt.deliveryState !== "pending") ||
        receipt.quarantined === true && !receipt.delivered || receipt.suppressed === true && !receipt.delivered)
        context.addIssue({ code: "custom", message: "Inconsistent delivery processing state." });
});
/** Creator-facing projection metadata is validated before any identity/reward writes. */
const Settlement = Receipt.safeExtend({ creatorId: Id, challengeId: Id, categoryId: race_1.RaceCategoryIdSchema,
    result: zod_1.z.enum(["win", "loss", "tie"]), adjustedDeltaMs: zod_1.z.number().int() });
/** A Facebook reward retry can retain an already-committed owner projection. */
const Performance = Receipt.safeExtend({ facebookPerformanceRecorded: zod_1.z.literal(true).optional(),
    facebookContext: facebookLiveContextBinding_1.FacebookLiveContextBindingSchema.optional(),
    source: zod_1.z.enum(["facebook_live", "reddit_live"]).optional(), liveTicketId: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(),
    liveMatchId: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).superRefine((receipt, context) => {
    if (receipt.facebookContext !== undefined && receipt.source !== "facebook_live")
        context.addIssue({ code: "custom", message: "Inconsistent Facebook context source." });
    if (receipt.source !== undefined ? !receipt.liveTicketId || !receipt.liveMatchId || receipt.facebookPerformanceRecorded !== undefined :
        receipt.liveTicketId !== undefined || receipt.liveMatchId !== undefined)
        context.addIssue({ code: "custom", message: "Inconsistent live referral source." });
});
/** Rejects corrupt creator receipts with generic answer-free diagnostics. */
function parseRaceSettlementEvent(value, eventId) {
    /** Full supported delivery metadata must match its opaque document identity. */
    const parsed = Settlement.safeParse(value);
    if (!parsed.success || parsed.data.runId !== eventId)
        throw new https_1.HttpsError("data-loss", "Stored race settlement receipt is invalid.");
    return parsed.data;
}
/** Rejects corrupt owner-performance receipts before updating rating evidence. */
function parseRacePerformanceEvent(value, eventId) {
    /** Popular recording replays cannot attribute evidence to another owner. */
    const parsed = Performance.safeParse(value);
    if (!parsed.success || parsed.data.runId !== eventId)
        throw new https_1.HttpsError("data-loss", "Stored race performance receipt is invalid.");
    return parsed.data;
}
//# sourceMappingURL=raceDeliveryRecords.js.map