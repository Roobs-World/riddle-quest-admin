import {describe, expect, it} from "@jest/globals";
import type {RaceRiddlePrompt} from "@qwordly/core/race";
import {deleteRaceLetter, insertRaceLetter, insertRaceText, isRaceSlotEditable} from "../logic/raceInput";

/** Creates a deterministic riddle for answer-input tests. */
const createRiddle = (revealedLetters: RaceRiddlePrompt["revealedLetters"] = []): RaceRiddlePrompt => ({
  riddleId: "riddle-input",
  text: "Test riddle",
  answerLength: 4,
  position: 0,
  guessesUsed: 0,
  guessesRemaining: 5,
  hintAvailable: true,
  revealedLetters,
});

describe("race input helpers", () => {
  it("identifies slots protected by server-revealed hints", () => {
    /** Riddle whose second answer slot is authoritative. */
    const riddle = createRiddle([{index: 1, letter: "E"}]);
    expect(isRaceSlotEditable(riddle, 0)).toBe(true);
    expect(isRaceSlotEditable(riddle, 1)).toBe(false);
  });

  it("inserts a letter and advances over filled and revealed slots", () => {
    /** Riddle whose second answer slot cannot be edited. */
    const riddle = createRiddle([{index: 1, letter: "E"}]);
    expect(insertRaceLetter(riddle, {letters: ["", "E", "S", ""], activeSlotIndex: 0}, "T")).toEqual({
      letters: ["T", "E", "S", ""],
      activeSlotIndex: 3,
    });
  });

  it("keeps the current slot when an answer becomes full", () => {
    expect(insertRaceLetter(createRiddle(), {letters: ["T", "E", "S", ""], activeSlotIndex: 3}, "T")).toEqual({
      letters: ["T", "E", "S", "T"],
      activeSlotIndex: 3,
    });
  });

  it("normalizes partial attempts before inserting or deleting", () => {
    expect(insertRaceLetter(createRiddle(), {letters: [], activeSlotIndex: 0}, "T")).toEqual({
      letters: ["T", "", "", ""],
      activeSlotIndex: 1,
    });
    expect(deleteRaceLetter(createRiddle(), {letters: ["T"], activeSlotIndex: 0})).toEqual({
      letters: ["", "", "", ""],
      activeSlotIndex: 0,
    });
  });

  it("does not overwrite a server-revealed slot", () => {
    /** Existing state returned unchanged when the active slot is protected. */
    const state = {letters: ["", "E", "", ""], activeSlotIndex: 1};
    expect(insertRaceLetter(createRiddle([{index: 1, letter: "E"}]), state, "X")).toBe(state);
  });

  it("stores one NFC grapheme and rejects multi-grapheme insertions", () => {
    expect(insertRaceLetter(createRiddle(), {letters: [], activeSlotIndex: 0}, "نَ")).toMatchObject({
      letters: ["نَ", "", "", ""],
    });
    const state = {letters: ["", "", "", ""], activeSlotIndex: 0};
    expect(insertRaceLetter(createRiddle(), state, "日本")).toBe(state);
    expect(insertRaceLetter(createRiddle(), state, " ")).toBe(state);
  });

  it("atomically fills editable slots from IME or pasted text without overwriting on overflow", () => {
    expect(insertRaceText(createRiddle(), {letters: [], activeSlotIndex: 0}, "日本語版追加")).toEqual({
      letters: ["日", "本", "語", "版"],
      activeSlotIndex: 3,
    });
    expect(insertRaceText(
      createRiddle([{index: 1, letter: "E"}]),
      {letters: ["", "E", "", ""], activeSlotIndex: 0},
      "क्ष한中extra",
    )).toEqual({
      letters: ["क्ष", "E", "한", "中"],
      activeSlotIndex: 3,
    });
    expect(insertRaceText(
      createRiddle(),
      {letters: ["A", "B", "C", "D"], activeSlotIndex: 2},
      "ЖЯ",
    )).toEqual({letters: ["A", "B", "Ж", "D"], activeSlotIndex: 2});
  });

  it("deletes the active letter or searches backward with wraparound", () => {
    expect(deleteRaceLetter(createRiddle(), {letters: ["T", "E", "", "T"], activeSlotIndex: 1})).toEqual({
      letters: ["T", "", "", "T"],
      activeSlotIndex: 1,
    });
    expect(deleteRaceLetter(createRiddle(), {letters: ["T", "", "", "T"], activeSlotIndex: 2})).toEqual({
      letters: ["", "", "", "T"],
      activeSlotIndex: 0,
    });
  });

  it("preserves state when every candidate slot is server-revealed", () => {
    /** Fully authoritative answer state that cannot be locally deleted. */
    const state = {letters: ["T", "E", "S", "T"], activeSlotIndex: 0};
    /** Riddle with all answer positions protected by hints. */
    const riddle = createRiddle([
      {index: 0, letter: "T"},
      {index: 1, letter: "E"},
      {index: 2, letter: "S"},
      {index: 3, letter: "T"},
    ]);
    expect(deleteRaceLetter(riddle, state)).toBe(state);
  });
});
