import {expect, it} from "@jest/globals";
import {computeFeedback, splitGraphemes} from "@riddle-quest/core/game";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

/** Browser authority fixtures use the same duplicate-aware scoring contract as real race authority. */
it.each(["abbba", "anbbb", "ppppp", "PIANO", "wrong", " piano "])("scores %s with shared positional feedback and stable replay", async guess => {
  /** Fresh deterministic run starts on the piano riddle. */
  const services = createFakeRaceServices();
  /** Public start supplies the authority-selected question and answer for this fixture. */
  const {run} = await services.startRace({locale: "en", categoryId: "mixed", requestId: "feedback-start", includeEvaluation: true});
  /** Same receipt must return its original feedback even if the run advances. */
  const request = {runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess, requestId: "feedback-guess"};
  /** Production scorer supplies the expected duplicate occurrence budget. */
  const expected = computeFeedback(guess.trim(), run.currentRiddle!.evaluation!.answer, run.locale);
  /** Confirmed response remains stable across exact receipt replay. */
  const result = await services.submitRaceGuess(request);
  expect(result.feedback).toEqual(splitGraphemes(guess.trim(), run.locale).map((letter, index) => ({letter, status: expected[index]})));
  expect(await services.submitRaceGuess(request)).toEqual(result);
  expect((await services.resumeRace(run.runId)).run.currentRiddle?.guessesUsed).toBe(result.isCorrect ? 0 : 1);
});

/** Harness answer length is measured in normalized graphemes rather than UTF-16 code units. */
it.each(["😀abcd", "a\u0301bcde"])("accepts five answer slots in %s", async guess => {
  /** Fresh public authority run is independent of other scoring examples. */
  const services = createFakeRaceServices();
  /** The deterministic prompt has five editable grapheme slots. */
  const {run} = await services.startRace({locale: "en", categoryId: "mixed", requestId: "unicode-start"});
  /** One request consumes exactly one attempt and returns one score per normalized slot. */
  const result = await services.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess, requestId: "unicode-guess"});
  expect(result.feedback).toHaveLength(5);
  expect(result.feedback.map(cell => cell.letter)).toEqual(splitGraphemes(guess, run.locale));
  expect(result.run.currentRiddle!.guessesUsed).toBe(1);
});

/** A code-unit length match cannot submit too few answer slots or consume an attempt. */
it("rejects four normalized slots even when the string has five code units", async () => {
  /** Fresh public run supplies the original untouched question. */
  const services = createFakeRaceServices();
  /** Deterministic five-slot authority prompt. */
  const {run} = await services.startRace({locale: "en", categoryId: "mixed", requestId: "short-start"});
  await expect(services.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess: "a\u0301bcd", requestId: "short-guess"})).rejects.toThrow("exactly 5");
  expect((await services.resumeRace(run.runId)).run.currentRiddle!.guessesUsed).toBe(0);
});
