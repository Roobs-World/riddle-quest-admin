import {describe, expect, it} from "@jest/globals";
import {RACE_RULES, type RaceRiddlePrompt, type RaceRunView} from "@riddle-quest/core/race";
import {
  confirmedGuessesKey,
  applyRaceOutcome,
  createRaceAttempt,
  findFirstEditableRaceSlot,
  formatRaceTime,
  getAdjustedRaceTime,
  getRaceLetterStates,
  projectInstantCorrectGuess,
  projectInstantRaceHint,
  projectInstantRaceSkip,
  projectRaceOutcome,
} from "../logic/racePresentation";

/** Provides riddle behavior. */
const riddle = (revealedLetters: RaceRiddlePrompt["revealedLetters"] = []): RaceRiddlePrompt => ({
  riddleId: "riddle-1",
  text: "What has four letters?",
  answerLength: 4,
  position: 0,
  guessesUsed: 0,
  guessesRemaining: 5,
  hintAvailable: true,
  revealedLetters,
});

/** Complete public run view used by result-presentation examples. */
const run = (overrides: Partial<RaceRunView> = {}): RaceRunView => ({
  runId: "run-1",
  challengeId: "challenge-1",
  role: "challenger",
  status: "active",
  categoryId: "mixed",
  locale: "en",
  rules: RACE_RULES,
  correctCount: 8,
  wallElapsedMs: 2_000,
  totalPenaltyMs: 0,
  adjustedElapsedMs: 2_000,
  currentRiddle: riddle(),
  events: [],
  opponent: {displayName: "Ava", adjustedFinishMs: 3_000, events: []},
  ...overrides,
});

describe("race presentation helpers", () => {
  it("formats authoritative race time without displaying negative values", () => {
    expect(formatRaceTime(-1)).toBe("0:00.0");
    expect(formatRaceTime(61_250)).toBe("1:01.3");
  });

  it("creates a blank attempt while preserving server-revealed letters", () => {
    expect(createRaceAttempt(riddle([{index: 1, letter: "E"}]))).toEqual(["", "E", "", ""]);
    expect(createRaceAttempt(null)).toEqual([]);
  });

  it("selects the first editable slot and safely handles a fully revealed answer", () => {
    expect(findFirstEditableRaceSlot(riddle([{index: 0, letter: "T"}]))).toBe(1);
    expect(
      findFirstEditableRaceSlot(
        riddle([
          {index: 0, letter: "T"},
          {index: 1, letter: "E"},
          {index: 2, letter: "S"},
          {index: 3, letter: "T"},
        ]),
      ),
    ).toBe(0);
    expect(findFirstEditableRaceSlot(null)).toBe(0);
  });

  it("advances active clocks and clamps only a challenger to the race limit", () => {
    /** Provides run behavior. */
    const run = {
      status: "active",
      adjustedElapsedMs: 4_000,
      rules: {maxAdjustedTimeMs: 10_000},
    } as RaceRunView;
    expect(getAdjustedRaceTime(null, 1_000, 5_000)).toBe(0);
    expect(getAdjustedRaceTime(run, 1_000, 5_000)).toBe(8_000);
    expect(getAdjustedRaceTime({...run, role: "challenger"}, 1_000, 20_000)).toBe(10_000);
    expect(getAdjustedRaceTime({...run, role: "challenger", status: "completed"}, 1_000, 20_000)).toBe(4_000);
    expect(getAdjustedRaceTime({...run, role: "creator"}, 1_000, 20_000)).toBe(23_000);
    expect(getAdjustedRaceTime({...run, status: "completed"}, 1_000, 20_000)).toBe(4_000);
    expect(getAdjustedRaceTime({...run, status: "completed"}, 1_000)).toBe(4_000);
  });

  it("projects a skip immediately from the deck downloaded before the race", () => {
    /** Complete immutable deck available before the countdown finishes. */
    const preloadedRiddles = Array.from({length: RACE_RULES.deckSize}, (_, position) => ({
      riddleId: `riddle-${position + 1}`,
      text: `Clue ${position + 1}`,
      answerLength: 4,
      position,
      evaluation: {answer: "test", locale: "en" as const},
    }));
    expect(projectInstantRaceSkip(run({preloadedRiddles}))).toMatchObject({
      correctCount: 9,
      totalPenaltyMs: RACE_RULES.skipPenaltyMs,
      adjustedElapsedMs: 2_000 + RACE_RULES.skipPenaltyMs,
      currentRiddle: {
        riddleId: "riddle-2",
        text: "Clue 2",
        position: 1,
        guessesUsed: 0,
        guessesRemaining: RACE_RULES.maxGuessesPerRiddle,
        hintAvailable: true,
        revealedLetters: [],
        evaluation: {answer: "test", locale: "en"},
      },
    });
    expect(projectInstantRaceSkip(run())).toBeNull();
    expect(projectInstantRaceSkip(run({correctCount: 9, preloadedRiddles}))).toMatchObject({
      status: "completed",
      correctCount: 10,
      currentRiddle: null,
    });
    expect(
      projectInstantRaceSkip(
        run({currentRiddle: {...riddle(), position: RACE_RULES.deckSize - 1}, preloadedRiddles}),
      ),
    ).toMatchObject({status: "timed_out", currentRiddle: null});
  });

  it("shows the next preloaded clue immediately after a correct guess", () => {
    /** Provides preloaded riddles behavior. */
    const preloadedRiddles = Array.from({length: RACE_RULES.deckSize}, (_, position) => ({
      riddleId: `riddle-${position + 1}`,
      text: `Clue ${position + 1}`,
      answerLength: 4,
      position,
      evaluation: {answer: "test", locale: "en" as const},
    }));
    expect(projectInstantCorrectGuess(run({preloadedRiddles}))).toMatchObject({
      correctCount: 9,
      currentRiddle: {riddleId: "riddle-2", text: "Clue 2", guessesUsed: 0},
    });
    expect(projectInstantCorrectGuess(run())).toBeNull();
    expect(projectInstantCorrectGuess(run({preloadedRiddles: []}))).toBeNull();
    expect(projectInstantCorrectGuess(run({correctCount: 9, preloadedRiddles}))).toBeNull();
  });

  it("projects a hint immediately from the answer downloaded before the race", () => {
    /** Complete immutable deck available before the countdown finishes. */
    const preloadedRiddles = Array.from({length: RACE_RULES.deckSize}, (_, position) => ({
      riddleId: `riddle-${position + 1}`,
      text: `Clue ${position + 1}`,
      answerLength: 4,
      position,
      evaluation: {answer: "test", locale: "en" as const},
      hint: {index: 0, letter: "t"},
    }));
    /** First locally projected reveal. */
    const first = projectInstantRaceHint(run({preloadedRiddles}));
    expect(first).toMatchObject({
      totalPenaltyMs: RACE_RULES.hintPenaltyMs,
      adjustedElapsedMs: 2_000 + RACE_RULES.hintPenaltyMs,
      currentRiddle: {
        hintAvailable: true,
        revealedLetters: [{index: 0, letter: "t"}],
      },
    });
    /** Second locally projected reveal. */
    const second = projectInstantRaceHint(first!);
    expect(second?.currentRiddle?.revealedLetters).toEqual([{index: 0, letter: "t"}, {index: 1, letter: "e"}]);
    expect(second?.currentRiddle?.hintAvailable).toBe(true);
    /** Third locally projected reveal. */
    const third = projectInstantRaceHint(second!);
    /** Final locally projected reveal. */
    const fourth = projectInstantRaceHint(third!);
    expect(fourth?.currentRiddle?.revealedLetters).toHaveLength(4);
    expect(fourth?.currentRiddle?.hintAvailable).toBe(false);
    expect(fourth?.totalPenaltyMs).toBe(4 * RACE_RULES.hintPenaltyMs);
    expect(projectInstantRaceHint(fourth!)).toBeNull();
    expect(projectInstantRaceHint(run({
      currentRiddle: riddle(Array.from("test", (letter, index) => ({index, letter}))),
      preloadedRiddles,
    }))).toBeNull();
    expect(projectInstantRaceHint(run())).toBeNull();
    expect(projectInstantRaceHint(run({preloadedRiddles: []}))).toBeNull();
    /** Legacy one-hint rules still bound immediate projection and further paid requests. */
    const legacy = projectInstantRaceHint(run({preloadedRiddles, rules: {...RACE_RULES, maxHintsPerRiddle: 1}}));
    expect(legacy?.currentRiddle?.hintAvailable).toBe(false);
    expect(projectInstantRaceHint(legacy!)).toBeNull();
    expect(projectInstantRaceHint({...legacy!, currentRiddle: {...legacy!.currentRiddle!, hintAvailable: true}})).toBeNull();
  });

  it("projects an opponent win only after the server-issued ghost finish elapses", () => {
    /** Active run containing already-confirmed hint and skip penalties. */
    const penalized = run({
      totalPenaltyMs: 60_000,
      events: [
        {sequence: 0, type: "hint", riddlePosition: 0, wallElapsedMs: 500, penaltyAddedMs: 15_000, totalPenaltyMs: 15_000, adjustedElapsedMs: 15_500, correctCount: 0},
        {sequence: 1, type: "skip", riddlePosition: 0, wallElapsedMs: 600, penaltyAddedMs: 45_000, totalPenaltyMs: 60_000, adjustedElapsedMs: 60_600, correctCount: 0},
      ],
      opponent: {displayName: "Ava", adjustedFinishMs: 70_000, events: []},
    });
    expect(projectRaceOutcome(penalized, 70_000)).toBeNull();
    expect(projectRaceOutcome(penalized, 70_001)).toMatchObject({
      result: "ghost_win",
      correctCount: 8,
      wallFinishMs: 10_000,
      hintPenaltyMs: 15_000,
      skipPenaltyMs: 45_000,
      totalPenaltyMs: 60_000,
      adjustedFinishMs: 70_000,
      opponentAdjustedFinishMs: 70_000,
      rematchEligible: true,
    });
  });

  it("projects every server-determined terminal result and applies confirmation to the run", () => {
    expect(projectRaceOutcome(run({status: "abandoned"}), 2_000)).toBeNull();
    expect(projectRaceOutcome(run({role: "creator", status: "completed", correctCount: 10, currentRiddle: null, adjustedElapsedMs: 42_000, wallElapsedMs: 42_000, opponent: undefined}), 42_000)).toMatchObject({
      result: "recorded",
      publishable: true,
    });
    /** Completed challenger outcome used to cover the non-timeout run projection. */
    const playerWin = projectRaceOutcome(run({status: "completed", correctCount: 10, currentRiddle: null, adjustedElapsedMs: 2_500}), 2_500);
    expect(playerWin).toMatchObject({result: "player_win"});
    expect(applyRaceOutcome(run(), playerWin!)).toMatchObject({
      status: "completed",
      currentRiddle: null,
      adjustedElapsedMs: 2_500,
    });
    expect(projectRaceOutcome(run({status: "completed", correctCount: 10, currentRiddle: null, adjustedElapsedMs: 3_000}), 3_000)).toMatchObject({result: "tie"});
    /** A creator setting a time to beat is not competing against a deadline. */
    expect(projectRaceOutcome(run({role: "creator", opponent: undefined}), RACE_RULES.maxAdjustedTimeMs)).toBeNull();
    /** Provides challenger timeout behavior. */
    const timeout = projectRaceOutcome(run({role: "challenger"}), RACE_RULES.maxAdjustedTimeMs);
    expect(timeout).toMatchObject({
      result: "timed_out",
      adjustedFinishMs: RACE_RULES.maxAdjustedTimeMs,
      rematchEligible: false,
    });
    expect(applyRaceOutcome(run(), timeout!)).toMatchObject({
      status: "timed_out",
      currentRiddle: null,
      adjustedElapsedMs: RACE_RULES.maxAdjustedTimeMs,
    });
  });

  it.each(["completed", "timed_out"] as const)("preserves a confirmed %s clock when paid penalties exceed the active challenger limit", status => {
    /** Penalty crossings can leave a terminal canonical clock above the active-play deadline. */
    const terminal = run({status, correctCount: status === "completed" ? 10 : 9, currentRiddle: null,
      wallElapsedMs: 0, totalPenaltyMs: 330000, adjustedElapsedMs: 330000,
      opponent: {displayName: "Ava", adjustedFinishMs: 310000, events: []}});
    expect(getAdjustedRaceTime(terminal, 0, 60000)).toBe(330000);
    expect(projectRaceOutcome(terminal, 330000)).toMatchObject({result: status === "completed" ? "ghost_win" : "timed_out",
      adjustedFinishMs: 330000, totalPenaltyMs: 330000, wallFinishMs: 0});
  });
  it("projects an opponent win when the final clearing penalty makes a completed challenger slower", () => {
    /** Completing all ten questions does not turn a slower finish into a tie. */
    const terminal = run({status: "completed", correctCount: 10, currentRiddle: null, totalPenaltyMs: 45000,
      wallElapsedMs: 2000, adjustedElapsedMs: 47000, opponent: {displayName: "Ava", adjustedFinishMs: 40000, events: []}});
    expect(projectRaceOutcome(terminal, 47000)).toMatchObject({result: "ghost_win", correctCount: 10, adjustedFinishMs: 47000, rematchEligible: true});
  });
  it("marks revealed hints green using the keyboard locale and ignores empty hints", () => {
    expect(getRaceLetterStates(
      [{guess: ["İ", "K"], feedback: ["red", "yellow"]}],
      "tr",
      [{index: 0, letter: "İ"}, {index: 1, letter: ""}],
    )).toEqual({i: "green", k: "yellow"});
  });
  it("retains green keyboard feedback and ignores empty scoring cells", () => {
    expect(
      getRaceLetterStates([
        {guess: ["A", "B", "", "C"], feedback: ["yellow", "gray", "green"]},
        {guess: ["a", "B", "D"], feedback: ["green", "yellow", "gray"]},
        {guess: ["A"], feedback: ["gray"]},
      ]),
    ).toEqual({a: "green", b: "yellow", d: "gray"});
  });
});

describe("confirmedGuessesKey", () => {
  it("treats equal guess histories from separate polls as the same content", () => {
    /** First poll's history. */
    const first = [{guess: ["z", "z"], feedback: ["red", "red"] as const}];
    /** A later poll delivering the same history as new objects. */
    const second = [{guess: ["z", "z"], feedback: ["red", "red"] as const}];
    expect(confirmedGuessesKey(first as never)).toBe(confirmedGuessesKey(second as never));
    expect(confirmedGuessesKey([...first, {guess: ["p", "i"], feedback: ["green", "yellow"]}] as never))
      .not.toBe(confirmedGuessesKey(first as never));
    expect(confirmedGuessesKey(undefined)).toBe("");
  });
});
