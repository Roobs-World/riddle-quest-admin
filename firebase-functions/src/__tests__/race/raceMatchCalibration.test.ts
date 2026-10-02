import {raceMatchMeasurement, summarizeRaceMatches, compareRacePolicies, RaceMatchMeasurementSchema} from "../../race/raceMatchCalibration";
import {DEFAULT_RACE_MATCH_POLICY} from "../../race/raceMatchPolicy";
import {emptyRaceMatchProfile, recordRaceExposure} from "../../race/raceMatchPerformance";

/** Answer-free observations use one fixed cohort and a deterministic reporting clock. */
const row = {provider: "reddit", locale: "en", categoryId: "history", createdAtMs: 100, expiresAtMs: 500};

it("separates pending offers and ongoing runs from terminal completion denominators", () => {
  /** One completed finish, one preparation abandonment, one active run and one unaccepted expiry. */
  const report = summarizeRaceMatches([
    {...row, acceptedAtMs: 200, startsAtMs: 250, terminalStatus: "completed", terminalAtMs: 400, finishedTen: true, correctCount: 10,
      actualPerformanceMs: 10000, predictionLogError: -0.2, finishTimeDeltaMs: -1000, settlementDelayMs: 20},
    {...row, acceptedAtMs: 200, terminalStatus: "abandoned", terminalAtMs: 300, finishedTen: false, correctCount: 0},
    {...row, acceptedAtMs: 200, startsAtMs: 250}, row,
    {...row, expiresAtMs: 2000}, {...row, createdAtMs: 2000, expiresAtMs: 3000},
  ], 1000);
  expect(report.excludedFuture).toBe(1);
  expect(report.cohorts[0]).toMatchObject({offers: 5, maturedOffers: 4, pendingOffers: 1, accepted: 3, acceptanceRate: 0.75,
    started: 2, terminal: 2, finishedTen: 1, completionRateAmongTerminal: 0.5, abandoned: 1, preparationFailures: 1,
    acceptedPendingTerminal: 1, absoluteFinishGapMs: {count: 1, p95: 1000}, absolutePredictionLogError: {count: 1, mean: 0.2}});
});
it("keeps legacy unknown-policy and low/high-confidence cohorts distinct with explicit missing measurements", () => {
  /** Different policy cohorts cannot silently blend calibration assumptions. */
  const report = summarizeRaceMatches([row, {...row, matchPolicyHash: "a".repeat(64), matchPolicyRevision: 2, performanceConfidence: 0.1},
    {...row, matchPolicyHash: "a".repeat(64), matchPolicyRevision: 2, performanceConfidence: 0.9}], 600);
  expect(report.cohorts).toHaveLength(3);
  expect(report.cohorts[0]).toMatchObject({policyHash: "unknown", confidence: "unknown", selectionDurationMs: {count: 0, mean: null}});
  /** Legacy terminal receipts with no finish measurement cannot be counted as non-completions. */
  const legacy = summarizeRaceMatches([{...row, acceptedAtMs: 200, terminalStatus: "completed", terminalAtMs: 300, correctCount: 10}], 600);
  expect(legacy.cohorts[0]).toMatchObject({terminal: 1, completionMeasuredTerminal: 0, completionMeasurementMissing: 1, completionRateAmongTerminal: null});
});
it("uses nearest-rank cost quantiles and reports selected versus baseline freshness", () => {
  /** Small synthetic samples make quantile and overlap arithmetic inspectable. */
  const report = summarizeRaceMatches([1, 2, 3, 100].map(cost => ({...row, lookupDocumentReadAttempts: cost,
    questionOverlap: 0, freshnessBaselineOverlap: 0.5, recentRivalRepeats: 0, freshnessBaselineRepeats: 1, freshnessRelaxed: true})), 600);
  expect(report.cohorts[0]).toMatchObject({freshnessRelaxed: 4, documentReadAttempts: {count: 4, mean: 26.5, p50: 2, p95: 100},
    overlap: {mean: 0}, baselineOverlap: {mean: 0.5}, baselineRepeats: {mean: 1}});
});
it("rejects impossible completion evidence and clocks, and allowlists production receipts", () => {
  for (const changes of [{actualPerformanceMs: 1000}, {finishedTen: true, terminalStatus: "completed", correctCount: 5},
    {acceptedAtMs: 10}, {startsAtMs: 200}, {terminalAtMs: 200}, {userId: "private"}, {answer: "secret"}]) {
    expect(RaceMatchMeasurementSchema.safeParse({...row, ...changes}).success).toBe(false);
  }
  expect(raceMatchMeasurement({...row, userId: "private", riddles: [{answer: "secret"}], matchPolicySnapshot: {private: true}})).toEqual(row);
  expect(() => summarizeRaceMatches([row], -1)).toThrow();
});
it("does not count abandoned countdowns or future scheduled starts as started", () => {
  /** Accepted readiness differs from the actual start clock. */
  const report = summarizeRaceMatches([
    {...row, acceptedAtMs: 200, startsAtMs: 900, terminalAtMs: 300, terminalStatus: "abandoned", correctCount: 0, finishedTen: false},
    {...row, acceptedAtMs: 200, startsAtMs: 2000},
  ], 1000);
  expect(report.cohorts[0]).toMatchObject({accepted: 2, started: 0, terminal: 1, abandoned: 1, countdownFailures: 1});
});
it("compares identical eligible pools with production scoring and freshness without emitting identities", () => {
  /** Original policy intentionally lacks algorithm-3 fields. */
  const {freshness: _freshness, ...base} = DEFAULT_RACE_MATCH_POLICY.policy.algorithmVersion === 3 ? DEFAULT_RACE_MATCH_POLICY.policy : (() => {throw Error("expected-v3");})();
  /** Repetition alone changes which comparable recording the new policy selects. */
  const profile = recordRaceExposure(emptyRaceMatchProfile(), "private-viewer", [], "private-rival");
  /** Both observations use the same eligible snapshot, recording units and search intent. */
  const input = {schemaVersion: 1, baselinePolicy: {...base, algorithmVersion: 2}, proposedPolicy: DEFAULT_RACE_MATCH_POLICY.policy,
    samples: [{viewer: "private-viewer", requestId: "intent", locale: "en", nowMs: 1000, canonicalEligibilityValidated: true, profile,
      candidates: [{id: "near", creatorId: "private-rival", categoryId: "history", performanceMs: 120000, canonicalRiddleIds: ["q-near"]},
        {id: "wide", creatorId: "fresh-rival", categoryId: "history", performanceMs: 200000, canonicalRiddleIds: ["q-wide"]}]},
    {viewer: "private-viewer", requestId: "empty", locale: "en", nowMs: 1000, canonicalEligibilityValidated: true, profile, candidates: []}]};
  /** Output contains only aggregate simulated metrics and policy attribution. */
  const report = compareRacePolicies(input);
  expect(report).toMatchObject({mode: "sampled-pool-counterfactual", samples: 2, changedSelections: 1});
  expect(report.policies[0]).toMatchObject({selected: 1, empty: 1, rivalRepeats: {mean: 1}});
  expect(report.policies[1]).toMatchObject({selected: 1, empty: 1, rivalRepeats: {mean: 0}});
  expect(JSON.stringify(report)).not.toMatch(/private-viewer|private-rival|q-near|q-wide|fresh-rival/);
  expect(() => compareRacePolicies({...input, samples: [{...input.samples[0], canonicalEligibilityValidated: false}]})).toThrow();
  expect(() => compareRacePolicies({...input, samples: [{...input.samples[0], answer: "secret"}]})).toThrow();
});


it("keeps observed experiment arms and allocation revisions distinct without exporting identity or salt", () => {
  /** Receipt attribution distinguishes experimental traffic from the same policy outside an experiment. */
  const assignment = {id: "freshness-study", revision: 1, arm: "control", allocationHash: "a".repeat(64)};
  /** Outcomes remain measured offer cohorts, not claims about unique-player causal effects. */
  const report = summarizeRaceMatches([row, {...row, matchExperiment: assignment},
    {...row, matchExperiment: {...assignment, arm: "variant"}}, {...row, matchExperiment: {...assignment, revision: 2}}], 600);
  expect(report.cohorts).toHaveLength(4);
  expect(report.cohorts[1]).toMatchObject({experiment: assignment, offers: 1});
  expect(report.experimentComparisons).toHaveLength(2);
  expect(report.experimentComparisons[0]).toMatchObject({assignmentUnit: "authenticated-player", observationUnit: "offer", observedArmsOnly: true});
  expect(report.experimentComparisons[0].arms.map((arm: {
    /** Observed arm identity retained by the aggregate report. */ arm: string;
  }) => arm.arm)).toEqual(["control", "variant"]);
  expect(RaceMatchMeasurementSchema.safeParse({...row, matchExperiment: {...assignment, salt: "private"}}).success).toBe(false);
});

it.each([0, 5])("counts a %i-answer timeout as terminal censored evidence", correctCount => {
  /** Timeout measurements are canonical non-finishes, distinct from still-running races. */
  const timeout = {...row, acceptedAtMs: 200, startsAtMs: 250, terminalStatus: "timed_out", terminalAtMs: 400,
    correctCount, finishedTen: false, actualPerformanceMs: null, predictionLogError: null, finishTimeDeltaMs: null};
  /** Allowlisted receipts retain timeout status while removing account and answer data. */
  const measurement = raceMatchMeasurement({...timeout, userId: "private-player", answer: "private-answer"});
  expect(measurement).toEqual(timeout);
  /** One full finish and one timeout produce a half-completed terminal cohort. */
  const report = summarizeRaceMatches([measurement, {...row, acceptedAtMs: 200, startsAtMs: 250,
    terminalStatus: "completed", terminalAtMs: 350, correctCount: 10, finishedTen: true,
    actualPerformanceMs: 10000, predictionLogError: 0, finishTimeDeltaMs: 1000}], 1000);
  expect(report.cohorts[0]).toMatchObject({accepted: 2, started: 2, terminal: 2, acceptedPendingTerminal: 0,
    finishedTen: 1, completionMeasuredTerminal: 2, completionMeasurementMissing: 0, completionRateAmongTerminal: 0.5,
    abandoned: 0, actualPerformanceMs: {count: 1}, absolutePredictionLogError: {count: 1}, absoluteFinishGapMs: {count: 1}});
});

it.each([{finishedTen: true, correctCount: 10}, {actualPerformanceMs: 12000}, {predictionLogError: 0}, {finishTimeDeltaMs: 0}])(
  "keeps timeout finish measurements censored: %j", patch => {
    expect(RaceMatchMeasurementSchema.safeParse({...row, acceptedAtMs: 200, startsAtMs: 250,
      terminalStatus: "timed_out", terminalAtMs: 400, correctCount: 5, finishedTen: false, ...patch}).success).toBe(false);
  });
