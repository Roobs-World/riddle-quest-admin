import type {RaceMatchPolicy} from "./raceMatchPolicy";

/** Answer-free quality facts, scored before canonical eligibility is revalidated. */
export type RaceFreshnessQuality = {
  /** Exact performance band, rather than the coarse retrieval tier. */ band: number;
  /** Prior accepted races against this recording's creator. */ repeats: number;
  /** Fraction of the archived deck already exposed to this player. */ exposure: number;
};
/** Historical algorithm snapshots keep their original band-first behavior. */
export function raceCandidateNeedsFreshness(candidate: RaceFreshnessQuality, policy: RaceMatchPolicy): boolean {
  return policy.algorithmVersion === 3 && (candidate.repeats >= policy.freshness.repeatThreshold || candidate.exposure >= policy.freshness.overlapThreshold);
}
/** Selects only among canonically eligible candidates sorted by band, score and stable tie. */
export function selectRaceFreshCandidate<T extends RaceFreshnessQuality>(eligible: T[], policy: RaceMatchPolicy): T | undefined {
  /** The nearest eligible recording remains the thin-pool fallback. */
  const baseline = eligible[0];
  if (!baseline || !raceCandidateNeedsFreshness(baseline, policy) || baseline.band > 1) return baseline;
  // The broader, unconstrained performance band is never a freshness substitute.
  return eligible.find(candidate => candidate.band <= 1 && !raceCandidateNeedsFreshness(candidate, policy)) ?? baseline;
}
