import {describe, expect, it} from "@jest/globals";
import {BridgeRiddleSchema} from "../index";

/** Issued riddle fixture binds recovery to its answer shape. */
const riddle = {riddleId: "classic-1", text: "Clue", answerLength: 5,
  sessionToken: "00000000-0000-4000-8000-000000000001", gameMode: "classic",
  attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false};

describe("issued paid hint recovery", () => {
  it("accepts a single combining grapheme and old responses without hints", () => {
    expect(BridgeRiddleSchema.parse({...riddle, revealedHints: [{index: 1, letter: "E\u0301"}]}).revealedHints).toHaveLength(1);
    expect(BridgeRiddleSchema.parse(riddle).revealedHints).toBeUndefined();
  });
  it.each([
    [{index: 5, letter: "P"}], [{index: -1, letter: "P"}],
    [{index: 0, letter: "PI"}], [{index: 0, letter: "P", answer: "PIANO"}],
    [{index: 0, letter: "P"}, {index: 0, letter: "I"}],
  ])("rejects invalid or overlapping revealed hints %j", (...hints) => {
    expect(BridgeRiddleSchema.safeParse({...riddle, revealedHints: hints}).success).toBe(false);
  });
});


it("validates recovery histories against the issued attempt count and answer length", () => {
  /** Positional scoring colors accompany the accepted submitted graphemes. */
  const feedback = Array.from({length: 5}, () => ({letter: "z", status: "red"}));
  /** Issued riddle binds public recovery to the current session. */
  const issued = {...riddle, attemptsUsed: 1, acceptedGuesses: [{attempt: 1, feedback}]};
  expect(BridgeRiddleSchema.safeParse(issued).success).toBe(true);
  for (const bad of [
    {...issued, attemptsUsed: 2},
    {...issued, acceptedGuesses: [{attempt: 2, feedback}]},
    {...issued, acceptedGuesses: [{attempt: 1, feedback: feedback.slice(1)}]},
    {...issued, acceptedGuesses: [{attempt: 1, feedback, answer: "hidden"}]},
  ]) expect(BridgeRiddleSchema.safeParse(bad).success).toBe(false);
});
