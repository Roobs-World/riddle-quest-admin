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

/** Bounds optional canonical work without reading beyond the first potentially fresh winner. */
export function raceFreshnessInspectionBatch<T extends RaceFreshnessQuality>(
  candidates: T[], policy: RaceMatchPolicy, remainingChecks: number, remainingReads: number,
): T[] {
  /** Each legacy recording needs at most eight documents before final offer revalidation. */
  const limit = Math.min(4, remainingChecks, Math.floor(remainingReads / 8));
  /** Contiguous rank order prevents a different performance band from consuming this allowance. */
  const group: T[] = [];
  for (const candidate of candidates) {
    if (group.length >= limit || candidate.band !== candidates[0]?.band) break;
    group.push(candidate);
    if (!raceCandidateNeedsFreshness(candidate, policy)) break;
  }
  return group;
}
