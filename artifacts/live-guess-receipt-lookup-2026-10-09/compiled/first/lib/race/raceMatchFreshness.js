"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceCandidateNeedsFreshness = raceCandidateNeedsFreshness;
exports.selectRaceFreshCandidate = selectRaceFreshCandidate;
exports.raceFreshnessInspectionBatch = raceFreshnessInspectionBatch;
/** Historical algorithm snapshots keep their original band-first behavior. */
function raceCandidateNeedsFreshness(candidate, policy) {
    return policy.algorithmVersion === 3 && (candidate.repeats >= policy.freshness.repeatThreshold || candidate.exposure >= policy.freshness.overlapThreshold);
}
/** Selects only among canonically eligible candidates sorted by band, score and stable tie. */
function selectRaceFreshCandidate(eligible, policy) {
    /** The nearest eligible recording remains the thin-pool fallback. */
    const baseline = eligible[0];
    if (!baseline || !raceCandidateNeedsFreshness(baseline, policy) || baseline.band > 1)
        return baseline;
    // The broader, unconstrained performance band is never a freshness substitute.
    return eligible.find(candidate => candidate.band <= 1 && !raceCandidateNeedsFreshness(candidate, policy)) ?? baseline;
}
/** Bounds optional canonical work without reading beyond the first potentially fresh winner. */
function raceFreshnessInspectionBatch(candidates, policy, remainingChecks, remainingReads) {
    /** Each legacy recording needs at most eight documents before final offer revalidation. */
    const limit = Math.min(4, remainingChecks, Math.floor(remainingReads / 8));
    /** Contiguous rank order prevents a different performance band from consuming this allowance. */
    const group = [];
    for (const candidate of candidates) {
        if (group.length >= limit || candidate.band !== candidates[0]?.band)
            break;
        group.push(candidate);
        if (!raceCandidateNeedsFreshness(candidate, policy))
            break;
    }
    return group;
}
//# sourceMappingURL=raceMatchFreshness.js.map