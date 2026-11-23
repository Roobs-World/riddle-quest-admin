import type {RaceLocale} from "../../../../src/races/contracts/index.js";
import {assertRaceDeckCompatible} from "../../race/runs/raceDeckCompatibility";
import type {RaceRiddleSnapshot} from "../../race/runs/raceEngine";

/** Original frozen content isolates answer validation from identity, clue and position constraints. */
const riddle: RaceRiddleSnapshot = {
  riddleId: "bounded-work-question", canonicalRiddleId: "history:bounded-work-question",
  text: "Which original concept follows this clue?", answer: "origin", position: 0,
};

it.each([4096, 129])("rejects a %i-unit archived answer before normalizing its source bytes", units => {
  /** Exact excessive source distinguishes bounded rejection from a complete Unicode traversal. */
  const answer = "a".repeat(units);
  /** Instrumentation observes the production normalization path without replacing the helper. */
  const normalize = jest.spyOn(String.prototype, "normalize");
  try {
    expect(() => assertRaceDeckCompatible([{...riddle, answer}], "en"))
      .toThrow(expect.objectContaining({code: "data-loss"}));
    expect(normalize.mock.contexts.map(value => String(value))).not.toContain(answer);
  } finally {normalize.mockRestore();}
});

it("classifies a non-string archived answer as structured data loss", () => {
  /** Persisted malformed content crosses the typed storage boundary without a gameplay normalization call. */
  const malformed = {...riddle, answer: 42} as unknown as RaceRiddleSnapshot;
  expect(() => assertRaceDeckCompatible([malformed], "en"))
    .toThrow(expect.objectContaining({code: "data-loss"}));
});

it("classifies an invalid archived locale as structured data loss", () => {
  /** Invalid persisted locale must be rejected before Intl.Segmenter receives it. */
  const malformedLocale = "invalid_locale" as RaceLocale;
  expect(() => assertRaceDeckCompatible([riddle], malformedLocale))
    .toThrow(expect.objectContaining({code: "data-loss"}));
});

it("retains valid original decomposed answer bytes", () => {
  /** Seven user-perceived French letters occupy nine original UTF-16 units. */
  const answer = "élément".normalize("NFD");
  /** Authoritative frozen source survives validation without trimming or canonical rewriting. */
  const original = [{...riddle, answer}];
  expect(answer).toHaveLength(9);
  expect(() => assertRaceDeckCompatible(original, "fr")).not.toThrow();
  expect(original).toEqual([{...riddle, answer}]);
  expect(original[0].answer).not.toBe(answer.normalize("NFC"));
});
