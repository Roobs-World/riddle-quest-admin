import {expect, it} from "@jest/globals";
import {fixture, harness, racing} from "./raceSession.support.ts";

/** A solved historical attempt cannot remain attached to the same still-editable question. */
it.each([true, false])("rejects solved current-question history with evaluation=%s", async evaluation => {
  /** Server-shaped cold snapshot exposes a solved row without its mandatory question transition. */
  const run = await fixture();
  run.currentRiddle!.guessesUsed = 1;run.currentRiddle!.guessesRemaining = 4;
  run.currentRiddle!.confirmedGuesses = [{guess: [..."piano"], feedback: Array<"green">(5).fill("green")}];
  if (!evaluation) {delete run.preloadedRiddles;delete run.currentRiddle!.evaluation;}
  /** No private prior history is required to recognize the impossible progression. */
  const h = harness({}, run.runId);h.respond("raceResume", {run});
  expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: null, raceGuesses: []});
});

/** Wrong current-question history remains valid for both modern and answer-free contracts. */
it.each([true, false])("accepts unsolved current-question history with evaluation=%s", async evaluation => {
  /** A fully red wrong answer legitimately remains on the same question. */
  const run = await fixture();
  run.currentRiddle!.guessesUsed = 1;run.currentRiddle!.guessesRemaining = 4;
  run.currentRiddle!.confirmedGuesses = [{guess: [..."zzzzz"], feedback: Array<"red">(5).fill("red")}];
  if (!evaluation) {delete run.preloadedRiddles;delete run.currentRiddle!.evaluation;}
  /** Structural progression validation must not require an answer key. */
  const h = harness({}, run.runId);h.respond("raceResume", {run});
  expect(h.session.getSnapshot()).toMatchObject({error: null, raceGuesses: run.currentRiddle!.confirmedGuesses});
});

/** Impossible newly observed history rejects before consuming a pending paid checkpoint. */
it.each([true, false])("validates concurrent history before Hint confirmation, solved=%s", async solved => {
  /** Current owned question and unsent draft precede one pending local Hint. */
  const h = await racing();h.session.input("text", "pi");h.session.hint();
  /** Another tab consumes a real wrong attempt before the Hint transaction. */
  const guess = await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "zzzzz", requestId: "other-wrong"});
  /** Exact authority charge otherwise validates independently of optional history. */
  const result = await h.authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "local-hint"});
  result.run.currentRiddle!.confirmedGuesses = [{guess: guess.feedback.map(cell => cell.letter), feedback: guess.feedback.map(cell => solved ? "green" : cell.status)}];
  h.respond("raceHint", result);
  if (solved) expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", requiresRunRefresh: true, currentLetters: ["p", "i", "", "", ""], raceGuesses: [], run: {totalPenaltyMs: 0, currentRiddle: {guessesUsed: 0}}});
  else expect(h.session.getSnapshot()).toMatchObject({error: null, run: {totalPenaltyMs: 15000, currentRiddle: {guessesUsed: 1}}});
  expect(h.commands.filter(command => command.type === "game:requestRaceHint")).toHaveLength(1);
});
