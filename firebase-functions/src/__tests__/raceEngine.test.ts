import {RACE_HINT_PENALTY_MS, RACE_SKIP_PENALTY_MS} from "@qwordly/core/race";
import {
  abandonRaceRun,
  applyRaceGuess,
  applyRaceHint,
  applyRaceSkip,
  raceClock,
  raceOutcome,
  refreshRaceRun,
  toRaceRunView,
  type RaceRunRecord,
} from "../race/raceEngine";

const STARTED_AT = 1_000_000;

const createRun = (overrides: Partial<RaceRunRecord> = {}): RaceRunRecord => ({
  runId: "run-1",
  userId: "user-1",
  role: "creator",
  status: "active",
  categoryId: "history",
  locale: "en",
  rulesVersion: "race10_v1",
  deckId: "deck-1",
  riddles: Array.from({length: 15}, (_, position) => ({
    riddleId: `riddle-${position + 1}`,
    canonicalRiddleId: `history:${position + 1}`,
    text: `Fixture clue ${position + 1}`,
    answer: "piano",
    position,
  })),
  currentPosition: 0,
  correctCount: 0,
  guessesUsed: 0,
  hintUsed: false,
  revealedLetters: [],
  startedAtMs: STARTED_AT,
  hintPenaltyMs: 0,
  skipPenaltyMs: 0,
  events: [],
  ...overrides,
});

describe("Race to 10 authoritative engine", () => {
  it("abandons an active run with a null result", () => {
    const abandoned = abandonRaceRun(createRun(), STARTED_AT + 12_000);
    expect(abandoned).toMatchObject({
      status: "abandoned",
      result: null,
      wallFinishMs: 12_000,
      finishedAtMs: STARTED_AT + 12_000,
    });
    expect(() => raceOutcome(abandoned, STARTED_AT + 13_000)).toThrow(/does not have a final outcome/i);
  });
  it("adds a server-owned 15-second hint penalty without coins", () => {
    const result = applyRaceHint(
      createRun(),
      {riddleId: "riddle-1", currentAttempt: ["", "", "", "", ""]},
      STARTED_AT + 5_000,
    );
    expect(result).toMatchObject({revealedLetter: "p", index: 0});
    expect(result.run.hintPenaltyMs).toBe(RACE_HINT_PENALTY_MS);
    expect(raceClock(result.run, STARTED_AT + 5_000)).toEqual({
      wallElapsedMs: 5_000,
      totalPenaltyMs: 15_000,
      adjustedElapsedMs: 20_000,
    });
    expect(result.run.events[0]).toMatchObject({type: "hint", penaltyAddedMs: 15_000, adjustedElapsedMs: 20_000});
    expect(() =>
      applyRaceHint(result.run, {riddleId: "riddle-1", currentAttempt: ["", "", "", "", ""]}, STARTED_AT + 6_000),
    ).toThrow("already used");
  });

  it("requires a guess before a manual skip and then adds the heavy 45-second penalty", () => {
    expect(() => applyRaceSkip(createRun(), {riddleId: "riddle-1"}, STARTED_AT + 2_000)).toThrow(
      "Submit at least one guess",
    );
    const wrong = applyRaceGuess(createRun(), {riddleId: "riddle-1", guess: "xxxxx"}, STARTED_AT + 2_000);
    const skipped = applyRaceSkip(wrong.run, {riddleId: "riddle-1"}, STARTED_AT + 4_000);
    expect(skipped.skipPenaltyMs).toBe(RACE_SKIP_PENALTY_MS);
    expect(skipped.currentPosition).toBe(1);
    expect(skipped.correctCount).toBe(0);
    expect(skipped.events[0]).toMatchObject({type: "skip", penaltyAddedMs: 45_000, adjustedElapsedMs: 49_000});
  });

  it("automatically skips after the fifth wrong guess and applies the penalty once", () => {
    let run = createRun();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = applyRaceGuess(run, {riddleId: "riddle-1", guess: "xxxxx"}, STARTED_AT + attempt * 1_000);
      run = result.run;
      expect(result.autoSkipped).toBe(attempt === 5);
    }
    expect(run.currentPosition).toBe(1);
    expect(run.skipPenaltyMs).toBe(45_000);
    expect(run.events.filter((event) => event.type === "skip")).toHaveLength(1);
  });

  it("redacts answers from run views", () => {
    const view = toRaceRunView(createRun(), STARTED_AT + 3_000);
    expect(view.currentRiddle).toMatchObject({riddleId: "riddle-1", answerLength: 5});
    expect(view.currentRiddle).not.toHaveProperty("answer");
    expect(JSON.stringify(view)).not.toContain("piano");
  });

  it("records ten correct milestones and produces a publishable creator outcome", () => {
    let run = createRun();
    for (let solve = 1; solve <= 10; solve += 1) {
      run = applyRaceGuess(run, {riddleId: `riddle-${solve}`, guess: "piano"}, STARTED_AT + solve * 7_000).run;
    }
    expect(run.status).toBe("completed");
    expect(run.result).toBe("recorded");
    expect(run.events).toHaveLength(10);
    expect(raceOutcome(run, STARTED_AT + 80_000)).toMatchObject({
      result: "recorded",
      correctCount: 10,
      wallFinishMs: 70_000,
      totalPenaltyMs: 0,
      adjustedFinishMs: 70_000,
      publishable: true,
    });
  });

  it("lets accumulated penalties trigger the five-minute adjusted cap", () => {
    const run = createRun({hintPenaltyMs: 15_000, skipPenaltyMs: 45_000});
    const timedOut = refreshRaceRun(run, STARTED_AT + 240_000);
    expect(timedOut).toMatchObject({status: "timed_out", result: "timed_out", wallFinishMs: 240_000});
    expect(raceOutcome(timedOut, STARTED_AT + 500_000).adjustedFinishMs).toBe(300_000);
  });

  it("fast-forwards to a ghost loss and supports a faster challenger win", () => {
    const opponent = {
      displayName: "Ava",
      adjustedFinishMs: 100_000,
      events: [],
    };
    const lost = refreshRaceRun(
      createRun({role: "challenger", challengeId: "challenge-1", opponent}),
      STARTED_AT + 100_001,
    );
    expect(lost).toMatchObject({status: "completed", result: "ghost_win", wallFinishMs: 100_000});

    let winningRun = createRun({role: "challenger", challengeId: "challenge-1", opponent});
    for (let solve = 1; solve <= 10; solve += 1) {
      winningRun = applyRaceGuess(
        winningRun,
        {riddleId: `riddle-${solve}`, guess: "piano"},
        STARTED_AT + solve * 9_000,
      ).run;
    }
    expect(winningRun).toMatchObject({status: "completed", result: "player_win", wallFinishMs: 90_000});
  });
});
