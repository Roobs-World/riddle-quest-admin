import {createHash} from "node:crypto";
import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import {RaceLocaleSchema, RACE_CATEGORY_IDS, type RaceLocale} from "@qwordly/core/race";
import type {Firestore} from "./raceSetupService";

/** Validated duration priors for one language; user histories remain language-specific. */
export const RacePerformancePriorsSchema = z.object({overallMs: z.number().finite().min(1000).max(300000),
  categories: z.partialRecord(z.enum(RACE_CATEGORY_IDS), z.number().finite().min(1000).max(300000))}).strict();
/** Language-specific performance assumptions supplied by the selected policy. */
export type RacePerformancePriors = z.infer<typeof RacePerformancePriorsSchema>;
/** Configurable reading/scoring parameters do not change stored observation normalization or decay. */
const PerformanceParametersSchema = z.object({
  priorEvidence: z.number().finite().min(1).max(40), confidenceEvidence: z.number().finite().min(1).max(40),
  censoredMaxWeight: z.number().finite().min(0).max(0.25),
  nearRatioConfident: z.number().finite().min(1).max(2), nearRatioUncertain: z.number().finite().min(1).max(3),
  wideRatio: z.number().finite().min(1).max(4),
  distanceWeightUncertain: z.number().finite().min(0.1).max(4), distanceWeightConfident: z.number().finite().min(0.1).max(4),
  rivalRepeatWeight: z.number().finite().min(0).max(4), questionExposureWeight: z.number().finite().min(0).max(4),
}).strict().refine(value => value.nearRatioConfident <= value.nearRatioUncertain && value.nearRatioUncertain <= value.wideRatio &&
  value.distanceWeightUncertain <= value.distanceWeightConfident, {message: "Policy windows and confidence weights must be ordered."});
/** A complete policy is selected once, validated and attributed by revision plus content hash. */
const PolicyFields = {schemaVersion: z.literal(1),
  revision: z.number().int().min(1).max(1000000), defaultPriors: RacePerformancePriorsSchema,
  localePriors: z.partialRecord(RaceLocaleSchema, RacePerformancePriorsSchema), performance: PerformanceParametersSchema};
/** Legacy snapshots retain their exact shape and hash, without inserting new defaults. */
const LegacyPolicySchema = z.object({...PolicyFields, algorithmVersion: z.literal(2)}).strict();
/** Freshness can widen only into the comparable wider band, never remove hard eligibility. */
const FreshPolicySchema = z.object({...PolicyFields, algorithmVersion: z.literal(3), freshness: z.object({
  nearCandidateBudget: z.number().int().min(50).max(150), maxAdditionalChecks: z.number().int().min(1).max(50),
  repeatThreshold: z.number().int().min(1).max(20), overlapThreshold: z.number().finite().min(0.1).max(1),
}).strict()}).strict();
/** Version-specific parsing preserves historical attribution through policy upgrades. */
export const RaceMatchPolicySchema = z.discriminatedUnion("algorithmVersion", [LegacyPolicySchema, FreshPolicySchema]);
/** Public experiment attribution excludes allocation salt and authenticated player identity. */
export const RaceMatchExperimentAssignmentSchema = z.object({id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  revision: z.number().int().min(1).max(1000000), arm: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
  allocationHash: z.string().regex(/^[a-f0-9]{64}$/)}).strict();
/** Immutable allocation identity accompanies the selected policy on every offer. */
export type RaceMatchExperimentAssignment = z.infer<typeof RaceMatchExperimentAssignmentSchema>;
/** Admin configuration explicitly declares enrollment and complete arm policies. */
export const RaceMatchExperimentSchema = z.object({kind: z.literal("experiment"), schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), revision: z.number().int().min(1).max(1000000),
  salt: z.string().min(16).max(160), providers: z.array(z.enum(["jest", "facebook", "reddit"])).min(1).max(3),
  locales: z.array(RaceLocaleSchema).min(1).max(17), fallbackPolicy: RaceMatchPolicySchema,
  arms: z.array(z.object({id: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/), weightBasisPoints: z.number().int().min(1).max(9999),
    policy: RaceMatchPolicySchema}).strict()).min(2).max(4),
}).strict().refine(value => value.arms.reduce((total, arm) => total + arm.weightBasisPoints, 0) === 10000 &&
  new Set(value.arms.map(arm => arm.id)).size === value.arms.length && new Set(value.providers).size === value.providers.length &&
  new Set(value.locales).size === value.locales.length, {message: "Experiment allocation must be unique and total 10000 basis points."});
/** Configuration cannot relax provider, language, authorization, blocking or attempt eligibility. */
export type RaceMatchPolicy = z.infer<typeof RaceMatchPolicySchema>;
/** One immutable configuration snapshot, with its reproducible attribution. */
export type RaceMatchPolicySnapshot = {
  /** Validated scoring parameters and language priors. */ policy: RaceMatchPolicy;
  /** Stable hash independent of configuration object-key order. */ hash: string;
  /** Present only for an explicitly enrolled experimental selection. */ experiment?: RaceMatchExperimentAssignment;
};
/** Resolved language assumptions accompany the exact selected policy into retrieval and ranking. */
export type RaceMatchContext = RaceMatchPolicySnapshot & {
  /** Priors selected for the authenticated lookup's requested language. */ priors: RacePerformancePriors;
};

/** Canonical key ordering gives equivalent policies the same content hash. */
function canonical(value: unknown): unknown {
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, child]) => [key, canonical(child)]));
  return value;
}
/** Runtime freezing prevents asynchronous consumers from modifying the selected snapshot. */
function freeze(value: object): void {
  for (const child of Object.values(value)) if (child !== null && typeof child === "object") freeze(child);
  Object.freeze(value);
}
/** Parses a fresh copy and seals it before any lookup work can observe it. */
export function raceMatchPolicySnapshot(value: unknown): RaceMatchPolicySnapshot {
  /** Validation also rejects unsupported algorithms and unknown configuration fields. */
  const policy = RaceMatchPolicySchema.parse(value);
  /** Attribution identifies the entire configuration, including all language priors. */
  const hash = createHash("sha256").update(JSON.stringify(canonical(policy))).digest("hex");
  freeze(policy);
  return Object.freeze({policy, hash});
}
/** Baseline retains the current transparent heuristic until an operator installs a validated revision. */
export const DEFAULT_RACE_MATCH_POLICY = raceMatchPolicySnapshot({schemaVersion: 1, algorithmVersion: 3, revision: 2, freshness: {nearCandidateBudget: 100, maxAdditionalChecks: 20, repeatThreshold: 1, overlapThreshold: 0.5},
  defaultPriors: {overallMs: 120000, categories: {}}, localePriors: {},
  performance: {priorEvidence: 4, confidenceEvidence: 8, censoredMaxWeight: 0.25,
    nearRatioConfident: 1.25, nearRatioUncertain: 1.5, wideRatio: 2,
    distanceWeightUncertain: 0.5, distanceWeightConfident: 1, rivalRepeatWeight: 0.6, questionExposureWeight: 0.8}});
/** Pure scoring defaults share the same snapshot as unconfigured backend lookups. */
export const DEFAULT_RACE_MATCH_CONTEXT: RaceMatchContext = Object.freeze({...DEFAULT_RACE_MATCH_POLICY, priors: DEFAULT_RACE_MATCH_POLICY.policy.defaultPriors});
/** Resolves language-specific priors without rereading or mutating the policy. */
export function raceMatchContext(snapshot: RaceMatchPolicySnapshot, locale: RaceLocale): RaceMatchContext {
  return Object.freeze({...snapshot, priors: snapshot.policy.localePriors[locale] ?? snapshot.policy.defaultPriors});
}
/** Deterministic player-level assignment does not depend on request ID, category or retry timing. */
export function selectRaceMatchConfiguration(value: unknown, identity?: {
  /** Authenticated provider account; never accepted from matching preferences. */ userId: string;
  /** Authorized discovery pool derived from the account. */ provider: "jest" | "facebook" | "reddit";
  /** Supported language used for explicit experiment enrollment. */ locale: RaceLocale;
}): RaceMatchPolicySnapshot {
  if (typeof value !== "object" || value === null || !("kind" in value)) return raceMatchPolicySnapshot(value);
  /** Detached validation prevents mid-lookup mutation of allocation weights or arm policies. */
  const experiment = RaceMatchExperimentSchema.parse(value);
  if (!identity || !new RegExp(`^${identity.provider}_[a-f0-9]{40}$`).test(identity.userId)) throw new Error("Experiment requires authenticated pool identity.");
  if (!experiment.providers.includes(identity.provider) || !experiment.locales.includes(identity.locale)) return raceMatchPolicySnapshot(experiment.fallbackPolicy);
  /** Allocation hashing covers all parameters and enrollment restrictions without exporting them. */
  const allocationHash = createHash("sha256").update(JSON.stringify(canonical(experiment))).digest("hex");
  /** A 64-bit digest gives deterministic near-uniform assignment to ten thousand intervals. */
  const bucket = Number(BigInt(`0x${createHash("sha256").update(JSON.stringify([experiment.id, experiment.revision, experiment.salt, identity.userId])).digest("hex").slice(0, 16)}`) % 10000n);
  /** Arm order defines disjoint cumulative intervals and is covered by allocation identity. */
  let remaining = bucket;
  for (const arm of experiment.arms) {
    if (remaining < arm.weightBasisPoints) return Object.freeze({...raceMatchPolicySnapshot(arm.policy),
      experiment: Object.freeze({id: experiment.id, revision: experiment.revision, arm: arm.id, allocationHash})});
    remaining -= arm.weightBasisPoints;
  }
  throw new Error("Experiment allocation is invalid.");
}
/** Admin-only policy selection has no cache that could mix revisions within one lookup. */
export async function loadRaceMatchPolicy(db: Firestore, identity?: {
  /** Authenticated provider account passed by the server lookup. */ userId: string;
  /** Authorized discovery pool derived from the account. */ provider: "jest" | "facebook" | "reddit";
  /** Supported language used for explicit experiment enrollment. */ locale: RaceLocale;
}): Promise<RaceMatchPolicySnapshot> {
  /** A missing configuration uses the explicitly versioned baseline; storage errors propagate. */
  const stored = await db.doc("raceConfig/matchPolicy").get();
  if (!stored.exists) return DEFAULT_RACE_MATCH_POLICY;
  try {return selectRaceMatchConfiguration(stored.data(), identity);}
  catch {throw new HttpsError("data-loss", "Stored matchmaking policy is invalid.");}
}
