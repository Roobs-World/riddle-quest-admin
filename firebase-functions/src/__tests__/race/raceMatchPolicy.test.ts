import {DEFAULT_RACE_MATCH_POLICY, selectRaceMatchConfiguration, raceMatchPolicySnapshot, raceMatchContext, loadRaceMatchPolicy, RaceMatchPolicySchema} from "../../race/raceMatchPolicy";
import {emptyRaceMatchProfile, racePerformanceExpectation, scoreRaceCandidate, recordRaceExposure} from "../../race/raceMatchPerformance";
import type {Firestore} from "../../race/raceSetupService";

it("hashes equivalent configurations identically and seals a detached snapshot", () => {
  /** Operator input is mutable until validated. */
  const input = {...DEFAULT_RACE_MATCH_POLICY.policy, localePriors: {ar: {overallMs: 180000, categories: {history: 90000}}}};
  /** Captured policy is independent of later configuration changes. */
  const selected = raceMatchPolicySnapshot(input);
  /** JSON field ordering is not a policy change. */
  const reordered = {...input, localePriors: {ar: {categories: {history: 90000}, overallMs: 180000}}};
  expect(raceMatchPolicySnapshot(reordered).hash).toBe(selected.hash);
  input.localePriors.ar.overallMs = 220000;
  expect(selected.policy.localePriors.ar?.overallMs).toBe(180000);
  expect(Object.isFrozen(selected.policy.localePriors.ar?.categories)).toBe(true);
  expect(raceMatchPolicySnapshot(input).hash).not.toBe(selected.hash);
});

it.each([
  {schemaVersion: 2}, {freshness: {nearCandidateBudget: 100, maxAdditionalChecks: 20, repeatThreshold: 0, overlapThreshold: 0.5}}, {freshness: {nearCandidateBudget: 100, maxAdditionalChecks: 20, repeatThreshold: 1, overlapThreshold: 0}}, {algorithmVersion: 4}, {revision: 0}, {eligibility: {allowBlocked: true}},
  {defaultPriors: {overallMs: 0, categories: {}}}, {localePriors: {unknown: {overallMs: 120000, categories: {}}}},
  {performance: {...DEFAULT_RACE_MATCH_POLICY.policy.performance, censoredMaxWeight: 0.5}},
  {performance: {...DEFAULT_RACE_MATCH_POLICY.policy.performance, wideRatio: 1.1}},
  {performance: {...DEFAULT_RACE_MATCH_POLICY.policy.performance, distanceWeightUncertain: 2}},
])("rejects unsupported or unsafe policy parameters: %j", changes => {
  expect(RaceMatchPolicySchema.safeParse({...DEFAULT_RACE_MATCH_POLICY.policy, ...changes}).success).toBe(false);
});

it("resolves language/category priors and uses configured continuous ranking weights", () => {
  /** Arabic cold-start history has a measured category-specific prior. */
  const snapshot = raceMatchPolicySnapshot({...DEFAULT_RACE_MATCH_POLICY.policy, revision: 2,
    localePriors: {ar: {overallMs: 180000, categories: {history: 90000}}},
    performance: {...DEFAULT_RACE_MATCH_POLICY.policy.performance, rivalRepeatWeight: 2, questionExposureWeight: 3}});
  /** One context supplies exact parameters to every selection step. */
  const context = raceMatchContext(snapshot, "ar");
  /** Fresh candidate exactly matches the configured category prior. */
  const candidate = {creatorId: "rival", categoryId: "history" as const, performanceMs: 90000, canonicalRiddleIds: ["known"]};
  expect(scoreRaceCandidate(emptyRaceMatchProfile(), "player", candidate, 1000, context).score).toBe(0);
  expect(raceMatchContext(snapshot, "en").priors).toEqual(snapshot.policy.defaultPriors);
  /** Repetition scoring uses the same selected revision. */
  const exposed = recordRaceExposure(emptyRaceMatchProfile(), "player", [{canonicalRiddleId: "known"} as never], "rival");
  expect(scoreRaceCandidate(exposed, "player", candidate, 1000, context)).toMatchObject({score: 5, repeats: 1, exposure: 1});
  expect(racePerformanceExpectation(exposed, "history", 1000, context.priors, context.policy.performance).expectedLog).toBe(Math.log(90000));
});

it("loads one explicit baseline for missing configuration and fails closed on corrupt configuration or unavailable storage", async () => {
  /** Storage observer exercises the policy module's read-only seam. */
  const get = jest.fn().mockResolvedValue({exists: false});
  /** Only the fixed admin-only policy document may be read. */
  const doc = jest.fn(() => ({get}));
  /** A Firestore adapter avoids any provider/network access in this contract test. */
  const db = {doc} as unknown as Firestore;
  expect(await loadRaceMatchPolicy(db)).toBe(DEFAULT_RACE_MATCH_POLICY);
  expect(doc).toHaveBeenCalledWith("raceConfig/matchPolicy");
  get.mockResolvedValueOnce({exists: true, data: () => ({schemaVersion: 999})});
  await expect(loadRaceMatchPolicy(db)).rejects.toMatchObject({code: "data-loss"});
  get.mockRejectedValueOnce(new Error("storage-unavailable"));
  await expect(loadRaceMatchPolicy(db)).rejects.toThrow("storage-unavailable");
  get.mockResolvedValueOnce({exists: true, data: () => DEFAULT_RACE_MATCH_POLICY.policy});
  expect((await loadRaceMatchPolicy(db)).hash).toBe(DEFAULT_RACE_MATCH_POLICY.hash);
});

it("assigns one stable player-level experiment arm and isolates unenrolled pools", () => {
  /** Complete arm policies differ by a reproducible prior rather than hard eligibility. */
  const configuration = {kind: "experiment", schemaVersion: 1, id: "freshness-study", revision: 1, salt: "private-allocation-salt",
    providers: ["reddit"], locales: ["en"], fallbackPolicy: DEFAULT_RACE_MATCH_POLICY.policy,
    arms: [{id: "control", weightBasisPoints: 5000, policy: DEFAULT_RACE_MATCH_POLICY.policy},
      {id: "variant", weightBasisPoints: 5000, policy: {...DEFAULT_RACE_MATCH_POLICY.policy, revision: 3, defaultPriors: {overallMs: 90000, categories: {}}}}]};
  /** Authenticated identity is separate from client-controlled request preferences. */
  const identity = {userId: `reddit_${"a".repeat(40)}`, provider: "reddit" as const, locale: "en" as const};
  /** Repeated new searches reproduce selection without storing a per-user experiment profile. */
  const selected = selectRaceMatchConfiguration(configuration, identity);
  expect(selectRaceMatchConfiguration(configuration, identity)).toEqual(selected);
  expect(Object.isFrozen(selected.experiment)).toBe(true);
  expect(JSON.stringify(selected.experiment)).not.toContain(configuration.salt);
  expect(JSON.stringify(selected.experiment)).not.toContain(identity.userId);
  expect(selectRaceMatchConfiguration(configuration, {...identity, locale: "fr"}).experiment).toBeUndefined();
  expect(selectRaceMatchConfiguration(configuration, {userId: `jest_${"a".repeat(40)}`, provider: "jest", locale: "en"}).experiment).toBeUndefined();
  expect(() => selectRaceMatchConfiguration(configuration)).toThrow();
  expect(() => selectRaceMatchConfiguration(configuration, {...identity, userId: "forged"})).toThrow();
  /** A bounded synthetic population exercises both disjoint assignment intervals. */
  const arms = Array.from({length: 200}, (_, index) => selectRaceMatchConfiguration(configuration,
    {...identity, userId: `reddit_${index.toString(16).padStart(40, "0")}`}).experiment!.arm);
  expect(new Set(arms)).toEqual(new Set(["control", "variant"]));
  expect(arms.filter(arm => arm === "control").length).toBeGreaterThan(60);
  expect(arms.filter(arm => arm === "control").length).toBeLessThan(140);
  expect(selectRaceMatchConfiguration({...configuration, revision: 2}, identity).experiment?.allocationHash).not.toBe(selected.experiment?.allocationHash);
  for (const patch of [{arms: configuration.arms.map(arm => ({...arm, weightBasisPoints: 1}))},
    {arms: configuration.arms.map(arm => ({...arm, id: "duplicate"}))}, {providers: ["reddit", "reddit"]}, {salt: "short"}]) {
    expect(() => selectRaceMatchConfiguration({...configuration, ...patch}, identity)).toThrow();
  }
});
