import {expect, it} from "@jest/globals";
import type {ScoredGuess} from "@qwordly/core/game";
import {getRaceLetterStates} from "../logic/racePresentation";

/** Confirmed duplicate-letter evaluations must preserve the strongest available keyboard fact. */
it.each([
  ["yellow", "red", "yellow"],
  ["red", "yellow", "yellow"],
  ["green", "red", "green"],
  ["yellow", "green", "green"],
  ["green", "yellow", "green"],
] as const)("keeps %s then %s as %s within one answer", (first, second, expected) => {
  expect(getRaceLetterStates([{guess: ["A", "a"], feedback: [first, second]}])).toEqual({a: expected});
});

/** Reload history order and repeated submissions cannot erase evidence of a present letter. */
it.each([false, true])("retains yellow across separate rows (reversed=%s)", reversed => {
  /** Two canonical rows contain different occurrence counts of the same answer letter. */
  const rows: ScoredGuess[] = [
    {guess: ["a"], feedback: ["yellow"]},
    {guess: ["A"], feedback: ["red"]},
  ];
  if (reversed) rows.reverse();
  expect(getRaceLetterStates(rows)).toEqual({a: "yellow"});
});

/** Each keyboard letter aggregates independently while empty legacy placeholders remain invisible. */
it("keeps independent ranks without modifying canonical history", () => {
  /** A frozen confirmed history includes empty legacy cells and every supported score. */
  const rows: ScoredGuess[] = [
    {guess: ["a", "b", "c", ""], feedback: ["yellow", "green", "red", "red"]},
    {guess: ["A", "B", "C"], feedback: ["red", "yellow", "yellow"]},
  ];
  /** Snapshot verifies presentation does not rewrite server-confirmed feedback. */
  const before = structuredClone(rows);
  rows.forEach(row => {Object.freeze(row.guess); Object.freeze(row.feedback); Object.freeze(row);});
  expect(getRaceLetterStates(rows)).toEqual({a: "yellow", b: "green", c: "yellow"});
  expect(rows).toEqual(before);
});
