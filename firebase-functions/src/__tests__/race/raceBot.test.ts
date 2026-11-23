import {RaceGhostEventSchema, RACE_RULES} from "../../../../src/races/contracts/index.js";
import {buildRaceBotOpponent, parseRaceBotOffer, type RaceBotOffer} from "../../race/matchmaking/raceBot";
import {toRaceRunView, refreshRaceRun, raceDeadlineAtMs, type RaceRunRecord} from "../../race/runs/raceEngine";

/** Complete immutable fallback deck used across multiple simulated skill levels. */
const riddles = Array.from({length: 15}, (_, position) => ({position, riddleId: `r${position}`,
  canonicalRiddleId: `history:${position}`, text: `Clue ${position}`, answer: "clock", difficultyBand: position % 3 ? "easy" as const : "medium" as const}));
/** Server receipt, never a client-supplied pacing value. */
const offer = (performanceMs = 120000): RaceBotOffer => ({version: 1, userId: "owner", requestId: "empty-search",
  locale: "en", categoryId: "history", requestedCategoryId: "history", performanceMs, createdAtMs: 1000, expiresAtMs: 61000});

it("keeps immutable pacing on retries and varies rivals between search intents", () => {
  /** First generated rival must replay exactly for the same selection intent. */
  const first = buildRaceBotOpponent(offer(), "search-a", riddles);
  expect(buildRaceBotOpponent(offer(), "search-a", riddles)).toEqual(first);
  /** Independent selection intents retain varied but deterministic playback. */
  const rivals = Array.from({length: 100}, (_, index) => buildRaceBotOpponent(offer(), `search-${index}`, riddles));
  expect(new Set(rivals.map(rival => rival.displayName)).size).toBeGreaterThan(5);
  expect(new Set(rivals.map(rival => rival.adjustedFinishMs)).size).toBeGreaterThan(80);
  expect(rivals.some(rival => rival.events.some(event => event.type === "hint"))).toBe(true);
  expect(rivals.some(rival => rival.events.some(event => event.type === "skip"))).toBe(true);
});

it.each([1000, 30000, 60000, 90000, 120000, 300000])("produces feasible playback at a %ims skill estimate", performanceMs => {
  for (let index = 0; index < 100; index++) {
    /** Generated rival across each supported performance range. */
    const rival = buildRaceBotOpponent(offer(performanceMs), `search-${index}`, riddles);
    expect(rival.adjustedFinishMs).toBeGreaterThanOrEqual(30000);
    expect(rival.adjustedFinishMs).toBeLessThanOrEqual(240000);
    /** Accumulated ghost event clocks, penalties and correct answers. */
    let wall = 0, adjusted = 0, penalty = 0, correct = 0;
    for (const [sequence, event] of rival.events.entries()) {
      expect(RaceGhostEventSchema.safeParse(event).success).toBe(true);
      expect(event.sequence).toBe(sequence);
      expect(event.wallElapsedMs).toBeGreaterThan(wall);
      expect(event.adjustedElapsedMs).toBeGreaterThan(adjusted);
      penalty += event.penaltyAddedMs;
      correct += Number(event.type === "correct");
      expect(event.totalPenaltyMs).toBe(penalty);
      expect(event.correctCount).toBe(correct);
      wall = event.wallElapsedMs; adjusted = event.adjustedElapsedMs;
    }
    expect(correct).toBe(10);
    expect(adjusted).toBe(rival.adjustedFinishMs);
  }
});

it("adapts pace to observed skill without changing the generated question order", () => {
  expect(buildRaceBotOpponent(offer(50000), "same", riddles).adjustedFinishMs)
    .toBeLessThan(buildRaceBotOpponent(offer(200000), "same", riddles).adjustedFinishMs);
});

it("projects ordinary rival presentation and settles an unattended loss using the existing deadline", () => {
  /** Server-generated ghost uses the same lifecycle as recorded opponents. */
  const opponent = buildRaceBotOpponent(offer(), "search", riddles);
  /** Active challenger run retains the internal fallback receipt. */
  const run: RaceRunRecord = {runId: "run", userId: "owner", fallbackOfferId: "a".repeat(64), role: "challenger", status: "active",
    locale: "en", categoryId: "history", rulesVersion: RACE_RULES.version, deckId: "deck", riddles, currentPosition: 0,
    correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [], startedAtMs: 1000,
    hintPenaltyMs: 0, skipPenaltyMs: 0, events: [], opponent};
  /** Browser view exposes only the provider-neutral opponent presentation. */
  const view = toRaceRunView(run, 1000);
  expect(view.opponent?.displayName).toBe(opponent.displayName);
  expect(view.opponent).not.toHaveProperty("kind");
  expect(view).not.toHaveProperty("fallbackOfferId");
  expect(raceDeadlineAtMs(run)).toBe(1000 + opponent.adjustedFinishMs + 1);
  expect(refreshRaceRun(run, 1000 + opponent.adjustedFinishMs + 1)).toMatchObject({status: "completed", result: "ghost_win"});
});

it("rejects forged ownership, preferences and nonfinite pacing", () => {
  expect(() => parseRaceBotOffer(offer(), "intruder", {locale: "en", categoryId: "history"})).toThrow("another player");
  expect(() => parseRaceBotOffer(offer(), "owner", {locale: "es", categoryId: "history"})).toThrow("preferences changed");
  expect(() => parseRaceBotOffer({...offer(), performanceMs: NaN}, "owner", {locale: "en", categoryId: "history"})).toThrow("invalid");
});

it("rejects an explicit category contradiction while permitting unrestricted category selection", () => {
  expect(() => parseRaceBotOffer({...offer(), categoryId: "science"}, "owner", {locale: "en", categoryId: "science"})).toThrow("invalid");
  expect(parseRaceBotOffer({...offer(), categoryId: "science", requestedCategoryId: null}, "owner", {locale: "en", categoryId: "science"}))
    .toMatchObject({categoryId: "science", requestedCategoryId: null});
});
