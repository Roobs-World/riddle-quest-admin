"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceCandidateSearchPivot = exports.raceCandidateSelectionKey = exports.racePerformanceBucket = exports.RACE_MATCH_PAGE_SIZE = exports.RACE_MATCH_READ_BUDGET = void 0;
exports.searchRaceCandidates = searchRaceCandidates;
const node_crypto_1 = require("node:crypto");
const race_1 = require("@qwordly/core/race");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const raceMatchPerformance_1 = require("./raceMatchPerformance");
const raceMatchPolicy_1 = require("./raceMatchPolicy");
/** Bounded candidate-document budget, independent of the number of sparse indexed buckets. */
exports.RACE_MATCH_READ_BUDGET = 200;
/** Maximum records fetched by one indexed query. */
exports.RACE_MATCH_PAGE_SIZE = 50;
/** Coarse indexed intervals; exact matching still uses continuous log-duration distance. */
const BUCKET_WIDTH = Math.log(1.5);
/** Last supported normalized duration bucket, including the 300-second clamp. */
const LAST_BUCKET = Math.floor(Math.log(300) / BUCKET_WIDTH);
/** Publication pins this retrieval key to the recording, independent of mutable creator skill. */
const racePerformanceBucket = (performanceMs) => Math.max(0, Math.min(LAST_BUCKET, Math.floor(Math.log(performanceMs / 1000) / BUCKET_WIDTH)));
exports.racePerformanceBucket = racePerformanceBucket;
/** Uniform, stable recording key supports request-specific circular sampling. */
const raceCandidateSelectionKey = (challengeId) => (0, node_crypto_1.createHash)("sha256").update(challengeId).digest("hex");
exports.raceCandidateSelectionKey = raceCandidateSelectionKey;
/** A new lookup intent rotates retrieval; retrying the same intent retains its deterministic window. */
const raceCandidateSearchPivot = (userId, requestId) => (0, node_crypto_1.createHash)("sha256").update(`${userId}:${requestId}`).digest("hex");
exports.raceCandidateSearchPivot = raceCandidateSearchPivot;
/** Retrieves comparable recordings before wider intervals while respecting hard scope and a fixed document budget. */
async function searchRaceCandidates(db, userId, provider, input, profile, requestId, nowMs, onTier, checkWorkBudget, context = raceMatchPolicy_1.DEFAULT_RACE_MATCH_CONTEXT, candidateBudget = exports.RACE_MATCH_READ_BUDGET) {
    /** Categories with identical expectations share queries without changing ranking semantics. */
    const groups = new Map();
    for (const category of input.categoryId ? [input.categoryId] : race_1.RACE_CATEGORY_IDS) {
        /** Same category-specific expectation used by exact candidate scoring. */
        const { expectedLog, nearDistance, wideDistance } = (0, raceMatchPerformance_1.racePerformanceExpectation)(profile, category, nowMs, context.priors, context.policy.performance);
        /** Exact grouping preserves distinct category evidence, including confidence differences. */
        const key = `${expectedLog}:${nearDistance}`;
        /** Mutable query group assembled once before retrieval. */
        const group = groups.get(key) ?? { expectedLog, nearDistance, wideDistance, categories: [] };
        group.categories.push(category);
        groups.set(key, group);
    }
    /** Provides pivot behavior. */
    const pivot = (0, exports.raceCandidateSearchPivot)(userId, requestId);
    /** Provides cursors behavior. */
    const cursors = [...groups.values()].flatMap(({ expectedLog, nearDistance, wideDistance, categories }) => Array.from({ length: LAST_BUCKET + 1 }, (_, bucket) => {
        /** Provides lower behavior. */
        const lower = Math.log(1000) + bucket * BUCKET_WIDTH;
        /** Provides upper behavior. */
        const upper = bucket === LAST_BUCKET ? Math.log(300000) : lower + BUCKET_WIDTH;
        /** Provides overlap distance behavior. */
        const overlapDistance = Math.max(0, lower - expectedLog, expectedLog - upper);
        return { categories: categories.length === race_1.RACE_CATEGORY_IDS.length ? undefined : categories, bucket,
            tier: overlapDistance <= nearDistance ? 0 : overlapDistance <= wideDistance ? 1 : 2,
            distance: Math.abs((lower + upper) / 2 - expectedLog), half: 0 };
    })).sort((left, right) => left.tier - right.tier || left.distance - right.distance);
    /** Provides documents behavior. */
    const documents = [];
    /** Provides queries behavior. */
    let queries = 0;
    /** If no eligible fallback exists, spend unused wider capacity on the remaining nearest window before far matches. */
    const tiers = context.policy.algorithmVersion === 3 ? [0, 1, 0, 2] : [0, 1, 2];
    for (const [pass, tier] of tiers.entries()) {
        if (documents.length >= candidateBudget)
            break;
        /** Provides active behavior. */
        const active = cursors.filter(cursor => cursor.tier === tier);
        /** Reserve candidate capacity for comparable freshness alternatives in dense nearest pools. */
        const tierBudget = pass === 0 && context.policy.algorithmVersion === 3 ? Math.min(candidateBudget, context.policy.freshness.nearCandidateBudget) : candidateBudget;
        while (active.some(cursor => cursor.half < 2) && documents.length < tierBudget) {
            /** Comparable intervals share capacity before any dense interval consumes it. */
            const pending = active.filter(cursor => cursor.half < 2);
            for (let index = 0; index < pending.length && documents.length < tierBudget; index += 4) {
                /** Reserve disjoint page capacity so concurrent RPCs cannot overrun the document budget. */
                let reserved = 0, returned = 0;
                /** Stable cursor order determines quotas and result ordering, independent of RPC completion. */
                const wave = pending.slice(index, index + 4).map((cursor, offset) => {
                    /** Empty intervals release their unused share to the next bounded wave. */
                    const allowance = Math.min(exports.RACE_MATCH_PAGE_SIZE, Math.ceil((tierBudget - documents.length - reserved) / (pending.length - index - offset)));
                    reserved += allowance;
                    return { cursor, allowance };
                });
                /** At most four indexed intervals execute concurrently, retaining circular sampling. */
                const pages = await Promise.all(wave.map(async ({ cursor, allowance }) => {
                    /** This cursor owns only its reserved capacity until the next wave. */
                    const received = [];
                    while (received.length < allowance && cursor.half < 2) {
                        checkWorkBudget?.({ candidateQueries: queries, candidateDocumentsRead: documents.length + returned });
                        /** Scope and ordering remain identical on both halves of the circular cursor. */
                        let query = db.collection("raceMatchCandidates").where("provider", "==", provider)
                            .where("locale", "==", input.locale).where("rulesVersion", "==", race_1.RACE_RULES_VERSION)
                            .where("status", "==", "active").where("performanceBucket", "==", cursor.bucket)
                            .where("selectionKey", cursor.half === 0 ? ">=" : "<", pivot).where("expiresAtMs", ">", nowMs)
                            .orderBy("selectionKey").orderBy("expiresAtMs").orderBy(firebaseAdmin_1.admin.firestore.FieldPath.documentId()).limit(allowance - received.length);
                        if (cursor.categories)
                            query = query.where("categoryId", cursor.categories.length === 1 ? "==" : "in", cursor.categories.length === 1 ? cursor.categories[0] : cursor.categories);
                        if (cursor.after)
                            query = query.startAfter(cursor.after);
                        queries++;
                        /** Issued RPCs are metered even when a query rejects. */
                        const page = await query.get();
                        /** Each cursor exhausts one half before wrapping, with no duplicate documents. */
                        const exhaustedHalf = page.size < allowance - received.length;
                        received.push(...page.docs);
                        returned += page.size;
                        checkWorkBudget?.({ candidateQueries: queries, candidateDocumentsRead: documents.length + returned });
                        cursor.after = page.docs.at(-1);
                        if (exhaustedHalf) {
                            cursor.half++;
                            cursor.after = undefined;
                        }
                    }
                    return received;
                }));
                documents.push(...pages.flat());
            }
        }
        if (onTier && await onTier(documents, tier))
            break;
    }
    return { documents, queries, exhausted: cursors.every(cursor => cursor.half >= 2) };
}
//# sourceMappingURL=raceCandidateSearch.js.map