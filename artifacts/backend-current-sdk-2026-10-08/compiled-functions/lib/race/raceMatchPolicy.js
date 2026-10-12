"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RACE_MATCH_CONTEXT = exports.DEFAULT_RACE_MATCH_POLICY = exports.RaceMatchExperimentSchema = exports.RaceMatchExperimentAssignmentSchema = exports.RaceMatchPolicySchema = exports.RacePerformancePriorsSchema = void 0;
exports.raceMatchPolicySnapshot = raceMatchPolicySnapshot;
exports.raceMatchContext = raceMatchContext;
exports.selectRaceMatchConfiguration = selectRaceMatchConfiguration;
exports.loadRaceMatchPolicy = loadRaceMatchPolicy;
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const https_1 = require("firebase-functions/v2/https");
const race_1 = require("@qwordly/core/race");
/** Validated duration priors for one language; user histories remain language-specific. */
exports.RacePerformancePriorsSchema = zod_1.z.object({ overallMs: zod_1.z.number().finite().min(1000).max(300000),
    categories: zod_1.z.partialRecord(zod_1.z.enum(race_1.RACE_CATEGORY_IDS), zod_1.z.number().finite().min(1000).max(300000)) }).strict();
/** Configurable reading/scoring parameters do not change stored observation normalization or decay. */
const PerformanceParametersSchema = zod_1.z.object({
    priorEvidence: zod_1.z.number().finite().min(1).max(40), confidenceEvidence: zod_1.z.number().finite().min(1).max(40),
    censoredMaxWeight: zod_1.z.number().finite().min(0).max(0.25),
    nearRatioConfident: zod_1.z.number().finite().min(1).max(2), nearRatioUncertain: zod_1.z.number().finite().min(1).max(3),
    wideRatio: zod_1.z.number().finite().min(1).max(4),
    distanceWeightUncertain: zod_1.z.number().finite().min(0.1).max(4), distanceWeightConfident: zod_1.z.number().finite().min(0.1).max(4),
    rivalRepeatWeight: zod_1.z.number().finite().min(0).max(4), questionExposureWeight: zod_1.z.number().finite().min(0).max(4),
}).strict().refine(value => value.nearRatioConfident <= value.nearRatioUncertain && value.nearRatioUncertain <= value.wideRatio &&
    value.distanceWeightUncertain <= value.distanceWeightConfident, { message: "Policy windows and confidence weights must be ordered." });
/** A complete policy is selected once, validated and attributed by revision plus content hash. */
const PolicyFields = { schemaVersion: zod_1.z.literal(1),
    revision: zod_1.z.number().int().min(1).max(1000000), defaultPriors: exports.RacePerformancePriorsSchema,
    localePriors: zod_1.z.partialRecord(race_1.RaceLocaleSchema, exports.RacePerformancePriorsSchema), performance: PerformanceParametersSchema };
/** Legacy snapshots retain their exact shape and hash, without inserting new defaults. */
const LegacyPolicySchema = zod_1.z.object({ ...PolicyFields, algorithmVersion: zod_1.z.literal(2) }).strict();
/** Freshness can widen only into the comparable wider band, never remove hard eligibility. */
const FreshPolicySchema = zod_1.z.object({ ...PolicyFields, algorithmVersion: zod_1.z.literal(3), freshness: zod_1.z.object({
        nearCandidateBudget: zod_1.z.number().int().min(50).max(150), maxAdditionalChecks: zod_1.z.number().int().min(1).max(50),
        repeatThreshold: zod_1.z.number().int().min(1).max(20), overlapThreshold: zod_1.z.number().finite().min(0.1).max(1),
    }).strict() }).strict();
/** Version-specific parsing preserves historical attribution through policy upgrades. */
exports.RaceMatchPolicySchema = zod_1.z.discriminatedUnion("algorithmVersion", [LegacyPolicySchema, FreshPolicySchema]);
/** Public experiment attribution excludes allocation salt and authenticated player identity. */
exports.RaceMatchExperimentAssignmentSchema = zod_1.z.object({ id: zod_1.z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    revision: zod_1.z.number().int().min(1).max(1000000), arm: zod_1.z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
    allocationHash: zod_1.z.string().regex(/^[a-f0-9]{64}$/) }).strict();
/** Admin configuration explicitly declares enrollment and complete arm policies. */
exports.RaceMatchExperimentSchema = zod_1.z.object({ kind: zod_1.z.literal("experiment"), schemaVersion: zod_1.z.literal(1),
    id: zod_1.z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), revision: zod_1.z.number().int().min(1).max(1000000),
    salt: zod_1.z.string().min(16).max(160), providers: zod_1.z.array(zod_1.z.enum(["jest", "facebook", "reddit"])).min(1).max(3),
    locales: zod_1.z.array(race_1.RaceLocaleSchema).min(1).max(17), fallbackPolicy: exports.RaceMatchPolicySchema,
    arms: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string().regex(/^[a-z][a-z0-9-]{0,31}$/), weightBasisPoints: zod_1.z.number().int().min(1).max(9999),
        policy: exports.RaceMatchPolicySchema }).strict()).min(2).max(4),
}).strict().refine(value => value.arms.reduce((total, arm) => total + arm.weightBasisPoints, 0) === 10000 &&
    new Set(value.arms.map(arm => arm.id)).size === value.arms.length && new Set(value.providers).size === value.providers.length &&
    new Set(value.locales).size === value.locales.length, { message: "Experiment allocation must be unique and total 10000 basis points." });
/** Canonical key ordering gives equivalent policies the same content hash. */
function canonical(value) {
    if (value !== null && typeof value === "object")
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
            .map(([key, child]) => [key, canonical(child)]));
    return value;
}
/** Runtime freezing prevents asynchronous consumers from modifying the selected snapshot. */
function freeze(value) {
    for (const child of Object.values(value))
        if (child !== null && typeof child === "object")
            freeze(child);
    Object.freeze(value);
}
/** Parses a fresh copy and seals it before any lookup work can observe it. */
function raceMatchPolicySnapshot(value) {
    /** Validation also rejects unsupported algorithms and unknown configuration fields. */
    const policy = exports.RaceMatchPolicySchema.parse(value);
    /** Attribution identifies the entire configuration, including all language priors. */
    const hash = (0, node_crypto_1.createHash)("sha256").update(JSON.stringify(canonical(policy))).digest("hex");
    freeze(policy);
    return Object.freeze({ policy, hash });
}
/** Baseline retains the current transparent heuristic until an operator installs a validated revision. */
exports.DEFAULT_RACE_MATCH_POLICY = raceMatchPolicySnapshot({ schemaVersion: 1, algorithmVersion: 3, revision: 2, freshness: { nearCandidateBudget: 100, maxAdditionalChecks: 20, repeatThreshold: 1, overlapThreshold: 0.5 },
    defaultPriors: { overallMs: 120000, categories: {} }, localePriors: {},
    performance: { priorEvidence: 4, confidenceEvidence: 8, censoredMaxWeight: 0.25,
        nearRatioConfident: 1.25, nearRatioUncertain: 1.5, wideRatio: 2,
        distanceWeightUncertain: 0.5, distanceWeightConfident: 1, rivalRepeatWeight: 0.6, questionExposureWeight: 0.8 } });
/** Pure scoring defaults share the same snapshot as unconfigured backend lookups. */
exports.DEFAULT_RACE_MATCH_CONTEXT = Object.freeze({ ...exports.DEFAULT_RACE_MATCH_POLICY, priors: exports.DEFAULT_RACE_MATCH_POLICY.policy.defaultPriors });
/** Resolves language-specific priors without rereading or mutating the policy. */
function raceMatchContext(snapshot, locale) {
    return Object.freeze({ ...snapshot, priors: snapshot.policy.localePriors[locale] ?? snapshot.policy.defaultPriors });
}
/** Deterministic player-level assignment does not depend on request ID, category or retry timing. */
function selectRaceMatchConfiguration(value, identity) {
    if (typeof value !== "object" || value === null || !("kind" in value))
        return raceMatchPolicySnapshot(value);
    /** Detached validation prevents mid-lookup mutation of allocation weights or arm policies. */
    const experiment = exports.RaceMatchExperimentSchema.parse(value);
    if (!identity || !new RegExp(`^${identity.provider}_[a-f0-9]{40}$`).test(identity.userId))
        throw new Error("Experiment requires authenticated pool identity.");
    if (!experiment.providers.includes(identity.provider) || !experiment.locales.includes(identity.locale))
        return raceMatchPolicySnapshot(experiment.fallbackPolicy);
    /** Allocation hashing covers all parameters and enrollment restrictions without exporting them. */
    const allocationHash = (0, node_crypto_1.createHash)("sha256").update(JSON.stringify(canonical(experiment))).digest("hex");
    /** A 64-bit digest gives deterministic near-uniform assignment to ten thousand intervals. */
    const bucket = Number(BigInt(`0x${(0, node_crypto_1.createHash)("sha256").update(JSON.stringify([experiment.id, experiment.revision, experiment.salt, identity.userId])).digest("hex").slice(0, 16)}`) % 10000n);
    /** Arm order defines disjoint cumulative intervals and is covered by allocation identity. */
    let remaining = bucket;
    for (const arm of experiment.arms) {
        if (remaining < arm.weightBasisPoints)
            return Object.freeze({ ...raceMatchPolicySnapshot(arm.policy),
                experiment: Object.freeze({ id: experiment.id, revision: experiment.revision, arm: arm.id, allocationHash }) });
        remaining -= arm.weightBasisPoints;
    }
    throw new Error("Experiment allocation is invalid.");
}
/** Admin-only policy selection has no cache that could mix revisions within one lookup. */
async function loadRaceMatchPolicy(db, identity) {
    /** A missing configuration uses the explicitly versioned baseline; storage errors propagate. */
    const stored = await db.doc("raceConfig/matchPolicy").get();
    if (!stored.exists)
        return exports.DEFAULT_RACE_MATCH_POLICY;
    try {
        return selectRaceMatchConfiguration(stored.data(), identity);
    }
    catch {
        throw new https_1.HttpsError("data-loss", "Stored matchmaking policy is invalid.");
    }
}
//# sourceMappingURL=raceMatchPolicy.js.map