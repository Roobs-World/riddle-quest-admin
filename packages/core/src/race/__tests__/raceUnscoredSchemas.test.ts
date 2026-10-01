import {RACE_RULES, RaceRunViewSchema, type RaceRunView} from "../raceSchemas";

/** Untouched preparation/countdown with optional legacy clock metadata. */
const fixture = (status: "prepared" | "scheduled"): RaceRunView => ({runId: "unscored", role: "creator", status,
  categoryId: "history", locale: "en", rules: RACE_RULES, correctCount: 0, serverNowMs: 1000,
  ...(status === "scheduled" ? {startsAtMs: 4000} : {preparationExpiresAtMs: 30000}),
  wallElapsedMs: 0, totalPenaltyMs: 0, adjustedElapsedMs: 0, events: [],
  currentRiddle: {riddleId: "question", text: "A clue", answerLength: 4, position: 0, guessesUsed: 0,
    guessesRemaining: RACE_RULES.maxGuessesPerRiddle, hintAvailable: true, revealedLetters: []}});

/** Independent corruptions preserve valid field shapes, isolating the phase contract. */
const corruptions = [{correctCount: 1}, {totalPenaltyMs: 1000, adjustedElapsedMs: 1000},
  {adjustedElapsedMs: 1000}, {events: [{sequence: 0, type: "correct", riddlePosition: 0, penaltyAddedMs: 0,
    totalPenaltyMs: 0, correctCount: 1, wallElapsedMs: 0, adjustedElapsedMs: 0}]},
  ...[{position: 1}, {guessesUsed: 1, guessesRemaining: 4}, {guessesRemaining: 4}, {hintAvailable: false},
    {revealedLetters: [{index: 0, letter: "t"}]}].map(prompt => ({currentRiddle: {...fixture("prepared").currentRiddle!, ...prompt}})),
  {currentRiddle: null}];

it.each((["prepared", "scheduled"] as const).flatMap(status => corruptions.map(invalid => ({status, invalid}))))("rejects independently malformed unscored projection %j", ({status, invalid}) => {
  expect(RaceRunViewSchema.safeParse({...fixture(status), ...invalid}).success).toBe(false);
});

it.each(["prepared", "scheduled"] as const)("accepts untouched %s, including legacy clock absence", status => {
  expect(RaceRunViewSchema.safeParse(fixture(status)).success).toBe(true);
  expect(RaceRunViewSchema.safeParse({...fixture(status), serverNowMs: undefined, startsAtMs: undefined,
    preparationExpiresAtMs: undefined}).success).toBe(true);
});

it.each([30000, 30001])("rejects preparation sampled at or after its known expiry: %s", serverNowMs => {
  expect(RaceRunViewSchema.safeParse({...fixture("prepared"), serverNowMs}).success).toBe(false);
});

it("does not mistake a retained preparation deadline for a countdown or gameplay deadline", () => {
  expect(RaceRunViewSchema.safeParse({...fixture("prepared"), serverNowMs: 29999}).success).toBe(true);
  expect(RaceRunViewSchema.safeParse({...fixture("scheduled"), preparationExpiresAtMs: 500}).success).toBe(true);
  expect(RaceRunViewSchema.safeParse({...fixture("scheduled"), status: "active", startsAtMs: 0,
    wallElapsedMs: 1000, adjustedElapsedMs: 1000, preparationExpiresAtMs: 500,
    currentRiddle: {...fixture("scheduled").currentRiddle!, guessesUsed: 1, guessesRemaining: 4}}).success).toBe(true);
});
