import {describe, expect, it} from "@jest/globals";
import {RACE_RULES, type RaceRiddlePrompt, type RaceRunView} from "@qwordly/core/race";
import {
  applyRaceOutcome,
  createRaceAttempt,
  findFirstEditableRaceSlot,
  formatRaceTime,
  getAdjustedRaceTime,
  getRaceLetterStates,
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

  it("advances only active authoritative clocks and clamps them to the race limit", () => {
    /** Provides run behavior. */
    const run = {
      status: "active",
      adjustedElapsedMs: 4_000,
      rules: {maxAdjustedTimeMs: 10_000},
    } as RaceRunView;
    expect(getAdjustedRaceTime(null, 1_000, 5_000)).toBe(0);
    expect(getAdjustedRaceTime(run, 1_000, 5_000)).toBe(8_000);
    expect(getAdjustedRaceTime(run, 1_000, 20_000)).toBe(10_000);
    expect(getAdjustedRaceTime({...run, status: "completed"}, 1_000, 20_000)).toBe(4_000);
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
    expect(projectRaceOutcome(run({role: "creator", status: "completed", correctCount: 10, currentRiddle: null, adjustedElapsedMs: 42_000, wallElapsedMs: 42_000, opponent: undefined}), 42_000)).toMatchObject({
      result: "recorded",
      publishable: true,
    });
    expect(projectRaceOutcome(run({status: "completed", correctCount: 10, currentRiddle: null, adjustedElapsedMs: 2_500}), 2_500)).toMatchObject({result: "player_win"});
    expect(projectRaceOutcome(run({status: "completed", correctCount: 10, currentRiddle: null, adjustedElapsedMs: 3_000}), 3_000)).toMatchObject({result: "tie"});
    /** Provides timeout behavior. */
    const timeout = projectRaceOutcome(run({opponent: undefined}), RACE_RULES.maxAdjustedTimeMs);
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
