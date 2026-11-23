import {expect, it} from "@jest/globals";
import {fixture, harness} from "./raceSession.support.ts";

/** Server-trimmed submissions cannot contain newly restored outer whitespace cells. */
it.each([true, false].flatMap(evaluation => [[" ", "x"], ["x", " "], ["\u00a0", "x"], ["x", "\u00a0"], [" ", "\u00a0"]].map(guess => ({evaluation, guess}))))("rejects outer whitespace history $guess with evaluation=$evaluation", async ({evaluation, guess}) => {
  /** Otherwise coherent two-slot row demonstrates the missing canonical trim invariant. */
  const run = await fixture();
  Object.assign(run.currentRiddle!, {answerLength: 2, guessesUsed: 1, guessesRemaining: 4, evaluation: {answer: "ab", locale: "en"}, confirmedGuesses: [{guess, feedback: ["red", "red"]}]});
  Object.assign(run.preloadedRiddles![0], {answerLength: 2, evaluation: {answer: "ab", locale: "en"}, hint: {index: 0, letter: "a"}});
  if (!evaluation) {delete run.preloadedRiddles;delete run.currentRiddle!.evaluation;}
  /** Optional answer data cannot change whether a word could be stored by the server. */
  const h = harness({}, run.runId);h.respond("raceResume", {run});
  expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: null, raceGuesses: []});
  /** Corrected canonical history remains retryable without replaying a guess. */
  run.currentRiddle!.confirmedGuesses = [{guess: ["x", "y"], feedback: ["red", "red"]}];
  h.session.retry();h.respond("raceResume", {run});
  expect(h.session.getSnapshot()).toMatchObject({error: null, raceGuesses: run.currentRiddle!.confirmedGuesses});
  expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(0);
});

/** Trimming applies only to the outer word, preserving legitimate internal whitespace slots. */
it.each([true, false])("preserves internal whitespace history with evaluation=%s", async evaluation => {
  /** Server accepts the exact three-grapheme word without trimming its internal separator. */
  const run = await fixture();
  Object.assign(run.currentRiddle!, {answerLength: 3, guessesUsed: 1, guessesRemaining: 4, evaluation: {answer: "abc", locale: "en"}, confirmedGuesses: [{guess: ["x", " ", "y"], feedback: ["red", "red", "red"]}]});
  Object.assign(run.preloadedRiddles![0], {answerLength: 3, evaluation: {answer: "abc", locale: "en"}, hint: {index: 0, letter: "a"}});
  if (!evaluation) {delete run.preloadedRiddles;delete run.currentRiddle!.evaluation;}
  /** Canonical storage compatibility must retain every interior character and its position. */
  const h = harness({}, run.runId);h.respond("raceResume", {run});
  expect(h.session.getSnapshot()).toMatchObject({error: null, raceGuesses: run.currentRiddle!.confirmedGuesses});
});
