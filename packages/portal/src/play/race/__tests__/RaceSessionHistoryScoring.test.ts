import {expect, it} from "@jest/globals";
import {computeFeedback} from "@riddle-quest/core/game";
import {fixture, harness} from "./raceSession.support";

/** Restored colors must agree with immutable evaluation when that answer is actually available. */
it.each(["prompt", "deck", "retained", "answer-free"].flatMap(source => [false, true].map(corrupt => ({source, corrupt}))))("validates duplicate-letter history from $source, corrupt=$corrupt", async ({source, corrupt}) => {
  /** Full authority fixture provides a single-a answer for duplicate-letter scoring. */
  const original = await fixture();
  /** Cold or warm recovery uses the same public session boundary. */
  const h = harness({}, original.runId);
  if (source === "retained") {h.respond("raceResume", {run: original});h.session.input("text", "pi");h.session.retry();}
  /** Newly observed canonical row has no prior private row to compare. */
  const run = structuredClone(original);
  run.currentRiddle!.guessesUsed = 1;run.currentRiddle!.guessesRemaining = 4;
  /** Shared scoring consumes the answer's one a only once. */
  const row = {guess: [..."abbba"], feedback: computeFeedback("abbba", "piano", "en")};
  if (corrupt) row.feedback[4] = "yellow";
  run.currentRiddle!.confirmedGuesses = [row];
  if (source !== "deck") delete run.preloadedRiddles;
  if (source !== "prompt") delete run.currentRiddle!.evaluation;
  h.respond("raceResume", {run});
  /** Answer-free contracts retain server-authoritative colors without inventing an answer. */
  const rejected = corrupt && source !== "answer-free";
  expect(h.session.getSnapshot().error).toBe(rejected ? "RaceTo10.ERROR_INVALID_RESPONSE" : null);
  if (rejected) {
    expect(h.session.getSnapshot().raceGuesses).toEqual([]);
    if (source === "retained") expect(h.session.getSnapshot()).toMatchObject({currentLetters: ["p", "i", "", "", ""], run: {currentRiddle: {guessesUsed: 0}}});
    else expect(h.session.getSnapshot().run).toBeNull();
    /** A valid later response remains recoverable because rejected colors never become private facts. */
    run.currentRiddle!.confirmedGuesses![0].feedback = computeFeedback("abbba", "piano", "en");
    h.session.retry();h.respond("raceResume", {run});
    expect(h.session.getSnapshot()).toMatchObject({error: null, raceGuesses: run.currentRiddle!.confirmedGuesses});
  }
});
