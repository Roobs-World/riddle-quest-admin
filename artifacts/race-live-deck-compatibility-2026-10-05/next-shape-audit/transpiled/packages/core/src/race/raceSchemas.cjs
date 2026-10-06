"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordFacebookContextRunRequestSchema = exports.ListFacebookTournamentResponseSchema = exports.FacebookTournamentStandingSchema = exports.ListFacebookTournamentRequestSchema = exports.RecordFacebookTournamentRunResponseSchema = exports.RecordFacebookTournamentRunRequestSchema = exports.ListRaceInboxResponseSchema = exports.ListRaceInboxRequestSchema = exports.ReportSocialRivalResponseSchema = exports.BlockSocialRivalResponseSchema = exports.ReportSocialRivalRequestSchema = exports.BlockSocialRivalRequestSchema = exports.SocialReportCategorySchema = exports.RaceInboxItemSchema = exports.FindRedditRaceMatchResponseSchema = exports.FindRedditRaceMatchRequestSchema = exports.RaceMatchResponseSchema = exports.RaceMatchRequestSchema = exports.CancelRaceInviteRequestSchema = exports.RaceEntryResponseSchema = exports.RaceInvitationViewSchema = exports.RaceEntryRequestSchema = exports.RaceChallengeIdRequestSchema = exports.ReserveRaceInviteResponseSchema = exports.ReserveRaceInviteRequestSchema = exports.PublishRaceChallengeResponseSchema = exports.PublishRaceChallengeRequestSchema = exports.SkipRaceRiddleRequestSchema = exports.RequestRaceHintRequestSchema = exports.SubmitRaceGuessRequestSchema = exports.AbandonRaceRunResponseSchema = exports.AbandonRaceRunRequestSchema = exports.ReadyRaceRunRequestSchema = exports.RaceRunIdRequestSchema = exports.StartRaceRunRequestSchema = exports.ListRaceCategoriesResponseSchema = exports.ListRaceCategoriesRequestSchema = exports.RaceChallengePreviewSchema = exports.RaceOutcomeSchema = exports.SkipRaceRiddleResponseSchema = exports.RequestRaceHintResponseSchema = exports.SubmitRaceGuessResponseSchema = exports.RaceRunResponseSchema = exports.RaceLetterFeedbackSchema = exports.RaceRunViewSchema = exports.RaceOpponentSchema = exports.RaceRunStatusSchema = exports.RacePreloadedRiddleSchema = exports.RaceRiddlePromptSchema = exports.RaceConfirmedGuessSchema = void 0;
exports.ListFacebookContextBoardResponseSchema = exports.ListFacebookContextBoardRequestSchema = exports.RecordFacebookContextRunResponseSchema = void 0;
const zod_1 = require("zod");
const limits_1 = require("../game/limits");
const raceTextSchemas_1 = require("./raceTextSchemas");
const raceDefinitionSchemas_1 = require("./raceDefinitionSchemas");
const raceGhostSchemas_1 = require("./raceGhostSchemas");
__exportStar(require("./raceAnalyticsSchemas"), exports);
__exportStar(require("./raceDefinitionSchemas"), exports);
__exportStar(require("./raceGhostSchemas"), exports);
/** Validates the request id data shape. */
const RequestIdSchema = zod_1.z.string().trim().min(8).max(160);
/** Validates the opaque id data shape. */
const OpaqueIdSchema = zod_1.z.string().trim().min(1).max(160);
/** Validates the milliseconds data shape. */
const MillisecondsSchema = zod_1.z.number().int().nonnegative();
/** Confirmed presentation rows; scoring remains owned by the server run. */
exports.RaceConfirmedGuessSchema = zod_1.z.object({
    guess: zod_1.z.array(raceTextSchemas_1.RaceGraphemeTextSchema).min(1).max(limits_1.MAX_RIDDLE_ANSWER_CHARACTERS),
    feedback: zod_1.z.array(zod_1.z.enum(["green", "yellow", "red"])).min(1).max(limits_1.MAX_RIDDLE_ANSWER_CHARACTERS),
}).strict();
/** Schema for the current riddle, with optional local evaluation data. */
exports.RaceRiddlePromptSchema = zod_1.z
    .object({
    riddleId: OpaqueIdSchema,
    text: zod_1.z.string().trim().min(1).max(2_000),
    answerLength: zod_1.z.number().int().positive().max(limits_1.MAX_RIDDLE_ANSWER_CHARACTERS),
    position: zod_1.z
        .number()
        .int()
        .nonnegative()
        .max(raceDefinitionSchemas_1.RACE_DECK_SIZE - 1),
    guessesUsed: zod_1.z.number().int().nonnegative().max(raceDefinitionSchemas_1.RACE_MAX_GUESSES_PER_RIDDLE),
    guessesRemaining: zod_1.z.number().int().nonnegative().max(raceDefinitionSchemas_1.RACE_MAX_GUESSES_PER_RIDDLE),
    /** Optional negotiated server history, including repeated guesses as distinct attempts. */
    confirmedGuesses: zod_1.z.array(exports.RaceConfirmedGuessSchema).max(raceDefinitionSchemas_1.RACE_MAX_GUESSES_PER_RIDDLE).optional(),
    hintAvailable: zod_1.z.boolean(),
    revealedLetters: zod_1.z.array(zod_1.z
        .object({
        index: zod_1.z
            .number()
            .int()
            .nonnegative()
            .max(limits_1.MAX_RIDDLE_ANSWER_CHARACTERS - 1),
        letter: raceTextSchemas_1.RaceGraphemeTextSchema,
    })
        .strict()),
    /** Opt-in local feedback for the current question only. */
    evaluation: zod_1.z.object({ answer: raceTextSchemas_1.RaceAnswerTextSchema, locale: raceDefinitionSchemas_1.RaceLocaleSchema }).strict().optional(),
})
    .strict()
    .check((context) => {
    /** Current prompt whose history must fit its answer and consumed attempts. */
    const prompt = context.value;
    if (prompt.confirmedGuesses && (prompt.confirmedGuesses.length > prompt.guessesUsed ||
        prompt.confirmedGuesses.some(row => row.guess.length !== prompt.answerLength || row.feedback.length !== prompt.answerLength)))
        context.issues.push({ code: "custom", input: prompt, message: "Confirmed rows must match the current question and consumed attempts." });
});
/** Immutable riddle content downloaded before an evaluation-enabled race begins. */
exports.RacePreloadedRiddleSchema = zod_1.z
    .object({
    riddleId: OpaqueIdSchema,
    text: zod_1.z.string().trim().min(1).max(2_000),
    answerLength: zod_1.z.number().int().positive().max(limits_1.MAX_RIDDLE_ANSWER_CHARACTERS),
    position: zod_1.z.number().int().nonnegative().max(raceDefinitionSchemas_1.RACE_DECK_SIZE - 1),
    evaluation: zod_1.z
        .object({ answer: raceTextSchemas_1.RaceAnswerTextSchema, locale: raceDefinitionSchemas_1.RaceLocaleSchema })
        .strict(),
    /** First server-selected hint when supplied by the current race server. */
    hint: zod_1.z
        .object({
        index: zod_1.z.number().int().nonnegative().max(limits_1.MAX_RIDDLE_ANSWER_CHARACTERS - 1),
        letter: raceTextSchemas_1.RaceGraphemeTextSchema,
    })
        .strict().optional(),
})
    .strict();
/** Schema for the lifecycle state of an authoritative race run. */
exports.RaceRunStatusSchema = zod_1.z.enum(["prepared", "scheduled", "active", "completed", "timed_out", "abandoned"]);
/** Schema for answer-free opponent identity and ghost playback data. */
exports.RaceOpponentSchema = zod_1.z
    .object({
    displayName: zod_1.z.string().trim().min(1).max(80),
    avatarUrl: zod_1.z.string().url().nullable().optional(),
    adjustedFinishMs: MillisecondsSchema,
    events: zod_1.z.array(raceGhostSchemas_1.RaceGhostEventSchema).max(raceDefinitionSchemas_1.RACE_DECK_SIZE * (raceDefinitionSchemas_1.RACE_MAX_HINTS_PER_RIDDLE + 1)),
})
    .strict()
    .check((context) => {
    /** Recorded opponent timeline bounded by its authoritative finish. */
    const opponent = context.value;
    if (opponent.events.some(event => event.adjustedElapsedMs > opponent.adjustedFinishMs))
        context.issues.push({ code: "custom", input: opponent, message: "Opponent history cannot extend beyond its recorded finish." });
});
/** Schema for the client projection of a race run. */
exports.RaceRunViewSchema = zod_1.z
    .object({
    runId: OpaqueIdSchema,
    challengeId: OpaqueIdSchema.optional(),
    rivalryChallengeId: OpaqueIdSchema.optional(),
    role: zod_1.z.enum(["creator", "challenger"]),
    status: exports.RaceRunStatusSchema,
    /** Authoritative time sampled when projecting this response. */
    serverNowMs: MillisecondsSchema.optional(),
    /** Immutable scored start, including the scheduled countdown lead-in. */
    startsAtMs: MillisecondsSchema.optional(),
    /** Latest time a prepared run may be scheduled. */
    preparationExpiresAtMs: MillisecondsSchema.optional(),
    categoryId: raceDefinitionSchemas_1.RaceCategoryIdSchema,
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    rules: raceDefinitionSchemas_1.RaceRulesSchema,
    correctCount: zod_1.z.number().int().nonnegative().max(raceDefinitionSchemas_1.RACE_TARGET_CORRECT),
    wallElapsedMs: MillisecondsSchema,
    totalPenaltyMs: MillisecondsSchema,
    adjustedElapsedMs: MillisecondsSchema,
    currentRiddle: exports.RaceRiddlePromptSchema.nullable(),
    /** Complete immutable deck used for instant local transitions; absent for answer-safe legacy callers. */
    preloadedRiddles: zod_1.z.array(exports.RacePreloadedRiddleSchema).length(raceDefinitionSchemas_1.RACE_DECK_SIZE).optional(),
    events: zod_1.z.array(raceGhostSchemas_1.RaceGhostEventSchema).max(raceDefinitionSchemas_1.RACE_DECK_SIZE * (raceDefinitionSchemas_1.RACE_MAX_HINTS_PER_RIDDLE + 1)),
    opponent: exports.RaceOpponentSchema.optional(),
})
    .strict()
    .check((context) => {
    /** Canonical run containing the event aggregates being validated. */
    const run = context.value;
    if (run.events.some(event => event.correctCount > run.correctCount || event.totalPenaltyMs > run.totalPenaltyMs ||
        run.status === "active" && event.wallElapsedMs > run.wallElapsedMs))
        context.issues.push({ code: "custom", input: run, message: "Known events cannot exceed their containing run's progress or clock." });
    /** Editable questions retain the fixed attempt budget and exact remaining hint capacity. */
    const prompt = run.currentRiddle;
    if (prompt) {
        if (prompt.guessesUsed >= run.rules.maxGuessesPerRiddle ||
            prompt.guessesUsed + prompt.guessesRemaining !== run.rules.maxGuessesPerRiddle)
            context.issues.push({ code: "custom", input: run, message: "Editable race attempts must retain their remaining guess budget." });
        /** Older one-hint runs use their recorded rule, rather than the current hint maximum. */
        const hintLimit = Math.min(run.rules.maxHintsPerRiddle, prompt.answerLength);
        if (prompt.revealedLetters.length > hintLimit || prompt.hintAvailable !== (prompt.revealedLetters.length < hintLimit))
            context.issues.push({ code: "custom", input: run, message: "Race hint availability must agree with the remaining hint budget." });
    }
    if (run.status === "active" && (run.correctCount >= run.rules.targetCorrect ||
        run.currentRiddle && run.correctCount > run.currentRiddle.position))
        context.issues.push({ code: "custom", input: run, message: "Active score cannot exceed owned question progress or reach the target." });
    /** Countdown may withhold the first prompt; all unscored metadata remains untouched. */
    const unscored = run.status === "prepared" || run.status === "scheduled";
    if (unscored && (run.correctCount !== 0 || run.totalPenaltyMs !== 0 || run.adjustedElapsedMs !== 0 ||
        run.events.length !== 0 || !prompt && (run.status !== "scheduled" || run.startsAtMs === undefined || run.serverNowMs === undefined) || prompt && (prompt.position !== 0 ||
        prompt.guessesUsed !== 0 || prompt.guessesRemaining !== run.rules.maxGuessesPerRiddle ||
        prompt.revealedLetters.length !== 0 || !prompt.hintAvailable)))
        context.issues.push({ code: "custom", input: run, message: "Unscored races must retain an untouched or withheld first question." });
    if (run.status === "prepared" && run.serverNowMs !== undefined && run.preparationExpiresAtMs !== undefined &&
        run.serverNowMs >= run.preparationExpiresAtMs)
        context.issues.push({ code: "custom", input: run, message: "Expired preparation must be abandoned before projection." });
    // Preparation/countdown are unscored; terminal durations remain fixed independently of later reads.
    if ((run.status === "prepared" || run.status === "scheduled") && run.wallElapsedMs !== 0 ||
        run.startsAtMs !== undefined && run.serverNowMs !== undefined &&
            (run.status === "active" && (run.serverNowMs < run.startsAtMs || run.wallElapsedMs !== run.serverNowMs - run.startsAtMs) ||
                run.status === "scheduled" && run.serverNowMs >= run.startsAtMs))
        context.issues.push({ code: "custom", input: run, message: "Live race clocks must agree with the fixed start." });
});
/** Schema for positional feedback returned for a submitted guess. */
exports.RaceLetterFeedbackSchema = zod_1.z
    .object({
    letter: raceTextSchemas_1.RaceGraphemeTextSchema,
    status: zod_1.z.enum(["green", "yellow", "red"]),
})
    .strict();
/** Schema wrapping the current answer-safe run view. */
exports.RaceRunResponseSchema = zod_1.z
    .object({
    run: exports.RaceRunViewSchema,
})
    .strict();
/** Schema for the result of an authoritative race guess. */
exports.SubmitRaceGuessResponseSchema = zod_1.z
    .object({
    run: exports.RaceRunViewSchema,
    feedback: zod_1.z.array(exports.RaceLetterFeedbackSchema).max(limits_1.MAX_RIDDLE_ANSWER_CHARACTERS),
    isCorrect: zod_1.z.boolean(),
    autoSkipped: zod_1.z.boolean(),
})
    .strict();
/** Schema for the result of an authoritative race hint request. */
exports.RequestRaceHintResponseSchema = zod_1.z
    .object({
    run: exports.RaceRunViewSchema,
    revealedLetter: raceTextSchemas_1.RaceGraphemeTextSchema,
    index: zod_1.z
        .number()
        .int()
        .nonnegative()
        .max(limits_1.MAX_RIDDLE_ANSWER_CHARACTERS - 1),
})
    .strict();
/** Schema for the result of an authoritative race skip request. */
exports.SkipRaceRiddleResponseSchema = zod_1.z
    .object({
    run: exports.RaceRunViewSchema,
    penaltyAddedMs: zod_1.z.literal(raceDefinitionSchemas_1.RACE_SKIP_PENALTY_MS),
})
    .strict();
/** Schema for the immutable final outcome of a completed race run. */
exports.RaceOutcomeSchema = zod_1.z
    .object({
    runId: OpaqueIdSchema,
    challengeId: OpaqueIdSchema.optional(),
    result: zod_1.z.enum(["recorded", "player_win", "ghost_win", "tie", "timed_out"]),
    correctCount: zod_1.z.number().int().nonnegative().max(raceDefinitionSchemas_1.RACE_TARGET_CORRECT),
    wallFinishMs: MillisecondsSchema,
    hintPenaltyMs: MillisecondsSchema,
    skipPenaltyMs: MillisecondsSchema,
    totalPenaltyMs: MillisecondsSchema,
    adjustedFinishMs: MillisecondsSchema,
    opponentAdjustedFinishMs: MillisecondsSchema.optional(),
    publishable: zod_1.z.boolean(),
    rematchEligible: zod_1.z.boolean(),
    newlyUnlockedAchievementIds: zod_1.z.array(raceDefinitionSchemas_1.RaceAchievementIdSchema).default([]),
    achievementCoinsAwarded: zod_1.z.number().int().nonnegative().default(0),
    newCoins: zod_1.z.number().int().nonnegative().optional(),
})
    .strict();
/** Schema for an answer-free preview of a published challenge. */
exports.RaceChallengePreviewSchema = zod_1.z
    .object({
    challengeId: OpaqueIdSchema,
    rivalryChallengeId: OpaqueIdSchema.optional(),
    creator: zod_1.z
        .object({
        displayName: zod_1.z.string().trim().min(1).max(80),
        avatarUrl: zod_1.z.string().url().nullable().optional(),
    })
        .strict(),
    categoryId: raceDefinitionSchemas_1.RaceCategoryIdSchema,
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    targetCorrect: zod_1.z.literal(raceDefinitionSchemas_1.RACE_TARGET_CORRECT),
    adjustedTimeToBeatMs: MillisecondsSchema,
    rulesVersion: zod_1.z.literal(raceDefinitionSchemas_1.RACE_RULES_VERSION),
    expiresAtMs: MillisecondsSchema,
    status: zod_1.z.enum(["active", "expired", "revoked"]),
})
    .strict();
/** Schema for a locale-specific race category listing request. */
exports.ListRaceCategoriesRequestSchema = zod_1.z
    .object({
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
})
    .strict();
/** Schema for a race category listing response and its rules. */
exports.ListRaceCategoriesResponseSchema = zod_1.z
    .object({
    categories: zod_1.z.array(raceDefinitionSchemas_1.RaceCategorySchema),
    rules: raceDefinitionSchemas_1.RaceRulesSchema,
})
    .strict();
/** Schema for starting a category run or accepting one direct challenge. */
exports.StartRaceRunRequestSchema = zod_1.z
    .object({
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    categoryId: raceDefinitionSchemas_1.RaceCategoryIdSchema.optional(),
    challengeId: OpaqueIdSchema.optional(),
    rivalryChallengeId: OpaqueIdSchema.optional(),
    /** Optional server-issued matchmaking attribution; direct links remain supported. */
    offerId: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(),
    /** Owner-bound fallback offered only after an eligible pool search completes. */
    fallbackOfferId: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(),
    requestId: RequestIdSchema,
    includeEvaluation: zod_1.z.boolean().optional(),
    /** Prepare content without starting the scored clock. */
    prepare: zod_1.z.boolean().optional(),
})
    .strict()
    .refine((input) => Boolean(input.categoryId) !== Boolean(input.challengeId), {
    message: "Provide exactly one of categoryId or challengeId",
})
    .refine((input) => !(input.challengeId && input.rivalryChallengeId), {
    message: "A direct challenge cannot also be a counter-challenge",
})
    .refine(input => !input.offerId || Boolean(input.challengeId), { message: "Match offers require a direct challenge" })
    .refine(input => !input.fallbackOfferId || Boolean(input.categoryId) && !input.rivalryChallengeId && !input.offerId, { message: "Fallback offers require a category without a challenge or rivalry" });
/** Schema identifying a race run owned by the authenticated player. */
exports.RaceRunIdRequestSchema = zod_1.z
    .object({
    runId: OpaqueIdSchema,
    includeEvaluation: zod_1.z.boolean().optional(),
    /** New clients opt into history without changing responses accepted by older previews. */
    includeGuessHistory: zod_1.z.boolean().optional(),
})
    .strict();
/** Idempotent command to schedule an owned prepared run; repeats never reset its clock. */
exports.ReadyRaceRunRequestSchema = zod_1.z.object({ runId: OpaqueIdSchema, requestId: RequestIdSchema,
    includeEvaluation: zod_1.z.boolean().optional() }).strict();
/** Schema for an idempotent request to abandon an active run. */
exports.AbandonRaceRunRequestSchema = zod_1.z
    .object({
    runId: OpaqueIdSchema,
    requestId: RequestIdSchema,
})
    .strict();
/** Schema returned after a race run is abandoned. */
exports.AbandonRaceRunResponseSchema = zod_1.z
    .object({
    run: exports.RaceRunViewSchema,
    result: zod_1.z.null(),
})
    .strict();
/** Schema for an idempotent guess against the active race riddle. */
exports.SubmitRaceGuessRequestSchema = zod_1.z
    .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    guess: raceTextSchemas_1.RaceGuessTextSchema,
    requestId: RequestIdSchema,
    includeEvaluation: zod_1.z.boolean().optional(),
})
    .strict();
/** Schema for an idempotent hint request against the active race riddle. */
exports.RequestRaceHintRequestSchema = zod_1.z
    .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    requestId: RequestIdSchema,
    includeEvaluation: zod_1.z.boolean().optional(),
})
    .strict();
/** Schema for an idempotent skip request against the active race riddle. */
exports.SkipRaceRiddleRequestSchema = zod_1.z
    .object({
    runId: OpaqueIdSchema,
    riddleId: OpaqueIdSchema,
    requestId: RequestIdSchema,
    includeEvaluation: zod_1.z.boolean().optional(),
})
    .strict();
/** Schema for publishing a verified creator run as a challenge. */
exports.PublishRaceChallengeRequestSchema = zod_1.z
    .object({
    runId: OpaqueIdSchema,
    requestId: RequestIdSchema,
    reservedChallengeId: zod_1.z.string().regex(/^jest-invite-[a-f0-9]{64}-[a-f0-9]{32}$/).optional(),
})
    .strict();
/** Schema returned after publishing a verified race challenge. */
exports.PublishRaceChallengeResponseSchema = zod_1.z
    .object({
    challengeId: OpaqueIdSchema,
    preview: exports.RaceChallengePreviewSchema,
    newlyUnlockedAchievementIds: zod_1.z.array(raceDefinitionSchemas_1.RaceAchievementIdSchema).default([]),
    achievementCoinsAwarded: zod_1.z.number().int().nonnegative().default(0),
    newCoins: zod_1.z.number().int().nonnegative().optional(),
})
    .strict();
/** Creates one expiring server-owned lobby before opening a provider invite dialog. */
exports.ReserveRaceInviteRequestSchema = zod_1.z
    .object({
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    requestId: RequestIdSchema,
})
    .strict();
/** Identifies the reserved lobby carried through the provider referral payload. */
exports.ReserveRaceInviteResponseSchema = zod_1.z
    .object({
    challengeId: zod_1.z.string().regex(/^jest-invite-[a-f0-9]{64}-[a-f0-9]{32}$/),
    expiresAtMs: MillisecondsSchema,
})
    .strict();
/** Schema identifying one published race challenge. */
exports.RaceChallengeIdRequestSchema = zod_1.z
    .object({
    challengeId: OpaqueIdSchema,
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
})
    .strict();
/** Opt-in viewer facts keep strict legacy responses compatible. */
exports.RaceEntryRequestSchema = exports.RaceChallengeIdRequestSchema.extend({ includeViewerRole: zod_1.z.boolean().optional(), includeExistingAttempt: zod_1.z.boolean().optional() }).strict();
/** Answer-free invitation facts; exclusive seat identity never crosses this seam. */
exports.RaceInvitationViewSchema = zod_1.z.object({
    claimState: zod_1.z.enum(["unclaimed", "claimed"]),
    publicationState: zod_1.z.enum(["pending", "published"]),
    role: zod_1.z.enum(["creator", "recipient"]),
    canCancel: zod_1.z.boolean(),
    expiresAtMs: MillisecondsSchema,
}).strict();
/** Typed challenge readiness shared by direct links and reserved invitations. */
exports.RaceEntryResponseSchema = zod_1.z.discriminatedUnion("status", [
    zod_1.z.object({ status: zod_1.z.literal("ready"), challenge: exports.RaceChallengePreviewSchema, viewerRole: zod_1.z.enum(["creator", "recipient"]).optional(), existingRunId: OpaqueIdSchema.optional(), invitation: exports.RaceInvitationViewSchema.optional(), serverNowMs: MillisecondsSchema }).strict(),
    zod_1.z.object({ status: zod_1.z.literal("waiting"), invitation: exports.RaceInvitationViewSchema, serverNowMs: MillisecondsSchema }).strict(),
    zod_1.z.object({ status: zod_1.z.literal("expired"), invitation: exports.RaceInvitationViewSchema.optional(), serverNowMs: MillisecondsSchema }).strict(),
    zod_1.z.object({ status: zod_1.z.literal("cancelled"), invitation: exports.RaceInvitationViewSchema.optional(), serverNowMs: MillisecondsSchema }).strict(),
    zod_1.z.object({ status: zod_1.z.literal("unavailable"), reason: zod_1.z.enum(["missing", "claimed", "blocked", "deleted", "locale", "inactive", "invalid"]), serverNowMs: MillisecondsSchema }).strict(),
]);
/** Idempotent creator cancellation affects a reserved invitation, never a reusable public share. */
exports.CancelRaceInviteRequestSchema = exports.RaceChallengeIdRequestSchema.extend({ requestId: RequestIdSchema }).strict();
/** Requests a recorded opponent; provider scope is derived by the trusted adapter. */
exports.RaceMatchRequestSchema = zod_1.z.object({
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    categoryId: raceDefinitionSchemas_1.RaceCategoryIdSchema.optional(),
    requestId: RequestIdSchema.optional(),
}).strict();
/** Answer-safe recorded matchmaking result shared by supported provider adapters. */
exports.RaceMatchResponseSchema = zod_1.z.discriminatedUnion("status", [
    zod_1.z.object({ status: zod_1.z.literal("matched"), challenge: exports.RaceChallengePreviewSchema,
        /** Optional only for compatibility with older provider adapters. */
        offerId: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict(),
    zod_1.z.object({ status: zod_1.z.literal("empty"), locale: raceDefinitionSchemas_1.RaceLocaleSchema,
        fallback: zod_1.z.object({ offerId: zod_1.z.string().regex(/^[a-f0-9]{64}$/), categoryId: raceDefinitionSchemas_1.RaceCategoryIdSchema }).strict().optional() }).strict(),
]);
/** Compatibility alias for deployed Reddit gateway requests. */
exports.FindRedditRaceMatchRequestSchema = exports.RaceMatchRequestSchema;
/** Compatibility alias for deployed Reddit gateway responses. */
exports.FindRedditRaceMatchResponseSchema = exports.RaceMatchResponseSchema;
/** Schema for one answer-free multiplayer result inbox item. */
exports.RaceInboxItemSchema = zod_1.z
    .object({
    itemId: OpaqueIdSchema,
    challengeId: OpaqueIdSchema,
    /** Provider-neutral account identifier used only by server-authorized safety actions. */
    opponentUserId: zod_1.z.string().trim().min(1).max(128).optional(),
    opponentDisplayName: zod_1.z.string().trim().min(1).max(80),
    opponentAvatarUrl: zod_1.z.string().url().nullable().optional(),
    /** Trusted opponent progression at result delivery. */
    opponentLevel: zod_1.z.number().int().positive().optional(),
    categoryId: raceDefinitionSchemas_1.RaceCategoryIdSchema,
    result: zod_1.z.enum(["win", "loss", "tie"]),
    adjustedDeltaMs: zod_1.z.number().int(),
    read: zod_1.z.boolean(),
    createdAtMs: MillisecondsSchema,
})
    .strict();
/** Bounded moderation categories accepted by the social-safety queue. */
exports.SocialReportCategorySchema = zod_1.z.enum(["harassment", "cheating", "inappropriate_identity", "spam", "other"]);
/** Exact social target is either an established rival or the caller's opaque live seat. */
exports.BlockSocialRivalRequestSchema = zod_1.z.union([
    zod_1.z.object({ targetUserId: zod_1.z.string().trim().min(1).max(128) }).strict(),
    zod_1.z.object({ liveTicketId: zod_1.z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
]);
/** Categorized reporting never accepts narrative text or competing target selectors. */
exports.ReportSocialRivalRequestSchema = zod_1.z.union([
    zod_1.z.object({ targetUserId: zod_1.z.string().trim().min(1).max(128), category: exports.SocialReportCategorySchema,
        requestId: zod_1.z.string().regex(/^[A-Za-z0-9_-]{8,160}$/) }).strict(),
    zod_1.z.object({ liveTicketId: zod_1.z.string().regex(/^[a-f0-9]{64}$/), category: exports.SocialReportCategorySchema,
        requestId: zod_1.z.string().regex(/^[A-Za-z0-9_-]{8,160}$/) }).strict(),
]);
/** Identity-free acknowledgement of an authoritative block. */
exports.BlockSocialRivalResponseSchema = zod_1.z.object({ blocked: zod_1.z.literal(true) }).strict();
/** A queue acknowledgement never promises moderation disposition. */
exports.ReportSocialRivalResponseSchema = zod_1.z.object({ reportId: zod_1.z.string().min(1).max(160), queued: zod_1.z.literal(true) }).strict();
/** Schema for a bounded, cursor-paginated race inbox request. */
exports.ListRaceInboxRequestSchema = zod_1.z
    .object({
    cursor: zod_1.z.string().min(1).max(500).optional(),
    limit: zod_1.z.number().int().positive().max(50).default(20),
})
    .strict()
    .default({ limit: 20 });
/** Schema for a page of multiplayer result inbox items. */
exports.ListRaceInboxResponseSchema = zod_1.z
    .object({
    items: zod_1.z.array(exports.RaceInboxItemSchema),
    nextCursor: zod_1.z.string().min(1).max(500).optional(),
})
    .strict();
/** Facebook tournament submissions identify an authoritative run, never a client score. */
exports.RecordFacebookTournamentRunRequestSchema = zod_1.z
    .object({
    runId: OpaqueIdSchema,
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
})
    .strict();
/** Answer- and economy-free result of recording an official Facebook tournament run. */
exports.RecordFacebookTournamentRunResponseSchema = zod_1.z
    .object({
    tournamentId: OpaqueIdSchema,
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    runId: OpaqueIdSchema,
    adjustedTimeMs: MillisecondsSchema.max(raceDefinitionSchemas_1.RACE_MAX_ADJUSTED_TIME_MS),
    completedAtMs: MillisecondsSchema,
    improved: zod_1.z.boolean(),
    sortOrder: zod_1.z.literal("LOWER_IS_BETTER"),
    rewardsEnabled: zod_1.z.literal(false),
})
    .strict();
/** Requests the active 24-hour Facebook tournament for one exact locale. */
exports.ListFacebookTournamentRequestSchema = zod_1.z.object({ locale: raceDefinitionSchemas_1.RaceLocaleSchema }).strict();
/** One identity-free row in the server-authoritative tournament presentation. */
exports.FacebookTournamentStandingSchema = zod_1.z
    .object({
    rank: zod_1.z.number().int().positive(),
    adjustedTimeMs: MillisecondsSchema.max(raceDefinitionSchemas_1.RACE_MAX_ADJUSTED_TIME_MS),
    isCurrentPlayer: zod_1.z.boolean(),
})
    .strict();
/** Active tournament metadata and its bounded, economy-free standings. */
exports.ListFacebookTournamentResponseSchema = zod_1.z
    .object({
    tournamentId: OpaqueIdSchema,
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    startsAtMs: MillisecondsSchema,
    endsAtMs: MillisecondsSchema,
    sortOrder: zod_1.z.literal("LOWER_IS_BETTER"),
    rewardsEnabled: zod_1.z.literal(false),
    standings: zod_1.z.array(exports.FacebookTournamentStandingSchema).max(50),
    currentPlayer: exports.FacebookTournamentStandingSchema.optional(),
})
    .strict();
/** Validates the facebook context id data shape. */
const FacebookContextIdSchema = zod_1.z
    .string()
    .min(1)
    .max(256)
    .regex(/^[A-Za-z0-9._:-]+$/);
/** Records one authoritative run into the player's current Facebook context board. */
exports.RecordFacebookContextRunRequestSchema = zod_1.z
    .object({
    contextId: FacebookContextIdSchema,
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    runId: OpaqueIdSchema,
})
    .strict();
/** Economy- and identity-free result of recording a context-board run. */
exports.RecordFacebookContextRunResponseSchema = zod_1.z
    .object({
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    runId: OpaqueIdSchema,
    adjustedTimeMs: MillisecondsSchema.max(raceDefinitionSchemas_1.RACE_MAX_ADJUSTED_TIME_MS),
    completedAtMs: MillisecondsSchema,
    improved: zod_1.z.boolean(),
    sortOrder: zod_1.z.literal("LOWER_IS_BETTER"),
    rewardsEnabled: zod_1.z.literal(false),
})
    .strict();
/** Requests the active seven-day board for an exact Facebook context and locale. */
exports.ListFacebookContextBoardRequestSchema = zod_1.z
    .object({
    contextId: FacebookContextIdSchema,
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
})
    .strict();
/** Bounded identity-free Facebook context board. */
exports.ListFacebookContextBoardResponseSchema = zod_1.z
    .object({
    locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    startsAtMs: MillisecondsSchema,
    endsAtMs: MillisecondsSchema,
    sortOrder: zod_1.z.literal("LOWER_IS_BETTER"),
    rewardsEnabled: zod_1.z.literal(false),
    standings: zod_1.z.array(exports.FacebookTournamentStandingSchema).max(50),
    currentPlayer: exports.FacebookTournamentStandingSchema.optional(),
})
    .strict();
