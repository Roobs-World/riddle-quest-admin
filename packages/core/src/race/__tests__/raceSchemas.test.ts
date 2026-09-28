import {
  AbandonRaceRunRequestSchema,
  AbandonRaceRunResponseSchema,
  ListRaceCategoriesResponseSchema,
  PublishRaceChallengeRequestSchema,
  RecordFacebookTournamentRunRequestSchema,
  RecordFacebookTournamentRunResponseSchema,
  RecordFacebookContextRunRequestSchema,
  RecordFacebookContextRunResponseSchema,
  ListFacebookContextBoardResponseSchema,
  RaceAnalyticsEventRequestSchema,
  RACE_HINT_PENALTY_MS,
  RACE_MAX_ADJUSTED_TIME_MS,
  RACE_RULES,
  RACE_SKIP_PENALTY_MS,
  RaceGhostEventSchema,
  RaceRunViewSchema,
  RequestRaceHintRequestSchema,
  SkipRaceRiddleRequestSchema,
  StartRaceRunRequestSchema,
  SubmitRaceGuessRequestSchema,
} from "../raceSchemas";
import {ENGLISH_RACE_DECK_FIXTURE, GHOST_TIMELINE_FIXTURE} from "./raceFixtures";

/** Provides correct event behavior. */
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

/** Provides hint event behavior. */
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

/** Provides skip event behavior. */
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
      maxHintsPerRiddle: 7,
      hintPenaltyMs: 15_000,
      skipPenaltyMs: 45_000,
      maxAdjustedTimeMs: 300_000,
    });
  });

  it("accepts a one-hint server response during the multiplayer rollout", () => {
    expect(ListRaceCategoriesResponseSchema.safeParse({
      categories: [],
      rules: {...RACE_RULES, maxHintsPerRiddle: 1},
    }).success).toBe(true);
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
    /** Provides base behavior. */
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
    /** Provides response behavior. */
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
    /** Provides run behavior. */
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
    /** More than 45 hint events must remain valid for a long race. */
    const repeatedHints = Array.from({length: 46}, (_, sequence) => ({
      ...hintEvent,
      sequence,
      totalPenaltyMs: (sequence + 1) * RACE_HINT_PENALTY_MS,
      adjustedElapsedMs: hintEvent.wallElapsedMs + (sequence + 1) * RACE_HINT_PENALTY_MS,
    }));
    expect(RaceRunViewSchema.safeParse({...run, events: repeatedHints}).success).toBe(true);
    expect(RaceRunViewSchema.safeParse({...run, events: Array.from({length: 121}, (_, index) => ({
      ...repeatedHints[0], sequence: index,
    }))}).success).toBe(false);
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

  it("accepts supported race locales and rejects extra fields or unknown locales", () => {
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
    ).toBe(true);
    expect(
      StartRaceRunRequestSchema.safeParse({
        locale: "en",
        categoryId: "history",
        requestId: "request-0001",
        elapsedMs: 0,
      }).success,
    ).toBe(false);
  });

  it("accepts only player intent and rejects forged multiplayer mechanics", () => {
    /** Requests id. */
    const requestId = "request-0001";
    expect(RequestRaceHintRequestSchema.safeParse({runId: "run-1", riddleId: "riddle-1", requestId}).success).toBe(
      true,
    );
    expect(
      RequestRaceHintRequestSchema.safeParse({
        runId: "run-1",
        riddleId: "riddle-1",
        requestId,
        currentAttempt: ["P", "", "", "", ""],
      }).success,
    ).toBe(false);
    expect(
      SubmitRaceGuessRequestSchema.safeParse({
        runId: "run-1",
        riddleId: "riddle-1",
        guess: "piano",
        requestId,
        isCorrect: true,
        penaltyMs: 0,
        elapsedMs: 1,
      }).success,
    ).toBe(false);
    expect(
      StartRaceRunRequestSchema.safeParse({
        locale: "en",
        categoryId: "history",
        requestId,
        startedAtMs: 1,
        deckId: "client-deck",
        rulesVersion: "race10_v1",
      }).success,
    ).toBe(false);
    expect(
      RequestRaceHintRequestSchema.safeParse({
        runId: "run-1",
        riddleId: "riddle-1",
        requestId,
        index: 0,
        revealedLetter: "p",
        penaltyMs: 0,
      }).success,
    ).toBe(false);
    expect(
      SkipRaceRiddleRequestSchema.safeParse({
        runId: "run-1",
        riddleId: "riddle-1",
        requestId,
        penaltyAddedMs: 0,
        nextRiddleId: "riddle-2",
      }).success,
    ).toBe(false);
    expect(
      PublishRaceChallengeRequestSchema.safeParse({
        runId: "run-1",
        requestId,
        correctCount: 10,
        adjustedFinishMs: 1,
        achievementCoinsAwarded: 999_999,
      }).success,
    ).toBe(false);
    expect(PublishRaceChallengeRequestSchema.safeParse({
      runId: "run-1", requestId, reservedChallengeId: `jest-invite-${"a".repeat(64)}-${"b".repeat(32)}`,
    }).success).toBe(true);
    expect(PublishRaceChallengeRequestSchema.safeParse({
      runId: "run-1", requestId, reservedChallengeId: "jest-invite-guessable",
    }).success).toBe(false);
  });

  it("limits analytics payloads to ten bounded fields", () => {
    expect(
      RaceAnalyticsEventRequestSchema.safeParse({
        eventId: "analytics-0001",
        eventName: "race_mode_viewed",
        params: Object.fromEntries(Array.from({length: 11}, (_, index) => [`field${index}`, index])),
      }).success,
    ).toBe(false);
  });

  it("keeps Facebook tournament input score-free and output economy-free", () => {
    expect(RecordFacebookTournamentRunRequestSchema.safeParse({runId: "run-1", locale: "ja"}).success).toBe(true);
    expect(
      RecordFacebookTournamentRunRequestSchema.safeParse({
        runId: "run-1",
        locale: "ja",
        score: 1,
      }).success,
    ).toBe(false);
    expect(
      RecordFacebookTournamentRunResponseSchema.safeParse({
        tournamentId: "facebook-race10-ja-2026-08-19",
        locale: "ja",
        runId: "run-1",
        adjustedTimeMs: 45_000,
        completedAtMs: 1_000_000,
        improved: true,
        sortOrder: "LOWER_IS_BETTER",
        rewardsEnabled: false,
        coins: 100,
      }).success,
    ).toBe(false);
    expect(
      RecordFacebookTournamentRunResponseSchema.safeParse({
        tournamentId: "facebook-race10-ja-2026-08-19",
        locale: "ja",
        runId: "run-1",
        adjustedTimeMs: RACE_MAX_ADJUSTED_TIME_MS + 1,
        completedAtMs: 1_000_000,
        improved: true,
        sortOrder: "LOWER_IS_BETTER",
        rewardsEnabled: false,
      }).success,
    ).toBe(false);
  });

  it("keeps Facebook context-board input bounded and standings identity-free", () => {
    expect(
      RecordFacebookContextRunRequestSchema.safeParse({
        contextId: "thread-1",
        locale: "ar",
        runId: "run-1",
      }).success,
    ).toBe(true);
    expect(
      RecordFacebookContextRunRequestSchema.safeParse({
        contextId: "../escape",
        locale: "ar",
        runId: "run-1",
        score: 1,
      }).success,
    ).toBe(false);
    expect(
      ListFacebookContextBoardResponseSchema.safeParse({
        locale: "ar",
        startsAtMs: 1,
        endsAtMs: 2,
        sortOrder: "LOWER_IS_BETTER",
        rewardsEnabled: false,
        standings: [{rank: 1, adjustedTimeMs: 30_000, isCurrentPlayer: true, userId: "facebook_secret"}],
      }).success,
    ).toBe(false);
    expect(
      RecordFacebookContextRunResponseSchema.safeParse({
        locale: "ar",
        runId: "run-1",
        adjustedTimeMs: RACE_MAX_ADJUSTED_TIME_MS + 1,
        completedAtMs: 1_000_000,
        improved: true,
        sortOrder: "LOWER_IS_BETTER",
        rewardsEnabled: false,
      }).success,
    ).toBe(false);
    expect(
      ListFacebookContextBoardResponseSchema.safeParse({
        locale: "ar",
        startsAtMs: 1,
        endsAtMs: 2,
        sortOrder: "LOWER_IS_BETTER",
        rewardsEnabled: false,
        standings: [{rank: 1, adjustedTimeMs: RACE_MAX_ADJUSTED_TIME_MS + 1, isCurrentPlayer: false}],
      }).success,
    ).toBe(false);
  });
});
