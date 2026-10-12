"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RacePolicyComparisonInputSchema = exports.RaceMatchMeasurementSchema = void 0;
exports.raceMatchMeasurement = raceMatchMeasurement;
exports.summarizeRaceMatches = summarizeRaceMatches;
exports.compareRacePolicies = compareRacePolicies;
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const race_1 = require("@qwordly/core/race");
const raceMatchPerformance_1 = require("./raceMatchPerformance");
const raceMatchPolicy_1 = require("./raceMatchPolicy");
const raceMatchFreshness_1 = require("./raceMatchFreshness");
/** Supported receipt measurements contain no player identities, answer text or archived decks. */
exports.RaceMatchMeasurementSchema = zod_1.z.object({
    provider: zod_1.z.enum(["jest", "facebook", "reddit"]), locale: race_1.RaceLocaleSchema, categoryId: race_1.RaceCategoryIdSchema,
    createdAtMs: zod_1.z.number().int().nonnegative(), expiresAtMs: zod_1.z.number().int().nonnegative(),
    matchPolicyHash: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(), matchPolicyRevision: zod_1.z.number().int().positive().optional(),
    matchExperiment: raceMatchPolicy_1.RaceMatchExperimentAssignmentSchema.optional(),
    performanceConfidence: zod_1.z.number().min(0).max(1).optional(), expectedPerformanceMs: zod_1.z.number().finite().positive().optional(),
    acceptedAtMs: zod_1.z.number().int().nonnegative().optional(), startsAtMs: zod_1.z.number().int().nonnegative().optional(),
    terminalStatus: zod_1.z.enum(["completed", "timed_out", "abandoned"]).optional(), terminalAtMs: zod_1.z.number().int().nonnegative().optional(),
    correctCount: zod_1.z.number().int().min(0).max(10).optional(), finishedTen: zod_1.z.boolean().optional(),
    actualPerformanceMs: zod_1.z.number().finite().min(1000).max(300000).nullable().optional(),
    predictionLogError: zod_1.z.number().finite().nullable().optional(), finishTimeDeltaMs: zod_1.z.number().finite().nullable().optional(),
    settlementDelayMs: zod_1.z.number().finite().nonnegative().nullable().optional(),
    lookupDocumentReadAttempts: zod_1.z.number().int().nonnegative().optional(), lookupCandidateDocumentsRead: zod_1.z.number().int().nonnegative().optional(),
    lookupTransactionAttempts: zod_1.z.number().int().nonnegative().optional(), lookupSelectionDurationMs: zod_1.z.number().finite().nonnegative().optional(),
    recentRivalRepeats: zod_1.z.number().int().nonnegative().optional(), questionOverlap: zod_1.z.number().min(0).max(1).optional(),
    freshnessRelaxed: zod_1.z.boolean().optional(), freshnessBaselineRepeats: zod_1.z.number().int().nonnegative().optional(),
    freshnessBaselineOverlap: zod_1.z.number().min(0).max(1).optional(),
}).strict().refine(value => value.finishedTen !== true || value.terminalStatus === "completed" && value.correctCount === 10)
    .refine(value => value.expiresAtMs >= value.createdAtMs &&
    (value.acceptedAtMs === undefined || value.acceptedAtMs >= value.createdAtMs) &&
    (value.startsAtMs === undefined || value.acceptedAtMs !== undefined && value.startsAtMs >= value.acceptedAtMs) &&
    (value.terminalAtMs === undefined || value.acceptedAtMs !== undefined && value.terminalAtMs >= value.acceptedAtMs))
    .refine(value => value.actualPerformanceMs == null && value.predictionLogError == null && value.finishTimeDeltaMs == null || value.finishedTen === true);
/** Answer-free projection is an allowlist, not an arbitrary receipt export. */
function raceMatchMeasurement(value) {
    /** Schema-owned fields explicitly exclude identity, answer and mutable provider payloads. */
    const allowed = Object.keys(exports.RaceMatchMeasurementSchema.shape);
    return exports.RaceMatchMeasurementSchema.parse(Object.fromEntries(allowed.filter(key => value[key] !== undefined).map(key => [key, value[key]])));
}
/** Validated offline comparisons require explicit canonical-eligibility attestation for the supplied sampled pool. */
exports.RacePolicyComparisonInputSchema = zod_1.z.object({
    schemaVersion: zod_1.z.literal(1), baselinePolicy: raceMatchPolicy_1.RaceMatchPolicySchema, proposedPolicy: raceMatchPolicy_1.RaceMatchPolicySchema,
    samples: zod_1.z.array(zod_1.z.object({ viewer: zod_1.z.string().min(1).max(160), requestId: zod_1.z.string().min(1).max(160), locale: race_1.RaceLocaleSchema, nowMs: zod_1.z.number().int().nonnegative(),
        canonicalEligibilityValidated: zod_1.z.literal(true), profile: raceMatchPerformance_1.RaceMatchProfileSchema,
        candidates: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string().min(1).max(160), creatorId: zod_1.z.string().min(1).max(160), categoryId: race_1.RaceCategoryIdSchema,
            performanceMs: zod_1.z.number().finite().min(1000).max(300000), canonicalRiddleIds: zod_1.z.array(zod_1.z.string().min(1).max(160)).min(1).max(15) }).strict()).max(200)
            .refine(value => new Set(value.map(candidate => candidate.id)).size === value.length),
    }).strict()).max(10000),
}).strict();
/** Null means unobserved rather than zero; quantiles use nearest-rank selection. */
function distribution(values) {
    if (!values.length)
        return { count: 0, mean: null, p50: null, p95: null };
    /** Sorted independent copy avoids mutating observations. */
    const sorted = [...values].sort((a, b) => a - b);
    return { count: values.length, mean: values.reduce((sum, value) => sum + value, 0) / values.length,
        p50: sorted[Math.ceil(sorted.length * 0.5) - 1], p95: sorted[Math.ceil(sorted.length * 0.95) - 1] };
}
/** Identical offer-level denominators serve stratified cohorts and observed experiment arms. */
function summarizeMatchRows(rows, asOfMs) {
    /** Only milestones already reached at the report clock count in the funnel. */
    const accepted = rows.filter(row => row.acceptedAtMs !== undefined && row.acceptedAtMs <= asOfMs);
    /** Unexpired unaccepted offers are pending, not failed opportunities. */
    const matured = rows.filter(row => row.expiresAtMs <= asOfMs || accepted.includes(row));
    /** Future scheduled starts are kept separate from races that actually reached their start clock. */
    const started = accepted.filter(row => row.startsAtMs !== undefined && row.startsAtMs <= asOfMs &&
        !(row.terminalStatus === "abandoned" && row.terminalAtMs !== undefined && row.terminalAtMs < row.startsAtMs));
    /** Terminal completion denominators exclude ongoing accepted runs. */
    const terminal = accepted.filter(row => row.terminalAtMs !== undefined && row.terminalAtMs <= asOfMs && row.terminalStatus !== undefined);
    /** Ten solved answers are independent of whether the player beat the fixed ghost. */
    const finished = terminal.filter(row => row.finishedTen === true);
    /** Older receipts lacking complete-finish measurement are unknown, not assumed losses. */
    const measuredTerminal = terminal.filter(row => typeof row.finishedTen === "boolean");
    /** Measurements absent on older receipts are excluded with visible counts. */
    const numeric = (source, field) => source.flatMap(row => typeof row[field] === "number" ? [row[field]] : []);
    return { offers: rows.length, maturedOffers: matured.length, pendingOffers: rows.length - matured.length,
        accepted: accepted.length, acceptanceRate: matured.length ? accepted.length / matured.length : null,
        started: started.length, acceptedPendingTerminal: accepted.length - terminal.length, terminal: terminal.length,
        finishedTen: finished.length, completionMeasuredTerminal: measuredTerminal.length, completionMeasurementMissing: terminal.length - measuredTerminal.length,
        completionRateAmongTerminal: measuredTerminal.length ? finished.length / measuredTerminal.length : null,
        abandoned: terminal.filter(row => row.terminalStatus === "abandoned").length,
        preparationFailures: terminal.filter(row => row.terminalStatus === "abandoned" && row.startsAtMs === undefined).length,
        countdownFailures: terminal.filter(row => row.terminalStatus === "abandoned" && row.startsAtMs !== undefined && row.terminalAtMs < row.startsAtMs).length,
        actualPerformanceMs: distribution(numeric(finished, "actualPerformanceMs")), expectedPerformanceMs: distribution(numeric(rows, "expectedPerformanceMs")),
        freshnessRelaxed: rows.filter(row => row.freshnessRelaxed === true).length,
        overlap: distribution(numeric(rows, "questionOverlap")), rivalRepeats: distribution(numeric(rows, "recentRivalRepeats")),
        baselineOverlap: distribution(numeric(rows, "freshnessBaselineOverlap")), baselineRepeats: distribution(numeric(rows, "freshnessBaselineRepeats")),
        absoluteFinishGapMs: distribution(numeric(finished, "finishTimeDeltaMs").map(Math.abs)),
        absolutePredictionLogError: distribution(numeric(finished, "predictionLogError").map(Math.abs)),
        settlementDelayMs: distribution(numeric(terminal, "settlementDelayMs")),
        documentReadAttempts: distribution(numeric(rows, "lookupDocumentReadAttempts")),
        candidateDocuments: distribution(numeric(rows, "lookupCandidateDocumentsRead")), transactionAttempts: distribution(numeric(rows, "lookupTransactionAttempts")),
        selectionDurationMs: distribution(numeric(rows, "lookupSelectionDurationMs")) };
}
/** Reports cohort denominators and pending opportunities explicitly, without inferring idle losses as actual finishes. */
function summarizeRaceMatches(values, asOfMs) {
    zod_1.z.number().int().nonnegative().parse(asOfMs);
    /** Receipt cohorts retain policy hash, language/category and confidence differences. */
    const cohorts = new Map();
    /** Enrollment cohorts preserve complete allocation identity across configuration revisions. */
    const experiments = new Map();
    /** Future receipts cannot be treated as observations in the requested report window. */
    let excludedFuture = 0;
    for (const value of values) {
        /** Input schema rejects answer-bearing or identity-bearing arbitrary exports. */
        const row = exports.RaceMatchMeasurementSchema.parse(value);
        if (row.createdAtMs > asOfMs) {
            excludedFuture++;
            continue;
        }
        if (row.matchExperiment) {
            /** Policy revisions and category/confidence strata are retained separately in detailed cohorts. */
            const experimentKey = JSON.stringify({ id: row.matchExperiment.id, revision: row.matchExperiment.revision,
                allocationHash: row.matchExperiment.allocationHash, provider: row.provider, locale: row.locale });
            /** No identity, allocation salt or answer-bearing fields enter report groups. */
            const experimentRows = experiments.get(experimentKey) ?? [];
            experimentRows.push(row);
            experiments.set(experimentKey, experimentRows);
        }
        /** Historical snapshots without attribution stay a separate unknown-policy cohort. */
        const key = JSON.stringify({ provider: row.provider, locale: row.locale, categoryId: row.categoryId,
            experiment: row.matchExperiment ?? null, policyHash: row.matchPolicyHash ?? "unknown", policyRevision: row.matchPolicyRevision ?? null,
            confidence: row.performanceConfidence === undefined ? "unknown" : row.performanceConfidence < 0.5 ? "low" : "high" });
        /** Append without quadratic copying when a large sample shares one cohort. */
        const group = cohorts.get(key) ?? [];
        group.push(row);
        cohorts.set(key, group);
    }
    return { schemaVersion: 1, asOfMs, excludedFuture,
        cohorts: [...cohorts].map(([key, rows]) => ({ ...JSON.parse(key), ...summarizeMatchRows(rows, asOfMs) })),
        experimentComparisons: [...experiments].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => {
            /** Arm metrics aggregate actual observations without pretending offers are independent players. */
            const arms = new Map();
            for (const row of rows) {
                /** Only enrolled rows enter this group. */
                const arm = row.matchExperiment.arm;
                /** Mutable aggregation keeps large samples linear in their observation count. */
                const group = arms.get(arm) ?? [];
                group.push(row);
                arms.set(arm, group);
            }
            return { ...JSON.parse(key), assignmentUnit: "authenticated-player", observationUnit: "offer", observedArmsOnly: true,
                arms: [...arms].sort(([a], [b]) => a.localeCompare(b)).map(([arm, observations]) => ({ arm,
                    policyHashes: [...new Set(observations.map(row => row.matchPolicyHash ?? "unknown"))].sort(), ...summarizeMatchRows(observations, asOfMs) })) };
        }),
        experimentLimitations: ["Observed offer-level comparisons are descriptive, not independent-player significance or causal lift estimates.",
            "Only observed arms are reported; missing arms, empty/capped searches, retained-sample bias and ongoing outcomes must be investigated separately."] };
}
/** Scores two policies against the identical eligible sampled pool; this is a counterfactual simulation, never measured wins. */
function compareRacePolicies(value) {
    /** Strict parsing protects the offline tool from malformed, incompatible or answer-bearing inputs. */
    const input = exports.RacePolicyComparisonInputSchema.parse(value);
    /** Attribution covers complete configurations, including language priors. */
    const policies = [(0, raceMatchPolicy_1.raceMatchPolicySnapshot)(input.baselinePolicy), (0, raceMatchPolicy_1.raceMatchPolicySnapshot)(input.proposedPolicy)];
    /** Aggregate selections contain no viewer, creator, challenge or riddle identifiers. */
    const selections = input.samples.map(sample => policies.map(snapshot => {
        /** Language resolution matches production scoring. */
        const context = (0, raceMatchPolicy_1.raceMatchContext)(snapshot, sample.locale);
        /** The supplied candidate pool has already passed canonical hard eligibility. */
        const ranked = sample.candidates.map(candidate => ({ ...candidate, ...(0, raceMatchPerformance_1.scoreRaceCandidate)(sample.profile, sample.viewer, candidate, sample.nowMs, context),
            tie: (0, node_crypto_1.createHash)("sha256").update(`${sample.requestId}:${candidate.id}`).digest("hex") }))
            .sort((a, b) => a.band - b.band || a.score - b.score || (a.tie < b.tie ? -1 : a.tie > b.tie ? 1 : 0));
        /** Same freshness choice used after canonical validation in the backend. */
        const chosen = (0, raceMatchFreshness_1.selectRaceFreshCandidate)(ranked, context.policy);
        return chosen ? { id: chosen.id, band: chosen.band, overlap: chosen.exposure, repeats: chosen.repeats, distance: chosen.distance,
            expectedMs: Math.exp((0, raceMatchPerformance_1.racePerformanceExpectation)(sample.profile, chosen.categoryId, sample.nowMs, context.priors, context.policy.performance).expectedLog) } : null;
    }));
    return { schemaVersion: 1, mode: "sampled-pool-counterfactual", samples: selections.length,
        changedSelections: selections.filter(([a, b]) => a?.id !== b?.id).length,
        limitations: ["Retrieval windows, freshness check budgets, canonical validation costs and live contention are not simulated.",
            "Unplayed selections have no observed completion or win outcomes; cohort comparisons are descriptive, not causal."],
        policies: policies.map((snapshot, index) => {
            /** Empty sample pools retain a distinct denominator. */
            const chosen = selections.flatMap(pair => pair[index] ? [pair[index]] : []);
            return { hash: snapshot.hash, revision: snapshot.policy.revision, algorithmVersion: snapshot.policy.algorithmVersion,
                selected: chosen.length, empty: selections.length - chosen.length, broadBand: chosen.filter(row => row.band === 2).length,
                overlap: distribution(chosen.map(row => row.overlap)), rivalRepeats: distribution(chosen.map(row => row.repeats)),
                logDistance: distribution(chosen.map(row => row.distance)), expectedMs: distribution(chosen.map(row => row.expectedMs)) };
        }) };
}
//# sourceMappingURL=raceMatchCalibration.js.map