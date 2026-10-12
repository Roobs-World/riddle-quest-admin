"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRaceBotOffer = parseRaceBotOffer;
exports.assertRaceAcceptedBotRun = assertRaceAcceptedBotRun;
exports.replayRaceBotOffer = replayRaceBotOffer;
exports.offerRaceBot = offerRaceBot;
exports.buildRaceBotOpponent = buildRaceBotOpponent;
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const https_1 = require("firebase-functions/v2/https");
const race_1 = require("@qwordly/core/race");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const raceSetupService_1 = require("./raceSetupService");
const raceMatchPerformance_1 = require("./raceMatchPerformance");
const raceMatchReadMeter_1 = require("./raceMatchReadMeter");
/** Internal receipts keep retry pacing and ownership immutable without creating fake accounts. */
const BotOffer = zod_1.z.object({ version: zod_1.z.literal(1), userId: zod_1.z.string().min(1), requestId: zod_1.z.string().min(8),
    locale: race_1.RaceLocaleSchema, categoryId: race_1.RaceCategoryIdSchema, requestedCategoryId: race_1.RaceCategoryIdSchema.nullable(),
    performanceMs: zod_1.z.number().finite().min(1000).max(300000), createdAtMs: zod_1.z.number().int().nonnegative(),
    expiresAtMs: zod_1.z.number().int().nonnegative(), acceptedRunId: zod_1.z.string().min(1).max(160).refine(value => !value.includes("/")).optional() })
    .refine(offer => offer.expiresAtMs === offer.createdAtMs + 60_000, { message: "Invalid fallback lifetime" })
    .refine(offer => offer.requestedCategoryId === null || offer.categoryId === offer.requestedCategoryId, { message: "Invalid fallback category preference" });
/** Short selection window; accepted runs retain their own lifecycle and countdown. */
const OFFER_MS = 60_000;
/** Fictional rival names never refer to a real provider account. */
const NAMES = ["Nova", "RiddleRider", "ClueFox", "Luna", "PuzzlePilot", "Echo", "WordWanderer", "Atlas"];
/** Validates the canonical receipt before any bot preparation or concurrent acceptance. */
function parseRaceBotOffer(value, userId, input, expectedId) {
    /** Complete receipt schema result before ownership checks. */
    const parsed = BotOffer.safeParse(value);
    if (!parsed.success)
        throw new https_1.HttpsError("data-loss", "Fallback opponent receipt is invalid.");
    /** Validated immutable selection receipt. */
    const offer = parsed.data;
    if (expectedId !== undefined && (0, raceSetupService_1.requestDocumentId)(offer.userId, offer.requestId) !== expectedId)
        throw new https_1.HttpsError("data-loss", "Fallback opponent receipt identity is invalid.");
    if (offer.userId !== userId)
        throw new https_1.HttpsError("permission-denied", "Opponent offer belongs to another player.");
    if (offer.locale !== input.locale || offer.categoryId !== input.categoryId)
        throw new https_1.HttpsError("invalid-argument", "Opponent offer preferences changed.");
    return offer;
}
/** Accepted offer aliases must resume their original owned synthetic run before a request receipt is written. */
function assertRaceAcceptedBotRun(run, offer, offerId) {
    if (offer.acceptedRunId !== run.runId || offer.userId !== run.userId || offer.locale !== run.locale || offer.categoryId !== run.categoryId ||
        run.role !== "challenger" || run.fallbackOfferId !== offerId || run.challengeId !== undefined || run.opponent?.kind !== "bot")
        throw new https_1.HttpsError("data-loss", "Stored fallback run does not match its accepted offer.");
}
/** Replays only the original owner/request fallback, preserving consumption and expiry recovery. */
function replayRaceBotOffer(value, userId, input, requestId, nowMs) {
    /** Shape validation precedes interpretation of private receipt fields. */
    const result = BotOffer.safeParse(value);
    if (!result.success)
        throw new https_1.HttpsError("data-loss", "Fallback opponent receipt is invalid.");
    /** Physical identity must agree with the caller's original search. */
    const stored = result.data;
    /** Both offer kinds share this deterministic request key. */
    const offerId = (0, raceSetupService_1.requestDocumentId)(userId, requestId);
    if ((0, raceSetupService_1.requestDocumentId)(stored.userId, stored.requestId) !== offerId)
        throw new https_1.HttpsError("data-loss", "Fallback opponent receipt identity is invalid.");
    if (stored.userId !== userId || stored.locale !== input.locale || stored.requestedCategoryId !== (input.categoryId ?? null))
        throw new https_1.HttpsError("invalid-argument", "Opponent search preferences changed.");
    if (stored.acceptedRunId)
        throw new https_1.HttpsError("already-exists", "Opponent offer was already accepted.");
    if (stored.expiresAtMs <= nowMs)
        throw new https_1.HttpsError("failed-precondition", "Opponent offer expired.", { matchmaking: (0, race_1.raceMatchFailure)("intent-expired") });
    return { offerId, categoryId: stored.categoryId };
}
/** Issues one stable fallback only after a successful empty recorded-pool search. */
async function offerRaceBot(db, userId, input, requestId, nowMs, profile, context, meter) {
    /** Deterministic account/request key coalesces concurrent discovery retries. */
    const ref = db.doc(`raceBotOffers/${(0, raceSetupService_1.requestDocumentId)(userId, requestId)}`);
    /** Existing receipt fixes category and pace for the selection lifetime. */
    if (meter) {
        (0, raceMatchReadMeter_1.assertRaceMatchReadBudget)(meter);
        meter.documentReadAttempts++;
    }
    /** This optional replay read is included in the lookup work budget. */
    const previous = await ref.get();
    if (previous.exists)
        return replayRaceBotOffer(previous.data(), userId, input, requestId, nowMs);
    /** Unfiltered discovery chooses only a validated available category. */
    const categoryId = input.categoryId ?? (await (0, raceSetupService_1.listRaceCategoriesForLocale)(input.locale, db)).categories[0]?.categoryId;
    if (!categoryId)
        return undefined;
    /** Server-selected expected pace clamped to the supported receipt range. */
    const performanceMs = Math.max(1000, Math.min(300000, Math.exp((0, raceMatchPerformance_1.racePerformanceExpectation)(profile, categoryId, nowMs, context.priors, context.policy.performance).expectedLog)));
    /** Immutable timing and preference snapshot retained for acceptance. */
    const offer = { version: 1, userId, requestId, locale: input.locale, categoryId,
        requestedCategoryId: input.categoryId ?? null, performanceMs, createdAtMs: nowMs, expiresAtMs: nowMs + OFFER_MS };
    /** Reading both receipt kinds makes concurrent issuance mutually exclusive. */
    const commit = async (transaction) => {
        /** The winner is re-read after every automatic transaction retry. */
        const [fallback, recorded] = await transaction.getAll(ref, db.doc(`raceMatchOffers/${ref.id}`));
        if (recorded.exists)
            throw new https_1.HttpsError("aborted", "A recorded offer already owns this search; retry with a new intent.");
        if (fallback.exists)
            return replayRaceBotOffer(fallback.data(), userId, input, requestId, nowMs);
        transaction.create(ref, { ...offer, expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nowMs + race_1.RACE_CHALLENGE_TTL_MS) });
        return { offerId: ref.id, categoryId };
    };
    return meter ? (0, raceMatchReadMeter_1.withMeteredRaceTransaction)(db, meter, commit) : db.runTransaction(commit);
}
/** Builds bounded, deterministic ghost playback once, with no per-tick server work. */
function buildRaceBotOpponent(offer, seed, riddles) {
    /** Deterministic independent samples preserve retry playback. */
    const random = (key) => (0, node_crypto_1.createHash)("sha256").update(`${seed}:${key}`).digest().readUInt32BE(0) / 0x100000000;
    /** Bounded skip count selected for slower opponents. */
    const skips = offer.performanceMs >= 90_000 && random("skips") < 0.45 ? 1 : 0;
    /** Optional hint position fixed before any gameplay events are emitted. */
    const hintPosition = offer.performanceMs >= 60_000 && random("hint") < 0.5 ? Math.floor(random("hint-position") * 9) : -1;
    /** Optional skipped question within the supported deck. */
    const skipPosition = skips ? 2 + Math.floor(random("skip-position") * 5) : -1;
    /** Questions needed to reach the target after the selected skips. */
    const played = riddles.slice(0, race_1.RACE_RULES.targetCorrect + skips);
    if (played.length !== race_1.RACE_RULES.targetCorrect + skips)
        throw new https_1.HttpsError("failed-precondition", "Opponent deck is incomplete.");
    /** Relative question durations incorporate authored difficulty and stable variation. */
    const weights = played.map((riddle, position) => (riddle.difficultyBand === "easy" ? 1 : riddle.difficultyBand === "medium" ? 1.5 : riddle.difficultyBand === "hard" ? 2 : 1.25) *
        (0.75 + random(`question:${position}`) * 0.6));
    /** Average authored difficulty adjusts the selected finish pace. */
    const difficulty = played.reduce((sum, riddle) => sum + (riddle.difficultyBand === "easy" ? 1 : riddle.difficultyBand === "medium" ? 1.5 : riddle.difficultyBand === "hard" ? 2 : 1.25), 0) / played.length;
    /** A skip suppresses a hint on the same question. */
    const hasHint = hintPosition >= 0 && hintPosition !== skipPosition;
    /** Complete hint and skip penalties included in the adjusted finish. */
    const penalties = skips * race_1.RACE_RULES.skipPenaltyMs + (hasHint ? race_1.RACE_RULES.hintPenaltyMs : 0);
    /** Finish pace retains enough wall time for every selected question. */
    const adjustedFinishMs = Math.round(Math.max(30_000, penalties + played.length * 2_000, Math.min(240_000, offer.performanceMs * difficulty / 1.25 * (0.9 + random("pace") * 0.22))));
    /** Playback duration excluding competitive penalties. */
    const wallFinishMs = adjustedFinishMs - penalties;
    /** Normalizer for allocating finish time among questions. */
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    /** Accumulated duration weight, penalty time and successful answers. */
    let weight = 0, penalty = 0, correct = 0;
    /** Complete deterministic ghost timeline consumed by browser playback. */
    const events = [];
    for (const [position, value] of weights.entries()) {
        /** Wall clock at the beginning of this question. */
        const beforeMs = Math.round(wallFinishMs * weight / totalWeight);
        weight += value;
        /** Last question ends at the exact selected wall finish. */
        const wallElapsedMs = position === played.length - 1 ? wallFinishMs : Math.round(wallFinishMs * weight / totalWeight);
        if (hasHint && position === hintPosition) {
            penalty += race_1.RACE_RULES.hintPenaltyMs;
            /** Hint occurs halfway through its selected question. */
            const hintAt = Math.round((beforeMs + wallElapsedMs) / 2);
            events.push({ sequence: events.length, type: "hint", riddlePosition: position, wallElapsedMs: hintAt,
                penaltyAddedMs: race_1.RACE_RULES.hintPenaltyMs, totalPenaltyMs: penalty, adjustedElapsedMs: hintAt + penalty, correctCount: correct });
        }
        /** Selected skips add penalties without increasing successful answer count. */
        const skipped = position === skipPosition;
        if (skipped)
            penalty += race_1.RACE_RULES.skipPenaltyMs;
        else
            correct++;
        events.push({ sequence: events.length, type: skipped ? "skip" : "correct", riddlePosition: position, wallElapsedMs,
            penaltyAddedMs: skipped ? race_1.RACE_RULES.skipPenaltyMs : 0, totalPenaltyMs: penalty,
            adjustedElapsedMs: wallElapsedMs + penalty, correctCount: correct });
    }
    return { kind: "bot", displayName: NAMES[Math.floor(random("name") * NAMES.length)], adjustedFinishMs, events };
}
//# sourceMappingURL=raceBot.js.map