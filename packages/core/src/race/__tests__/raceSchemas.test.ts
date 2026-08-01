import {
  AbandonRaceRunRequestSchema,
  AbandonRaceRunResponseSchema,
  ListRaceCategoriesResponseSchema,
  RACE_HINT_PENALTY_MS,
  RACE_RULES,
  RACE_SKIP_PENALTY_MS,
  RaceGhostEventSchema,
  RaceRunViewSchema,
  StartRaceRunRequestSchema,
} from "../raceSchemas";
import {ENGLISH_RACE_DECK_FIXTURE, GHOST_TIMELINE_FIXTURE} from "./raceFixtures";

const correctEvent = {
  sequence: 0,
  type: "correct" as const,
  riddlePosition: 0,
  wallElapsedMs: 8_420,
  penaltyAddedMs: 0 as const,
  totalPenaltyMs: 0,
  adjustedElapsedMs: 8_420,
  correctCount: 1,
};

const hintEvent = {
  sequence: 1,
  type: "hint" as const,
  riddlePosition: 1,
  wallElapsedMs: 19_105,
  penaltyAddedMs: RACE_HINT_PENALTY_MS,
  totalPenaltyMs: RACE_HINT_PENALTY_MS,
  adjustedElapsedMs: 34_105,
  correctCount: 1,
};

const skipEvent = {
  sequence: 2,
  type: "skip" as const,
  riddlePosition: 1,
  wallElapsedMs: 31_780,
  penaltyAddedMs: RACE_SKIP_PENALTY_MS,
  totalPenaltyMs: RACE_HINT_PENALTY_MS + RACE_SKIP_PENALTY_MS,
  adjustedElapsedMs: 91_780,
  correctCount: 1,
};

describe("Race to 10 contracts", () => {
  it("freezes the race10_v1 rules and heavy skip penalty", () => {
    expect(RACE_RULES).toEqual({
      version: "race10_v1",
      targetCorrect: 10,
      deckSize: 15,
      maxGuessesPerRiddle: 5,
      maxHintsPerRiddle: 1,
      hintPenaltyMs: 15_000,
      skipPenaltyMs: 45_000,
      maxAdjustedTimeMs: 300_000,
    });
  });

  it.each([correctEvent, hintEvent, skipEvent])("accepts a valid $type timeline event", (event) => {
    expect(RaceGhostEventSchema.parse(event)).toEqual(event);
  });

  it("rejects a local-only or inconsistent adjusted clock", () => {
    expect(RaceGhostEventSchema.safeParse({...hintEvent, adjustedElapsedMs: hintEvent.wallElapsedMs}).success).toBe(
      false,
    );
    expect(RaceGhostEventSchema.safeParse({...skipEvent, penaltyAddedMs: 0}).success).toBe(false);
  });

  it("requires exactly one creator category or opponent challenge", () => {
    const base = {locale: "en", requestId: "request-0001"};
    expect(StartRaceRunRequestSchema.safeParse({...base, categoryId: "history"}).success).toBe(true);
    expect(
      StartRaceRunRequestSchema.safeParse({
        ...base,
        categoryId: "history",
        rivalryChallengeId: "challenge-previous",
      }).success,
    ).toBe(true);
    expect(StartRaceRunRequestSchema.safeParse({...base, challengeId: "challenge-1"}).success).toBe(true);
    expect(StartRaceRunRequestSchema.safeParse(base).success).toBe(false);
    expect(
      StartRaceRunRequestSchema.safeParse({...base, categoryId: "history", challengeId: "challenge-1"}).success,
    ).toBe(false);
    expect(
      StartRaceRunRequestSchema.safeParse({
        ...base,
        challengeId: "challenge-1",
        rivalryChallengeId: "challenge-previous",
      }).success,
    ).toBe(false);
  });

  it("parses a localized category response", () => {
    const response = {
      rules: RACE_RULES,
      categories: [
        {
          categoryId: "history",
          nameKey: "RaceTo10.CATEGORY_HISTORY_NAME",
          descriptionKey: "RaceTo10.CATEGORY_HISTORY_DESCRIPTION",
          icon: "history",
          colorToken: "#2e8b57",
          availableRiddleCount: 60,
        },
      ],
    };
    expect(ListRaceCategoriesResponseSchema.parse(response)).toEqual(response);
  });

  it("parses a deterministic English active run fixture", () => {
    const run = {
      runId: "run-en-1",
      role: "creator",
      status: "active",
      categoryId: "history",
      locale: "en",
      rules: RACE_RULES,
      correctCount: 1,
      wallElapsedMs: 19_105,
      totalPenaltyMs: 15_000,
      adjustedElapsedMs: 34_105,
      currentRiddle: {
        riddleId: "history-en-002",
        text: "Which empire built roads across ancient Britain?",
        answerLength: 3,
        position: 1,
        guessesUsed: 0,
        guessesRemaining: 5,
        hintAvailable: true,
        revealedLetters: [],
      },
      events: [correctEvent, hintEvent],
    };
    expect(RaceRunViewSchema.parse(run)).toEqual(run);
  });

  it("requires an idempotency key and a null result when abandoning a run", () => {
    expect(AbandonRaceRunRequestSchema.safeParse({runId: "run-en-1", requestId: "quit-request-1"}).success).toBe(true);
    expect(AbandonRaceRunRequestSchema.safeParse({runId: "run-en-1"}).success).toBe(false);
    expect(
      AbandonRaceRunResponseSchema.safeParse({
        run: {
          runId: "run-en-1",
          role: "creator",
          status: "abandoned",
          categoryId: "history",
          locale: "en",
          rules: RACE_RULES,
          correctCount: 0,
          wallElapsedMs: 1_000,
          totalPenaltyMs: 0,
          adjustedElapsedMs: 1_000,
          currentRiddle: null,
          events: [],
        },
        result: null,
      }).success,
    ).toBe(true);
  });

  it("provides a deterministic 15-riddle English deck and a complete penalized ghost timeline", () => {
    expect(ENGLISH_RACE_DECK_FIXTURE).toHaveLength(15);
    expect(GHOST_TIMELINE_FIXTURE.at(-1)).toMatchObject({
      type: "correct",
      correctCount: 10,
      adjustedElapsedMs: 170_000,
    });
    expect(GHOST_TIMELINE_FIXTURE.every((event) => RaceGhostEventSchema.safeParse(event).success)).toBe(true);
  });

  it("rejects extra fields and unsupported locales", () => {
    expect(
      StartRaceRunRequestSchema.safeParse({
        locale: "xx",
        categoryId: "history",
        requestId: "request-0001",
      }).success,
    ).toBe(false);
    expect(
      StartRaceRunRequestSchema.safeParse({
        locale: "ja",
        categoryId: "history",
        requestId: "request-0001",
      }).success,
    ).toBe(false);
    expect(
      StartRaceRunRequestSchema.safeParse({
        locale: "en",
        categoryId: "history",
        requestId: "request-0001",
        elapsedMs: 0,
      }).success,
    ).toBe(false);
  });
});
