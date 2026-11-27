import {admin} from "../../shared/firebaseAdmin";
import {z} from "zod";
import {RaceCategoryIdSchema, RaceLocaleSchema, RACE_RULES_VERSION} from "../../../../src/races/contracts/index.js";
import {raceProviderScope, type RaceProviderScope} from "../access/raceProviderScope";
import type {RaceChallengeRecord} from "../raceSetupService";
import {raceDifficultyAdjustedMs, RACE_MATCH_NORMALIZATION_VERSION} from "./raceMatchPerformance";
import {raceCandidateSelectionKey, racePerformanceBucket} from "./raceCandidateSearch";

/** Answer-free, compact projection used to retrieve the correct matchmaking pool. */
export type RaceMatchCandidate = {
  /** Indexed immutable performance interval used before candidate limits. */ performanceBucket: number;
  /** Uniform recording key used for request-specific circular retrieval. */ selectionKey: string;
  /** Authoritative challenge to revalidate before offering or accepting. */ challengeId: string;
  /** Game-owned recording identity; never a provider profile payload. */ creatorId: string;
  /** Trusted provider pool selected from the creator's account namespace. */ provider: RaceProviderScope;
  /** Exact language of the recording. */ locale: RaceChallengeRecord["locale"];
  /** Content preference supported without a separate queue. */ categoryId: RaceChallengeRecord["categoryId"];
  /** Immutable competition rules. */ rulesVersion: RaceChallengeRecord["rules"]["version"];
  /** Exact archived deck revision. */ contentVersion: string;
  /** Fixed adjusted performance of this recording. */ adjustedFinishMs: number;
  /** Versioned normalized recording performance, never a creator's mutable live rating. */ performanceMs: number;
  /** Recording normalization revision; stored field name retained for existing projections. */ matchPolicyVersion: number;
  /** Answer-free identifiers support repetition scoring without downloading the deck. */ canonicalRiddleIds: string[];
  /** Eligibility projection; acceptance always consults canonical state. */ status: "active";
  /** Indexed expiration; TTL removal is not the eligibility authority. */ expiresAtMs: number;
  /** Creation timestamp used for bounded retrieval and diagnostics. */ createdAtMs: number;
  /** Storage retention of this compact projection. */ expiresAt: FirebaseFirestore.Timestamp;
};

/** Complete answer-free retrieval contract, including immutable derived query keys. */
export const RaceMatchCandidateSchema = z.object({
  performanceBucket: z.number().int().nonnegative(), selectionKey: z.string().regex(/^[a-f0-9]{64}$/),
  challengeId: z.string().min(1).max(160).refine(value => !value.includes("/")),
  creatorId: z.string().regex(/^(?:(?:jest|facebook|reddit)_[a-f0-9]{40}|[A-Za-z0-9]{28})$/), provider: z.enum(["jest", "facebook", "reddit", "android"]),
  locale: RaceLocaleSchema, categoryId: RaceCategoryIdSchema, rulesVersion: z.literal(RACE_RULES_VERSION),
  contentVersion: z.string().min(1), adjustedFinishMs: z.number().int().nonnegative(),
  performanceMs: z.number().finite().min(1000).max(300000), matchPolicyVersion: z.literal(RACE_MATCH_NORMALIZATION_VERSION),
  canonicalRiddleIds: z.array(z.string().min(1).max(160).refine(value => !value.includes("/"))).min(1).max(15),
  status: z.literal("active"), expiresAtMs: z.number().int().nonnegative(), createdAtMs: z.number().int().nonnegative(),
  expiresAt: z.custom<FirebaseFirestore.Timestamp>(value => value instanceof admin.firestore.Timestamp),
}).strict().refine(value => value.provider === raceProviderScope(value.creatorId) &&
  value.performanceBucket === racePerformanceBucket(value.performanceMs) &&
  value.selectionKey === raceCandidateSelectionKey(value.challengeId) && value.expiresAtMs > value.createdAtMs &&
  value.expiresAt.toMillis() === value.expiresAtMs && new Set(value.canonicalRiddleIds).size === value.canonicalRiddleIds.length);

/** Invalid derived records cannot influence ranking; document identity is checked separately from stored data. */
export function parseRaceMatchCandidate(value: unknown, documentId: string): RaceMatchCandidate | null {
  /** Validation diagnostics remain internal and contain no answer-bearing payload. */
  const parsed = RaceMatchCandidateSchema.safeParse(value);
  return parsed.success && parsed.data.challengeId === documentId ? parsed.data : null;
}

/** Canonical-derived comparison excludes projections whose valid shape still carries stale ranking metadata. */
export function raceMatchCandidateEquals(value: unknown, expected: RaceMatchCandidate): boolean {
  /** Full schema validation also rejects unsupported extra fields. */
  const current = parseRaceMatchCandidate(value, expected.challengeId);
  return current !== null && Object.entries(expected).every(([key, field]) => key === "expiresAt"
    ? current.expiresAt.toMillis() === expected.expiresAt.toMillis()
    : JSON.stringify(current[key as keyof RaceMatchCandidate]) === JSON.stringify(field));
}

/** Projects public recordings only; private invitation seats never enter random matching. */
export function projectRaceMatchCandidate(challenge: RaceChallengeRecord): RaceMatchCandidate | null {
  /** Provides provider behavior. */
  const provider = raceProviderScope(challenge.creatorId);
  if (!provider || challenge.status !== "active" || challenge.scope === "invitation" || challenge.challengeId.startsWith("jest-invite-")) return null;
  /** Provides performance ms behavior. */
  const performanceMs = challenge.recordingPerformanceMs ?? raceDifficultyAdjustedMs(challenge.creatorAdjustedFinishMs, challenge.riddles ?? []);
  return {
    performanceBucket: racePerformanceBucket(performanceMs), selectionKey: raceCandidateSelectionKey(challenge.challengeId),
    challengeId: challenge.challengeId, creatorId: challenge.creatorId, provider, locale: challenge.locale,
    categoryId: challenge.categoryId, rulesVersion: challenge.rules.version, contentVersion: challenge.contentVersion,
    adjustedFinishMs: challenge.creatorAdjustedFinishMs,
    performanceMs,
    matchPolicyVersion: RACE_MATCH_NORMALIZATION_VERSION, canonicalRiddleIds: challenge.canonicalRiddleIds,
    status: "active", expiresAtMs: challenge.expiresAtMs,
    createdAtMs: challenge.createdAtMs, expiresAt: admin.firestore.Timestamp.fromMillis(challenge.expiresAtMs),
  };
}
