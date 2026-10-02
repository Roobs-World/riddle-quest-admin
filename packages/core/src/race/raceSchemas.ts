import {z} from "zod";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../game/limits";
import {
  RACE_DECK_SIZE,
  RACE_HINT_PENALTY_MS,
  RACE_MAX_ADJUSTED_TIME_MS,
  RACE_MAX_GUESSES_PER_RIDDLE,
  RACE_MAX_HINTS_PER_RIDDLE,
  RACE_RULES_VERSION,
  RACE_SKIP_PENALTY_MS,
  RACE_TARGET_CORRECT,
  RaceAchievementIdSchema,
  RaceCategoryIdSchema,
  RaceCategorySchema,
  RaceLocaleSchema,
  RaceRulesSchema,
} from "./raceDefinitionSchemas";
import {RaceGhostEventSchema} from "./raceGhostSchemas";

export * from "./raceAnalyticsSchemas";
export * from "./raceDefinitionSchemas";
export * from "./raceGhostSchemas";

/** Validates the request id data shape. */
const RequestIdSchema = z.string().trim().min(8).max(160);

/** Validates the opaque id data shape. */
const OpaqueIdSchema = z.string().trim().min(1).max(160);
/** Validates the milliseconds data shape. */
const MillisecondsSchema = z.number().int().nonnegative();

/** Confirmed presentation rows; scoring remains owned by the server run. */
export const RaceConfirmedGuessSchema = z.object({
  guess: z.array(z.string().min(1).max(8)).min(1).max(MAX_RIDDLE_ANSWER_CHARACTERS),
  feedback: z.array(z.enum(["green", "yellow", "red"])).min(1).max(MAX_RIDDLE_ANSWER_CHARACTERS),
}).strict();

/** Schema for the current riddle, with optional local evaluation data. */
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
    /** Optional negotiated server history, including repeated guesses as distinct attempts. */
    confirmedGuesses: z.array(RaceConfirmedGuessSchema).max(RACE_MAX_GUESSES_PER_RIDDLE).optional(),
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
    /** Opt-in local feedback for the current question only. */
    evaluation: z.object({answer: z.string().min(1).max(MAX_RIDDLE_ANSWER_CHARACTERS), locale: RaceLocaleSchema}).strict().optional(),
  })
  .strict()
  .superRefine((prompt, context) => {
    if (prompt.confirmedGuesses && (prompt.confirmedGuesses.length > prompt.guessesUsed ||
      prompt.confirmedGuesses.some(row => row.guess.length !== prompt.answerLength || row.feedback.length !== prompt.answerLength)))
      context.addIssue({code: "custom", message: "Confirmed rows must match the current question and consumed attempts."});
  });
/** Current riddle presented during an active run. */
export type RaceRiddlePrompt = z.infer<typeof RaceRiddlePromptSchema>;

/** Immutable riddle content downloaded before an evaluation-enabled race begins. */
export const RacePreloadedRiddleSchema = z
  .object({
    riddleId: OpaqueIdSchema,
    text: z.string().trim().min(1).max(2_000),
    answerLength: z.number().int().positive().max(MAX_RIDDLE_ANSWER_CHARACTERS),
    position: z.number().int().nonnegative().max(RACE_DECK_SIZE - 1),
    evaluation: z
      .object({answer: z.string().min(1).max(MAX_RIDDLE_ANSWER_CHARACTERS), locale: RaceLocaleSchema})
      .strict(),
    /** First server-selected hint when supplied by the current race server. */
    hint: z
      .object({
        index: z.number().int().nonnegative().max(MAX_RIDDLE_ANSWER_CHARACTERS - 1),
        letter: z.string().min(1).max(8),
      })
      .strict().optional(),
  })
  .strict();
/** Immutable riddle content downloaded before an evaluation-enabled race begins. */
export type RacePreloadedRiddle = z.infer<typeof RacePreloadedRiddleSchema>;

/** Schema for the lifecycle state of an authoritative race run. */
export const RaceRunStatusSchema = z.enum(["prepared", "scheduled", "active", "completed", "timed_out", "abandoned"]);
/** Lifecycle state of an authoritative race run. */
export type RaceRunStatus = z.infer<typeof RaceRunStatusSchema>;

/** Schema for answer-free opponent identity and ghost playback data. */
export const RaceOpponentSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    avatarUrl: z.string().url().nullable().optional(),
    adjustedFinishMs: MillisecondsSchema,
    events: z.array(RaceGhostEventSchema).max(RACE_DECK_SIZE * (RACE_MAX_HINTS_PER_RIDDLE + 1)),
  })
  .strict()
  .superRefine((opponent, context) => {
    if (opponent.events.some(event => event.adjustedElapsedMs > opponent.adjustedFinishMs))
      context.addIssue({code: "custom", message: "Opponent history cannot extend beyond its recorded finish."});
  });
/** Answer-free opponent identity and ghost playback data. */
export type RaceOpponent = z.infer<typeof RaceOpponentSchema>;

/** Schema for the client projection of a race run. */
export const RaceRunViewSchema = z
  .object({
    runId: OpaqueIdSchema,
    challengeId: OpaqueIdSchema.optional(),
    rivalryChallengeId: OpaqueIdSchema.optional(),
    role: z.enum(["creator", "challenger"]),
    status: RaceRunStatusSchema,
    /** Authoritative time sampled when projecting this response. */
    serverNowMs: MillisecondsSchema.optional(),
    /** Immutable scored start, including the scheduled countdown lead-in. */
    startsAtMs: MillisecondsSchema.optional(),
    /** Latest time a prepared run may be scheduled. */
    preparationExpiresAtMs: MillisecondsSchema.optional(),
    categoryId: RaceCategoryIdSchema,
    locale: RaceLocaleSchema,
    rules: RaceRulesSchema,
    correctCount: z.number().int().nonnegative().max(RACE_TARGET_CORRECT),
    wallElapsedMs: MillisecondsSchema,
    totalPenaltyMs: MillisecondsSchema,
    adjustedElapsedMs: MillisecondsSchema,
    currentRiddle: RaceRiddlePromptSchema.nullable(),
    /** Complete immutable deck used for instant local transitions; absent for answer-safe legacy callers. */
    preloadedRiddles: z.array(RacePreloadedRiddleSchema).length(RACE_DECK_SIZE).optional(),
    events: z.array(RaceGhostEventSchema).max(RACE_DECK_SIZE * (RACE_MAX_HINTS_PER_RIDDLE + 1)),
    opponent: RaceOpponentSchema.optional(),
  })
  .strict()
  .check((context) => {
    /** Canonical run containing the event aggregates being validated. */
    const run = context.value;
    if (run.events.some(event => event.correctCount > run.correctCount || event.totalPenaltyMs > run.totalPenaltyMs ||
      run.status === "active" && event.wallElapsedMs > run.wallElapsedMs))
      context.issues.push({code: "custom", input: run, message: "Known events cannot exceed their containing run's progress or clock."});
    /** Editable questions retain the fixed attempt budget and exact remaining hint capacity. */
    const prompt = run.currentRiddle;
    if (prompt) {
      if (prompt.guessesUsed >= run.rules.maxGuessesPerRiddle ||
        prompt.guessesUsed + prompt.guessesRemaining !== run.rules.maxGuessesPerRiddle)
        context.issues.push({code: "custom", input: run, message: "Editable race attempts must retain their remaining guess budget."});
      /** Older one-hint runs use their recorded rule, rather than the current hint maximum. */
      const hintLimit = Math.min(run.rules.maxHintsPerRiddle, prompt.answerLength);
      if (prompt.revealedLetters.length > hintLimit || prompt.hintAvailable !== (prompt.revealedLetters.length < hintLimit))
        context.issues.push({code: "custom", input: run, message: "Race hint availability must agree with the remaining hint budget."});
    }
    if (run.status === "active" && (run.correctCount >= run.rules.targetCorrect ||
      run.currentRiddle && run.correctCount > run.currentRiddle.position))
      context.issues.push({code: "custom", input: run, message: "Active score cannot exceed owned question progress or reach the target."});
    /** Preparation and countdown expose the untouched first question, never accepted scoring. */
    const unscored = run.status === "prepared" || run.status === "scheduled";
    if (unscored && (run.correctCount !== 0 || run.totalPenaltyMs !== 0 || run.adjustedElapsedMs !== 0 ||
      run.events.length !== 0 || !run.currentRiddle || run.currentRiddle.position !== 0 ||
      run.currentRiddle.guessesUsed !== 0 || run.currentRiddle.guessesRemaining !== run.rules.maxGuessesPerRiddle ||
      run.currentRiddle.revealedLetters.length !== 0 || !run.currentRiddle.hintAvailable))
      context.issues.push({code: "custom", input: run, message: "Unscored races must retain an untouched first question."});
    if (run.status === "prepared" && run.serverNowMs !== undefined && run.preparationExpiresAtMs !== undefined &&
      run.serverNowMs >= run.preparationExpiresAtMs)
      context.issues.push({code: "custom", input: run, message: "Expired preparation must be abandoned before projection."});
    // Preparation/countdown are unscored; terminal durations remain fixed independently of later reads.
    if ((run.status === "prepared" || run.status === "scheduled") && run.wallElapsedMs !== 0 ||
      run.startsAtMs !== undefined && run.serverNowMs !== undefined &&
      (run.status === "active" && (run.serverNowMs < run.startsAtMs || run.wallElapsedMs !== run.serverNowMs - run.startsAtMs) ||
        run.status === "scheduled" && run.serverNowMs >= run.startsAtMs))
      context.issues.push({code: "custom", input: run, message: "Live race clocks must agree with the fixed start."});
  });
/** Client projection of an authoritative race run. */
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
    locale: RaceLocaleSchema,
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
    /** Optional server-issued matchmaking attribution; direct links remain supported. */
    offerId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    /** Owner-bound fallback offered only after an eligible pool search completes. */
    fallbackOfferId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    requestId: RequestIdSchema,
    includeEvaluation: z.boolean().optional(),
    /** Prepare content without starting the scored clock. */
    prepare: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Boolean(input.categoryId) !== Boolean(input.challengeId), {
    message: "Provide exactly one of categoryId or challengeId",
  })
  .refine((input) => !(input.challengeId && input.rivalryChallengeId), {
    message: "A direct challenge cannot also be a counter-challenge",
  })
  .refine(input => !input.offerId || Boolean(input.challengeId), {message: "Match offers require a direct challenge"})
  .refine(input => !input.fallbackOfferId || Boolean(input.categoryId) && !input.rivalryChallengeId && !input.offerId,
    {message: "Fallback offers require a category without a challenge or rivalry"});

/** Schema identifying a race run owned by the authenticated player. */
export const RaceRunIdRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    includeEvaluation: z.boolean().optional(),
    /** New clients opt into history without changing responses accepted by older previews. */
    includeGuessHistory: z.boolean().optional(),
  })
  .strict();

/** Idempotent command to schedule an owned prepared run; repeats never reset its clock. */
export const ReadyRaceRunRequestSchema = z.object({runId: OpaqueIdSchema, requestId: RequestIdSchema,
  includeEvaluation: z.boolean().optional()}).strict();
/** Validated scheduling command. */
export type ReadyRaceRunRequest = z.infer<typeof ReadyRaceRunRequestSchema>;

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
    includeEvaluation: z.boolean().optional(),
  })
  .strict();

/** Schema for an idempotent hint request against the active race riddle. */
export const RequestRaceHintRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    requestId: RequestIdSchema,
    includeEvaluation: z.boolean().optional(),
  })
  .strict();

/** Schema for an idempotent skip request against the active race riddle. */
export const SkipRaceRiddleRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    requestId: RequestIdSchema,
    includeEvaluation: z.boolean().optional(),
  })
  .strict();

/** Schema for publishing a verified creator run as a challenge. */
export const PublishRaceChallengeRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    requestId: RequestIdSchema,
    reservedChallengeId: z.string().regex(/^jest-invite-[a-f0-9]{64}-[a-f0-9]{32}$/).optional(),
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

/** Creates one expiring server-owned lobby before opening a provider invite dialog. */
export const ReserveRaceInviteRequestSchema = z
  .object({
    locale: RaceLocaleSchema,
    requestId: RequestIdSchema,
  })
  .strict();

/** Identifies the reserved lobby carried through the provider referral payload. */
export const ReserveRaceInviteResponseSchema = z
  .object({
    challengeId: z.string().regex(/^jest-invite-[a-f0-9]{64}-[a-f0-9]{32}$/),
    expiresAtMs: MillisecondsSchema,
  })
  .strict();

/** Schema identifying one published race challenge. */
export const RaceChallengeIdRequestSchema = z
  .object({
    challengeId: OpaqueIdSchema,
    locale: RaceLocaleSchema,
  })
  .strict();

/** Opt-in viewer facts keep strict legacy responses compatible. */
export const RaceEntryRequestSchema = RaceChallengeIdRequestSchema.extend({includeViewerRole: z.boolean().optional(), includeExistingAttempt: z.boolean().optional()}).strict();

/** Answer-free invitation facts; exclusive seat identity never crosses this seam. */
export const RaceInvitationViewSchema = z.object({
  claimState: z.enum(["unclaimed", "claimed"]),
  publicationState: z.enum(["pending", "published"]),
  role: z.enum(["creator", "recipient"]),
  canCancel: z.boolean(),
  expiresAtMs: MillisecondsSchema,
}).strict();
/** Typed challenge readiness shared by direct links and reserved invitations. */
export const RaceEntryResponseSchema = z.discriminatedUnion("status", [
  z.object({status: z.literal("ready"), challenge: RaceChallengePreviewSchema, viewerRole: z.enum(["creator", "recipient"]).optional(), existingRunId: OpaqueIdSchema.optional(), invitation: RaceInvitationViewSchema.optional(), serverNowMs: MillisecondsSchema}).strict(),
  z.object({status: z.literal("waiting"), invitation: RaceInvitationViewSchema, serverNowMs: MillisecondsSchema}).strict(),
  z.object({status: z.literal("expired"), invitation: RaceInvitationViewSchema.optional(), serverNowMs: MillisecondsSchema}).strict(),
  z.object({status: z.literal("cancelled"), invitation: RaceInvitationViewSchema.optional(), serverNowMs: MillisecondsSchema}).strict(),
  z.object({status: z.literal("unavailable"), reason: z.enum(["missing", "claimed", "blocked", "deleted", "locale", "inactive", "invalid"]), serverNowMs: MillisecondsSchema}).strict(),
]);
/** Idempotent creator cancellation affects a reserved invitation, never a reusable public share. */
export const CancelRaceInviteRequestSchema = RaceChallengeIdRequestSchema.extend({requestId: RequestIdSchema}).strict();
/** Privacy-safe facts for one Race Invitation. */
export type RaceInvitationView = z.infer<typeof RaceInvitationViewSchema>;
/** Lifecycle-aware challenge-read response. */
export type RaceEntryResponse = z.infer<typeof RaceEntryResponseSchema>;
/** Reserved-invitation cancellation command. */
export type CancelRaceInviteRequest = z.infer<typeof CancelRaceInviteRequestSchema>;

/** Requests a recorded opponent; provider scope is derived by the trusted adapter. */
export const RaceMatchRequestSchema = z.object({
  locale: RaceLocaleSchema,
  categoryId: RaceCategoryIdSchema.optional(),
  requestId: RequestIdSchema.optional(),
}).strict();
/** Provider-neutral recorded opponent request. */
export type RaceMatchRequest = z.infer<typeof RaceMatchRequestSchema>;
/** Answer-safe recorded matchmaking result shared by supported provider adapters. */
export const RaceMatchResponseSchema = z.discriminatedUnion("status", [
  z.object({status: z.literal("matched"), challenge: RaceChallengePreviewSchema,
    /** Optional only for compatibility with older provider adapters. */
    offerId: z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict(),
  z.object({status: z.literal("empty"), locale: RaceLocaleSchema,
    fallback: z.object({offerId: z.string().regex(/^[a-f0-9]{64}$/), categoryId: RaceCategoryIdSchema}).strict().optional()}).strict(),
]);
/** Provider-neutral recorded opponent result. */
export type RaceMatchResponse = z.infer<typeof RaceMatchResponseSchema>;
/** Compatibility alias for deployed Reddit gateway requests. */
export const FindRedditRaceMatchRequestSchema = RaceMatchRequestSchema;
/** Compatibility alias for deployed Reddit gateway responses. */
export const FindRedditRaceMatchResponseSchema = RaceMatchResponseSchema;
/** Compatibility type for existing Reddit adapters. */
export type FindRedditRaceMatchResponse = RaceMatchResponse;

/** Schema for one answer-free multiplayer result inbox item. */
export const RaceInboxItemSchema = z
  .object({
    itemId: OpaqueIdSchema,
    challengeId: OpaqueIdSchema,
    /** Provider-neutral account identifier used only by server-authorized safety actions. */
    opponentUserId: z.string().trim().min(1).max(128).optional(),
    opponentDisplayName: z.string().trim().min(1).max(80),
    opponentAvatarUrl: z.string().url().nullable().optional(),
    categoryId: RaceCategoryIdSchema,
    result: z.enum(["win", "loss", "tie"]),
    adjustedDeltaMs: z.number().int(),
    read: z.boolean(),
    createdAtMs: MillisecondsSchema,
  })
  .strict();

/** Bounded moderation categories accepted by the social-safety queue. */
export const SocialReportCategorySchema = z.enum(["harassment", "cheating", "inappropriate_identity", "spam", "other"]);
/** One categorized social-safety report reason. */
export type SocialReportCategory = z.infer<typeof SocialReportCategorySchema>;

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

/** Facebook tournament submissions identify an authoritative run, never a client score. */
export const RecordFacebookTournamentRunRequestSchema = z
  .object({
    runId: OpaqueIdSchema,
    locale: RaceLocaleSchema,
  })
  .strict();

/** Answer- and economy-free result of recording an official Facebook tournament run. */
export const RecordFacebookTournamentRunResponseSchema = z
  .object({
    tournamentId: OpaqueIdSchema,
    locale: RaceLocaleSchema,
    runId: OpaqueIdSchema,
    adjustedTimeMs: MillisecondsSchema.max(RACE_MAX_ADJUSTED_TIME_MS),
    completedAtMs: MillisecondsSchema,
    improved: z.boolean(),
    sortOrder: z.literal("LOWER_IS_BETTER"),
    rewardsEnabled: z.literal(false),
  })
  .strict();

/** Requests the active 24-hour Facebook tournament for one exact locale. */
export const ListFacebookTournamentRequestSchema = z.object({locale: RaceLocaleSchema}).strict();

/** One identity-free row in the server-authoritative tournament presentation. */
export const FacebookTournamentStandingSchema = z
  .object({
    rank: z.number().int().positive(),
    adjustedTimeMs: MillisecondsSchema.max(RACE_MAX_ADJUSTED_TIME_MS),
    isCurrentPlayer: z.boolean(),
  })
  .strict();

/** Active tournament metadata and its bounded, economy-free standings. */
export const ListFacebookTournamentResponseSchema = z
  .object({
    tournamentId: OpaqueIdSchema,
    locale: RaceLocaleSchema,
    startsAtMs: MillisecondsSchema,
    endsAtMs: MillisecondsSchema,
    sortOrder: z.literal("LOWER_IS_BETTER"),
    rewardsEnabled: z.literal(false),
    standings: z.array(FacebookTournamentStandingSchema).max(50),
    currentPlayer: FacebookTournamentStandingSchema.optional(),
  })
  .strict();

/** Validates the facebook context id data shape. */
const FacebookContextIdSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9._:-]+$/);

/** Records one authoritative run into the player's current Facebook context board. */
export const RecordFacebookContextRunRequestSchema = z
  .object({
    contextId: FacebookContextIdSchema,
    locale: RaceLocaleSchema,
    runId: OpaqueIdSchema,
  })
  .strict();

/** Economy- and identity-free result of recording a context-board run. */
export const RecordFacebookContextRunResponseSchema = z
  .object({
    locale: RaceLocaleSchema,
    runId: OpaqueIdSchema,
    adjustedTimeMs: MillisecondsSchema.max(RACE_MAX_ADJUSTED_TIME_MS),
    completedAtMs: MillisecondsSchema,
    improved: z.boolean(),
    sortOrder: z.literal("LOWER_IS_BETTER"),
    rewardsEnabled: z.literal(false),
  })
  .strict();

/** Requests the active seven-day board for an exact Facebook context and locale. */
export const ListFacebookContextBoardRequestSchema = z
  .object({
    contextId: FacebookContextIdSchema,
    locale: RaceLocaleSchema,
  })
  .strict();

/** Bounded identity-free Facebook context board. */
export const ListFacebookContextBoardResponseSchema = z
  .object({
    locale: RaceLocaleSchema,
    startsAtMs: MillisecondsSchema,
    endsAtMs: MillisecondsSchema,
    sortOrder: z.literal("LOWER_IS_BETTER"),
    rewardsEnabled: z.literal(false),
    standings: z.array(FacebookTournamentStandingSchema).max(50),
    currentPlayer: FacebookTournamentStandingSchema.optional(),
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
/** Validated request for reserving a two-player invite lobby. */
export type ReserveRaceInviteRequest = z.infer<typeof ReserveRaceInviteRequestSchema>;
/** Validated response identifying a reserved invite lobby. */
export type ReserveRaceInviteResponse = z.infer<typeof ReserveRaceInviteResponseSchema>;
/** One validated multiplayer result inbox item. */
export type RaceInboxItem = z.infer<typeof RaceInboxItemSchema>;
/** Validated cursor-paginated multiplayer inbox request. */
export type ListRaceInboxRequest = z.infer<typeof ListRaceInboxRequestSchema>;
/** Validated page of multiplayer result inbox items. */
export type ListRaceInboxResponse = z.infer<typeof ListRaceInboxResponseSchema>;
/** Validated request to derive a Facebook tournament score from a completed run. */
export type RecordFacebookTournamentRunRequest = z.infer<typeof RecordFacebookTournamentRunRequestSchema>;
/** Validated economy-free official Facebook tournament result. */
export type RecordFacebookTournamentRunResponse = z.infer<typeof RecordFacebookTournamentRunResponseSchema>;
/** Validated request for the active locale-isolated Facebook tournament. */
export type ListFacebookTournamentRequest = z.infer<typeof ListFacebookTournamentRequestSchema>;
/** Validated identity-free active Facebook tournament presentation. */
export type ListFacebookTournamentResponse = z.infer<typeof ListFacebookTournamentResponseSchema>;
/** Validated context-board authoritative run request. */
export type RecordFacebookContextRunRequest = z.infer<typeof RecordFacebookContextRunRequestSchema>;
/** Validated context-board authoritative record response. */
export type RecordFacebookContextRunResponse = z.infer<typeof RecordFacebookContextRunResponseSchema>;
/** Validated active Facebook context-board request. */
export type ListFacebookContextBoardRequest = z.infer<typeof ListFacebookContextBoardRequestSchema>;
/** Validated identity-free Facebook context-board response. */
export type ListFacebookContextBoardResponse = z.infer<typeof ListFacebookContextBoardResponseSchema>;
