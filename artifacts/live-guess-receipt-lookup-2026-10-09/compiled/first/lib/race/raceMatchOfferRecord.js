"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRaceMatchOffer = parseRaceMatchOffer;
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const https_1 = require("firebase-functions/v2/https");
const race_1 = require("@qwordly/core/race");
const raceMatchPolicy_1 = require("./raceMatchPolicy");
/** Historical identities remain opaque single path segments. */
const Id = zod_1.z.string().min(1).max(160).refine(value => !value.includes("/"));
/** Persisted clocks and counters must be finite safe nonnegative integers. */
const Count = zod_1.z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
/** Preference identity is independent of the category selected from an unrestricted pool. */
const Preferences = zod_1.z.object({ locale: race_1.RaceLocaleSchema, categoryId: race_1.RaceCategoryIdSchema.nullable() }).strict();
/** Owned receipt fields are validated while Firestore TTL and future extension metadata survive reads. */
const Offer = zod_1.z.looseObject({
    recordingFingerprint: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(),
    recordVersion: zod_1.z.literal(1).optional(), requestId: zod_1.z.string().min(1).max(160).optional(), userId: Id, challengeId: Id, fingerprint: zod_1.z.string().min(1).max(1000),
    createdAtMs: Count, expiresAtMs: Count,
    provider: zod_1.z.enum(["jest", "facebook", "reddit"]).optional(), locale: race_1.RaceLocaleSchema.optional(), categoryId: race_1.RaceCategoryIdSchema.optional(),
    matchPolicyVersion: zod_1.z.number().int().min(1).max(3).optional(), matchPolicyRevision: zod_1.z.number().int().min(1).max(1000000).optional(),
    matchPolicyHash: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(), matchPolicySnapshot: raceMatchPolicy_1.RaceMatchPolicySchema.optional(),
    matchExperiment: raceMatchPolicy_1.RaceMatchExperimentAssignmentSchema.optional(),
    offerBand: zod_1.z.number().int().min(0).max(2).optional(), performanceConfidence: zod_1.z.number().min(0).max(1).optional(),
    recordingPerformanceMs: zod_1.z.number().finite().positive().optional(), expectedPerformanceMs: zod_1.z.number().finite().positive().optional(),
    recentRivalRepeats: Count.optional(), questionOverlap: zod_1.z.number().min(0).max(1).optional(), freshnessRelaxed: zod_1.z.boolean().optional(),
    freshnessBaselineBand: zod_1.z.number().int().min(0).max(2).optional(), freshnessBaselineRepeats: Count.optional(),
    freshnessBaselineOverlap: zod_1.z.number().min(0).max(1).optional(),
    lookupCandidateDocumentsRead: Count.optional(), lookupCandidateQueries: Count.optional(), lookupDocumentReadAttempts: Count.optional(),
    lookupTransactionAttempts: Count.optional(), lookupSelectionDurationMs: zod_1.z.number().finite().nonnegative().optional(),
    acceptedRunId: Id.optional(), acceptedAtMs: Count.optional(), preparationRequested: zod_1.z.boolean().optional(), offerExpiredAtAcceptance: zod_1.z.boolean().optional(),
    startsAtMs: Count.optional(), readinessAcceptedAtMs: Count.optional(), terminalStatus: zod_1.z.enum(["completed", "timed_out", "abandoned"]).optional(), terminalAtMs: Count.optional(),
    result: zod_1.z.enum(["player_win", "ghost_win", "tie", "timed_out", "recorded"]).nullable().optional(), correctCount: zod_1.z.number().int().min(0).max(10).optional(),
    finishedTen: zod_1.z.boolean().optional(), actualPerformanceMs: zod_1.z.number().finite().min(1000).max(300000).nullable().optional(),
    predictionLogError: zod_1.z.number().finite().nullable().optional(), finishTimeDeltaMs: zod_1.z.number().finite().nullable().optional(),
    opponentAdjustedFinishMs: Count.nullable().optional(), settlementDelayMs: Count.nullable().optional(),
    hintPenaltyMs: Count.optional(), skipPenaltyMs: Count.optional(), adjustedFinishMs: Count.optional(),
});
/** Parses both historical and versioned receipts without exposing stored payloads in errors. */
function parseRaceMatchOffer(value, documentId, expectedOwner) {
    try {
        /** Validated owned fields retain supported extension metadata. */
        const offer = Offer.parse(value);
        /** Original preferences constrain explicit pool fields. */
        const preferences = Preferences.parse(JSON.parse(offer.fingerprint));
        if (offer.requestId !== undefined && (0, node_crypto_1.createHash)("sha256").update(`${offer.userId}\u0000${offer.requestId}`).digest("hex") !== documentId || expectedOwner !== undefined && offer.userId !== expectedOwner || !/^[a-f0-9]{64}$/.test(documentId) || offer.expiresAtMs <= offer.createdAtMs ||
            offer.locale !== undefined && offer.locale !== preferences.locale ||
            preferences.categoryId !== null && offer.categoryId !== undefined && offer.categoryId !== preferences.categoryId ||
            offer.provider !== undefined && !offer.userId.startsWith(`${offer.provider}_`) ||
            (offer.acceptedRunId === undefined) !== (offer.acceptedAtMs === undefined) ||
            offer.acceptedAtMs !== undefined && offer.acceptedAtMs < offer.createdAtMs ||
            offer.startsAtMs !== undefined && (offer.acceptedAtMs === undefined || offer.startsAtMs < offer.acceptedAtMs) ||
            offer.readinessAcceptedAtMs !== undefined && (offer.acceptedAtMs === undefined || offer.readinessAcceptedAtMs < offer.acceptedAtMs ||
                offer.startsAtMs === undefined || offer.readinessAcceptedAtMs > offer.startsAtMs) ||
            (offer.terminalStatus === undefined) !== (offer.terminalAtMs === undefined) ||
            offer.terminalAtMs !== undefined && (offer.acceptedAtMs === undefined || offer.terminalAtMs < offer.acceptedAtMs) ||
            offer.finishedTen === true && (offer.terminalStatus !== "completed" || offer.correctCount !== 10) ||
            (offer.actualPerformanceMs != null || offer.predictionLogError != null || offer.finishTimeDeltaMs != null) && offer.finishedTen !== true)
            throw new Error();
        if (offer.matchExperiment !== undefined && offer.matchPolicySnapshot === undefined)
            throw new Error();
        if (offer.matchPolicySnapshot !== undefined) {
            /** Recomputed attribution detects inconsistent persisted policy fields. */
            const snapshot = (0, raceMatchPolicy_1.raceMatchPolicySnapshot)(offer.matchPolicySnapshot);
            if (snapshot.hash !== offer.matchPolicyHash || snapshot.policy.revision !== offer.matchPolicyRevision ||
                snapshot.policy.algorithmVersion !== offer.matchPolicyVersion)
                throw new Error();
        }
        // Historical receipts without a policy snapshot are supported; versioned writes must carry reproducible attribution.
        if (offer.recordVersion === 1 && (offer.requestId === undefined || offer.provider === undefined || offer.locale === undefined || offer.categoryId === undefined ||
            offer.matchPolicySnapshot === undefined || offer.expectedPerformanceMs === undefined))
            throw new Error();
        return { ...offer, locale: preferences.locale };
    }
    catch {
        throw new https_1.HttpsError("data-loss", "Stored matchmaking offer is invalid.");
    }
}
//# sourceMappingURL=raceMatchOfferRecord.js.map