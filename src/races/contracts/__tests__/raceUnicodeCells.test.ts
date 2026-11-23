import {splitGraphemes} from "../../../gameplay/input/graphemes";
import {RaceRiddlePromptSchema, RacePreloadedRiddleSchema, RaceLetterFeedbackSchema, RaceConfirmedGuessSchema, RequestRaceHintResponseSchema, SubmitRaceGuessRequestSchema} from "../raceSchemas";
import {UpdateLiveRaceSchema} from "../raceLiveSchemas";

/** Supported Unicode text includes a nine-unit Indic conjunct and a bounded answer expanded by NFC. */
const examples = ["क्ष्म्यां", "a"+"\u0344".repeat(127)];
/** Every public single-cell field must preserve the same emitted normalized grapheme. */
const cellCases = [
  {kind: "hint result", parse: (letter: string) => RequestRaceHintResponseSchema.shape.revealedLetter.safeParse(letter)},
  {kind: "feedback", parse: (letter: string) => RaceLetterFeedbackSchema.safeParse({letter, status: "green"})},
  {kind: "history", parse: (letter: string) => RaceConfirmedGuessSchema.safeParse({guess: [letter], feedback: ["green"]})},
  {kind: "current hint", parse: (letter: string) => RaceRiddlePromptSchema.shape.revealedLetters.element.shape.letter.safeParse(letter)},
  {kind: "preloaded hint", parse: (letter: string) => RacePreloadedRiddleSchema.shape.hint.unwrap().shape.letter.safeParse(letter)},
];
it.each(cellCases.flatMap(item => examples.map(original => ({...item, original}))))("preserves a valid long $kind grapheme", ({parse, original}) => {
  /** The same NFC output is produced by the authoritative engine and native input. */
  const letter = splitGraphemes(original)[0];
  expect(letter.length).toBeGreaterThan(8);expect(parse(letter).success).toBe(true);
});
it.each(["recorded", "live"])("accepts an expanded canonical %s guess without rewriting request bytes", kind => {
  /** Raw authored text remains within the answer contract while its native NFC input exceeds 128 units. */
  const original = examples[1], guess = original.normalize("NFC");
  expect(original).toHaveLength(128);expect(guess.length).toBeGreaterThan(128);
  /** Both transport paths are constrained by the same normalized budget. */
  const result = kind === "recorded" ? SubmitRaceGuessRequestSchema.parse({runId: "cells-run", riddleId: "cells-question", requestId: "cells-command", guess: ` ${guess} `}) : UpdateLiveRaceSchema.parse({ticketId: "a".repeat(64), action: "guess", requestId: "cells-command", riddleId: "cells-question", guess: ` ${guess} `});
  expect(result.guess).toBe(guess);
});
it.each(["recorded", "live"])("rejects %s guesses that expand past the normalized budget", kind => {
  /** Raw units alone fit, but the resulting single cell cannot fit the derived 384-unit output budget. */
  const guess = "a"+"\u0344".repeat(200);
  expect(guess.length).toBeLessThan(384);expect(guess.normalize("NFC").length).toBeGreaterThan(384);
  expect(kind === "recorded" ? SubmitRaceGuessRequestSchema.safeParse({runId: "cells-run", riddleId: "cells-question", requestId: "cells-command", guess}).success : UpdateLiveRaceSchema.safeParse({ticketId: "a".repeat(64), action: "guess", requestId: "cells-command", riddleId: "cells-question", guess}).success).toBe(false);
});
it.each(cellCases)("rejects multiple slots in a $kind cell", ({parse}) => {expect(parse("ab").success).toBe(false);});

it.each(["recorded", "live"])("accepts exactly 384 normalized units in a %s guess", kind => {
  /** A bounded single-grapheme attempt exercises the complete normalized transport capacity. */
  const guess = "b"+"\u0301".repeat(383);
  expect(guess.normalize("NFC")).toHaveLength(384);
  expect(kind === "recorded" ? SubmitRaceGuessRequestSchema.safeParse({runId: "cells-run", riddleId: "cells-question", requestId: "cells-command", guess}).success : UpdateLiveRaceSchema.safeParse({ticketId: "a".repeat(64), action: "guess", requestId: "cells-command", riddleId: "cells-question", guess}).success).toBe(true);
});
it.each(["recorded", "live"])("rejects a raw oversized %s guess before normalization", kind => {
  /** The earlier validation-work regression must remain true at the derived transport budget. */
  const normalize = jest.spyOn(String.prototype, "normalize");
  try {
    /** This source is just outside the derived 384-unit raw input limit. */
    const guess = "b"+"\u0301".repeat(384);
    expect(kind === "recorded" ? SubmitRaceGuessRequestSchema.safeParse({runId: "cells-run", riddleId: "cells-question", requestId: "cells-command", guess}).success : UpdateLiveRaceSchema.safeParse({ticketId: "a".repeat(64), action: "guess", requestId: "cells-command", riddleId: "cells-question", guess}).success).toBe(false);
    expect(normalize).not.toHaveBeenCalled();
  } finally {normalize.mockRestore();}
});
