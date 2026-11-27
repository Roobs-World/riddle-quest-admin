import {createHash} from "node:crypto";
import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import {RaceCategoryIdSchema, RaceLocaleSchema} from "../../../../src/races/contracts/index.js";
import {raceMatchPolicySnapshot, RaceMatchPolicySchema, RaceMatchExperimentAssignmentSchema} from "./raceMatchPolicy";

/** Historical identities remain opaque single path segments. */
const Id = z.string().min(1).max(160).refine(value => !value.includes("/"));
/** Persisted clocks and counters must be finite safe nonnegative integers. */
const Count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
/** Preference identity is independent of the category selected from an unrestricted pool. */
const Preferences = z.object({locale: RaceLocaleSchema, categoryId: RaceCategoryIdSchema.nullable()}).strict();
/** Owned receipt fields are validated while Firestore TTL and future extension metadata survive reads. */
const Offer = z.looseObject({
  recordingFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  recordVersion: z.literal(1).optional(), requestId: z.string().min(1).max(160).optional(), userId: Id, challengeId: Id, fingerprint: z.string().min(1).max(1000),
  createdAtMs: Count, expiresAtMs: Count,
  provider: z.enum(["jest", "facebook", "reddit", "android"]).optional(), locale: RaceLocaleSchema.optional(), categoryId: RaceCategoryIdSchema.optional(),
  matchPolicyVersion: z.number().int().min(1).max(3).optional(), matchPolicyRevision: z.number().int().min(1).max(1000000).optional(),
  matchPolicyHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), matchPolicySnapshot: RaceMatchPolicySchema.optional(),
  matchExperiment: RaceMatchExperimentAssignmentSchema.optional(),
  offerBand: z.number().int().min(0).max(2).optional(), performanceConfidence: z.number().min(0).max(1).optional(),
  recordingPerformanceMs: z.number().finite().positive().optional(), expectedPerformanceMs: z.number().finite().positive().optional(),
  recentRivalRepeats: Count.optional(), questionOverlap: z.number().min(0).max(1).optional(), freshnessRelaxed: z.boolean().optional(),
  freshnessBaselineBand: z.number().int().min(0).max(2).optional(), freshnessBaselineRepeats: Count.optional(),
  freshnessBaselineOverlap: z.number().min(0).max(1).optional(),
  lookupCandidateDocumentsRead: Count.optional(), lookupCandidateQueries: Count.optional(), lookupDocumentReadAttempts: Count.optional(),
  lookupTransactionAttempts: Count.optional(), lookupSelectionDurationMs: z.number().finite().nonnegative().optional(),
  acceptedRunId: Id.optional(), acceptedAtMs: Count.optional(), preparationRequested: z.boolean().optional(), offerExpiredAtAcceptance: z.boolean().optional(),
  startsAtMs: Count.optional(), readinessAcceptedAtMs: Count.optional(), terminalStatus: z.enum(["completed", "timed_out", "abandoned"]).optional(), terminalAtMs: Count.optional(),
  result: z.enum(["player_win", "ghost_win", "tie", "timed_out", "recorded"]).nullable().optional(), correctCount: z.number().int().min(0).max(10).optional(),
  finishedTen: z.boolean().optional(), actualPerformanceMs: z.number().finite().min(1000).max(300000).nullable().optional(),
  predictionLogError: z.number().finite().nullable().optional(), finishTimeDeltaMs: z.number().finite().nullable().optional(),
  opponentAdjustedFinishMs: Count.nullable().optional(), settlementDelayMs: Count.nullable().optional(),
  hintPenaltyMs: Count.optional(), skipPenaltyMs: Count.optional(), adjustedFinishMs: Count.optional(),
});

/** Parses both historical and versioned receipts without exposing stored payloads in errors. */
export function parseRaceMatchOffer(value: unknown, documentId: string, expectedOwner?: string) {
  try {
    /** Validated owned fields retain supported extension metadata. */
    const offer = Offer.parse(value);
    /** Original preferences constrain explicit pool fields. */
    const preferences = Preferences.parse(JSON.parse(offer.fingerprint));
    if (offer.requestId !== undefined && createHash("sha256").update(`${offer.userId}\u0000${offer.requestId}`).digest("hex") !== documentId || expectedOwner !== undefined && offer.userId !== expectedOwner || !/^[a-f0-9]{64}$/.test(documentId) || offer.expiresAtMs <= offer.createdAtMs ||
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
      (offer.actualPerformanceMs != null || offer.predictionLogError != null || offer.finishTimeDeltaMs != null) && offer.finishedTen !== true) throw new Error();
    if (offer.matchExperiment !== undefined && offer.matchPolicySnapshot === undefined) throw new Error();
    if (offer.matchPolicySnapshot !== undefined) {
      /** Recomputed attribution detects inconsistent persisted policy fields. */
      const snapshot = raceMatchPolicySnapshot(offer.matchPolicySnapshot);
      if (snapshot.hash !== offer.matchPolicyHash || snapshot.policy.revision !== offer.matchPolicyRevision ||
        snapshot.policy.algorithmVersion !== offer.matchPolicyVersion) throw new Error();
    }
    // Historical receipts without a policy snapshot are supported; versioned writes must carry reproducible attribution.
    if (offer.recordVersion === 1 && (offer.requestId === undefined || offer.provider === undefined || offer.locale === undefined || offer.categoryId === undefined ||
      offer.matchPolicySnapshot === undefined || offer.expectedPerformanceMs === undefined)) throw new Error();
    return {...offer, locale: preferences.locale};
  } catch {
    throw new HttpsError("data-loss", "Stored matchmaking offer is invalid.");
  }
}
