import {expect, it} from "@jest/globals";
import {fixture, harness} from "./raceSession.support.ts";

/** Canonical cell boundaries must remain distinct when reconstructed as the submitted word. */
it.each([true, false].flatMap(evaluation => ["combining", "flag", "flag-shift"].flatMap(kind => [true, false].map(valid => ({evaluation, kind, valid})))))("validates $kind history boundaries with evaluation=$evaluation, valid=$valid", async ({evaluation, kind, valid}) => {
  /** Exact two-slot authority contract keeps canonical row length independent of answer availability. */
  const run = await fixture();
  Object.assign(run.currentRiddle!, {answerLength: 2, guessesUsed: 1, guessesRemaining: 4, evaluation: {answer: "cd", locale: "en"}});
  Object.assign(run.preloadedRiddles![0], {answerLength: 2, evaluation: {answer: "cd", locale: "en"}, hint: {index: 0, letter: "c"}});
  /** Individually segmentable cells can merge into one grapheme across their array boundary. */
  const guess = kind === "combining" ? valid ? ["a\u0300", "b"] : ["a", "\u0300"] : kind === "flag" ? valid ? ["🇬🇧", "b"] : ["🇬", "🇧"] : valid ? ["🇬🇧", "🇺"] : ["🇬", "🇧🇺"];
  run.currentRiddle!.confirmedGuesses = [{guess, feedback: ["red", "red"]}];
  if (!evaluation) {delete run.preloadedRiddles;delete run.currentRiddle!.evaluation;}
  /** Same public cold recovery path applies to modern and answer-free snapshots. */
  const h = harness({}, run.runId);h.respond("raceResume", {run});
  expect(h.session.getSnapshot().error).toBe(valid ? null : "RaceTo10.ERROR_INVALID_RESPONSE");
  if (!valid) {
    expect(h.session.getSnapshot()).toMatchObject({run: null, raceGuesses: []});
    /** A correctly segmented later word remains recoverable after malformed history rejection. */
    run.currentRiddle!.confirmedGuesses = [{guess: ["x", "y"], feedback: ["red", "red"]}];
    h.session.retry();h.respond("raceResume", {run});
    expect(h.session.getSnapshot()).toMatchObject({error: null, raceGuesses: run.currentRiddle!.confirmedGuesses});
  }
});
