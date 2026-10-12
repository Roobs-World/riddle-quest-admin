"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaceMatchCandidateSchema = void 0;
exports.parseRaceMatchCandidate = parseRaceMatchCandidate;
exports.raceMatchCandidateEquals = raceMatchCandidateEquals;
exports.projectRaceMatchCandidate = projectRaceMatchCandidate;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const zod_1 = require("zod");
const race_1 = require("@qwordly/core/race");
const raceEligibility_1 = require("./raceEligibility");
const raceMatchPerformance_1 = require("./raceMatchPerformance");
const raceCandidateSearch_1 = require("./raceCandidateSearch");
/** Complete answer-free retrieval contract, including immutable derived query keys. */
exports.RaceMatchCandidateSchema = zod_1.z.object({
    performanceBucket: zod_1.z.number().int().nonnegative(), selectionKey: zod_1.z.string().regex(/^[a-f0-9]{64}$/),
    challengeId: zod_1.z.string().min(1).max(160).refine(value => !value.includes("/")),
    creatorId: zod_1.z.string().regex(/^(jest|facebook|reddit)_[a-f0-9]{40}$/), provider: zod_1.z.enum(["jest", "facebook", "reddit"]),
    locale: race_1.RaceLocaleSchema, categoryId: race_1.RaceCategoryIdSchema, rulesVersion: zod_1.z.literal(race_1.RACE_RULES_VERSION),
    contentVersion: zod_1.z.string().min(1), adjustedFinishMs: zod_1.z.number().int().nonnegative(),
    performanceMs: zod_1.z.number().finite().min(1000).max(300000), matchPolicyVersion: zod_1.z.literal(raceMatchPerformance_1.RACE_MATCH_NORMALIZATION_VERSION),
    canonicalRiddleIds: zod_1.z.array(zod_1.z.string().min(1).max(160).refine(value => !value.includes("/"))).min(1).max(15),
    status: zod_1.z.literal("active"), expiresAtMs: zod_1.z.number().int().nonnegative(), createdAtMs: zod_1.z.number().int().nonnegative(),
    expiresAt: zod_1.z.custom(value => value instanceof firebaseAdmin_1.admin.firestore.Timestamp),
}).strict().refine(value => value.provider === (0, raceEligibility_1.raceProviderScope)(value.creatorId) &&
    value.performanceBucket === (0, raceCandidateSearch_1.racePerformanceBucket)(value.performanceMs) &&
    value.selectionKey === (0, raceCandidateSearch_1.raceCandidateSelectionKey)(value.challengeId) && value.expiresAtMs > value.createdAtMs &&
    value.expiresAt.toMillis() === value.expiresAtMs && new Set(value.canonicalRiddleIds).size === value.canonicalRiddleIds.length);
/** Invalid derived records cannot influence ranking; document identity is checked separately from stored data. */
function parseRaceMatchCandidate(value, documentId) {
    /** Validation diagnostics remain internal and contain no answer-bearing payload. */
    const parsed = exports.RaceMatchCandidateSchema.safeParse(value);
    return parsed.success && parsed.data.challengeId === documentId ? parsed.data : null;
}
/** Canonical-derived comparison excludes projections whose valid shape still carries stale ranking metadata. */
function raceMatchCandidateEquals(value, expected) {
    /** Full schema validation also rejects unsupported extra fields. */
    const current = parseRaceMatchCandidate(value, expected.challengeId);
    return current !== null && Object.entries(expected).every(([key, field]) => key === "expiresAt"
        ? current.expiresAt.toMillis() === expected.expiresAt.toMillis()
        : JSON.stringify(current[key]) === JSON.stringify(field));
}
/** Projects public recordings only; private invitation seats never enter random matching. */
function projectRaceMatchCandidate(challenge) {
    /** Provides provider behavior. */
    const provider = (0, raceEligibility_1.raceProviderScope)(challenge.creatorId);
    if (!provider || challenge.status !== "active" || challenge.scope === "invitation" || challenge.challengeId.startsWith("jest-invite-"))
        return null;
    /** Provides performance ms behavior. */
    const performanceMs = challenge.recordingPerformanceMs ?? (0, raceMatchPerformance_1.raceDifficultyAdjustedMs)(challenge.creatorAdjustedFinishMs, challenge.riddles ?? []);
    return {
        performanceBucket: (0, raceCandidateSearch_1.racePerformanceBucket)(performanceMs), selectionKey: (0, raceCandidateSearch_1.raceCandidateSelectionKey)(challenge.challengeId),
        challengeId: challenge.challengeId, creatorId: challenge.creatorId, provider, locale: challenge.locale,
        categoryId: challenge.categoryId, rulesVersion: challenge.rules.version, contentVersion: challenge.contentVersion,
        adjustedFinishMs: challenge.creatorAdjustedFinishMs,
        performanceMs,
        matchPolicyVersion: raceMatchPerformance_1.RACE_MATCH_NORMALIZATION_VERSION, canonicalRiddleIds: challenge.canonicalRiddleIds,
        status: "active", expiresAtMs: challenge.expiresAtMs,
        createdAtMs: challenge.createdAtMs, expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(challenge.expiresAtMs),
    };
}
//# sourceMappingURL=raceMatchCandidates.js.map