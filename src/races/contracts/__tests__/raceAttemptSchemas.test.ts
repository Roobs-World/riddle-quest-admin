import {RACE_RULES, RaceRunViewSchema, type RaceRunView} from "../raceSchemas";

/** Active answer-free projection isolates attempt and hint budget relationships. */
const fixture = (): RaceRunView => ({runId: "attempt-budget", role: "creator", status: "active", categoryId: "history", locale: "en",
  rules: RACE_RULES, correctCount: 0, wallElapsedMs: 0, totalPenaltyMs: 0, adjustedElapsedMs: 0, events: [],
  currentRiddle: {riddleId: "current", text: "A clue", answerLength: 4, position: 0, guessesUsed: 0,
    guessesRemaining: 5, hintAvailable: true, revealedLetters: []}});

it.each([[0, 4], [1, 5], [4, 0], [5, 0]])("rejects live attempt budget used=%i remaining=%i", (guessesUsed, guessesRemaining) => {
  /** Each field fits its individual bounds, but the pair cannot describe an editable attempt. */
  const run = fixture();Object.assign(run.currentRiddle!, {guessesUsed, guessesRemaining});
  expect(RaceRunViewSchema.safeParse(run).success).toBe(false);
});
it.each([0, 1, 2, 3, 4])("accepts an editable attempt after %i wrong guesses", guessesUsed => {
  /** Every usable server attempt preserves the complete fixed guess budget. */
  const run = fixture();Object.assign(run.currentRiddle!, {guessesUsed, guessesRemaining: 5 - guessesUsed});
  expect(RaceRunViewSchema.safeParse(run).success).toBe(true);
});
it.each(["early-unavailable", "exhausted-available", "legacy-over-budget"])("rejects contradictory hint budget %s", kind => {
  /** Legacy one-hint runs remain supported with their own smaller immutable budget. */
  const run = fixture();
  if (kind === "early-unavailable") run.currentRiddle!.hintAvailable = false;
  else if (kind === "exhausted-available") run.currentRiddle!.revealedLetters = [0, 1, 2, 3].map(index => ({index, letter: "a"}));
  else {run.rules = {...RACE_RULES, maxHintsPerRiddle: 1};run.currentRiddle!.hintAvailable = false;
    run.currentRiddle!.revealedLetters = [{index: 0, letter: "a"}, {index: 1, letter: "b"}];}
  expect(RaceRunViewSchema.safeParse(run).success).toBe(false);
});
it.each([false, true])("accepts exhausted modern and legacy hint budgets, legacy=%s", legacy => {
  /** Exhaustion disables hints without rejecting an otherwise editable answer. */
  const run = fixture();if (legacy) run.rules = {...RACE_RULES, maxHintsPerRiddle: 1};
  run.currentRiddle!.hintAvailable = false;
  run.currentRiddle!.revealedLetters = Array.from({length: legacy ? 1 : 4}, (_, index) => ({index, letter: "a"}));
  expect(RaceRunViewSchema.safeParse(run).success).toBe(true);
});
