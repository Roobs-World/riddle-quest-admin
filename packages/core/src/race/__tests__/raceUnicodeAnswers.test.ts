import {graphemeLength} from "../../game/graphemes";
import {RaceRiddlePromptSchema, RacePreloadedRiddleSchema, SubmitRaceGuessRequestSchema} from "../raceSchemas";

/** Public prompt fields isolate Unicode answer validation from clocks and race lifecycle checks. */
const prompt = {riddleId: "unicode-question", text: "A localized clue", position: 0, guessesUsed: 0, guessesRemaining: 5, hintAvailable: true, revealedLetters: []};
/** Authored Unicode examples include decomposed accents and multi-code-point Indic graphemes. */
const cases = [{locale: "fr", answer: "élément".normalize("NFD")}, {locale: "ru", answer: "майонез".normalize("NFD")},
  {locale: "ja", answer: "ざざざざざざざ".normalize("NFD")}, {locale: "hi", answer: "महाराष्ट्र"}] as const;
it.each(cases)("keeps $locale Unicode answers playable without changing their stored text", ({locale, answer}) => {
  /** Slot count follows the same NFC segmentation as scoring and catalog validation. */
  const answerLength = graphemeLength(answer, locale), evaluation = {answer, locale};
  expect(answer.length).toBeGreaterThan(7); expect(answerLength).toBeLessThanOrEqual(7);
  expect(RaceRiddlePromptSchema.parse({...prompt, answerLength, evaluation}).evaluation).toEqual(evaluation);
  expect(RacePreloadedRiddleSchema.parse({riddleId: prompt.riddleId, text: prompt.text, position: 0, answerLength, evaluation}).evaluation).toEqual(evaluation);
  expect(SubmitRaceGuessRequestSchema.parse({runId: "unicode-run", riddleId: prompt.riddleId, requestId: "unicode-guess", guess: answer}).guess).toBe(answer);
});
it.each(["abcdefgh", "é".repeat(8).normalize("NFD"), "a"+"\u0301".repeat(128), "", 42, null, undefined])("rejects invalid or oversized Unicode answer input", answer => {
  expect(RaceRiddlePromptSchema.safeParse({...prompt, answerLength: 7, evaluation: {answer, locale: "fr"}}).success).toBe(false);
  expect(RacePreloadedRiddleSchema.safeParse({riddleId: prompt.riddleId, text: prompt.text, position: 0, answerLength: 7, evaluation: {answer, locale: "fr"}}).success).toBe(false);
  expect(SubmitRaceGuessRequestSchema.safeParse({runId: "unicode-run", riddleId: prompt.riddleId, requestId: "unicode-guess", guess: typeof answer === "string" && answer.length === 129 ? "a"+"\u0301".repeat(384) : answer}).success).toBe(false);
});
it("retains trim-before-validation semantics for a decomposed guess", () => {
  expect(SubmitRaceGuessRequestSchema.parse({runId: "unicode-run", riddleId: prompt.riddleId, requestId: "unicode-guess", guess: ` ${cases[0].answer} `}).guess).toBe(cases[0].answer);
});
it("retains the seven-slot ASCII boundary", () => {
  expect(SubmitRaceGuessRequestSchema.safeParse({runId: "unicode-run", riddleId: prompt.riddleId, requestId: "unicode-guess", guess: "abcdefg"}).success).toBe(true);
});
