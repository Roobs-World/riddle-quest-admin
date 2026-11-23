import {createHash} from "node:crypto";
import {z} from "zod";
import {RACE_CATEGORY_IDS, type RaceCategoryId} from "../../../src/races/contracts/index.js";
import type {RaceRiddleSnapshot, RaceRunRecord} from "./raceEngine";
import {RacePerformancePriorsSchema, DEFAULT_RACE_MATCH_CONTEXT, type RacePerformancePriors, type RaceMatchContext,
  type RaceMatchPolicy} from "./raceMatchPolicy";

export {RacePerformancePriorsSchema} from "./raceMatchPolicy";
export type {RacePerformancePriors} from "./raceMatchPolicy";

/** Versioned, transparent heuristic; never a competitive integrity guarantee. */
export const RACE_MATCH_POLICY_VERSION = 3;
/** Recording normalization remains compatible with previously published candidate indexes. */
export const RACE_MATCH_NORMALIZATION_VERSION = 1;
/** Neutral prior for an unknown player's ten-question recording. */
export const RACE_MATCH_PRIOR_MS = 120_000;
/** Recency bounds keep one owner's projection small and avoid unbounded histories. */
export const RACE_MATCH_EXPOSURE_LIMIT = 120;
/** Observed finish evidence remains independent of weaker censored lower bounds. */
const LegacyEstimateSchema = z.object({logMs: z.number().finite().min(Math.log(1000)).max(Math.log(300000)), evidence: z.number().min(0).max(20),
  updatedAtMs: z.number().finite().nonnegative().optional()}).strict();
/** Partial observations never increase confidence in a fully observed finish. */
const EstimateSchema = LegacyEstimateSchema.extend({censored: LegacyEstimateSchema.optional()}).strict();
/** Recent completion evidence is bounded and decays independently of duration observations. */
const CompletionSchema = z.object({finished: z.number().finite().min(0).max(20), unfinished: z.number().finite().min(0).max(20),
  updatedAtMs: z.number().finite().nonnegative()}).strict().refine(value => value.finished + value.unfinished <= 20.000001);
/** A creator recording and a ghost-limited challenge have different completion opportunities. */
const RoleCompletionSchema = z.object({overall: CompletionSchema,
  categories: z.partialRecord(z.enum(RACE_CATEGORY_IDS), CompletionSchema)}).strict();
/** Shared privacy-bounded histories are retained during legacy migration. */
const ProfileHistorySchema = z.object({
  recentOpponents: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(20),
  exposedRiddleIds: z.array(z.string()).max(RACE_MATCH_EXPOSURE_LIMIT),
}).strict();
/** Legacy mixed evidence cannot be relabelled as confirmed finishes. */
const LegacyProfileSchema = ProfileHistorySchema.extend({version: z.literal(1), overall: LegacyEstimateSchema,
  categories: z.partialRecord(z.enum(RACE_CATEGORY_IDS), LegacyEstimateSchema)}).strict();
/** Validates separated observation and completion projections independently of economy fields. */
const CurrentProfileSchema = ProfileHistorySchema.extend({version: z.literal(2), overall: EstimateSchema,
  categories: z.partialRecord(z.enum(RACE_CATEGORY_IDS), EstimateSchema),
  completion: z.object({creator: RoleCompletionSchema.optional(), challenger: RoleCompletionSchema.optional()}).strict()}).strict();
/** Lazily upgrades old histories without inventing completion outcomes or trusting mixed evidence fully. */
export const RaceMatchProfileSchema = z.union([CurrentProfileSchema, LegacyProfileSchema]).transform<z.infer<typeof CurrentProfileSchema>>(profile => {
  if (profile.version === 2) return profile;
  /** Legacy averages may contain extrapolated losses; retain their signal with at most one observation of confidence. */
  const limit = (estimate: z.infer<typeof LegacyEstimateSchema>) => ({...estimate, evidence: Math.min(1, estimate.evidence)});
  return {...profile, version: 2 as const, overall: limit(profile.overall),
    categories: Object.fromEntries(Object.entries(profile.categories).map(([category, estimate]) => [category, limit(estimate)])), completion: {}};
});
/** Compact per-user, per-language matchmaking projection. */
export type RaceMatchProfile = z.infer<typeof RaceMatchProfileSchema>;
/** An unfinished observation supplies a lower bound, never a projected finish. */
export const RacePerformanceSampleSchema = z.discriminatedUnion("observation", [
  z.object({observation: z.literal("finish"), timeMs: z.number().finite().min(1000).max(300000), evidence: z.literal(1)}).strict(),
  z.object({observation: z.literal("censored"), timeMs: z.number().finite().min(1000).max(300000), evidence: z.literal(0.25)}).strict(),
]);
/** Evidence supplied by one authoritative recording or challenger attempt. */
export type RacePerformanceSample = z.infer<typeof RacePerformanceSampleSchema>;
/** Neutral fallback remains available until calibrated policy parameters are supplied. */
const DEFAULT_PRIORS = DEFAULT_RACE_MATCH_CONTEXT.priors;

/** Empty history uses an overall prior until category-specific evidence is available. */
export function emptyRaceMatchProfile(): RaceMatchProfile {
  return {version: 2, overall: {logMs: Math.log(RACE_MATCH_PRIOR_MS), evidence: 0}, categories: {}, completion: {}, recentOpponents: [], exposedRiddleIds: []};
}

/** Viewer-bound opaque repetition key; no targetable rival identity is stored in this projection. */
export const raceRepetitionKey = (viewer: string, rival: string): string => createHash("sha256").update(`${viewer}:${rival}`).digest("hex");

/** Normalizes the played portion against a fixed medium/easy reference mix; legacy unknown difficulty stays unadjusted. */
export function raceDifficultyAdjustedMs(timeMs: number, riddles: RaceRiddleSnapshot[], cleared = 10): number {
  /** Provides played behavior. */
  const played = riddles.slice(0, Math.max(1, cleared));
  /** Provides weight behavior. */
  const weight = raceDifficultyWeight;
  /** Provides difficulty behavior. */
  const difficulty = played.length ? played.reduce((sum, riddle) => sum + weight(riddle.difficultyBand), 0) / played.length : 1.25;
  return Math.max(1_000, Math.min(300_000, timeMs * 1.25 / difficulty));
}

/** Fixed normalization weights are shared by observed finishes and conservative partial bounds. */
function raceDifficultyWeight(difficulty?: string): number {
  return difficulty === "easy" ? 1 : difficulty === "medium" ? 1.5 : difficulty === "hard" ? 2 : 1.25;
}

/** Uses actual finishes or conservative normalized elapsed lower bounds; idle speed observations are excluded. */
export function racePerformanceSample(run: RaceRunRecord): RacePerformanceSample | null {
  /** Provides outcome behavior. */
  const outcome = run.settledOutcome;
  if (!outcome || run.status === "abandoned" || run.correctCount === 0) return null;
  /** Provides completed behavior. */
  const completed = run.correctCount >= 10;
  if (completed) return {observation: "finish", timeMs: raceDifficultyAdjustedMs(outcome.adjustedFinishMs, run.riddles, run.correctCount), evidence: 1};
  // The eventual finish cannot precede elapsed adjusted time. Use the hardest
  // possible archived question so normalization cannot overstate that bound.
  /** Maximum weight bounds any possible completed question subset, including skipped questions. */
  const hardest = run.riddles.length ? Math.max(...run.riddles.map(riddle => raceDifficultyWeight(riddle.difficultyBand))) : 1.25;
  return {observation: "censored", timeMs: Math.max(1000, Math.min(300000, outcome.adjustedFinishMs * 1.25 / hardest)), evidence: 0.25};
}

/** Updates only the owner of this attempt; a popular ghost cannot multiply its creator's rating evidence. */
export function recordRacePerformance(profile: RaceMatchProfile, category: RaceCategoryId, sample: RacePerformanceSample, nowMs = Date.now()): RaceMatchProfile {
  RacePerformanceSampleSchema.parse(sample);
  /** Provides update behavior. */
  const update = (previous: RaceMatchProfile["overall"]) => {
    /** Censored statistics have their own clock and cannot refresh observed-finish confidence. */
    const source = sample.observation === "censored" ? previous.censored ?? {logMs: Math.log(sample.timeMs), evidence: 0} : previous;
    /** Delivery order cannot rewind the observation clock or refresh an old result. */
    const referenceAtMs = Math.max(nowMs, source.updatedAtMs ?? nowMs);
    /** A late observation contributes only its remaining recent evidence. */
    const sampleEvidence = sample.evidence * 2 ** (-(referenceAtMs - nowMs) / (30 * 86_400_000));
    /** Bounded observation count, including recency decay. */
    const evidence = Math.min(20, recentEvidence(source, referenceAtMs) + sampleEvidence);
    /** Provides alpha behavior. */
    const alpha = evidence > 0 ? sampleEvidence / evidence : 0;
    /** Mean of the observed finishes or lower bounds, kept in separate storage. */
    const estimate = {logMs: source.logMs + alpha * (Math.log(sample.timeMs) - source.logMs), evidence, updatedAtMs: referenceAtMs};
    return sample.observation === "censored" ? {...previous, censored: estimate} : {...previous, ...estimate};
  };
  return {...profile, overall: update(profile.overall), categories: {...profile.categories,
    [category]: update(profile.categories[category] ?? {logMs: profile.overall.logMs, evidence: 0})}};
}

/** Records completion against the issued opportunity, independently of any usable speed evidence. */
export function recordRaceCompletion(profile: RaceMatchProfile, role: "creator" | "challenger", category: RaceCategoryId,
  finished: boolean, nowMs: number): RaceMatchProfile {
  /** Decay and proportional capping preserve a bounded recent success/failure ratio. */
  const update = (previous?: z.infer<typeof CompletionSchema>) => {
    /** Old outbox delivery cannot make previous observations young again. */
    const referenceAtMs = Math.max(nowMs, previous?.updatedAtMs ?? nowMs);
    /** Completion evidence has its own observation clock. */
    const decay = previous ? 2 ** (-(referenceAtMs - previous.updatedAtMs) / (30 * 86_400_000)) : 0;
    /** A late opportunity has the same recency weight regardless of processing order. */
    const weight = 2 ** (-(referenceAtMs - nowMs) / (30 * 86_400_000));
    /** Counts represent actual completions, never extrapolated finish times. */
    const successes = (previous?.finished ?? 0) * decay + Number(finished) * weight;
    /** Idle settled races are valid non-completion observations. */
    const failures = (previous?.unfinished ?? 0) * decay + Number(!finished) * weight;
    /** Bounding both counts equally retains their ratio. */
    const scale = Math.min(1, 20 / (successes + failures));
    return {finished: successes * scale, unfinished: failures * scale, updatedAtMs: referenceAtMs};
  };
  /** Role separates recording completion from a challenge cut short by its fixed opponent. */
  const previous = profile.completion[role];
  return {...profile, completion: {...profile.completion, [role]: {overall: update(previous?.overall),
    categories: {...previous?.categories, [category]: update(previous?.categories[category])}}}};
}

/** Completion probability is conditional on role/category and shrinks sparse evidence toward a supplied prior. */
export function raceCompletionExpectation(profile: RaceMatchProfile, role: "creator" | "challenger", category: RaceCategoryId | undefined,
  nowMs: number, priorProbability = 0.5) {
  if (!Number.isFinite(priorProbability) || priorProbability <= 0 || priorProbability >= 1) throw new Error("Invalid completion prior");
  /** Returns effective recent counts without changing stored histories. */
  const counts = (estimate?: z.infer<typeof CompletionSchema>) => {
    /** Old completion opportunities lose confidence independently of performance samples. */
    const decay = estimate ? 2 ** (-Math.max(0, nowMs - estimate.updatedAtMs) / (30 * 86_400_000)) : 0;
    return {finished: (estimate?.finished ?? 0) * decay, total: ((estimate?.finished ?? 0) + (estimate?.unfinished ?? 0)) * decay};
  };
  /** Role-specific base estimate. */
  const overall = counts(profile.completion[role]?.overall);
  /** Four prior opportunities keep a first loss from becoming certainty. */
  const base = (overall.finished + priorProbability * 4) / (overall.total + 4);
  /** Category estimates use role-level evidence when their own history is sparse. */
  const specific = counts(category ? profile.completion[role]?.categories[category] : undefined);
  return {probability: (specific.finished + base * 4) / (specific.total + 4), confidence: Math.min(1, Math.max(overall.total, specific.total) / 8)};
}

/** Evidence loses half its confidence each thirty days without a fresh recording. */
function recentEvidence(estimate: RaceMatchProfile["overall"], nowMs: number): number {
  /** Provides age behavior. */
  const age = estimate.updatedAtMs === undefined ? 0 : Math.max(0, nowMs - estimate.updatedAtMs);
  return estimate.evidence * 2 ** (-age / (30 * 86_400_000));
}

/** Records all preloaded questions at acceptance, including abandoned preparation and future unsolved questions. */
export function recordRaceExposure(profile: RaceMatchProfile, viewer: string, riddles: RaceRiddleSnapshot[], rival?: string): RaceMatchProfile {
  /** Provides ids behavior. */
  const ids = riddles.map((riddle) => riddle.canonicalRiddleId);
  /** Provides recent opponents behavior. */
  const recentOpponents = rival ? [raceRepetitionKey(viewer, rival), ...profile.recentOpponents] : profile.recentOpponents;
  return {...profile, recentOpponents: recentOpponents.slice(0, 20),
    exposedRiddleIds: [...new Set([...ids, ...profile.exposedRiddleIds])].slice(0, RACE_MATCH_EXPOSURE_LIMIT)};
}

/** Shared expectation keeps indexed retrieval and exact ranking on the same confidence/category policy. */
export function racePerformanceExpectation(profile: RaceMatchProfile, categoryId: RaceCategoryId | undefined, nowMs: number,
  suppliedPriors: RacePerformancePriors = DEFAULT_PRIORS,
  parameters: RaceMatchPolicy["performance"] = DEFAULT_RACE_MATCH_CONTEXT.policy.performance) {
  /** The policy supplies validated priors for this profile's language. */
  const priors = RacePerformancePriorsSchema.parse(suppliedPriors);
  /** Provides overall evidence behavior. */
  const overallEvidence = recentEvidence(profile.overall, nowMs);
  /** Provides overall weight behavior. */
  const overallWeight = overallEvidence / (overallEvidence + parameters.priorEvidence);
  /** Provides overall behavior. */
  const overall = profile.overall.logMs * overallWeight + Math.log(priors.overallMs) * (1 - overallWeight);
  /** Provides category behavior. */
  const category = categoryId ? profile.categories[categoryId] : undefined;
  /** Provides category evidence behavior. */
  const categoryEvidence = category ? recentEvidence(category, nowMs) : 0;
  /** Provides category weight behavior. */
  const categoryWeight = categoryEvidence / (categoryEvidence + parameters.priorEvidence);
  /** Provides expected log behavior. */
  const categoryPrior = categoryId ? priors.categories[categoryId] : undefined;
  /** Category priors contribute only where personal overall evidence is weak. */
  const base = categoryPrior ? profile.overall.logMs * overallWeight + Math.log(categoryPrior) * (1 - overallWeight) : overall;
  /** Observed-finish expectation before applying limited one-sided partial evidence. */
  const observedLog = category ? category.logMs * categoryWeight + base * (1 - categoryWeight) : base;
  /** Category partial history falls back to overall partial evidence without doubling it. */
  const censored = category?.censored ?? profile.overall.censored;
  /** Partial evidence contributes at most one quarter and never invents a faster finish. */
  const censoredEvidence = censored ? recentEvidence(censored, nowMs) : 0;
  /** Limited lower-bound influence remains independent of finish confidence. */
  const censoredWeight = Math.min(parameters.censoredMaxWeight, censoredEvidence / (censoredEvidence + parameters.priorEvidence));
  /** No ten-question extrapolation or remaining-question difficulty assumption. */
  const expectedLog = observedLog + censoredWeight * Math.max(0, (censored?.logMs ?? observedLog) - observedLog);
  /** Provides confidence behavior. */
  const confidence = Math.min(1, Math.max(overallEvidence, categoryEvidence) / parameters.confidenceEvidence);
  return {expectedLog, confidence, nearDistance: Math.log(parameters.nearRatioConfident + (1 - confidence) *
    (parameters.nearRatioUncertain - parameters.nearRatioConfident)), wideDistance: Math.log(parameters.wideRatio)};
}

/** Scores within hard eligibility; lower values prefer similar performance and unfamiliar questions/opponents. */
export function scoreRaceCandidate(profile: RaceMatchProfile, viewer: string,
  candidate: {
    /** Creator of the original fixed performance. */
    creatorId: string;
    /** Category-specific evidence selection. */
    categoryId: RaceCategoryId;
    /** Fixed performance of this recording. */
    performanceMs: number;
    /** Archived question ordering. */
    canonicalRiddleIds: string[];
  }, nowMs = Date.now(), context: RaceMatchContext = DEFAULT_RACE_MATCH_CONTEXT) {
  /** Provides {expected log, confidence, near distance} behavior. */
  const {expectedLog, confidence, nearDistance, wideDistance} = racePerformanceExpectation(profile, candidate.categoryId, nowMs, context.priors, context.policy.performance);
  /** Provides distance behavior. */
  const distance = Math.abs(Math.log(candidate.performanceMs) - expectedLog);
  /** Provides repeats behavior. */
  const repeats = profile.recentOpponents.filter((key) => key === raceRepetitionKey(viewer, candidate.creatorId)).length;
  /** Provides exposed behavior. */
  const exposed = new Set(profile.exposedRiddleIds);
  /** Provides exposure behavior. */
  const exposure = candidate.canonicalRiddleIds.filter((id) => exposed.has(id)).length / Math.max(1, candidate.canonicalRiddleIds.length);
  /** Continuous weights share the immutable configuration used by indexed search. */
  const parameters = context.policy.performance;
  return {score: distance * (parameters.distanceWeightUncertain + confidence * (parameters.distanceWeightConfident - parameters.distanceWeightUncertain)) +
    repeats * parameters.rivalRepeatWeight + exposure * parameters.questionExposureWeight,
    distance, confidence, repeats, exposure, band: distance <= nearDistance ? 0 : distance <= wideDistance ? 1 : 2};
}
