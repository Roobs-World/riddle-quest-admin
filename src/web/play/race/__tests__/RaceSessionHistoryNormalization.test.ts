import {expect, it} from "@jest/globals";
import {fixture, harness} from "./raceSession.support";

/** Equivalent server spellings of the same confirmed grapheme cannot invalidate a later recovery. */
it.each(["À", "a\u0300"])("accepts normalized history after correlated feedback %s", async echoed => {
  /** One-grapheme question keeps the submitted and confirmed words unambiguous. */
  const run = await fixture();
  Object.assign(run.currentRiddle!, {answerLength: 1, evaluation: {answer: "é", locale: "en"}});
  Object.assign(run.preloadedRiddles![0], {answerLength: 1, evaluation: {answer: "é", locale: "en"}, hint: {index: 0, letter: "é"}});
  /** Public session accepts genuine immutable prompt and local wrong submission. */
  const h = harness({}, run.runId);h.respond("raceResume", {run});h.session.input("text", "à");h.session.submit();
  /** Correlated feedback legitimately differs only in casing or Unicode composition. */
  const confirmed = structuredClone(run);
  confirmed.currentRiddle!.guessesUsed = 1;confirmed.currentRiddle!.guessesRemaining = 4;
  confirmed.currentRiddle!.confirmedGuesses = [{guess: [echoed], feedback: ["red"]}];
  h.respond("raceGuess", {run: confirmed, isCorrect: false, autoSkipped: false, feedback: [{letter: echoed, status: "red"}]});
  expect(h.session.getSnapshot().error).toBeNull();
  /** Later canonical history uses the normalized lowercase spelling of that same word. */
  const resumed = structuredClone(confirmed);
  resumed.currentRiddle!.confirmedGuesses = [{guess: ["à"], feedback: ["red"]}];
  h.session.retry();h.respond("raceResume", {run: resumed});
  expect(h.session.getSnapshot()).toMatchObject({error: null, requiresRunRefresh: false, raceGuesses: [{guess: ["à"], feedback: ["red"]}]});
  expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(1);
});
