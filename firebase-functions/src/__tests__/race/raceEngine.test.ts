import {RACE_HINT_PENALTY_MS, RACE_SKIP_PENALTY_MS} from "@qwordly/core/race";
import {
  abandonRaceRun,
  applyRaceGuess,
  applyRaceHint,
  applyRaceSkip,
  raceClock,
  raceDeadlineAtMs,
  raceOutcome,
  refreshRaceRun,
  toRaceRunView,
  type RaceRunRecord,
} from "../../race/raceEngine";

/** Defines the started at value. */
const STARTED_AT = 1_000_000;

/** Creates run. */
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
  it("keeps preparation unscored and expires it without a competitive result", () => {
    /** Unscored preparation whose expiry is independent of solving time. */
    const prepared = createRun({status: "prepared", startedAtMs: 0, preparationExpiresAtMs: STARTED_AT + 30000});
    expect(raceClock(prepared, STARTED_AT + 20000).wallElapsedMs).toBe(0);
    expect(refreshRaceRun(prepared, STARTED_AT + 29999).status).toBe("prepared");
    expect(refreshRaceRun(prepared, STARTED_AT + 30000)).toMatchObject({status: "abandoned", result: null, wallFinishMs: 0});
    expect(refreshRaceRun({...prepared, preparationExpiresAtMs: undefined}, STARTED_AT + 30000).status).toBe("prepared");
    expect(toRaceRunView(prepared, STARTED_AT)).not.toHaveProperty("startsAtMs");
    expect(toRaceRunView(prepared, STARTED_AT).preparationExpiresAtMs).toBe(STARTED_AT + 30000);
  });

  it("activates a schedule only at its fixed start and rejects early scoring", () => {
    /** Server start remains fixed across pre-start reads and commands. */
    const scheduled = createRun({status: "scheduled"});
    expect(refreshRaceRun(scheduled, STARTED_AT - 1).status).toBe("scheduled");
    expect(() => applyRaceGuess(scheduled, {riddleId: "riddle-1", guess: "piano"}, STARTED_AT - 1)).toThrow(/no longer active/i);
    expect(refreshRaceRun(scheduled, STARTED_AT).status).toBe("active");
    expect(applyRaceGuess(scheduled, {riddleId: "riddle-1", guess: "piano"}, STARTED_AT).run.correctCount).toBe(1);
  });

  it("derives unattended deadlines from preparation, fixed starts, penalties and opponent limits", () => {
    expect(raceDeadlineAtMs(createRun({status: "prepared", preparationExpiresAtMs: STARTED_AT + 30000}))).toBe(STARTED_AT + 30000);
    expect(raceDeadlineAtMs(createRun({status: "completed"}))).toBeUndefined();
    expect(raceDeadlineAtMs(createRun())).toBeUndefined();
    /** Challenger wake-up deadline incorporates its immutable schedule. */
    const scheduled = createRun({role: "challenger", status: "scheduled"});
    expect(raceDeadlineAtMs(scheduled)).toBe(STARTED_AT + toRaceRunView(scheduled, STARTED_AT - 1).rules.maxAdjustedTimeMs);
    expect(raceDeadlineAtMs({...scheduled, opponent: {displayName: "Ava", adjustedFinishMs: 20000, events: []}, hintPenaltyMs: 15000})).toBe(STARTED_AT + 5001);
    expect(raceDeadlineAtMs({...scheduled, opponent: {displayName: "Ava", adjustedFinishMs: 20000, events: []}, skipPenaltyMs: 45000})).toBe(STARTED_AT);
  });

  it("records an exact full-score tie and enforces server-only evaluation despite a preload request", () => {
    /** Exact equality on the last clearing action produces a tie. */
    const tied = applyRaceGuess(createRun({role: "challenger", correctCount: 9, opponent: {displayName: "Ava", adjustedFinishMs: 20000, events: []}}),
      {riddleId: "riddle-1", guess: "piano"}, STARTED_AT + 20000).run;
    expect(raceOutcome(tied, STARTED_AT + 20001).result).toBe("tie");
    /** Last-action penalty can complete ten questions after the ghost. */
    const slower = applyRaceSkip(createRun({role: "challenger", correctCount: 9, opponent: {displayName: "Ava", adjustedFinishMs: 20000, events: []}}),
      {riddleId: "riddle-1"}, STARTED_AT + 1000);
    expect(raceOutcome(slower, STARTED_AT + 1001)).toMatchObject({result: "ghost_win", correctCount: 10, adjustedFinishMs: 46000});
    /** Evaluation requests cannot override a server-only run policy. */
    const view = toRaceRunView(createRun({evaluationPolicy: "server-only"}), STARTED_AT, true);
    expect(view.preloadedRiddles).toBeUndefined();
    expect(view.currentRiddle?.evaluation).toBeUndefined();
  });

  it("uses fixed finish time and clamps a pre-start live clock", () => {
    expect(raceClock(createRun({wallFinishMs: 9_000}), STARTED_AT + 50_000).wallElapsedMs).toBe(9_000);
    expect(raceClock(createRun(), STARTED_AT - 1).wallElapsedMs).toBe(0);
  });

  it("returns defensive copies for inactive runs including opponent ghost events", () => {
    /** Provides ghost event behavior. */
    const ghostEvent = {
      sequence: 0,
      type: "correct" as const,
      riddlePosition: 0,
      wallElapsedMs: 1_000,
      penaltyAddedMs: 0,
      totalPenaltyMs: 0,
      adjustedElapsedMs: 1_000,
      correctCount: 1,
    };
    /** Provides original behavior. */
    const original = createRun({
      status: "completed",
      result: "ghost_win",
      revealedLetters: [{index: 0, letter: "p"}],
      events: [ghostEvent],
      opponent: {displayName: "Ava", adjustedFinishMs: 10_000, events: [ghostEvent]},
    });
    /** Provides refreshed behavior. */
    const refreshed = refreshRaceRun(original, STARTED_AT + 2_000);
    expect(refreshed).toEqual(original);
    expect(refreshed).not.toBe(original);
    expect(refreshed.riddles[0]).not.toBe(original.riddles[0]);
    expect(refreshed.revealedLetters[0]).not.toBe(original.revealedLetters[0]);
    expect(refreshed.events[0]).not.toBe(original.events[0]);
    expect(refreshed.opponent?.events[0]).not.toBe(original.opponent?.events[0]);
  });

  it("keeps an active challenger running before the ghost finish", () => {
    /** Provides run behavior. */
    const run = createRun({opponent: {displayName: "Ava", adjustedFinishMs: 20_000, events: []}});
    expect(refreshRaceRun(run, STARTED_AT + 19_000).status).toBe("active");
  });

  it("abandons an active run with a null result", () => {
    /** Provides abandoned behavior. */
    const abandoned = abandonRaceRun(createRun(), STARTED_AT + 12_000);
    expect(abandoned).toMatchObject({
      status: "abandoned",
      result: null,
      wallFinishMs: 12_000,
      finishedAtMs: STARTED_AT + 12_000,
    });
    expect(() => raceOutcome(abandoned, STARTED_AT + 13_000)).toThrow(/does not have a final outcome/i);
  });

  it("makes abandonment idempotent and rejects finalized competitive runs", () => {
    /** Provides abandoned behavior. */
    const abandoned = createRun({status: "abandoned"});
    expect(abandonRaceRun(abandoned, STARTED_AT + 1_000)).toEqual(abandoned);
    expect(() => abandonRaceRun(createRun({status: "completed", result: "recorded"}), STARTED_AT + 1_000)).toThrow(
      "already has a final result",
    );
  });
  it("adds a server-owned 15-second hint penalty without coins", () => {
    /** Provides result behavior. */
    const result = applyRaceHint(createRun(), {riddleId: "riddle-1"}, STARTED_AT + 5_000);
    expect(result).toMatchObject({revealedLetter: "p", index: 0});
    expect(result.run.hintPenaltyMs).toBe(RACE_HINT_PENALTY_MS);
    expect(raceClock(result.run, STARTED_AT + 5_000)).toEqual({
      wallElapsedMs: 5_000,
      totalPenaltyMs: 15_000,
      adjustedElapsedMs: 20_000,
    });
    expect(result.run.events[0]).toMatchObject({type: "hint", penaltyAddedMs: 15_000, adjustedElapsedMs: 20_000});
    /** Latest authoritative result after each additional hint. */
    let hinted = result;
    for (const [index, letter] of Array.from("iano").entries()) {
      hinted = applyRaceHint(hinted.run, {riddleId: "riddle-1"}, STARTED_AT + 6_000 + index);
      expect(hinted).toMatchObject({revealedLetter: letter, index: index + 1});
      expect(hinted.run.hintPenaltyMs).toBe((index + 2) * RACE_HINT_PENALTY_MS);
      expect(toRaceRunView(hinted.run, STARTED_AT + 6_000 + index).currentRiddle?.hintAvailable).toBe(index < 3);
    }
    expect(() => applyRaceHint(hinted.run, {riddleId: "riddle-1"}, STARTED_AT + 7_000)).toThrow("No unrevealed race hint");
  });

  it("selects multiplayer hint positions from server-owned state", () => {
    /** Provides result behavior. */
    const result = applyRaceHint(
      createRun({revealedLetters: [{index: 0, letter: "p"}]}),
      {riddleId: "riddle-1"},
      STARTED_AT + 5_000,
    );
    expect(result).toMatchObject({revealedLetter: "i", index: 1});
  });

  it("rejects actions against inactive, missing, or mismatched riddles", () => {
    expect(() =>
      applyRaceGuess(
        createRun({status: "completed", result: "recorded"}),
        {riddleId: "riddle-1", guess: "piano"},
        STARTED_AT + 1_000,
      ),
    ).toThrow("no longer active");
    expect(() =>
      applyRaceGuess(createRun({riddles: []}), {riddleId: "riddle-1", guess: "piano"}, STARTED_AT + 1_000),
    ).toThrow("not the active race riddle");
    expect(() => applyRaceGuess(createRun(), {riddleId: "riddle-2", guess: "piano"}, STARTED_AT + 1_000)).toThrow(
      "not the active race riddle",
    );
    expect(() => applyRaceGuess(createRun(), {riddleId: "riddle-1", guess: "shorter"}, STARTED_AT + 1_000)).toThrow(
      "exactly 5 characters",
    );
  });

  it("rejects a hint when every answer position is already revealed", () => {
    expect(() =>
      applyRaceHint(
        createRun({revealedLetters: Array.from("piano", (letter, index) => ({index, letter}))}),
        {riddleId: "riddle-1"},
        STARTED_AT + 1_000,
      ),
    ).toThrow("No unrevealed race hint");
  });

  it("allows an immediate manual skip with the heavy 45-second penalty", () => {
    /** Captures skipped for this regression check. */
    const skipped = applyRaceSkip(createRun(), {riddleId: "riddle-1"}, STARTED_AT + 4_000);
    expect(skipped.skipPenaltyMs).toBe(RACE_SKIP_PENALTY_MS);
    expect(skipped.currentPosition).toBe(1);
    expect(skipped.correctCount).toBe(1);
    expect(skipped.events[0]).toMatchObject({type: "skip", penaltyAddedMs: 45_000, adjustedElapsedMs: 49_000});
  });

  it("automatically skips after the fifth wrong guess and applies the penalty once", () => {
    /** Provides run behavior. */
    let run = createRun();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      /** Provides result behavior. */
      const result = applyRaceGuess(run, {riddleId: "riddle-1", guess: "xxxxx"}, STARTED_AT + attempt * 1_000);
      run = result.run;
      expect(result.autoSkipped).toBe(attempt === 5);
    }
    expect(run.currentPosition).toBe(1);
    expect(run.correctCount).toBe(1);
    expect(run.skipPenaltyMs).toBe(45_000);
    expect(run.events.filter((event) => event.type === "skip")).toHaveLength(1);
  });

  it("completes the run when a skip clears the tenth riddle", () => {
    /** Ninth-clear run whose next skip reaches the Race to 10 target. */
    const completed = applyRaceSkip(
      createRun({correctCount: 9}),
      {riddleId: "riddle-1"},
      STARTED_AT + 4_000,
    );
    expect(completed).toMatchObject({status: "completed", result: "recorded", correctCount: 10});
  });

  it("completes the run when the fifth wrong guess auto-skips the tenth riddle", () => {
    /** Ninth-clear run on its final allowed guess. */
    const result = applyRaceGuess(
      createRun({correctCount: 9, guessesUsed: 4}),
      {riddleId: "riddle-1", guess: "xxxxx"},
      STARTED_AT + 5_000,
    );
    expect(result).toMatchObject({isCorrect: false, autoSkipped: true});
    expect(result.run).toMatchObject({status: "completed", result: "recorded", correctCount: 10});
  });

  it("times out when the final available riddle is skipped without ten solves", () => {
    /** Provides final riddle run behavior. */
    const finalRiddleRun = createRun({currentPosition: 14, guessesUsed: 1});
    /** Provides result behavior. */
    const result = applyRaceSkip(finalRiddleRun, {riddleId: "riddle-15"}, STARTED_AT + 2_000);
    expect(result).toMatchObject({status: "timed_out", result: "timed_out", currentPosition: 15});
  });

  it("redacts answers from run views", () => {
    /** Provides run behavior. */
    const run = createRun({revealedLetters: [{index: 0, letter: "p"}]});
    /** Provides view behavior. */
    const view = toRaceRunView(run, STARTED_AT + 3_000);
    expect(view.currentRiddle).toMatchObject({
      riddleId: "riddle-1",
      answerLength: 5,
      revealedLetters: [{index: 0, letter: "p"}],
    });
    expect(view.currentRiddle?.revealedLetters[0]).not.toBe(run.revealedLetters[0]);
    expect(view.currentRiddle).not.toHaveProperty("answer");
    expect(JSON.stringify(view)).not.toContain("piano");
  });

  it("preloads every question and answer when local feedback is requested", () => {
    /** The run used by this regression scenario. */
    const run = createRun();
    run.riddles[1].answer = "orbit";
    /** The view used by this regression scenario. */
    const view = toRaceRunView(run, STARTED_AT + 3_000, true);
    expect(view.currentRiddle?.evaluation).toEqual({answer: "piano", locale: "en"});
    expect(view.preloadedRiddles).toHaveLength(15);
    expect(view.preloadedRiddles?.[1]).toMatchObject({
      riddleId: "riddle-2",
      text: "Fixture clue 2",
      answerLength: 5,
      position: 1,
      evaluation: {answer: "orbit", locale: "en"},
      hint: {index: 0, letter: "o"},
    });
  });

  it("projects completed state and copies public opponent and event data", () => {
    /** Provides ghost event behavior. */
    const ghostEvent = {
      sequence: 0,
      type: "hint" as const,
      riddlePosition: 0,
      wallElapsedMs: 1_000,
      penaltyAddedMs: RACE_HINT_PENALTY_MS,
      totalPenaltyMs: RACE_HINT_PENALTY_MS,
      adjustedElapsedMs: 16_000,
      correctCount: 0,
    };
    /** Provides run behavior. */
    const run = createRun({
      status: "completed",
      result: "ghost_win",
      wallFinishMs: 1_000,
      events: [ghostEvent],
      opponent: {
        subjectUserId: "opponent-1",
        displayName: "Ava",
        avatarUrl: null,
        adjustedFinishMs: 16_000,
        events: [ghostEvent],
      },
    });
    /** Provides view behavior. */
    const view = toRaceRunView(run, STARTED_AT + 20_000);
    expect(view.currentRiddle).toBeNull();
    expect(view.opponent).toEqual({
      displayName: "Ava",
      avatarUrl: null,
      adjustedFinishMs: 16_000,
      events: [ghostEvent],
    });
    expect(view.events[0]).not.toBe(run.events[0]);
    expect(view.opponent?.events[0]).not.toBe(run.opponent?.events[0]);
  });

  it("suppresses unlinked legacy opponent identity while preserving ghost timing", () => {
    /** Provides view behavior. */
    const view = toRaceRunView(
      createRun({
        opponent: {
          displayName: "Legacy player name",
          avatarUrl: "https://example.test/legacy-avatar.png",
          adjustedFinishMs: 16_000,
          events: [],
        },
      }),
      STARTED_AT + 1_000,
    );

    expect(view.opponent).toEqual({
      displayName: "Riddle Quest player",
      adjustedFinishMs: 16_000,
      events: [],
    });
  });

  it("records ten correct milestones and produces a publishable creator outcome", () => {
    /** Provides run behavior. */
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

  it("keeps a creator run active beyond the competitive time cap", () => {
    /** Provides run behavior. */
    const run = createRun({hintPenaltyMs: 15_000, skipPenaltyMs: 45_000});
    /** Provides refreshed behavior. */
    const refreshed = refreshRaceRun(run, STARTED_AT + 240_000);
    expect(refreshed.status).toBe("active");
    expect(refreshed.result).toBeUndefined();
  });

  it("lets accumulated penalties trigger the five-minute challenger cap", () => {
    /** Provides run behavior. */
    const run = createRun({
      role: "challenger",
      challengeId: "challenge-1",
      opponent: {displayName: "Ava", adjustedFinishMs: 400_000, events: []},
      hintPenaltyMs: 15_000,
      skipPenaltyMs: 45_000,
    });
    /** Provides timed out behavior. */
    const timedOut = refreshRaceRun(run, STARTED_AT + 240_000);
    expect(timedOut).toMatchObject({status: "timed_out", result: "timed_out", wallFinishMs: 240_000});
    expect(raceOutcome(timedOut, STARTED_AT + 500_000).adjustedFinishMs).toBe(300_000);
  });

  it("fast-forwards to a ghost loss and supports a faster challenger win", () => {
    /** Provides opponent behavior. */
    const opponent = {
      displayName: "Ava",
      adjustedFinishMs: 100_000,
      events: [],
    };
    /** Provides lost behavior. */
    const lost = refreshRaceRun(
      createRun({role: "challenger", challengeId: "challenge-1", opponent}),
      STARTED_AT + 100_001,
    );
    expect(lost).toMatchObject({status: "completed", result: "ghost_win", wallFinishMs: 100_000});

    /** Provides winning run behavior. */
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

  it("records a tie when the challenger matches the ghost adjusted finish", () => {
    /** Provides opponent behavior. */
    const opponent = {displayName: "Ava", adjustedFinishMs: 90_000, events: []};
    /** Provides run behavior. */
    let run = createRun({role: "challenger", challengeId: "challenge-1", opponent});
    for (let solve = 1; solve <= 10; solve += 1) {
      run = applyRaceGuess(run, {riddleId: `riddle-${solve}`, guess: " PIANO "}, STARTED_AT + solve * 9_000).run;
    }
    expect(run).toMatchObject({status: "completed", result: "tie", wallFinishMs: 90_000});
    expect(raceOutcome(run, STARTED_AT + 90_000)).toMatchObject({
      publishable: false,
      rematchEligible: true,
      opponentAdjustedFinishMs: 90_000,
    });
  });

  it("rejects malformed active outcomes", () => {
    expect(() => raceOutcome(createRun({result: "recorded"}), STARTED_AT + 1_000)).toThrow(
      "does not have a final outcome",
    );
  });
});
