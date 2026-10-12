"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertRaceStoredRecord = assertRaceStoredRecord;
const zod_1 = require("zod");
const game_1 = require("@qwordly/core/game");
const https_1 = require("firebase-functions/v2/https");
const race_1 = require("@qwordly/core/race");
const raceStoredTimeline_1 = require("./raceStoredTimeline");
const raceEngine_1 = require("./raceEngine");
const raceAchievements_1 = require("./raceAchievements");
/** Storage IDs are opaque single path segments, including supported legacy identities. */
const Id = zod_1.z.string().min(1).max(160).refine(value => !value.includes("/"));
/** Canonical clocks and durations must never admit NaN, infinity or negative values. */
const Ms = zod_1.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
/** Immutable server deck shape; unknown extension metadata survives supported legacy reads. */
const Riddle = zod_1.z.looseObject({ riddleId: Id, canonicalRiddleId: Id, text: zod_1.z.string().min(1).max(2000),
    answer: zod_1.z.string().min(1), position: zod_1.z.number().int().min(0).max(14), difficultyBand: zod_1.z.enum(["easy", "medium", "hard"]).optional() });
/** Provider presentation is optional metadata and never an authorization credential. */
const Identity = zod_1.z.looseObject({ displayName: zod_1.z.string().min(1).max(80), avatarUrl: zod_1.z.string().nullable().optional() });
/** Canonical run validation covers every engine/scoring input before the storage cast. */
const Run = zod_1.z.looseObject({ recordVersion: zod_1.z.literal(1).optional(), runId: Id, userId: Id, challengeId: Id.optional(),
    matchOfferId: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(),
    recordingFingerprint: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(),
    fallbackOfferId: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(),
    rivalryChallengeId: Id.optional(), role: zod_1.z.enum(["creator", "challenger"]), status: race_1.RaceRunStatusSchema,
    result: zod_1.z.enum(["player_win", "ghost_win", "tie", "timed_out", "recorded"]).nullable().optional(),
    categoryId: race_1.RaceCategoryIdSchema, locale: race_1.RaceLocaleSchema, rulesVersion: zod_1.z.literal(race_1.RACE_RULES_VERSION), rulesSnapshot: race_1.RaceRulesSchema.optional(),
    deckId: Id, riddles: zod_1.z.array(Riddle).min(1).max(15), currentPosition: zod_1.z.number().int().min(0).max(15),
    correctCount: zod_1.z.number().int().min(0).max(10), guessesUsed: zod_1.z.number().int().min(0).max(5), guessHistory: zod_1.z.array(zod_1.z.string().min(1).max(race_1.RACE_NORMALIZED_TEXT_UNITS)).max(5).optional(), hintUsed: zod_1.z.boolean(),
    revealedLetters: zod_1.z.array(zod_1.z.looseObject({ index: zod_1.z.number().int().nonnegative(), letter: zod_1.z.string().min(1) })),
    startedAtMs: Ms, lastActionAtMs: Ms.optional(), readinessAcceptedAtMs: Ms.optional(), deadlineAtMs: Ms.optional(), preparationExpiresAtMs: Ms.optional(), finishedAtMs: Ms.optional(), wallFinishMs: Ms.optional(),
    hintPenaltyMs: Ms, skipPenaltyMs: Ms, events: zod_1.z.array(race_1.RaceGhostEventSchema),
    opponent: Identity.extend({ kind: zod_1.z.literal("bot").optional(), subjectUserId: Id.optional(), adjustedFinishMs: Ms, events: zod_1.z.array(race_1.RaceGhostEventSchema) }).optional(),
    contentVersion: zod_1.z.string().min(1).optional(), evaluationPolicy: zod_1.z.enum(["preloaded", "server-only"]).optional(),
    settledAtMs: Ms.optional(), settledOutcome: race_1.RaceOutcomeSchema.optional(),
    rateLimitWindowStartedAtMs: Ms.optional(), rateLimitActionCount: zod_1.z.number().int().nonnegative().optional(),
    achievementProgressRecordedAtMs: Ms.optional(), achievementOutcomePresentedAtMs: Ms.optional(),
    settlementAwards: zod_1.z.object({ newlyUnlockedAchievementIds: zod_1.z.array(zod_1.z.string()), achievementCoinsAwarded: zod_1.z.number().int().nonnegative() }).optional(),
}).superRefine((run, context) => {
    if (run.recordingFingerprint !== undefined && (!run.challengeId || run.role !== "challenger"))
        context.addIssue({ code: "custom", message: "Recording provenance requires a challenger source." });
    if (run.opponent?.kind === "bot" && (run.opponent.subjectUserId !== undefined || run.role !== "challenger" ||
        run.challengeId !== undefined || run.fallbackOfferId === undefined))
        context.addIssue({ code: "custom", message: "Synthetic opponents require an owned fallback run without account linkage." });
    if (run.riddles.some((riddle, position) => riddle.position !== position) ||
        new Set(run.riddles.map(riddle => riddle.riddleId)).size !== run.riddles.length ||
        new Set(run.riddles.map(riddle => riddle.canonicalRiddleId)).size !== run.riddles.length ||
        run.currentPosition > run.riddles.length ||
        ["prepared", "scheduled", "active"].includes(run.status) && run.currentPosition >= run.riddles.length)
        context.addIssue({ code: "custom", message: "Run deck ordering and position must agree." });
    if (run.rulesSnapshot && run.rulesSnapshot.version !== run.rulesVersion)
        context.addIssue({ code: "custom", message: "Run rules identities must agree." });
    /** The final clearing action keeps its owned question; every other clear advances to the next position. */
    const clearedPositions = run.currentPosition + (run.status === "completed" && run.correctCount === race_1.RACE_RULES.targetCorrect ? 1 : 0);
    if (run.correctCount > Math.min(clearedPositions, run.riddles.length) || run.recordVersion === 1 && run.correctCount !== clearedPositions)
        context.addIssue({ code: "custom", message: "Score must agree with owned question progress." });
    /** Persisted hints refer to distinct real grapheme positions in the owned current question. */
    const current = run.riddles[run.currentPosition];
    /** Locale-aware segmentation matches the authoritative hint engine. */
    const answer = current ? (0, game_1.splitGraphemes)(current.answer, run.locale) : [];
    if (run.guessHistory && (run.guessHistory.length > run.guessesUsed ||
        run.guessHistory.some(guess => (0, game_1.splitGraphemes)(guess, run.locale).length !== answer.length)))
        context.addIssue({ code: "custom", message: "Confirmed guesses must match consumed attempts and current question length." });
    if (new Set(run.revealedLetters.map(letter => letter.index)).size !== run.revealedLetters.length ||
        run.revealedLetters.some(letter => answer[letter.index] !== letter.letter))
        context.addIssue({ code: "custom", message: "Revealed hints must match the current question." });
    /** Lifecycle states cannot carry another state's scoring or terminal clocks. */
    const live = ["prepared", "scheduled", "active"].includes(run.status);
    /** Cancelling an untouched countdown is the only accepted command before scored start. */
    const countdownCancellation = run.status === "abandoned" && run.wallFinishMs === 0 && run.finishedAtMs === run.lastActionAtMs &&
        run.currentPosition === 0 && run.correctCount === 0 && run.guessesUsed === 0 && !run.hintUsed && run.revealedLetters.length === 0 &&
        run.hintPenaltyMs === 0 && run.skipPenaltyMs === 0 && run.events.length === 0;
    if (run.readinessAcceptedAtMs !== undefined && (run.status === "prepared" ||
        run.startedAtMs !== run.readinessAcceptedAtMs + raceEngine_1.RACE_START_LEAD_MS ||
        run.preparationExpiresAtMs !== undefined && run.readinessAcceptedAtMs >= run.preparationExpiresAtMs ||
        run.lastActionAtMs !== undefined && run.lastActionAtMs < run.readinessAcceptedAtMs ||
        run.finishedAtMs !== undefined && run.finishedAtMs < run.readinessAcceptedAtMs))
        context.addIssue({ code: "custom", message: "Readiness must precede the fixed start and accepted progress." });
    /** The same authored graphemes and immutable rules bound both player and opponent hint events. */
    const hintLimits = run.riddles.map(riddle => Math.min((run.rulesSnapshot ?? race_1.RACE_RULES).maxHintsPerRiddle, (0, game_1.splitGraphemes)(riddle.answer, run.locale).length));
    if (!(0, raceStoredTimeline_1.raceTimelineAgrees)(run.events, { deckSize: run.riddles.length, correctCount: run.correctCount, hintLimits,
        hintPenaltyMs: run.hintPenaltyMs, skipPenaltyMs: run.skipPenaltyMs, totalPenaltyMs: run.hintPenaltyMs + run.skipPenaltyMs,
        currentPosition: run.currentPosition, live,
        acceptedWallMs: run.lastActionAtMs === undefined ? undefined : countdownCancellation
            ? Math.max(0, run.lastActionAtMs - run.startedAtMs) : run.lastActionAtMs - run.startedAtMs }) ||
        run.opponent && !(0, raceStoredTimeline_1.raceTimelineAgrees)(run.opponent.events, { deckSize: run.riddles.length, correctCount: race_1.RACE_RULES.targetCorrect, hintLimits,
            adjustedFinishMs: run.opponent.adjustedFinishMs }))
        context.addIssue({ code: "custom", message: "Run history must agree with retained scoring authority." });
    if (live && (run.result != null || run.finishedAtMs !== undefined || run.wallFinishMs !== undefined || run.correctCount >= 10) ||
        run.status === "prepared" && (run.startedAtMs !== 0 || run.preparationExpiresAtMs === undefined || run.preparationExpiresAtMs === 0) ||
        ["prepared", "scheduled"].includes(run.status) && (run.currentPosition !== 0 || run.correctCount !== 0 || run.guessesUsed !== 0 || run.hintUsed || run.revealedLetters.length > 0 ||
            run.hintPenaltyMs !== 0 || run.skipPenaltyMs !== 0 || run.events.length > 0) ||
        run.status === "completed" && !["recorded", "player_win", "ghost_win", "tie"].includes(run.result ?? "") ||
        run.status === "timed_out" && run.result !== "timed_out" || run.status === "abandoned" && run.result != null)
        context.addIssue({ code: "custom", message: "Run lifecycle and scoring state must agree." });
    if (["completed", "timed_out"].includes(run.status) && (run.wallFinishMs === undefined || run.finishedAtMs === undefined ||
        run.finishedAtMs !== run.startedAtMs + run.wallFinishMs))
        context.addIssue({ code: "custom", message: "Terminal scoring clocks must agree." });
    if (["completed", "timed_out"].includes(run.status) && run.wallFinishMs !== undefined) {
        /** Historical runs execute their immutable rules, with the engine's supported legacy default. */
        const rules = run.rulesSnapshot ?? race_1.RACE_RULES;
        /** Penalty-triggered finishes can retain more penalty time than the requested deadline. */
        const penalty = run.hintPenaltyMs + run.skipPenaltyMs;
        /** Persisted terminal time, independent of the later read or settlement clock. */
        const adjusted = run.wallFinishMs + penalty;
        /** Completion after a tenth skip may legitimately exceed the active maximum. */
        const finishedTen = run.correctCount === rules.targetCorrect;
        /** Complete runs cannot finish before a recorded action; deadline losses may legitimately clamp backwards. */
        const earliestCompleteWallMs = Math.max(run.lastActionAtMs === undefined ? 0 : run.lastActionAtMs - run.startedAtMs, run.events.reduce((latest, event) => Math.max(latest, event.wallElapsedMs), 0));
        /** Only a fully cleared recording or the exact opponent comparison can decide a completed run. */
        const completedResult = run.opponent
            ? adjusted < run.opponent.adjustedFinishMs ? "player_win" : adjusted === run.opponent.adjustedFinishMs ? "tie" : "ghost_win"
            : "recorded";
        /** An unfinished ghost loss is clamped by finishRun; the maximum has precedence for challengers. */
        const validGhostDeadline = run.result === "ghost_win" && run.opponent !== undefined &&
            adjusted === Math.max(run.opponent.adjustedFinishMs, penalty) &&
            (run.role !== "challenger" || run.opponent.adjustedFinishMs < rules.maxAdjustedTimeMs && penalty < rules.maxAdjustedTimeMs);
        if (!Number.isSafeInteger(adjusted) || finishedTen && run.wallFinishMs < earliestCompleteWallMs ||
            run.status === "completed" && !(finishedTen ? run.result === completedResult : validGhostDeadline) ||
            run.status === "timed_out" && (finishedTen || (run.currentPosition >= run.riddles.length
                ? adjusted > Math.max(rules.maxAdjustedTimeMs, penalty)
                : run.role !== "challenger" && !(0, raceEngine_1.raceHasLegacyTerminalGrant)(run) || adjusted !== Math.max(rules.maxAdjustedTimeMs, penalty))))
            context.addIssue({ code: "custom", message: "Terminal result must follow the recorded score and clocks." });
    }
    if (run.settledOutcome) {
        /** Settlement is a deterministic projection of this terminal run, never another authority record. */
        const outcome = run.settledOutcome;
        /** Totals use persisted terminal durations rather than a read-time clock. */
        const totalPenaltyMs = run.hintPenaltyMs + run.skipPenaltyMs;
        if (!["completed", "timed_out"].includes(run.status) || run.settledAtMs === undefined || run.wallFinishMs === undefined ||
            outcome.runId !== run.runId || outcome.challengeId !== run.challengeId || outcome.result !== run.result ||
            outcome.correctCount !== run.correctCount || outcome.wallFinishMs !== run.wallFinishMs ||
            outcome.hintPenaltyMs !== run.hintPenaltyMs || outcome.skipPenaltyMs !== run.skipPenaltyMs ||
            outcome.totalPenaltyMs !== totalPenaltyMs || outcome.adjustedFinishMs !== run.wallFinishMs + totalPenaltyMs ||
            outcome.opponentAdjustedFinishMs !== run.opponent?.adjustedFinishMs ||
            outcome.publishable !== (run.role === "creator" && run.result === "recorded" && run.correctCount === 10) ||
            outcome.rematchEligible !== (run.role === "challenger" && run.status === "completed"))
            context.addIssue({ code: "custom", message: "Settled outcome must match its terminal run." });
        if (outcome.newlyUnlockedAchievementIds.length > 0 || outcome.achievementCoinsAwarded !== 0 || outcome.newCoins !== undefined)
            context.addIssue({ code: "custom", message: "Canonical outcomes must not retain one-time presentation rewards." });
    }
    if (run.settledAtMs !== undefined && (run.finishedAtMs === undefined || run.settledAtMs < run.finishedAtMs || run.settledOutcome === undefined))
        context.addIssue({ code: "custom", message: "Settlement clocks and outcome must agree." });
    /** Accepted action clocks still constrain old deadline-clamped terminal grants. */
    const progressFloor = Math.max(run.startedAtMs, run.finishedAtMs ?? 0, run.lastActionAtMs ?? 0, ...run.events.map(event => run.startedAtMs + event.wallElapsedMs));
    if (run.settledAtMs !== undefined && run.settledAtMs < progressFloor)
        context.addIssue({ code: "custom", message: "Settlement must follow every accepted action." });
    if (run.achievementProgressRecordedAtMs !== undefined &&
        (run.achievementProgressRecordedAtMs < progressFloor ||
            !["completed", "timed_out"].includes(run.status) && !(0, raceEngine_1.raceHasLegacyTerminalGrant)(run) ||
            run.recordVersion === 1 && run.settledAtMs === undefined ||
            run.settledAtMs !== undefined && run.achievementProgressRecordedAtMs > run.settledAtMs))
        context.addIssue({ code: "custom", message: "Achievement progress must follow an accepted terminal occurrence." });
    if (run.settlementAwards && (run.settledAtMs === undefined || run.achievementProgressRecordedAtMs === undefined ||
        !(0, raceAchievements_1.raceRewardAwardsAgree)(run.settlementAwards.newlyUnlockedAchievementIds, run.settlementAwards.achievementCoinsAwarded)))
        context.addIssue({ code: "custom", message: "Retained awards require an accepted grant receipt." });
    if (run.achievementOutcomePresentedAtMs !== undefined &&
        (run.settledAtMs === undefined || run.achievementOutcomePresentedAtMs < Math.max(run.settledAtMs, run.achievementProgressRecordedAtMs ?? 0)))
        context.addIssue({ code: "custom", message: "Reward presentation must follow settlement and its grant." });
});
/** Canonical recording validation preserves legacy normalization performed by its reader. */
const Challenge = zod_1.z.looseObject({ recordVersion: zod_1.z.literal(1).optional(), challengeId: Id, creatorId: Id, creatorRunId: Id,
    rivalryChallengeId: Id.optional(), creatorSnapshot: Identity, categoryId: race_1.RaceCategoryIdSchema, locale: race_1.RaceLocaleSchema,
    deckId: Id, scope: zod_1.z.enum(["public", "invitation"]).optional(), riddles: zod_1.z.array(Riddle).min(1).max(15).optional(),
    snapshotVersion: zod_1.z.literal(1).optional(), evaluationPolicy: zod_1.z.enum(["preloaded", "server-only"]).optional(),
    canonicalRiddleIds: zod_1.z.array(Id).min(1).max(15), targetCorrect: zod_1.z.literal(10), creatorWallFinishMs: Ms,
    creatorHintPenaltyMs: Ms, creatorSkipPenaltyMs: Ms, creatorTotalPenaltyMs: Ms, creatorAdjustedFinishMs: Ms,
    ghostEvents: zod_1.z.array(race_1.RaceGhostEventSchema), rules: race_1.RaceRulesSchema, contentVersion: zod_1.z.string().min(1),
    recordingPerformanceMs: zod_1.z.number().finite().positive().optional(), status: zod_1.z.enum(["active", "expired", "revoked"]),
    createdAtMs: Ms, expiresAtMs: Ms, }).refine(value => value.expiresAtMs > value.createdAtMs, { message: "Recording expiry must follow creation" })
    .superRefine((challenge, context) => {
    /** Older answer-free archives retain the immutable rules limit, while full snapshots also bound authored hints. */
    const hintLimits = challenge.canonicalRiddleIds.map((_, position) => Math.min(challenge.rules.maxHintsPerRiddle, challenge.riddles ? (0, game_1.splitGraphemes)(challenge.riddles[position]?.answer ?? "", challenge.locale).length : challenge.rules.maxHintsPerRiddle));
    if (!(0, raceStoredTimeline_1.raceTimelineAgrees)(challenge.ghostEvents, { deckSize: challenge.canonicalRiddleIds.length, correctCount: challenge.targetCorrect, hintLimits,
        hintPenaltyMs: challenge.creatorHintPenaltyMs, skipPenaltyMs: challenge.creatorSkipPenaltyMs,
        totalPenaltyMs: challenge.creatorTotalPenaltyMs, adjustedFinishMs: challenge.creatorAdjustedFinishMs }))
        context.addIssue({ code: "custom", message: "Recording history must agree with retained scoring authority." });
    if (new Set(challenge.canonicalRiddleIds).size !== challenge.canonicalRiddleIds.length ||
        challenge.creatorTotalPenaltyMs !== challenge.creatorHintPenaltyMs + challenge.creatorSkipPenaltyMs ||
        challenge.creatorAdjustedFinishMs !== challenge.creatorWallFinishMs + challenge.creatorTotalPenaltyMs ||
        challenge.riddles && (challenge.riddles.length !== challenge.canonicalRiddleIds.length ||
            new Set(challenge.riddles.map(riddle => riddle.riddleId)).size !== challenge.riddles.length ||
            challenge.riddles.some((riddle, position) => riddle.position !== position || riddle.canonicalRiddleId !== challenge.canonicalRiddleIds[position])))
        context.addIssue({ code: "custom", message: "Recording deck and timing totals must agree." });
});
/** Rejects unsupported/corrupt storage without exposing answer-bearing validation diagnostics. */
function assertRaceStoredRecord(value, kind) {
    /** Provides result behavior. */
    const result = (kind === "run" ? Run : Challenge).safeParse(value);
    if (!result.success)
        throw new https_1.HttpsError("data-loss", `Stored Race to 10 ${kind} is invalid.`);
}
//# sourceMappingURL=raceStoredRecords.js.map