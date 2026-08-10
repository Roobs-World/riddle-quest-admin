import {z} from "zod";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../game/limits";
/** Version identifier for the current authoritative multiplayer rules. */
export const RACE_RULES_VERSION = "race10_v1" as const;
/** Correct answers required to complete a Race to 10 run. */
export const RACE_TARGET_CORRECT = 10;
/** Riddles captured in each authoritative race deck. */
export const RACE_DECK_SIZE = 15;
/** Incorrect guesses allowed before a riddle is automatically skipped. */
export const RACE_MAX_GUESSES_PER_RIDDLE = 5;
/** Hints allowed for each race riddle. */
export const RACE_MAX_HINTS_PER_RIDDLE = 1;
/** Adjusted-time penalty added for using a hint. */
export const RACE_HINT_PENALTY_MS = 15_000;
/** Adjusted-time penalty added for skipping a riddle. */
export const RACE_SKIP_PENALTY_MS = 45_000;
/** Maximum adjusted duration of an active race run. */
export const RACE_MAX_ADJUSTED_TIME_MS = 300_000;
/** Duration for which a published race challenge remains active. */
export const RACE_CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
/** Stable identifiers for achievements granted by authoritative race events. */
export const RACE_ACHIEVEMENT_IDS = [
  "race_debut",
  "race_first_win",
  "race_wins_5",
  "race_wins_25",
  "race_host",
  "race_hosts_5",
  "race_clean_run",
] as const;
/** Schema for a supported multiplayer achievement identifier. */
export const RaceAchievementIdSchema = z.enum(RACE_ACHIEVEMENT_IDS);
/** Supported multiplayer achievement identifier. */
export type RaceAchievementId = z.infer<typeof RaceAchievementIdSchema>;
/** Stable identifiers for selectable multiplayer content categories. */
export const RACE_CATEGORY_IDS = ["history", "geography", "music", "film", "science", "mixed"] as const;
/** Locales currently supported by authoritative multiplayer content. */
export const RACE_SUPPORTED_LOCALES = ["en"] as const;

/** Schema for a supported multiplayer category identifier. */
export const RaceCategoryIdSchema = z.enum(RACE_CATEGORY_IDS);
/** Supported multiplayer category identifier. */
export type RaceCategoryId = z.infer<typeof RaceCategoryIdSchema>;
/** Schema for a locale supported by authoritative multiplayer. */
export const RaceLocaleSchema = z.enum(RACE_SUPPORTED_LOCALES);
/** Locale supported by authoritative multiplayer. */
export type RaceLocale = z.infer<typeof RaceLocaleSchema>;
/** Validates the request id data shape. */
const RequestIdSchema = z.string().trim().min(8).max(160);
/** Schema for a player's evaluated multiplayer rollout access. */
export const RaceAccessResponseSchema = z
  .object({
    enabled: z.boolean(),
    locale: RaceLocaleSchema,
    reason: z.enum(["enabled", "rollout_disabled", "not_in_cohort"]),
  })
  .strict();
/** Evaluated multiplayer rollout access returned to a player. */
export type RaceAccessResponse = z.infer<typeof RaceAccessResponseSchema>;
export * from "./raceAnalyticsSchemas";

/** Schema for a locale-specific multiplayer access request. */
export const RaceAccessRequestSchema = z.object({locale: RaceLocaleSchema}).strict();
/** Validated multiplayer access request. */
export type RaceAccessRequest = z.infer<typeof RaceAccessRequestSchema>;

/** Schema for the content difficulty bands used to balance race decks. */
export const RaceDifficultyBandSchema = z.enum(["easy", "medium", "hard"]);
/** Content difficulty band used to balance race decks. */
export type RaceDifficultyBand = z.infer<typeof RaceDifficultyBandSchema>;

/** Schema for the review/version marker attached to race content. */
export const RaceContentQualityVersionSchema = z.string().trim().min(1).max(80);

/** Schema for the immutable rules included in race responses. */
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
/** Immutable rules governing an authoritative race run. */
export type RaceRules = z.infer<typeof RaceRulesSchema>;

/** Frozen canonical rules used by the client and server. */
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

/** Validates the opaque id data shape. */
const OpaqueIdSchema = z.string().trim().min(1).max(160);
/** Validates the milliseconds data shape. */
const MillisecondsSchema = z.number().int().nonnegative();

/** Schema for events recorded in an opponent ghost timeline. */
export const RaceEventTypeSchema = z.enum(["correct", "hint", "skip"]);
/** Event recorded in an opponent ghost timeline. */
export type RaceEventType = z.infer<typeof RaceEventTypeSchema>;

/** Schema for one internally consistent authoritative ghost event. */
export const RaceGhostEventSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    type: RaceEventTypeSchema,
    riddlePosition: z.number().int().nonnegative().max(RACE_DECK_SIZE - 1),
    wallElapsedMs: MillisecondsSchema,
    penaltyAddedMs: z.union([z.literal(0), z.literal(RACE_HINT_PENALTY_MS), z.literal(RACE_SKIP_PENALTY_MS)]),
    totalPenaltyMs: MillisecondsSchema,
    adjustedElapsedMs: MillisecondsSchema,
    correctCount: z.number().int().nonnegative().max(RACE_TARGET_CORRECT),
  })
  .strict()
  .check((context) => {
    const event = context.value;
    const expectedPenalty =
      event.type === "hint" ? RACE_HINT_PENALTY_MS : event.type === "skip" ? RACE_SKIP_PENALTY_MS : 0;
    if (event.penaltyAddedMs !== expectedPenalty) {
      context.issues.push({
        code: "custom",
        message: `${event.type} events require a ${expectedPenalty}ms penalty`,
        path: ["penaltyAddedMs"],
        input: event,
      });
    }
    if (event.adjustedElapsedMs !== event.wallElapsedMs + event.totalPenaltyMs) {
      context.issues.push({
        code: "custom",
        message: "adjustedElapsedMs must equal wallElapsedMs + totalPenaltyMs",
        path: ["adjustedElapsedMs"],
        input: event,
      });
    }
  });
/** One authoritative event in a multiplayer ghost timeline. */
export type RaceGhostEvent = z.infer<typeof RaceGhostEventSchema>;

/** Schema for an answer-free multiplayer category summary. */
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
/** Answer-free multiplayer category summary displayed by the client. */
export type RaceCategory = z.infer<typeof RaceCategorySchema>;

/** Schema for the answer-safe current riddle presented to the client. */
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
/** Answer-safe current riddle presented during an active run. */
export type RaceRiddlePrompt = z.infer<typeof RaceRiddlePromptSchema>;

/** Schema for the lifecycle state of an authoritative race run. */
export const RaceRunStatusSchema = z.enum(["active", "completed", "timed_out", "abandoned"]);
/** Lifecycle state of an authoritative race run. */
export type RaceRunStatus = z.infer<typeof RaceRunStatusSchema>;

/** Schema for answer-free opponent identity and ghost playback data. */
export const RaceOpponentSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    avatarUrl: z.string().url().nullable().optional(),
    adjustedFinishMs: MillisecondsSchema,
    events: z.array(RaceGhostEventSchema).max(RACE_DECK_SIZE * 3),
  })
  .strict();
/** Answer-free opponent identity and ghost playback data. */
export type RaceOpponent = z.infer<typeof RaceOpponentSchema>;

/** Schema for the answer-safe client projection of a race run. */
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
/** Answer-safe client projection of an authoritative race run. */
export type RaceRunView = z.infer<typeof RaceRunViewSchema>;

/** Schema for positional feedback returned for a submitted guess. */
export const RaceLetterFeedbackSchema = z
  .object({
    letter: z.string().min(1).max(8),
    status: z.enum(["green", "yellow", "red"]),
  })
  .strict();

/** Schema wrapping the current answer-safe run view. */
export const RaceRunResponseSchema = z
  .object({
    run: RaceRunViewSchema,
  })
  .strict();

/** Schema for the result of an authoritative race guess. */
export const SubmitRaceGuessResponseSchema = z
  .object({
    run: RaceRunViewSchema,
    feedback: z.array(RaceLetterFeedbackSchema).max(MAX_RIDDLE_ANSWER_CHARACTERS),
    isCorrect: z.boolean(),
    autoSkipped: z.boolean(),
  })
  .strict();

/** Schema for the result of an authoritative race hint request. */
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

/** Schema for the result of an authoritative race skip request. */
export const SkipRaceRiddleResponseSchema = z
  .object({
    run: RaceRunViewSchema,
    penaltyAddedMs: z.literal(RACE_SKIP_PENALTY_MS),
  })
  .strict();

/** Schema for the immutable final outcome of a completed race run. */
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
    newlyUnlockedAchievementIds: z.array(RaceAchievementIdSchema).default([]),
    achievementCoinsAwarded: z.number().int().nonnegative().default(0),
    newCoins: z.number().int().nonnegative().optional(),
  })
  .strict();
/** Immutable final outcome of a completed race run. */
export type RaceOutcome = z.infer<typeof RaceOutcomeSchema>;

/** Schema for an answer-free preview of a published challenge. */
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
/** Answer-free preview of a published multiplayer challenge. */
export type RaceChallengePreview = z.infer<typeof RaceChallengePreviewSchema>;

/** Schema for a locale-specific race category listing request. */
export const ListRaceCategoriesRequestSchema = z
  .object({
    locale: RaceLocaleSchema,
  })
  .strict();
/** Schema for a race category listing response and its rules. */
export const ListRaceCategoriesResponseSchema = z
  .object({
    categories: z.array(RaceCategorySchema),
    rules: RaceRulesSchema,
  })
  .strict();

/** Schema for starting a category run or accepting one direct challenge. */
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

/** Schema identifying a race run owned by the authenticated player. */
export const RaceRunIdRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
  })
  .strict();

/** Schema for an idempotent request to abandon an active run. */
export const AbandonRaceRunRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    requestId: RequestIdSchema,
  })
  .strict();

/** Schema returned after a race run is abandoned. */
export const AbandonRaceRunResponseSchema = z
  .object({
    run: RaceRunViewSchema,
    result: z.null(),
  })
  .strict();

/** Schema for an idempotent guess against the active race riddle. */
export const SubmitRaceGuessRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    guess: z.string().trim().min(1).max(MAX_RIDDLE_ANSWER_CHARACTERS),
    requestId: RequestIdSchema,
  })
  .strict();

/** Schema for an idempotent hint request against the active race riddle. */
export const RequestRaceHintRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    requestId: RequestIdSchema,
  })
  .strict();

/** Schema for an idempotent skip request against the active race riddle. */
export const SkipRaceRiddleRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    requestId: RequestIdSchema,
  })
  .strict();

/** Schema for publishing a verified creator run as a challenge. */
export const PublishRaceChallengeRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    requestId: RequestIdSchema,
  })
  .strict();

/** Schema returned after publishing a verified race challenge. */
export const PublishRaceChallengeResponseSchema = z
  .object({
    challengeId: OpaqueIdSchema,
    preview: RaceChallengePreviewSchema,
    newlyUnlockedAchievementIds: z.array(RaceAchievementIdSchema).default([]),
    achievementCoinsAwarded: z.number().int().nonnegative().default(0),
    newCoins: z.number().int().nonnegative().optional(),
  })
  .strict();

/** Schema identifying one published race challenge. */
export const RaceChallengeIdRequestSchema = z
  .object({
    challengeId: OpaqueIdSchema,
  })
  .strict();

/** Schema for one answer-free multiplayer result inbox item. */
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

/** Schema for a bounded, cursor-paginated race inbox request. */
export const ListRaceInboxRequestSchema = z
  .object({
    cursor: z.string().min(1).max(500).optional(),
    limit: z.number().int().positive().max(50).default(20),
  })
  .strict()
  .default({limit: 20});

/** Schema for a page of multiplayer result inbox items. */
export const ListRaceInboxResponseSchema = z
  .object({
    items: z.array(RaceInboxItemSchema),
    nextCursor: z.string().min(1).max(500).optional(),
  })
  .strict();

/** Validated request for listing multiplayer categories. */
export type ListRaceCategoriesRequest = z.infer<typeof ListRaceCategoriesRequestSchema>;
/** Validated response containing multiplayer categories and rules. */
export type ListRaceCategoriesResponse = z.infer<typeof ListRaceCategoriesResponseSchema>;
/** Validated request for starting an authoritative race run. */
export type StartRaceRunRequest = z.infer<typeof StartRaceRunRequestSchema>;
/** Validated response containing the current answer-safe race run. */
export type RaceRunResponse = z.infer<typeof RaceRunResponseSchema>;
/** Validated request for abandoning an authoritative race run. */
export type AbandonRaceRunRequest = z.infer<typeof AbandonRaceRunRequestSchema>;
/** Validated response returned after abandoning a race run. */
export type AbandonRaceRunResponse = z.infer<typeof AbandonRaceRunResponseSchema>;
/** Validated request for submitting one race guess. */
export type SubmitRaceGuessRequest = z.infer<typeof SubmitRaceGuessRequestSchema>;
/** Validated authoritative feedback returned for one race guess. */
export type SubmitRaceGuessResponse = z.infer<typeof SubmitRaceGuessResponseSchema>;
/** Validated request for one server-selected race hint. */
export type RequestRaceHintRequest = z.infer<typeof RequestRaceHintRequestSchema>;
/** Validated response containing one server-selected race hint. */
export type RequestRaceHintResponse = z.infer<typeof RequestRaceHintResponseSchema>;
/** Validated request for skipping the active race riddle. */
export type SkipRaceRiddleRequest = z.infer<typeof SkipRaceRiddleRequestSchema>;
/** Validated response returned after skipping the active race riddle. */
export type SkipRaceRiddleResponse = z.infer<typeof SkipRaceRiddleResponseSchema>;
/** Validated request for publishing a completed creator run. */
export type PublishRaceChallengeRequest = z.infer<typeof PublishRaceChallengeRequestSchema>;
/** Validated response returned after publishing a race challenge. */
export type PublishRaceChallengeResponse = z.infer<typeof PublishRaceChallengeResponseSchema>;
/** One validated multiplayer result inbox item. */
export type RaceInboxItem = z.infer<typeof RaceInboxItemSchema>;
/** Validated cursor-paginated multiplayer inbox request. */
export type ListRaceInboxRequest = z.infer<typeof ListRaceInboxRequestSchema>;
/** Validated page of multiplayer result inbox items. */
export type ListRaceInboxResponse = z.infer<typeof ListRaceInboxResponseSchema>;
