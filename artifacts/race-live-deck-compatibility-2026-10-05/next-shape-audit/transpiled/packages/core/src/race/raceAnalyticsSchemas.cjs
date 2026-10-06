"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaceAnalyticsEventResponseSchema = exports.RaceAnalyticsEventRequestSchema = exports.RaceAnalyticsEventNameSchema = exports.RACE_ANALYTICS_FIELDS = void 0;
const zod_1 = require("zod");
/** Validates the race analytics request id data shape. */
const RaceAnalyticsRequestIdSchema = zod_1.z.string().trim().min(8).max(160);
/** Allowlisted parameter names for each multiplayer analytics event. */
exports.RACE_ANALYTICS_FIELDS = {
    race_mode_viewed: [],
    race_category_selected: ["categoryId"],
    race_started: ["kind"],
    race_hint_used: ["penaltyMs"],
    race_skip_used: ["penaltyMs"],
    race_completed: ["result", "correctCount", "hintPenaltyMs", "skipPenaltyMs", "adjustedFinishMs"],
    race_challenge_published: ["categoryId"],
    race_link_entered: [],
    race_attempt_started: ["categoryId"],
    race_attempt_completed: ["result", "adjustedFinishMs"],
    race_result_viewed: ["result"],
    race_share_dialog_opened: ["categoryId"],
    race_counter_challenge_started: ["categoryId"],
    race_inbox_viewed: ["resultCount"],
    race_rematch_started: ["categoryId", "result"],
};
/** Schema for a supported multiplayer analytics event name. */
exports.RaceAnalyticsEventNameSchema = zod_1.z.enum(Object.keys(exports.RACE_ANALYTICS_FIELDS));
/** Validates the race analytics params data shape. */
const RaceAnalyticsParamsSchema = zod_1.z
    .record(zod_1.z.string().min(1).max(80), zod_1.z.union([zod_1.z.string().max(80), zod_1.z.number().finite(), zod_1.z.boolean()]))
    .refine((params) => Object.keys(params).length <= 10, "Analytics params are limited to ten fields");
/** Schema for an idempotent, allowlisted multiplayer analytics request. */
exports.RaceAnalyticsEventRequestSchema = zod_1.z
    .object({
    eventId: RaceAnalyticsRequestIdSchema,
    eventName: exports.RaceAnalyticsEventNameSchema,
    params: RaceAnalyticsParamsSchema.default({}),
})
    .strict();
/** Schema acknowledging an accepted multiplayer analytics event. */
exports.RaceAnalyticsEventResponseSchema = zod_1.z.object({ accepted: zod_1.z.literal(true) }).strict();
