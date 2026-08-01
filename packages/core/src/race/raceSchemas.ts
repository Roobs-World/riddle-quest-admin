import {z} from "zod";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../game/limits";

export const RACE_RULES_VERSION = "race10_v1" as const;
export const RACE_TARGET_CORRECT = 10;
export const RACE_DECK_SIZE = 15;
export const RACE_MAX_GUESSES_PER_RIDDLE = 5;
export const RACE_MAX_HINTS_PER_RIDDLE = 1;
export const RACE_HINT_PENALTY_MS = 15_000;
export const RACE_SKIP_PENALTY_MS = 45_000;
export const RACE_MAX_ADJUSTED_TIME_MS = 300_000;
export const RACE_CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export const RACE_CATEGORY_IDS = ["history", "geography", "music", "film", "science", "mixed"] as const;
export const RACE_SUPPORTED_LOCALES = ["en"] as const;

export const RaceCategoryIdSchema = z.enum(RACE_CATEGORY_IDS);
export type RaceCategoryId = z.infer<typeof RaceCategoryIdSchema>;
export const RaceLocaleSchema = z.enum(RACE_SUPPORTED_LOCALES);
export type RaceLocale = z.infer<typeof RaceLocaleSchema>;
const RequestIdSchema = z.string().trim().min(8).max(160);

export const RaceAccessResponseSchema = z
  .object({
    enabled: z.boolean(),
    locale: RaceLocaleSchema,
    reason: z.enum(["enabled", "rollout_disabled", "not_in_cohort"]),
  })
  .strict();
export type RaceAccessResponse = z.infer<typeof RaceAccessResponseSchema>;

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
} as const;
export const RaceAnalyticsEventNameSchema = z.enum(
  Object.keys(RACE_ANALYTICS_FIELDS) as [keyof typeof RACE_ANALYTICS_FIELDS, ...(keyof typeof RACE_ANALYTICS_FIELDS)[]],
);
export type RaceAnalyticsEventName = z.infer<typeof RaceAnalyticsEventNameSchema>;
const RaceAnalyticsParamsSchema = z
  .record(z.string().min(1).max(80), z.union([z.string().max(80), z.number().finite(), z.boolean()]))
  .refine((params) => Object.keys(params).length <= 10, "Analytics params are limited to ten fields");
export const RaceAnalyticsEventRequestSchema = z
  .object({
    eventId: RequestIdSchema,
    eventName: RaceAnalyticsEventNameSchema,
    params: RaceAnalyticsParamsSchema.default({}),
  })
  .strict();
export type RaceAnalyticsEventRequest = z.infer<typeof RaceAnalyticsEventRequestSchema>;
export const RaceAnalyticsEventResponseSchema = z.object({accepted: z.literal(true)}).strict();
export type RaceAnalyticsEventResponse = z.infer<typeof RaceAnalyticsEventResponseSchema>;

export const RaceAccessRequestSchema = z.object({locale: RaceLocaleSchema}).strict();
export type RaceAccessRequest = z.infer<typeof RaceAccessRequestSchema>;

export const RaceDifficultyBandSchema = z.enum(["easy", "medium", "hard"]);
export type RaceDifficultyBand = z.infer<typeof RaceDifficultyBandSchema>;

export const RaceContentQualityVersionSchema = z.string().trim().min(1).max(80);

export const RaceRulesSchema = z
  .object({
    version: z.literal(RACE_RULES_VERSION),
    targetCorrect: z.literal(RACE_TARGET_CORRECT),
    deckSize: z.literal(RACE_DECK_SIZE),
    maxGuessesPerRiddle: z.literal(RACE_MAX_GUESSES_PER_RIDDLE),
    maxHintsPerRiddle: z.literal(RACE_MAX_HINTS_PER_RIDDLE),
    hintPenaltyMs: z.literal(RACE_HINT_PENALTY_MS),
    skipPenaltyMs: z.literal(RACE_SKIP_PENALTY_MS),
    maxAdjustedTimeMs: z.literal(RACE_MAX_ADJUSTED_TIME_MS),
  })
  .strict();
export type RaceRules = z.infer<typeof RaceRulesSchema>;

export const RACE_RULES: RaceRules = Object.freeze({
  version: RACE_RULES_VERSION,
  targetCorrect: RACE_TARGET_CORRECT,
  deckSize: RACE_DECK_SIZE,
  maxGuessesPerRiddle: RACE_MAX_GUESSES_PER_RIDDLE,
  maxHintsPerRiddle: RACE_MAX_HINTS_PER_RIDDLE,
  hintPenaltyMs: RACE_HINT_PENALTY_MS,
  skipPenaltyMs: RACE_SKIP_PENALTY_MS,
  maxAdjustedTimeMs: RACE_MAX_ADJUSTED_TIME_MS,
});

const OpaqueIdSchema = z.string().trim().min(1).max(160);
const MillisecondsSchema = z.number().int().nonnegative();

export const RaceEventTypeSchema = z.enum(["correct", "hint", "skip"]);
export type RaceEventType = z.infer<typeof RaceEventTypeSchema>;

export const RaceGhostEventSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    type: RaceEventTypeSchema,
    riddlePosition: z
      .number()
      .int()
      .nonnegative()
      .max(RACE_DECK_SIZE - 1),
    wallElapsedMs: MillisecondsSchema,
    penaltyAddedMs: z.union([z.literal(0), z.literal(RACE_HINT_PENALTY_MS), z.literal(RACE_SKIP_PENALTY_MS)]),
    totalPenaltyMs: MillisecondsSchema,
    adjustedElapsedMs: MillisecondsSchema,
    correctCount: z.number().int().nonnegative().max(RACE_TARGET_CORRECT),
  })
  .strict()
  .superRefine((event, context) => {
    const expectedPenalty =
      event.type === "hint" ? RACE_HINT_PENALTY_MS : event.type === "skip" ? RACE_SKIP_PENALTY_MS : 0;
    if (event.penaltyAddedMs !== expectedPenalty) {
      context.addIssue({
        code: "custom",
        message: `${event.type} events require a ${expectedPenalty}ms penalty`,
        path: ["penaltyAddedMs"],
      });
    }
    if (event.adjustedElapsedMs !== event.wallElapsedMs + event.totalPenaltyMs) {
      context.addIssue({
        code: "custom",
        message: "adjustedElapsedMs must equal wallElapsedMs + totalPenaltyMs",
        path: ["adjustedElapsedMs"],
      });
    }
  });
export type RaceGhostEvent = z.infer<typeof RaceGhostEventSchema>;

export const RaceCategorySchema = z
  .object({
    categoryId: RaceCategoryIdSchema,
    nameKey: z.string().min(1).max(120),
    descriptionKey: z.string().min(1).max(120),
    icon: z.enum(["history", "geography", "music", "film", "science", "shuffle"]),
    colorToken: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    availableRiddleCount: z.number().int().nonnegative(),
  })
  .strict();
export type RaceCategory = z.infer<typeof RaceCategorySchema>;

export const RaceRiddlePromptSchema = z
  .object({
    riddleId: OpaqueIdSchema,
    text: z.string().trim().min(1).max(2_000),
    answerLength: z.number().int().positive().max(MAX_RIDDLE_ANSWER_CHARACTERS),
    position: z
      .number()
      .int()
      .nonnegative()
      .max(RACE_DECK_SIZE - 1),
    guessesUsed: z.number().int().nonnegative().max(RACE_MAX_GUESSES_PER_RIDDLE),
    guessesRemaining: z.number().int().nonnegative().max(RACE_MAX_GUESSES_PER_RIDDLE),
    hintAvailable: z.boolean(),
    revealedLetters: z.array(
      z
        .object({
          index: z
            .number()
            .int()
            .nonnegative()
            .max(MAX_RIDDLE_ANSWER_CHARACTERS - 1),
          letter: z.string().min(1).max(8),
        })
        .strict(),
    ),
  })
  .strict();
export type RaceRiddlePrompt = z.infer<typeof RaceRiddlePromptSchema>;

export const RaceRunStatusSchema = z.enum(["active", "completed", "timed_out", "abandoned"]);
export type RaceRunStatus = z.infer<typeof RaceRunStatusSchema>;

export const RaceOpponentSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    avatarUrl: z.string().url().nullable().optional(),
    adjustedFinishMs: MillisecondsSchema,
    events: z.array(RaceGhostEventSchema).max(RACE_DECK_SIZE * 3),
  })
  .strict();
export type RaceOpponent = z.infer<typeof RaceOpponentSchema>;

export const RaceRunViewSchema = z
  .object({
    runId: OpaqueIdSchema,
    challengeId: OpaqueIdSchema.optional(),
    rivalryChallengeId: OpaqueIdSchema.optional(),
    role: z.enum(["creator", "challenger"]),
    status: RaceRunStatusSchema,
    categoryId: RaceCategoryIdSchema,
    locale: RaceLocaleSchema,
    rules: RaceRulesSchema,
    correctCount: z.number().int().nonnegative().max(RACE_TARGET_CORRECT),
    wallElapsedMs: MillisecondsSchema,
    totalPenaltyMs: MillisecondsSchema,
    adjustedElapsedMs: MillisecondsSchema,
    currentRiddle: RaceRiddlePromptSchema.nullable(),
    events: z.array(RaceGhostEventSchema).max(RACE_DECK_SIZE * 3),
    opponent: RaceOpponentSchema.optional(),
  })
  .strict();
export type RaceRunView = z.infer<typeof RaceRunViewSchema>;

export const RaceLetterFeedbackSchema = z
  .object({
    letter: z.string().min(1).max(8),
    status: z.enum(["green", "yellow", "red"]),
  })
  .strict();

export const RaceRunResponseSchema = z
  .object({
    run: RaceRunViewSchema,
  })
  .strict();

export const SubmitRaceGuessResponseSchema = z
  .object({
    run: RaceRunViewSchema,
    feedback: z.array(RaceLetterFeedbackSchema).max(MAX_RIDDLE_ANSWER_CHARACTERS),
    isCorrect: z.boolean(),
    autoSkipped: z.boolean(),
  })
  .strict();

export const RequestRaceHintResponseSchema = z
  .object({
    run: RaceRunViewSchema,
    revealedLetter: z.string().min(1).max(8),
    index: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_RIDDLE_ANSWER_CHARACTERS - 1),
  })
  .strict();

export const SkipRaceRiddleResponseSchema = z
  .object({
    run: RaceRunViewSchema,
    penaltyAddedMs: z.literal(RACE_SKIP_PENALTY_MS),
  })
  .strict();

export const RaceOutcomeSchema = z
  .object({
    runId: OpaqueIdSchema,
    challengeId: OpaqueIdSchema.optional(),
    result: z.enum(["recorded", "player_win", "ghost_win", "tie", "timed_out"]),
    correctCount: z.number().int().nonnegative().max(RACE_TARGET_CORRECT),
    wallFinishMs: MillisecondsSchema,
    hintPenaltyMs: MillisecondsSchema,
    skipPenaltyMs: MillisecondsSchema,
    totalPenaltyMs: MillisecondsSchema,
    adjustedFinishMs: MillisecondsSchema,
    opponentAdjustedFinishMs: MillisecondsSchema.optional(),
    publishable: z.boolean(),
    rematchEligible: z.boolean(),
  })
  .strict();
export type RaceOutcome = z.infer<typeof RaceOutcomeSchema>;

export const RaceChallengePreviewSchema = z
  .object({
    challengeId: OpaqueIdSchema,
    rivalryChallengeId: OpaqueIdSchema.optional(),
    creator: z
      .object({
        displayName: z.string().trim().min(1).max(80),
        avatarUrl: z.string().url().nullable().optional(),
      })
      .strict(),
    categoryId: RaceCategoryIdSchema,
    targetCorrect: z.literal(RACE_TARGET_CORRECT),
    adjustedTimeToBeatMs: MillisecondsSchema,
    rulesVersion: z.literal(RACE_RULES_VERSION),
    expiresAtMs: MillisecondsSchema,
    status: z.enum(["active", "expired", "revoked"]),
  })
  .strict();
export type RaceChallengePreview = z.infer<typeof RaceChallengePreviewSchema>;

export const ListRaceCategoriesRequestSchema = z
  .object({
    locale: RaceLocaleSchema,
  })
  .strict();
export const ListRaceCategoriesResponseSchema = z
  .object({
    categories: z.array(RaceCategorySchema),
    rules: RaceRulesSchema,
  })
  .strict();

export const StartRaceRunRequestSchema = z
  .object({
    locale: RaceLocaleSchema,
    categoryId: RaceCategoryIdSchema.optional(),
    challengeId: OpaqueIdSchema.optional(),
    rivalryChallengeId: OpaqueIdSchema.optional(),
    requestId: RequestIdSchema,
  })
  .strict()
  .refine((input) => Boolean(input.categoryId) !== Boolean(input.challengeId), {
    message: "Provide exactly one of categoryId or challengeId",
  })
  .refine((input) => !(input.challengeId && input.rivalryChallengeId), {
    message: "A direct challenge cannot also be a counter-challenge",
  });

export const RaceRunIdRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
  })
  .strict();

export const AbandonRaceRunRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    requestId: RequestIdSchema,
  })
  .strict();

export const AbandonRaceRunResponseSchema = z
  .object({
    run: RaceRunViewSchema,
    result: z.null(),
  })
  .strict();

export const SubmitRaceGuessRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    guess: z.string().trim().min(1).max(MAX_RIDDLE_ANSWER_CHARACTERS),
    requestId: RequestIdSchema,
  })
  .strict();

export const RequestRaceHintRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    currentAttempt: z.array(z.string().max(8)).max(MAX_RIDDLE_ANSWER_CHARACTERS),
    requestId: RequestIdSchema,
  })
  .strict();

export const SkipRaceRiddleRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    requestId: RequestIdSchema,
  })
  .strict();

export const PublishRaceChallengeRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    requestId: RequestIdSchema,
  })
  .strict();

export const PublishRaceChallengeResponseSchema = z
  .object({
    challengeId: OpaqueIdSchema,
    preview: RaceChallengePreviewSchema,
  })
  .strict();

export const RaceChallengeIdRequestSchema = z
  .object({
    challengeId: OpaqueIdSchema,
  })
  .strict();

export const RaceInboxItemSchema = z
  .object({
    itemId: OpaqueIdSchema,
    challengeId: OpaqueIdSchema,
    opponentDisplayName: z.string().trim().min(1).max(80),
    opponentAvatarUrl: z.string().url().nullable().optional(),
    categoryId: RaceCategoryIdSchema,
    result: z.enum(["win", "loss", "tie"]),
    adjustedDeltaMs: z.number().int(),
    read: z.boolean(),
    createdAtMs: MillisecondsSchema,
  })
  .strict();

export const ListRaceInboxRequestSchema = z
  .object({
    cursor: z.string().min(1).max(500).optional(),
    limit: z.number().int().positive().max(50).default(20),
  })
  .strict()
  .default({limit: 20});

export const ListRaceInboxResponseSchema = z
  .object({
    items: z.array(RaceInboxItemSchema),
    nextCursor: z.string().min(1).max(500).optional(),
  })
  .strict();

export type ListRaceCategoriesRequest = z.infer<typeof ListRaceCategoriesRequestSchema>;
export type ListRaceCategoriesResponse = z.infer<typeof ListRaceCategoriesResponseSchema>;
export type StartRaceRunRequest = z.infer<typeof StartRaceRunRequestSchema>;
export type RaceRunResponse = z.infer<typeof RaceRunResponseSchema>;
export type AbandonRaceRunRequest = z.infer<typeof AbandonRaceRunRequestSchema>;
export type AbandonRaceRunResponse = z.infer<typeof AbandonRaceRunResponseSchema>;
export type SubmitRaceGuessRequest = z.infer<typeof SubmitRaceGuessRequestSchema>;
export type SubmitRaceGuessResponse = z.infer<typeof SubmitRaceGuessResponseSchema>;
export type RequestRaceHintRequest = z.infer<typeof RequestRaceHintRequestSchema>;
export type RequestRaceHintResponse = z.infer<typeof RequestRaceHintResponseSchema>;
export type SkipRaceRiddleRequest = z.infer<typeof SkipRaceRiddleRequestSchema>;
export type SkipRaceRiddleResponse = z.infer<typeof SkipRaceRiddleResponseSchema>;
export type PublishRaceChallengeRequest = z.infer<typeof PublishRaceChallengeRequestSchema>;
export type PublishRaceChallengeResponse = z.infer<typeof PublishRaceChallengeResponseSchema>;
export type RaceInboxItem = z.infer<typeof RaceInboxItemSchema>;
export type ListRaceInboxRequest = z.infer<typeof ListRaceInboxRequestSchema>;
export type ListRaceInboxResponse = z.infer<typeof ListRaceInboxResponseSchema>;
