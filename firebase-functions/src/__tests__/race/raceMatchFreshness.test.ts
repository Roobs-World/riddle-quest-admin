import {DEFAULT_RACE_MATCH_POLICY, raceMatchPolicySnapshot} from "../../race/matchmaking/raceMatchPolicy";
import {raceCandidateNeedsFreshness, raceFreshnessInspectionBatch, selectRaceFreshCandidate} from "../../race/matchmaking/raceMatchFreshness";

/** Input is already canonically eligible and sorted by performance band and score. */
const near = {id: "near", band: 0, repeats: 1, exposure: 0};
/** Wider comparable recordings can supply variety without unconstrained widening. */
const wide = {id: "wide", band: 1, repeats: 0, exposure: 0};
/** Legacy policy shape remains hash-compatible and rejects new fields. */
const {freshness: _freshness, ...baseline} = DEFAULT_RACE_MATCH_POLICY.policy.algorithmVersion === 3 ? DEFAULT_RACE_MATCH_POLICY.policy : (() => {throw Error("expected-v3");})();
/** A stored historical offer supplies this exact version-2 shape. */
const legacy = raceMatchPolicySnapshot({...baseline, algorithmVersion: 2}).policy;

it("relaxes a repeated nearest opponent into the comparable fresh band only", () => {
  expect(selectRaceFreshCandidate([near, wide], DEFAULT_RACE_MATCH_POLICY.policy)).toBe(wide);
  expect(selectRaceFreshCandidate([near, {...wide, band: 2}], DEFAULT_RACE_MATCH_POLICY.policy)).toBe(near);
  expect(selectRaceFreshCandidate([near], DEFAULT_RACE_MATCH_POLICY.policy)).toBe(near);
});
it("keeps a fresh nearest opponent and supports configurable overlap thresholds", () => {
  expect(selectRaceFreshCandidate([{...near, repeats: 0}, wide], DEFAULT_RACE_MATCH_POLICY.policy)?.id).toBe("near");
  expect(raceCandidateNeedsFreshness({...near, repeats: 0, exposure: 0.5}, DEFAULT_RACE_MATCH_POLICY.policy)).toBe(true);
  /** Operators may tolerate more repeated opponents but cannot disable all freshness signals. */
  const policy = raceMatchPolicySnapshot({...DEFAULT_RACE_MATCH_POLICY.policy, freshness: {nearCandidateBudget: 100, maxAdditionalChecks: 20, repeatThreshold: 2, overlapThreshold: 0.8}}).policy;
  expect(selectRaceFreshCandidate([near, wide], policy)).toBe(near);
  expect(selectRaceFreshCandidate([{...near, repeats: 0, exposure: 0.8}, wide], policy)).toBe(wide);
});
it("preserves legacy band ordering without inserting freshness fields", () => {
  expect(legacy.algorithmVersion).toBe(2);
  expect(legacy).not.toHaveProperty("freshness");
  expect(selectRaceFreshCandidate([near, wide], legacy)).toBe(near);
  expect(raceMatchPolicySnapshot(legacy).hash).toBe(raceMatchPolicySnapshot({...baseline, algorithmVersion: 2}).hash);
});
it("keeps broad eligibility widening independent of freshness and handles empty pools", () => {
  /** Far candidates remain usable when no comparable eligible recording exists. */
  const far = {...near, band: 2};
  expect(selectRaceFreshCandidate([far], DEFAULT_RACE_MATCH_POLICY.policy)).toBe(far);
  expect(selectRaceFreshCandidate([], DEFAULT_RACE_MATCH_POLICY.policy)).toBeUndefined();
});

it("batches repetitive checks within the same band and stops at the first potentially fresh winner", () => {
  /** Ranked candidates retain identity and order across grouped canonical reads. */
  const rows = [near, {...near, id: "second"}, {...near, id: "fresh", repeats: 0}, {...near, id: "later"}];
  expect(raceFreshnessInspectionBatch(rows, DEFAULT_RACE_MATCH_POLICY.policy, 20, 100)).toEqual(rows.slice(0, 3));
  expect(raceFreshnessInspectionBatch([near, wide], DEFAULT_RACE_MATCH_POLICY.policy, 20, 100)).toEqual([near]);
});
it("caps speculative work by checks, worst-case legacy reads and the four-record batch limit", () => {
  /** Every row remains repetitive so only resource constraints terminate this group. */
  const rows = Array.from({length: 8}, (_, index) => ({...near, id: String(index)}));
  for (const [checks, reads, length] of [[20, 100, 4], [2, 100, 2], [20, 16, 2], [20, 7, 0], [0, 100, 0]]) {
    expect(raceFreshnessInspectionBatch(rows, DEFAULT_RACE_MATCH_POLICY.policy, checks, reads)).toEqual(rows.slice(0, length));
  }
});
