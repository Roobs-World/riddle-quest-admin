import {z} from "zod";

/** Validates the race analytics request id data shape. */
const RaceAnalyticsRequestIdSchema = z.string().trim().min(8).max(160);

/** Allowlisted parameter names for each multiplayer analytics event. */
export const RACE_ANALYTICS_FIELDS = {
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
} as const;
/** Schema for a supported multiplayer analytics event name. */
export const RaceAnalyticsEventNameSchema = z.enum(
  Object.keys(RACE_ANALYTICS_FIELDS) as [keyof typeof RACE_ANALYTICS_FIELDS, ...(keyof typeof RACE_ANALYTICS_FIELDS)[]],
);
/** Supported multiplayer analytics event name. */
export type RaceAnalyticsEventName = z.infer<typeof RaceAnalyticsEventNameSchema>;
/** Validates the race analytics params data shape. */
const RaceAnalyticsParamsSchema = z
  .record(z.string().min(1).max(80), z.union([z.string().max(80), z.number().finite(), z.boolean()]))
  .refine((params) => Object.keys(params).length <= 10, "Analytics params are limited to ten fields");
/** Schema for an idempotent, allowlisted multiplayer analytics request. */
export const RaceAnalyticsEventRequestSchema = z
  .object({
    eventId: RaceAnalyticsRequestIdSchema,
    eventName: RaceAnalyticsEventNameSchema,
    params: RaceAnalyticsParamsSchema.default({}),
  })
  .strict();
/** Validated multiplayer analytics request. */
export type RaceAnalyticsEventRequest = z.infer<typeof RaceAnalyticsEventRequestSchema>;
/** Schema acknowledging an accepted multiplayer analytics event. */
export const RaceAnalyticsEventResponseSchema = z.object({accepted: z.literal(true)}).strict();
/** Acknowledgement returned for an accepted multiplayer analytics event. */
export type RaceAnalyticsEventResponse = z.infer<typeof RaceAnalyticsEventResponseSchema>;
