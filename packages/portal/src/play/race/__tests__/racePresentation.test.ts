import {describe, expect, it} from "@jest/globals";
import type {RaceRiddlePrompt, RaceRunView} from "@qwordly/core/race";
import {
  createRaceAttempt,
  findFirstEditableRaceSlot,
  formatRaceTime,
  getAdjustedRaceTime,
  getRaceLetterStates,
} from "../logic/racePresentation";

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
    expect(findFirstEditableRaceSlot(riddle([
      {index: 0, letter: "T"},
      {index: 1, letter: "E"},
      {index: 2, letter: "S"},
      {index: 3, letter: "T"},
    ]))).toBe(0);
    expect(findFirstEditableRaceSlot(null)).toBe(0);
  });

  it("advances only active authoritative clocks and clamps them to the race limit", () => {
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

  it("retains green keyboard feedback and ignores empty scoring cells", () => {
    expect(getRaceLetterStates([
      {guess: ["A", "B", "", "C"], feedback: ["yellow", "gray", "green"]},
      {guess: ["a", "B", "D"], feedback: ["green", "yellow", "gray"]},
      {guess: ["A"], feedback: ["gray"]},
    ])).toEqual({a: "green", b: "yellow", d: "gray"});
  });
});
