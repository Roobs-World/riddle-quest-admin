import {createHash} from "node:crypto";
import {RACE_CATEGORY_IDS, RACE_RULES_VERSION, type RaceCategoryId, type RaceMatchRequest} from "../../../../src/races/contracts/index.js";
import {admin} from "../../shared/firebaseAdmin";
import {racePerformanceExpectation, type RaceMatchProfile} from "./raceMatchPerformance";
import {DEFAULT_RACE_MATCH_CONTEXT, type RaceMatchContext} from "./raceMatchPolicy";
import type {RaceProviderScope} from "../access/raceProviderScope";
import type {Firestore} from "../raceSetupService";

/** Bounded candidate-document budget, independent of the number of sparse indexed buckets. */
export const RACE_MATCH_READ_BUDGET = 200;
/** Maximum records fetched by one indexed query. */
export const RACE_MATCH_PAGE_SIZE = 50;
/** Coarse indexed intervals; exact matching still uses continuous log-duration distance. */
const BUCKET_WIDTH = Math.log(1.5);
/** Last supported normalized duration bucket, including the 300-second clamp. */
const LAST_BUCKET = Math.floor(Math.log(300) / BUCKET_WIDTH);

/** Publication pins this retrieval key to the recording, independent of mutable creator skill. */
export const racePerformanceBucket = (performanceMs: number): number =>
  Math.max(0, Math.min(LAST_BUCKET, Math.floor(Math.log(performanceMs / 1000) / BUCKET_WIDTH)));
/** Uniform, stable recording key supports request-specific circular sampling. */
export const raceCandidateSelectionKey = (challengeId: string): string => createHash("sha256").update(challengeId).digest("hex");
/** A new lookup intent rotates retrieval; retrying the same intent retains its deterministic window. */
export const raceCandidateSearchPivot = (userId: string, requestId: string): string => createHash("sha256").update(`${userId}:${requestId}`).digest("hex");

/** Cursor owns both halves of one circular bucket traversal, without duplicates. */
type BucketCursor = {
  /** Disjoint categories sharing the same retrieval expectation; undefined means all categories. */ categories?: RaceCategoryId[];
  /** Immutable normalized-performance interval. */ bucket: number;
  /** Coarse widening tier determined by interval overlap, not expiry. */ tier: number;
  /** Priority within its tier. */ distance: number;
  /** Greater-than-pivot half first, then the wrapping half. */ half: number;
  /** Last complete indexed cursor, including expiration and document ID. */ after?: FirebaseFirestore.QueryDocumentSnapshot;
};

/** Progress includes empty-query overhead and remains observable before a search failure. */
type SearchProgress = {
  /** Indexed page queries issued so far. */ candidateQueries: number;
  /** Candidate documents returned so far. */ candidateDocumentsRead: number;
};
/** Categories can share retrieval only when their continuous expectations and confidence windows agree. */
type SearchExpectation = {
  /** Difficulty-normalized expected log duration. */ expectedLog: number;
  /** Confidence-adjusted nearest tier radius. */ nearDistance: number;
  /** Policy-controlled wider tier radius, shared with exact scoring. */ wideDistance: number;
  /** Disjoint category group using these indexed bucket intervals. */ categories: RaceCategoryId[];
};

/** Retrieves comparable recordings before wider intervals while respecting hard scope and a fixed document budget. */
export async function searchRaceCandidates(db: Firestore, userId: string, provider: RaceProviderScope, input: RaceMatchRequest,
  profile: RaceMatchProfile, requestId: string, nowMs: number,
  onTier?: (documents: FirebaseFirestore.QueryDocumentSnapshot[], tier: number) => Promise<boolean>,
  checkWorkBudget?: (progress: SearchProgress) => void, context: RaceMatchContext = DEFAULT_RACE_MATCH_CONTEXT, candidateBudget = RACE_MATCH_READ_BUDGET) {
  /** Categories with identical expectations share queries without changing ranking semantics. */
  const groups = new Map<string, SearchExpectation>();
  for (const category of input.categoryId ? [input.categoryId] : RACE_CATEGORY_IDS) {
    /** Same category-specific expectation used by exact candidate scoring. */
    const {expectedLog, nearDistance, wideDistance} = racePerformanceExpectation(profile, category, nowMs, context.priors, context.policy.performance);
    /** Exact grouping preserves distinct category evidence, including confidence differences. */
    const key = `${expectedLog}:${nearDistance}`;
    /** Mutable query group assembled once before retrieval. */
    const group = groups.get(key) ?? {expectedLog, nearDistance, wideDistance, categories: []};
    group.categories.push(category);
    groups.set(key, group);
  }
  /** Provides pivot behavior. */
  const pivot = raceCandidateSearchPivot(userId, requestId);
  /** Provides cursors behavior. */
  const cursors: BucketCursor[] = [...groups.values()].flatMap(({expectedLog, nearDistance, wideDistance, categories}) => Array.from({length: LAST_BUCKET + 1}, (_, bucket) => {
    /** Provides lower behavior. */
    const lower = Math.log(1000) + bucket * BUCKET_WIDTH;
    /** Provides upper behavior. */
    const upper = bucket === LAST_BUCKET ? Math.log(300000) : lower + BUCKET_WIDTH;
    /** Provides overlap distance behavior. */
    const overlapDistance = Math.max(0, lower - expectedLog, expectedLog - upper);
    return {categories: categories.length === RACE_CATEGORY_IDS.length ? undefined : categories, bucket,
      tier: overlapDistance <= nearDistance ? 0 : overlapDistance <= wideDistance ? 1 : 2,
      distance: Math.abs((lower + upper) / 2 - expectedLog), half: 0};
  })).sort((left, right) => left.tier - right.tier || left.distance - right.distance);
  /** Provides documents behavior. */
  const documents: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  /** Provides queries behavior. */
  let queries = 0;
  /** If no eligible fallback exists, spend unused wider capacity on the remaining nearest window before far matches. */
  const tiers = context.policy.algorithmVersion === 3 ? [0, 1, 0, 2] : [0, 1, 2];
  for (const [pass, tier] of tiers.entries()) {
    if (documents.length >= candidateBudget) break;
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
          const allowance = Math.min(RACE_MATCH_PAGE_SIZE, Math.ceil((tierBudget - documents.length - reserved) / (pending.length - index - offset)));
          reserved += allowance;
          return {cursor, allowance};
        });
        /** At most four indexed intervals execute concurrently, retaining circular sampling. */
        const pages = await Promise.all(wave.map(async ({cursor, allowance}) => {
          /** This cursor owns only its reserved capacity until the next wave. */
          const received: FirebaseFirestore.QueryDocumentSnapshot[] = [];
          while (received.length < allowance && cursor.half < 2) {
            checkWorkBudget?.({candidateQueries: queries, candidateDocumentsRead: documents.length + returned});
            /** Scope and ordering remain identical on both halves of the circular cursor. */
            let query = db.collection("raceMatchCandidates").where("provider", "==", provider)
              .where("locale", "==", input.locale).where("rulesVersion", "==", RACE_RULES_VERSION)
              .where("status", "==", "active").where("performanceBucket", "==", cursor.bucket)
              .where("selectionKey", cursor.half === 0 ? ">=" : "<", pivot).where("expiresAtMs", ">", nowMs)
              .orderBy("selectionKey").orderBy("expiresAtMs").orderBy(admin.firestore.FieldPath.documentId()).limit(allowance - received.length);
            if (cursor.categories) query = query.where("categoryId", cursor.categories.length === 1 ? "==" : "in",
              cursor.categories.length === 1 ? cursor.categories[0] : cursor.categories);
            if (cursor.after) query = query.startAfter(cursor.after);
            queries++;
            /** Issued RPCs are metered even when a query rejects. */
            const page = await query.get();
            /** Each cursor exhausts one half before wrapping, with no duplicate documents. */
            const exhaustedHalf = page.size < allowance - received.length;
            received.push(...page.docs);
            returned += page.size;
            checkWorkBudget?.({candidateQueries: queries, candidateDocumentsRead: documents.length + returned});
            cursor.after = page.docs.at(-1);
            if (exhaustedHalf) {cursor.half++; cursor.after = undefined;}
          }
          return received;
        }));
        documents.push(...pages.flat());
      }
    }
    if (onTier && await onTier(documents, tier)) break;
  }
  return {documents, queries, exhausted: cursors.every(cursor => cursor.half >= 2)};
}
