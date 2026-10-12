"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceCandidateNeedsFreshness = raceCandidateNeedsFreshness;
exports.selectRaceFreshCandidate = selectRaceFreshCandidate;
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
//# sourceMappingURL=raceMatchFreshness.js.map