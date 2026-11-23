import {expect, it} from "@jest/globals";
import {RaceConfirmedHistory} from "../logic/raceConfirmedHistory";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

/** Real harness authority supplies a validated current-question fixture with three distinct rows. */
const fixture = async () => {
  /** Independent authority lifetime for each retention scenario. */
  const services = createFakeRaceServices();
  /** Initial server-selected question. */
  let {run} = await services.startRace({locale: "en", categoryId: "mixed", requestId: "history-ledger-start", includeEvaluation: true});
  /** Exact canonical rows, including repeated and distinct wrong guesses. */
  const rows = [];
  for (const [index, guess] of ["abbba", "wrong", "abbba"].entries()) {
    /** Accepted wrong guess consumes its canonical attempt index. */
    const response = await services.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess, requestId: `history-${index}`});
    run = response.run;rows.push({guess: response.feedback.map(cell => cell.letter), feedback: response.feedback.map(cell => cell.status)});
  }
  run.currentRiddle!.confirmedGuesses = rows;
  return run;
};

/** Optional compatible omissions never erase same-question confirmed facts. */
it.each(["omitted", "shortened", "empty"])("retains history after %s metadata", async mode => {
  /** Privately committed authority history. */
  const ledger = new RaceConfirmedHistory(), run = await fixture();
  ledger.accept(run);
  /** A compatible suffix or omission contains no contradictory attempt. */
  const next = structuredClone(run);
  if (mode === "omitted") delete next.currentRiddle!.confirmedGuesses;
  else next.currentRiddle!.confirmedGuesses = mode === "empty" ? [] : next.currentRiddle!.confirmedGuesses!.slice(1);
  expect(ledger.accept(next).currentRiddle!.confirmedGuesses).toEqual(run.currentRiddle!.confirmedGuesses);
});

/** Changed canonical words and scores reject without consuming the previous ledger. */
it.each(["word", "feedback"])("rejects changed %s and accepts the original afterward", async mode => {
  /** Confirmed rows precede the malformed candidate. */
  const ledger = new RaceConfirmedHistory(), run = await fixture();ledger.accept(run);
  /** An otherwise valid response changes one immutable cell. */
  const changed = structuredClone(run);
  if (mode === "word") changed.currentRiddle!.confirmedGuesses![0].guess[1] = "z";
  else changed.currentRiddle!.confirmedGuesses![0].feedback[0] = "red";
  expect(() => ledger.accept(changed)).toThrow("Changed confirmed race history");
  expect(ledger.accept(run)).toEqual(run);
});

/** Unknown new attempts do not shift old rows, and later full history still validates old facts. */
it("keeps earlier facts across an unreported new attempt", async () => {
  /** Canonical first three attempts. */
  const ledger = new RaceConfirmedHistory(), run = await fixture();ledger.accept(run);
  /** A fourth attempt is confirmed without its optional history. */
  const gap = structuredClone(run);gap.currentRiddle!.guessesUsed = 4;gap.currentRiddle!.guessesRemaining = 1;delete gap.currentRiddle!.confirmedGuesses;
  expect(ledger.accept(gap).currentRiddle!.confirmedGuesses).toBeUndefined();
  /** A later full history must still match the earlier first attempt. */
  const full = structuredClone(gap);full.currentRiddle!.confirmedGuesses = [...structuredClone(run.currentRiddle!.confirmedGuesses!), structuredClone(run.currentRiddle!.confirmedGuesses![0])];
  expect(ledger.accept(full).currentRiddle!.confirmedGuesses).toHaveLength(4);
  full.currentRiddle!.confirmedGuesses[0].guess[1] = "z";
  expect(() => ledger.preview(full)).toThrow("Changed confirmed race history");
});

/** Preview and public consumer mutation cannot pin or rewrite private authority facts. */
it("isolates candidate and returned rows and resets across disposal", async () => {
  /** Exact private authority fixture and uncommitted append candidate. */
  const ledger = new RaceConfirmedHistory(), run = await fixture();
  /** Preview never commits facts from a response whose journey may be retired. */
  const preview = ledger.preview(run);preview.currentRiddle!.confirmedGuesses![0].guess[1] = "z";
  /** Commit returns independent rows, so subsequent renderer edits cannot alter retention. */
  const accepted = ledger.accept(run);accepted.currentRiddle!.confirmedGuesses![0].guess[1] = "z";
  expect(ledger.accept(run)).toEqual(run);
  ledger.reset();expect(ledger.accept(preview)).toEqual(preview);
});

/** A genuinely new question starts its own bounded history with no former rows. */
it("does not carry history into a successor question", async () => {
  /** Earlier confirmed question. */
  const ledger = new RaceConfirmedHistory(), run = await fixture();ledger.accept(run);
  /** Successor starts with an untouched attempt counter. */
  const successor = structuredClone(run);successor.currentRiddle!.position++;successor.currentRiddle!.riddleId = "successor";successor.currentRiddle!.guessesUsed = 0;successor.currentRiddle!.guessesRemaining = 5;delete successor.currentRiddle!.confirmedGuesses;
  expect(ledger.accept(successor)).toEqual(successor);
});

/** Equivalent row properties retain their meaning regardless of serialization key order. */
it("accepts equivalent confirmed rows with reordered object keys", async () => {
  /** Committed canonical fixture. */
  const ledger = new RaceConfirmedHistory(), run = await fixture();ledger.accept(run);
  /** A compatible serializer writes feedback before guess without changing any cells. */
  const reordered = structuredClone(run);reordered.currentRiddle!.confirmedGuesses = reordered.currentRiddle!.confirmedGuesses!.map(row => ({feedback: row.feedback, guess: row.guess}));
  expect(ledger.accept(reordered).currentRiddle!.confirmedGuesses).toEqual(run.currentRiddle!.confirmedGuesses);
});

/** Retention remains bounded even when a caller accidentally passes an unvalidated numeric counter. */
it.each([-1, 6, 1.5, NaN, Infinity])("rejects invalid attempt count %s atomically", async guessesUsed => {
  /** Original valid history must survive each malformed candidate. */
  const ledger = new RaceConfirmedHistory(), run = await fixture();ledger.accept(run);
  /** Invalid authority count cannot establish indexes outside the five-attempt ledger. */
  const invalid = structuredClone(run);invalid.currentRiddle!.guessesUsed = guessesUsed;delete invalid.currentRiddle!.confirmedGuesses;
  expect(() => ledger.accept(invalid)).toThrow("Invalid confirmed race history");
  expect(ledger.accept(run)).toEqual(run);
});

/** History equality follows locale casing without accepting genuinely different graphemes. */
it.each([
  {locale: "tr", before: "I", after: "ı", compatible: true},
  {locale: "en", before: "I", after: "ı", compatible: false},
  {locale: "en", before: "A", after: "a", compatible: true},
  {locale: "en", before: "a", after: "á", compatible: false},
] as const)("compares $before and $after using $locale history semantics", async ({locale, before, after, compatible}) => {
  /** Canonical private fact belongs to this locale rather than a global casing rule. */
  const ledger = new RaceConfirmedHistory(), run = await fixture();run.locale = locale;
  run.currentRiddle!.confirmedGuesses![0].guess[0] = before;ledger.accept(run);
  /** Same-index candidate differs by the grapheme under examination only. */
  const next = structuredClone(run);next.currentRiddle!.confirmedGuesses![0].guess[0] = after;
  if (compatible) expect(ledger.accept(next)).toEqual(next);
  else {
    expect(() => ledger.accept(next)).toThrow("Changed confirmed race history");
    expect(ledger.accept(run)).toEqual(run);
  }
});
