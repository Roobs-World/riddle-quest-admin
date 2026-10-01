import {RACE_RULES, RaceRunViewSchema, type RaceRunView} from "../raceSchemas";

/** Minimal authority view with a fixed start and one second of unpenalized play. */
const fixture = (): RaceRunView => ({runId: "clock-contract", role: "creator", status: "active", categoryId: "history",
  locale: "en", rules: RACE_RULES, correctCount: 0, startsAtMs: 1000, serverNowMs: 2000,
  wallElapsedMs: 1000, totalPenaltyMs: 0, adjustedElapsedMs: 1000, events: [],
  currentRiddle: {riddleId: "clock-question", text: "A clue", answerLength: 4, position: 0, guessesUsed: 0,
    guessesRemaining: 5, hintAvailable: true, revealedLetters: []}});

it.each([
  {wallElapsedMs: 5000, adjustedElapsedMs: 5000}, {serverNowMs: 1500}, {serverNowMs: 500},
  {status: "prepared", wallElapsedMs: 1, adjustedElapsedMs: 1, startsAtMs: undefined},
  {status: "scheduled", serverNowMs: 500, wallElapsedMs: 1, adjustedElapsedMs: 1},
  {status: "scheduled", serverNowMs: 1000, wallElapsedMs: 0, adjustedElapsedMs: 0},
])("rejects contradictory live authority clocks: %j", overrides => {
  expect(RaceRunViewSchema.safeParse({...fixture(), ...overrides}).success).toBe(false);
});

it.each([
  {serverNowMs: 1000, wallElapsedMs: 0, adjustedElapsedMs: 0},
  {status: "prepared", startsAtMs: undefined, wallElapsedMs: 0, adjustedElapsedMs: 0},
  {status: "scheduled", serverNowMs: 500, wallElapsedMs: 0, adjustedElapsedMs: 0},
  {status: "completed", serverNowMs: 9000, currentRiddle: null},
  {status: "abandoned", serverNowMs: 500, wallElapsedMs: 0, adjustedElapsedMs: 0, currentRiddle: null},
  {startsAtMs: undefined, serverNowMs: undefined},
])("preserves valid boundaries, fixed terminal duration and legacy clock absence: %j", overrides => {
  expect(RaceRunViewSchema.safeParse({...fixture(), ...overrides}).success).toBe(true);
});
