import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {performance} from "node:perf_hooks";
import {validateRacePool} from "../../race/content/raceContentValidation";
import type {ExistingRaceContentRecord} from "../../race/content/raceContentMigration";

/** Balanced complete source fixtures exercise actual fresh catalog validation. */
const pool = (answer: string): ExistingRaceContentRecord[] => Array.from({length: 30}, (_, index) => ({locale: "en",
  documentPath: `localizedRiddles/en/riddles/work-${index}`, data: {riddleId: `work-${index}`, canonicalRiddleId: `history:${index}`,
    text: `Original clue ${index} follows its distinct trail`, answer: index === 0 ? answer : `word${String.fromCharCode(97+Math.floor(index/26), 97+index%26)}`,
    categoryId: "history", difficultyBand: ["easy", "medium", "hard"][index%3], raceEligible: true, qualityVersion: "human_review_v1"},
}));
/** Raw source limits must precede costly Unicode duplicate/leak processing. */
const oversized = [{name: "minimum", answer: "x".repeat(129)}, {name: "fullwidth", answer: "Ａ".repeat(200000)},
  {name: "combining", answer: "a\u0301".repeat(100000)}, {name: "joined-emoji", answer: "👩‍👩‍👧‍👦".repeat(10000)}];
it.each(oversized)("bounds answer Unicode work before rejecting $name", ({name, answer}) => {
  /** Real Unicode calls are observed, never stubbed to hide their work or change comparisons. */
  const records = pool(answer), original = String.prototype.normalize, calls: {
    /** Original normalization input length in UTF-16 units. */ units: number;
    /** Actual normalization form passed to ICU. */ form: string | undefined;
    /** Identifies processing of the unchanged oversized answer. */ answerInput: boolean;
    /** Owned source call sites distinguish duplicate processing from leak processing. */ site: string[];
  }[] = [];
  /** Prototype observation reaches cached real segmenters while preserving their results. */
  const originalSegment = Intl.Segmenter.prototype.segment, segments: number[] = [];
  /** Each segmentation still executes the actual ICU implementation. */
  const segmentSpy = jest.spyOn(Intl.Segmenter.prototype, "segment").mockImplementation(function(this: Intl.Segmenter, input: string) {segments.push(input.length);return originalSegment.call(this, input);});
  /** One bounded fixture can otherwise trigger repeated processing of a storage-sized invalid answer. */
  const spy = jest.spyOn(String.prototype, "normalize").mockImplementation(function(this: string, form?: string) {
    /** Only dimensions and provenance are retained; source answer bytes do not enter traces. */
    const value = String(this);calls.push({units: value.length, form, answerInput: value === answer, site: value === answer ? (new Error().stack ?? "").split("\n").slice(2, 6) : []});return original.call(value, form);
  });
  /** The trace records the actual rejecting validator and an exact deterministic work count. */
  let result;
  try {result = validateRacePool(records, {locale: "en", categoryId: "history"});} finally {spy.mockRestore();segmentSpy.mockRestore();}
  /** Uninstrumented repeated timings are diagnostic, not a platform-independent test threshold. */
  const samples: number[] = [];
  for (let index=0; index<23; index++) {
    /** Every sample reaches the same real balanced-pool validator without spies or remote storage. */
    const start = performance.now();validateRacePool(records, {locale: "en", categoryId: "history"});if (index>=3) samples.push(performance.now()-start);
  }
  /** Optional owned baseline/fixed captures include the complete diagnostic result and work dimensions. */
  const directory = process.env.RACE_CATALOG_WORK_TRACE;
  if (directory) {mkdirSync(directory, {recursive: true});writeFileSync(join(directory, `${name}.json`), JSON.stringify({name,
    answerUnits: answer.length, answerBytes: Buffer.byteLength(answer), result, normalizationCalls: calls, segmentationInputUnits: segments,
    answerNormalizationCalls: calls.filter(call => call.answerInput).length,
    answerNormalizationUnits: calls.filter(call => call.answerInput).reduce((sum, call) => sum+call.units, 0), samples}, null, 2));}
  expect(result.valid).toBe(false);expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "answer_too_long", documentPaths: [records[0].documentPath]})]));
  expect(result.eligibleCount).toBe(30);expect(result.difficultyCounts).toEqual({easy: 10, medium: 10, hard: 10});expect(records[0].data.answer).toBe(answer);
  expect(segments.every(units => units <= 128)).toBe(true);expect(calls.filter(call => call.answerInput)).toEqual([]);
});

/** Supported boundary and input examples retain byte-exact admission and comparison semantics. */
it.each(["piano", "élément".normalize("NFD"), "लक्ष्म्यां", "a-b", "a'b", "a1b", "a😀b", "a👩‍👩‍👧‍👦b", "a\u200bb", "a"+"\u0301".repeat(127)])(
  "keeps bounded supported answer %s eligible without rewriting source", answer => {
    /** Actual validation accepts the same original bytes used by runtime deck construction. */
    const records = pool(answer), result = validateRacePool(records, {locale: "en", categoryId: "history"});
    expect(result.valid).toBe(true);expect(result.issues).toEqual([]);expect(records[0].data.answer).toBe(answer);
  });
/** Bounded duplicate and leak checks remain active for valid and slot-oversized answers. */
it.each(["ＰＩＡＮＯ", "eight888"])("keeps bounded normalized duplicate and clue-leak diagnostics for %s", answer => {
  /** Identical source meaning may have compatibility/case differences but still needs authoring diagnostics. */
  const records = pool(answer);records[1].data.answer = answer.normalize("NFKC").toLowerCase();records[0].data.text = `The answer is ${answer}`;
  /** Slot-oversized bounded answers still receive every useful Unicode diagnostic. */
  const result = validateRacePool(records, {locale: "en", categoryId: "history"});
  expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "duplicate_answer"}), expect.objectContaining({code: "clue_leaks_answer"})]));
  if (answer === "eight888") expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "answer_too_long"})]));
});

it("retains clue, identity, translation and balance diagnostics alongside raw oversized answers", () => {
  /** Oversized answer rejection must not bypass unrelated whole-pool authoring diagnostics. */
  const records = pool("Ａ".repeat(200000));records[1].data.text = records[0].data.text;records[1].data.canonicalRiddleId = records[0].data.canonicalRiddleId;
  /** Independent content facts still produce their original diagnostics and difficulty counts. */
  const result = validateRacePool(records, {locale: "en", categoryId: "history", requiredLocales: ["en", "fr"]});
  expect(result.valid).toBe(false);expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "duplicate_question"}),
    expect.objectContaining({code: "duplicate_canonical"}), expect.objectContaining({code: "missing_translation"}), expect.objectContaining({code: "answer_too_long"})]));
  expect(result.difficultyCounts).toEqual({easy: 10, medium: 10, hard: 10});expect(records[0].data.answer).toBe("Ａ".repeat(200000));
});
