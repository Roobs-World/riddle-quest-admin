import {emptyRaceMatchProfile, raceDifficultyAdjustedMs, racePerformanceSample, recordRaceExposure,
  recordRacePerformance, scoreRaceCandidate, RaceMatchProfileSchema, racePerformanceExpectation,
  recordRaceCompletion, raceCompletionExpectation, RacePerformanceSampleSchema} from "../../race/raceMatchPerformance";
import type {RaceRunRecord} from "../../race/raceEngine";

/** Transparent estimator fixtures exercise observable match quality, not storage implementation. */
const candidate = (overrides: Partial<Parameters<typeof scoreRaceCandidate>[2]> = {}) => ({creatorId: "creator", categoryId: "history" as const,
  performanceMs: 120_000, canonicalRiddleIds: ["new-question"], ...overrides});

it("uses a stable prior and progressively trusts category-specific evidence", () => {
  /** Provides cold behavior. */
  const cold = emptyRaceMatchProfile();
  expect(RaceMatchProfileSchema.parse(cold)).toEqual(cold);
  expect(scoreRaceCandidate(cold, "player", candidate()).score).toBe(0);
  /** Provides history behavior. */
  let history = cold;
  for (let index = 0; index < 10; index += 1) history = recordRacePerformance(history, "history", {observation: "finish", timeMs: 40_000, evidence: 1});
  expect(scoreRaceCandidate(history, "player", candidate({performanceMs: 45_000})).score)
    .toBeLessThan(scoreRaceCandidate(history, "player", candidate({performanceMs: 120_000})).score);
  expect(scoreRaceCandidate(history, "player", candidate()).confidence).toBe(1);
});

it("reduces confidence in stale performance rather than treating a year-old recording as current skill", () => {
  /** Provides profile behavior. */
  const profile = recordRacePerformance(emptyRaceMatchProfile(), "history", {observation: "finish", timeMs: 40_000, evidence: 1}, 1_000);
  /** Provides current behavior. */
  const current = scoreRaceCandidate(profile, "player", candidate(), 1_000).confidence;
  /** Provides stale behavior. */
  const stale = scoreRaceCandidate(profile, "player", candidate(), 1_000 + 360 * 86_400_000).confidence;
  expect(stale).toBeLessThan(current / 1_000);
});

it("uses category-specific evidence while falling back to overall history for a sparse category", () => {
  /** Provides profile behavior. */
  let profile = emptyRaceMatchProfile();
  for (let index = 0; index < 12; index += 1) profile = recordRacePerformance(profile, "history", {observation: "finish", timeMs: 200_000, evidence: 1});
  for (let index = 0; index < 12; index += 1) profile = recordRacePerformance(profile, "film", {observation: "finish", timeMs: 30_000, evidence: 1});
  expect(scoreRaceCandidate(profile, "player", candidate({categoryId: "film", performanceMs: 40_000})).score)
    .toBeLessThan(scoreRaceCandidate(profile, "player", candidate({categoryId: "film", performanceMs: 150_000})).score);
  expect(Number.isFinite(scoreRaceCandidate(profile, "player", candidate({categoryId: "science"})).score)).toBe(true);
});

it("penalizes repeat rivals and exposed questions even after abandoning a preloaded deck", () => {
  /** Provides cold behavior. */
  const cold = emptyRaceMatchProfile();
  /** Provides exposed behavior. */
  const exposed = recordRaceExposure(cold, "player", [{canonicalRiddleId: "new-question"} as never], "creator");
  expect(scoreRaceCandidate(exposed, "player", candidate()).score).toBeGreaterThan(1);
  expect(scoreRaceCandidate(exposed, "player", candidate({creatorId: "other", canonicalRiddleIds: ["fresh"]})).score).toBe(0);
  expect(exposed.recentOpponents.join()).not.toContain("creator");
});

it("bounds repeated exposure history without losing the latest deck", () => {
  /** Provides profile behavior. */
  let profile = emptyRaceMatchProfile();
  for (let index = 0; index < 150; index += 1) profile = recordRaceExposure(profile, "player",
    [{canonicalRiddleId: `q-${index}`} as never], `rival-${index}`);
  expect(profile.exposedRiddleIds).toHaveLength(120);
  expect(profile.exposedRiddleIds[0]).toBe("q-149");
  expect(profile.recentOpponents).toHaveLength(20);
});

it("normalizes known difficulty while leaving legacy unknown decks unchanged", () => {
  expect(raceDifficultyAdjustedMs(100_000, [{difficultyBand: "easy"} as never])).toBe(125_000);
  expect(raceDifficultyAdjustedMs(100_000, [{difficultyBand: "hard"} as never])).toBe(62_500);
  expect(raceDifficultyAdjustedMs(100_000, [])).toBe(100_000);
});

it("widens confidence-sensitive performance bands without changing eligibility", () => {
  /** Provides profile behavior. */
  const profile = emptyRaceMatchProfile();
  expect(scoreRaceCandidate(profile, "player", candidate({performanceMs: 120_000})).band).toBe(0);
  expect(scoreRaceCandidate(profile, "player", candidate({performanceMs: 210_000})).band).toBe(1);
  expect(scoreRaceCandidate(profile, "player", candidate({performanceMs: 10_000})).band).toBe(2);
});

it("distinguishes observed finishes, partial censored losses, and idle losses", () => {
  /** Provides run behavior. */
  const run = {status: "completed", correctCount: 10, riddles: [], settledOutcome: {adjustedFinishMs: 60_000}} as unknown as RaceRunRecord;
  expect(racePerformanceSample(run)).toEqual({observation: "finish", timeMs: 60_000, evidence: 1});
  expect(racePerformanceSample({...run, correctCount: 5})).toEqual({observation: "censored", timeMs: 60_000, evidence: 0.25});
  expect(racePerformanceSample({...run, correctCount: 0})).toBeNull();
  expect(racePerformanceSample({...run, status: "abandoned"})).toBeNull();
});

it("does not let a first partial race replace the prior or create observed-finish confidence", () => {
  /** A short ghost loss is not evidence that ten questions would take twice that long. */
  const profile = recordRacePerformance(emptyRaceMatchProfile(), "history", {observation: "censored", timeMs: 60000, evidence: 0.25}, 1000);
  expect(profile.overall).toMatchObject({evidence: 0, censored: {logMs: Math.log(60000), evidence: 0.25}});
  expect(racePerformanceExpectation(profile, "history", 1000)).toMatchObject({expectedLog: Math.log(120000), confidence: 0});
});

it("limits repeated slow partial observations to a one-sided correction and never refreshes finish evidence", () => {
  /** Complete finish evidence and partial lower-bound evidence own independent clocks. */
  let profile = recordRacePerformance(emptyRaceMatchProfile(), "history", {observation: "finish", timeMs: 40000, evidence: 1}, 1000);
  for (let index = 0; index < 200; index++) profile = recordRacePerformance(profile, "history", {observation: "censored", timeMs: 300000, evidence: 0.25}, 2000);
  /** Comparison removes only partial evidence from the same observed history. */
  const observed = racePerformanceExpectation({...profile, overall: {...profile.overall, censored: undefined},
    categories: {history: {...profile.categories.history!, censored: undefined}}}, "history", 2000);
  /** Partial influence remains capped even after many repeated losses. */
  const bounded = racePerformanceExpectation(profile, "history", 2000);
  expect(profile.overall.updatedAtMs).toBe(1000);
  expect(profile.overall.evidence).toBe(1);
  expect(profile.overall.censored?.evidence).toBe(20);
  expect(bounded.confidence).toBe(observed.confidence);
  expect(bounded.expectedLog - observed.expectedLog).toBeCloseTo(0.25 * (Math.log(300000) - observed.expectedLog));
});

it("normalizes censored elapsed time conservatively against every possible archived question", () => {
  /** Remaining hard questions can change the eventual completed-deck normalization. */
  const run = {status: "completed", correctCount: 5, riddles: [{difficultyBand: "easy"}, {difficultyBand: "hard"}],
    settledOutcome: {adjustedFinishMs: 60000}} as unknown as RaceRunRecord;
  expect(racePerformanceSample(run)).toEqual({observation: "censored", timeMs: 37500, evidence: 0.25});
  expect(RacePerformanceSampleSchema.safeParse({observation: "censored", timeMs: 120000, evidence: 1}).success).toBe(false);
});

it("supports validated language-specific category priors and personal-history shrinkage", () => {
  /** Caller supplies the policy selected for this profile's language. */
  const priors = {overallMs: 180000, categories: {history: 90000}};
  expect(Math.exp(racePerformanceExpectation(emptyRaceMatchProfile(), "history", 1000, priors).expectedLog)).toBeCloseTo(90000);
  expect(Math.exp(racePerformanceExpectation(emptyRaceMatchProfile(), "science", 1000, priors).expectedLog)).toBeCloseTo(180000);
  /** Personal overall evidence gradually replaces category cold-start assumptions. */
  let experienced = emptyRaceMatchProfile();
  for (let index = 0; index < 20; index++) experienced = recordRacePerformance(experienced, "film", {observation: "finish", timeMs: 40000, evidence: 1}, 1000);
  expect(Math.exp(racePerformanceExpectation(experienced, "history", 1000, priors).expectedLog)).toBeLessThan(60000);
  expect(() => racePerformanceExpectation(experienced, "history", 1000, {...priors, overallMs: 0})).toThrow();
});

it("measures role/category completion separately from speed and keeps sparse estimates uncertain", () => {
  /** A first ghost-limited loss does not imply the player can never complete a creator recording. */
  let profile = recordRaceCompletion(emptyRaceMatchProfile(), "challenger", "history", false, 1000);
  expect(raceCompletionExpectation(profile, "challenger", "history", 1000).probability).toBeGreaterThan(0);
  expect(raceCompletionExpectation(profile, "challenger", "history", 1000).probability).toBeLessThan(0.5);
  expect(raceCompletionExpectation(profile, "creator", "history", 1000)).toEqual({probability: 0.5, confidence: 0});
  for (let index = 0; index < 100; index++) profile = recordRaceCompletion(profile, "creator", "film", true, 2000);
  expect(RaceMatchProfileSchema.safeParse(profile).success).toBe(true);
  expect(profile.completion.creator?.overall.finished).toBe(20);
  expect(profile.overall.evidence).toBe(0);
  expect(raceCompletionExpectation(profile, "creator", "film", 2000).probability).toBeGreaterThan(0.9);
  expect(raceCompletionExpectation(profile, "creator", "film", 2000 + 360 * 86400000).confidence).toBeLessThan(0.001);
  expect(() => raceCompletionExpectation(profile, "creator", undefined, 2000, 1)).toThrow();
});

it("migrates legacy mixed histories conservatively without inventing completion results", () => {
  /** Version one did not distinguish full finishes from extrapolated partial races. */
  const migrated = RaceMatchProfileSchema.parse({version: 1, overall: {logMs: Math.log(40000), evidence: 20, updatedAtMs: 1000},
    categories: {history: {logMs: Math.log(50000), evidence: 10}}, recentOpponents: ["a".repeat(64)], exposedRiddleIds: ["known"]});
  expect(migrated).toMatchObject({version: 2, overall: {evidence: 1}, categories: {history: {evidence: 1}}, completion: {}, exposedRiddleIds: ["known"]});
  expect(migrated.recentOpponents).toEqual(["a".repeat(64)]);
  expect(RaceMatchProfileSchema.parse(migrated)).toEqual(migrated);
});

it("weights delayed outbox observations by occurrence time without rewinding newer histories", () => {
  /** Two outcomes are delivered in either order, before bounded history capping is relevant. */
  const early = 1000, late = early + 30 * 86400000;
  /** Shared finish sequence used to compare delivery order. */
  const finish = (profile: ReturnType<typeof emptyRaceMatchProfile>, timeMs: number, at: number) => recordRacePerformance(profile, "history", {observation: "finish", timeMs, evidence: 1}, at);
  /** Older loss followed by newer finish. */
  const ordered = finish(finish(emptyRaceMatchProfile(), 200000, early), 40000, late);
  /** Newer finish followed by delayed older loss. */
  const delayed = finish(finish(emptyRaceMatchProfile(), 40000, late), 200000, early);
  expect(delayed.overall.logMs).toBeCloseTo(ordered.overall.logMs);
  expect(delayed.overall).toMatchObject({evidence: 1.5, updatedAtMs: late});
  /** Completion counts likewise preserve occurrence-time decay. */
  const completion = recordRaceCompletion(recordRaceCompletion(emptyRaceMatchProfile(), "challenger", "history", true, late), "challenger", "history", false, early);
  expect(completion.completion.challenger?.overall).toEqual({finished: 1, unfinished: 0.5, updatedAtMs: late});
});
