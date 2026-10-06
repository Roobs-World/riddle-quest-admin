import {splitGraphemes} from "@qwordly/core/game";
import {RaceRiddlePromptSchema} from "@qwordly/core/race";
import {editRaceInput} from "../../../../packages/portal/src/play/race/logic/raceInput";
import {validateRacePool} from "../../race/raceContentValidation";
import {assertRaceDeckCompatible, assertLiveRaceDeckCompatible} from "../../race/raceDeckCompatibility";
import {applyRaceGuess} from "../../race/raceEngine";
import {liveRun} from "../../race/raceLiveState";
import type {ExistingRaceContentRecord} from "../../race/raceContentMigration";

/** Complete balanced records exercise catalog admission without external models or mutable services. */
const pool = (answer: string): ExistingRaceContentRecord[] => Array.from({length: 30}, (_, index) => ({
  locale: "en", documentPath: `localizedRiddles/en/riddles/input-${index}`,
  data: {riddleId: `input-${index}`, canonicalRiddleId: `history:${index}`, text: `Original clue ${index} follows a distinct trail`,
    answer: index === 0 ? answer : `word${String.fromCharCode(97 + Math.floor(index / 26), 97 + index % 26)}`,
    categoryId: "history", difficultyBand: ["easy", "medium", "hard"][index % 3], raceEligible: true, qualityVersion: "human_review_v1"},
}));
/** Immutable source position preserves the original answer rather than normalized validation output. */
const riddle = (answer: string, position = 0) => ({riddleId: `input-${position}`, canonicalRiddleId: `history:${position}`,
  text: `Original clue ${position} follows a distinct trail`, answer, position});
/** Whitespace-only graphemes are discarded by both committed-text and single-cell edits. */
const spaces = [" ", "\t", "\n", "\r\n", "\u00a0", "\u202f", "\u3000", "\u2009", "\ufeff"];

it.each(spaces)("rejects fresh catalog answers containing an uneditable %s slot", space => {
  /** Actual pool validation must not offer an answer that the actual editor discards. */
  const result = validateRacePool(pool(`a${space}b`), {locale: "en", categoryId: "history"});
  expect(result.valid).toBe(false); expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "missing_metadata"})]));
});

it.each(spaces)("rejects an immutable new opponent source containing an uneditable %s slot", space => {
  /** Both recorded and live new-entry guards must cover the same input shape. */
  const source = riddle(`a${space}b`);
  expect(() => assertRaceDeckCompatible([source], "en")).toThrow(expect.objectContaining({code: "data-loss"}));
  expect(source.answer).toBe(`a${space}b`);
});

it.each(["a-b", "a'b", "a1b", "a😀b", "a👩‍👩‍👧‍👦b", "a\u200bb", "abc", "élément".normalize("NFD"), "लक्ष्म्यां", "a \u0301b"])(
  "preserves and scores supported original input %s without requiring paid hints", answer => {
    /** Nonempty graphemes may contain marks, punctuation, digits or joined emoji. */
    const validation = validateRacePool(pool(answer), {locale: "en", categoryId: "history"});
    expect(validation.valid).toBe(true);
    /** Full live source retains every original answer while requiring complete ordered identities. */
    const source = Array.from({length: 15}, (_, index) => riddle(index === 0 ? answer : "piano", index));
    expect(() => assertRaceDeckCompatible(source, "en")).not.toThrow();
    expect(() => assertLiveRaceDeckCompatible({riddles: source, locale: "en"})).not.toThrow();
    /** Published prompt uses the exact source's NFC slot count. */
    const prompt = RaceRiddlePromptSchema.parse({riddleId: source[0].riddleId, text: source[0].text, answerLength: splitGraphemes(answer).length,
      position: 0, guessesUsed: 0, guessesRemaining: 5, hintAvailable: true, revealedLetters: []});
    /** Actual native edit implementation fills every authored slot using committed text. */
    const input = editRaceInput(prompt, {letters: Array(prompt.answerLength).fill(""), activeSlotIndex: 0}, "text", answer);
    expect(input.letters.every(letter => Boolean(letter))).toBe(true); expect(input.letters.join("")).toBe(answer.normalize("NFC"));
    /** Actual authority scores that editor result with zero hint penalties. */
    const run = liveRun({riddles: source, locale: "en", categoryId: "history"}, "input-owner", "input-run", 1000);
    /** Zero-penalty authority response confirms complete native input, including nonletter controls. */
    const correct = applyRaceGuess(run, {riddleId: prompt.riddleId, guess: input.letters.join("")}, 2000);
    expect(correct.isCorrect).toBe(true); expect(correct.run.hintPenaltyMs).toBe(0); expect(source[0].answer).toBe(answer);
  });
