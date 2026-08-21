import type {RaceTranslationModelPort} from "../../race/raceTranslationGenerator";
import {
  generateRaceTranslationBundle,
  assertExactTranslationResponseIds,
  raceTranslationDraftHash,
  validateRaceTranslationCheckpoint,
} from "../../race/raceTranslationGenerator";
import reviewedEnglish from "../../../content/race-en-reviewed-v1.json";

const source = reviewedEnglish;

const port = (): RaceTranslationModelPort => ({
  async translate({source: batch}) {
    return batch.map((item) => ({
      canonicalRiddleId: item.canonicalRiddleId,
      text: `日本語の手掛かり ${item.canonicalRiddleId}`,
      answer: item.answer,
    }));
  },
  async critique({source: batch}) {
    return batch.map((item) => ({
      canonicalRiddleId: item.canonicalRiddleId,
      backTranslation: item.text,
      equivalentCanonical: true,
      clueLeak: false,
      prohibitedContent: false,
      categoryMatch: true,
      difficultyMatch: true,
    }));
  },
});

describe("race translation generator", () => {
  it("rejects duplicate or substituted response IDs before persistence", () => {
    expect(() => assertExactTranslationResponseIds(
      [{canonicalRiddleId: "a"}, {canonicalRiddleId: "a"}], ["a", "b"], "translation",
    )).toThrow("translation-canonical-set-mismatch");
    expect(() => assertExactTranslationResponseIds(
      [{canonicalRiddleId: "a"}, {canonicalRiddleId: "c"}], ["a", "b"], "critique",
    )).toThrow("critique-canonical-set-mismatch");
    expect(() => assertExactTranslationResponseIds(
      [{canonicalRiddleId: "b"}, {canonicalRiddleId: "a"}], ["a", "b"], "translation",
    )).not.toThrow();
  });

  it("binds restored critiques to exact translation bytes and known canonical IDs", () => {
    const translation = {
      canonicalRiddleId: source.riddles[0].canonicalRiddleId,
      text: "日本語の手掛かり",
      answer: "答え",
    };
    const critique = {
      canonicalRiddleId: translation.canonicalRiddleId,
      backTranslation: "A Japanese clue",
      equivalentCanonical: true,
      clueLeak: false,
      prohibitedContent: false,
      categoryMatch: true,
      difficultyMatch: true,
    };
    const checkpoint = {
      sourceFileHash: "a".repeat(64),
      translatorModel: "translator-v1",
      criticModel: "critic-v2",
      translations: {[translation.canonicalRiddleId]: translation},
      critiques: {[translation.canonicalRiddleId]: critique},
      critiqueTranslationHashes: {
        [translation.canonicalRiddleId]: raceTranslationDraftHash(translation),
      },
    };
    const expected = {
      sourceFileHash: checkpoint.sourceFileHash,
      translatorModel: checkpoint.translatorModel,
      criticModel: checkpoint.criticModel,
      canonicalRiddleIds: source.riddles.map(({canonicalRiddleId}) => canonicalRiddleId),
    };
    expect(validateRaceTranslationCheckpoint(checkpoint, expected)).toEqual(checkpoint);
    expect(() => validateRaceTranslationCheckpoint({
      ...checkpoint,
      translations: {[translation.canonicalRiddleId]: {...translation, text: "改変された手掛かり"}},
    }, expected)).toThrow("checkpoint-critique-translation-mismatch");
    expect(() => validateRaceTranslationCheckpoint({
      ...checkpoint,
      translations: {...checkpoint.translations, unknown: {...translation, canonicalRiddleId: "unknown"}},
    }, expected)).toThrow("checkpoint-critique-translation-mismatch");
  });

  it("assembles a complete independently critiqued machine-only bundle", async () => {
    const bundle = await generateRaceTranslationBundle({
      locale: "ja",
      source,
      translatorModel: "translator-v1",
      criticModel: "critic-v2",
      port: port(),
      batchSize: 30,
    });
    expect(bundle.riddles).toHaveLength(180);
    expect(bundle.riddles.every((item) => item.qualityVersion === "automated_translation_v1")).toBe(true);
    expect(bundle.riddles.every((item) => item.review.criticModel === "critic-v2")).toBe(true);
  });

  it("rejects same-model review and incomplete canonical responses", async () => {
    await expect(generateRaceTranslationBundle({
      locale: "ja",
      source,
      translatorModel: "same",
      criticModel: "same",
      port: port(),
    })).rejects.toThrow("translation-models-must-be-distinct");
    const incomplete = port();
    incomplete.translate = async ({source: batch}) => batch.slice(1).map((item) => ({
      canonicalRiddleId: item.canonicalRiddleId,
      text: item.text,
      answer: item.answer,
    }));
    await expect(generateRaceTranslationBundle({
      locale: "ja",
      source,
      translatorModel: "translator-v1",
      criticModel: "critic-v2",
      port: incomplete,
    })).rejects.toThrow();
  });

  it("rejects an unsafe translated answer before requesting independent critique", async () => {
    const invalid = port();
    invalid.translate = async ({source: batch}) => batch.map((item, index) => ({
      canonicalRiddleId: item.canonicalRiddleId,
      text: `日本語の手掛かり ${item.canonicalRiddleId}`,
      answer: index === 0 ? "two words" : item.answer,
    }));
    invalid.critique = jest.fn(invalid.critique);
    await expect(generateRaceTranslationBundle({
      locale: "ja",
      source,
      translatorModel: "translator-v1",
      criticModel: "critic-v2",
      port: invalid,
    })).rejects.toThrow("translation-answer-invalid:race:history:01:letters_and_marks_only");
    expect(invalid.critique).not.toHaveBeenCalled();
  });

  it("rejects an invalid reviewed source before spending a model request", async () => {
    const invalidSource = structuredClone(source);
    invalidSource.riddles[1].canonicalRiddleId = invalidSource.riddles[0].canonicalRiddleId;
    const modelPort = port();
    modelPort.translate = jest.fn(modelPort.translate);
    modelPort.critique = jest.fn(modelPort.critique);
    await expect(generateRaceTranslationBundle({
      locale: "ja",
      source: invalidSource,
      translatorModel: "translator-v1",
      criticModel: "critic-v2",
      port: modelPort,
    })).rejects.toThrow("translation-source-invalid:duplicate_canonical");
    expect(modelPort.translate).not.toHaveBeenCalled();
    expect(modelPort.critique).not.toHaveBeenCalled();
  });
});
